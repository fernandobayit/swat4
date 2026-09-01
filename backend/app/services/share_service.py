import re
import os
import logging
from typing import Optional, Dict, List
from app.config import settings

logger = logging.getLogger(__name__)

SMB_CONF_PATH = "/etc/samba/smb.conf"
BUILTIN_SHARES = {"sysvol", "netlogon", "IPC$", "print$"}


def parse_smb_conf() -> Dict[str, Dict[str, str]]:
    """Parse smb.conf into sections with key-value pairs."""
    if not os.path.exists(SMB_CONF_PATH):
        logger.warning(f"smb.conf not found at {SMB_CONF_PATH}")
        return {}
    
    sections = {}
    current_section = None
    
    with open(SMB_CONF_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith(";"):
                continue
            
            match = re.match(r"\[(.+)\]", line)
            if match:
                current_section = match.group(1)
                sections[current_section] = {}
                continue
            
            if current_section and "=" in line:
                key, _, value = line.partition("=")
                sections[current_section][key.strip()] = value.strip()
    
    return sections


def list_shares() -> List[Dict]:
    """List all shares (excluding built-in)."""
    sections = parse_smb_conf()
    shares = []
    
    for name, config in sections.items():
        if name.lower() in {"global"} or name.lower() in {s.lower() for s in BUILTIN_SHARES}:
            continue
        
        shares.append({
            "name": name,
            "path": config.get("path", ""),
            "comment": config.get("comment", ""),
            "veto_files": config.get("veto files", ""),
            "write_list": config.get("write list", ""),
        })
    
    return shares


def get_share(name: str) -> Optional[Dict]:
    """Get a single share by name."""
    sections = parse_smb_conf()
    config = sections.get(name)
    
    if config is None:
        return None
    
    return {
        "name": name,
        "path": config.get("path", ""),
        "comment": config.get("comment", ""),
        "veto_files": config.get("veto files", ""),
        "write_list": config.get("write list", ""),
    }


def add_share(name: str, config: Dict[str, str]) -> None:
    """Add a new share to smb.conf and setup security."""
    from app.services.samba_tool import create_group, get_group_sid
    import subprocess
    import time
    
    sections = parse_smb_conf()
    
    if name in sections:
        raise ValueError(f"Share '{name}' already exists")
    
    # 1. Force the path
    share_path = f"/mnt/data/Corporativo/{name}"
    config["path"] = share_path
    
    # 2. Create local directory
    os.makedirs(share_path, exist_ok=True)
    
    # 3. Create groups
    write_group = f"Acesso Escrita {name}"
    read_group = f"Acesso Leitura {name}"
    
    try:
        create_group(write_group, f"Acesso de Escrita para {name}", "", "Security")
    except Exception as e:
        logger.warning(f"Failed to create group {write_group}, might exist: {e}")
        
    try:
        create_group(read_group, f"Acesso de Leitura para {name}", "", "Security")
    except Exception as e:
        logger.warning(f"Failed to create group {read_group}, might exist: {e}")

    # 4. Write to smb.conf
    with open(SMB_CONF_PATH, "a") as f:
        f.write(f"\n[{name}]\n")
        for key, value in config.items():
            if value is not None and value != "":
                f.write(f"   {key} = {value}\n")
    
    # Reload samba conf locally (might not trigger smbd if not sharing process, but good practice)
    _reload_samba()
    
    # Give smbd a moment to realize conf has changed
    time.sleep(1.5)
    
    # 5. Apply ACL
    sid_write = get_group_sid(write_group)
    sid_read = get_group_sid(read_group)
    
    if sid_write and sid_read:
        # Administrators get Full Control, Write gets Modify, Read gets Read. All inherit down.
        sddl = f"O:BAG:BAD:PAI(A;OICI;0x001f01ff;;;BA)(A;OICI;0x001301bf;;;{sid_write})(A;OICI;0x001200a9;;;{sid_read})"
        
        from app.config import settings
        admin_user = settings.samba_admin_user
        admin_pass = settings.samba_admin_password
        dc_ip = settings.samba_dc_host

        cmd = [
            "smbcacls", f"//{dc_ip}/{name}", "/",
            "-U", f"{admin_user}%{admin_pass}",
            "--sddl", "--set", sddl
        ]
        
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if res.returncode != 0:
                logger.error(f"smbcacls failed: {res.stderr} {res.stdout}")
        except Exception as e:
            logger.error(f"smbcacls exception: {e}")


def update_share(name: str, config: Dict[str, str]) -> None:
    """Update an existing share in smb.conf."""
    sections = parse_smb_conf()
    
    if name not in sections:
        raise ValueError(f"Share '{name}' not found")
    
    # Read file, replace section
    with open(SMB_CONF_PATH, "r") as f:
        content = f.read()
    
    # Build new section
    new_section = f"[{name}]\n"
    merged = {**sections[name], **{k: v for k, v in config.items() if v is not None}}
    for key, value in merged.items():
        if value is not None and value != "":
            new_section += f"   {key} = {value}\n"
    
    # Replace old section
    pattern = rf"\[{re.escape(name)}\][^\[]*"
    content = re.sub(pattern, new_section, content)
    
    with open(SMB_CONF_PATH, "w") as f:
        f.write(content)
    
    _reload_samba()


def delete_share(name: str) -> None:
    """Delete a share from smb.conf."""
    if name.lower() in {s.lower() for s in BUILTIN_SHARES}:
        raise ValueError(f"Cannot delete built-in share '{name}'")
    
    with open(SMB_CONF_PATH, "r") as f:
        content = f.read()
    
    pattern = rf"\[{re.escape(name)}\][^\[]*"
    content = re.sub(pattern, "", content)
    
    with open(SMB_CONF_PATH, "w") as f:
        f.write(content)
        
    share_path = f"/mnt/data/Corporativo/{name}"
    if os.path.exists(share_path):
        import shutil
        try:
            shutil.rmtree(share_path)
            logger.info(f"Deleted physical directory {share_path}")
        except Exception as e:
            logger.error(f"Failed to delete directory {share_path}: {e}")
            
    from app.services.samba_tool import delete_group
    write_group = f"Acesso Escrita {name}"
    read_group = f"Acesso Leitura {name}"
    try:
        delete_group(write_group)
    except Exception as e:
        logger.warning(f"Could not delete group {write_group}: {e}")
    try:
        delete_group(read_group)
    except Exception as e:
        logger.warning(f"Could not delete group {read_group}: {e}")
    
    _reload_samba()


def _reload_samba():
    """Reload samba configuration."""
    import subprocess
    try:
        subprocess.run(
            ["smbcontrol", "all", "reload-config"],
            capture_output=True, text=True, timeout=10
        )
    except Exception as e:
        logger.warning(f"Could not reload samba config: {e}")
