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
    """Add a new share (Domain Admins only; sem grupos por compartilhamento)."""
    import subprocess
    import time

    sections = parse_smb_conf()

    if name in sections:
        raise ValueError(f"Share '{name}' already exists")

    # 1. Force the path (raiz dos compartilhamentos: /mnt/data/)
    share_path = f"/mnt/data/{name}"
    config["path"] = share_path

    # 2. Create local directory
    os.makedirs(share_path, exist_ok=True)

    # 3. Write to smb.conf
    with open(SMB_CONF_PATH, "a") as f:
        f.write(f"\n[{name}]\n")
        for key, value in config.items():
            if value is not None and value != "":
                f.write(f"   {key} = {value}\n")

    # Reload samba conf locally
    _reload_samba()

    # Give smbd a moment to realize conf has changed
    time.sleep(1.5)

    # 4. SDDL padrao: apenas Administrators (BA) Full Control com heranca
    sddl = "O:BAG:BAD:PAI(A;OICI;0x001f01ff;;;BA)"
    _apply_sddl(name, "", sddl)


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
    """Delete a share from smb.conf; subpastas e grupos vao em cascata."""
    if name.lower() in {s.lower() for s in BUILTIN_SHARES}:
        raise ValueError(f"Cannot delete built-in share '{name}'")

    from app.database import list_share_folders, delete_share_folder_row

    # 0. Cascata: subpastas registradas (grupos + pasta + registro)
    for row in list_share_folders(name):
        _delete_folder_artifacts(name, row["folder"])
        delete_share_folder_row(name, row["folder"])

    with open(SMB_CONF_PATH, "r") as f:
        content = f.read()

    pattern = rf"\[{re.escape(name)}\][^\[]*"
    content = re.sub(pattern, "", content)

    with open(SMB_CONF_PATH, "w") as f:
        f.write(content)

    share_path = f"/mnt/data/{name}"
    if os.path.exists(share_path):
        import shutil
        try:
            shutil.rmtree(share_path)
            logger.info(f"Deleted physical directory {share_path}")
        except Exception as e:
            logger.error(f"Failed to delete directory {share_path}: {e}")

    _reload_samba()


def _apply_sddl(share: str, relative_path: str, sddl: str) -> None:
    """Aplica SDDL via smbcacls em um caminho relativo de um compartilhamento."""
    import subprocess
    from app.config import settings

    target = relative_path if relative_path else "/"
    cmd = [
        "smbcacls", f"//{settings.samba_dc_host}/{share}", target,
        "-U", f"{settings.samba_admin_user}%{settings.samba_admin_password}",
        "--sddl", "--set", sddl,
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if res.returncode != 0:
            logger.error(f"smbcacls failed ({share}/{relative_path}): {res.stderr} {res.stdout}")
    except Exception as e:
        logger.error(f"smbcacls exception ({share}/{relative_path}): {e}")


def _delete_folder_artifacts(share: str, folder: str) -> None:
    """Apaga grupos e pasta fisica de uma subpasta (sem tocar o registro)."""
    import shutil
    from app.services.samba_tool import delete_group

    for group in (f"Acesso Escrita {folder}", f"Acesso Leitura {folder}"):
        try:
            delete_group(group)
        except Exception as e:
            logger.warning(f"Could not delete group {group}: {e}")

    folder_path = f"/mnt/data/{share}/{folder}"
    if os.path.exists(folder_path):
        try:
            shutil.rmtree(folder_path)
            logger.info(f"Deleted folder directory {folder_path}")
        except Exception as e:
            logger.error(f"Failed to delete directory {folder_path}: {e}")


def add_share_folder(share: str, folder: str, created_by: str) -> None:
    """Cria subpasta nivel 1 com grupos proprios (Acesso Escrita/Leitura {folder})."""
    from app.services.samba_tool import create_group, get_group_sid
    from app.database import add_share_folder_row as register_row
    from app.database import list_share_folders
    import time

    folder = (folder or "").strip().strip("\\").strip("/")

    if not folder or "/" in folder or "\\" in folder:
        raise ValueError("Folder name must be a single level (sem barras)")
    if folder.lower() in {b.lower() for b in BUILTIN_SHARES}:
        raise ValueError(f"Cannot use reserved name '{folder}'")
    if get_share(share) is None:
        raise ValueError(f"Share '{share}' not found")

    existing = [r["folder"] for r in list_share_folders(share)]
    if folder in existing:
        raise ValueError(f"Folder '{folder}' already registered in share '{share}'")

    # Grupos da subpasta (nomes exatos conforme diretiva)
    write_group = f"Acesso Escrita {folder}"
    read_group = f"Acesso Leitura {folder}"
    specs = (
        (write_group, f"Acesso de Escrita para subpasta {folder} do share {share}"),
        (read_group, f"Acesso de Leitura para subpasta {folder} do share {share}"),
    )
    for group, desc in specs:
        try:
            create_group(group, desc, "", "Security")
        except Exception as e:
            logger.warning(f"Failed to create group {group}, might exist: {e}")

    # Pasta fisica
    folder_path = f"/mnt/data/{share}/{folder}"
    os.makedirs(folder_path, exist_ok=True)

    # Reconhecer nova pasta/grupos no smbd antes de aplicar ACL
    _reload_samba()
    time.sleep(1.5)

    # SDDL da diretiva padrao aplicado na subpasta (heranca OICI)
    sid_write = get_group_sid(write_group)
    sid_read = get_group_sid(read_group)
    sddl = "O:BAG:BAD:PAI(A;OICI;0x001f01ff;;;BA)"
    if sid_write and sid_read:
        sddl = (
            "O:BAG:BAD:PAI(A;OICI;0x001f01ff;;;BA)"
            f"(A;OICI;0x001301bf;;;{sid_write})"
            f"(A;OICI;0x001200a9;;;{sid_read})"
        )
    _apply_sddl(share, folder, sddl)

    register_row(share, folder, created_by)


def delete_share_folder(share: str, folder: str) -> None:
    """Exclui subpasta nivel 1: pasta, grupos e registro."""
    from app.database import list_share_folders, delete_share_folder_row

    existing = [r["folder"] for r in list_share_folders(share)]
    if folder not in existing:
        raise ValueError(f"Folder '{folder}' not found in share '{share}'")

    _delete_folder_artifacts(share, folder)
    delete_share_folder_row(share, folder)
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
