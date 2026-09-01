"""
DNS operations using samba-tool dns via subprocess.
Provides listing, creating, and deleting DNS zones and records.
"""
import subprocess
import logging
import socket
from typing import List, Dict, Any
from app.config import settings
from app.exceptions import SambaToolError

logger = logging.getLogger(__name__)

def run_samba_dns_cmd(*args: str) -> str:
    """Helper to run samba-tool dns commands."""
    try:
        # Resolve hostname to IP to prevent samba-tool DCE-RPC SPN timeouts
        dc_ip = socket.gethostbyname(settings.samba_dc_host)
    except Exception:
        dc_ip = settings.samba_dc_host

    subcommand = args[0]
    rest_args = list(args)[1:]

    cmd = [
        "samba-tool", "dns", subcommand, dc_ip, *rest_args,
        "-U", settings.samba_admin_user,
        f"--password={settings.samba_admin_password}"
    ]
    
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, check=True, timeout=15
        )
        return result.stdout
    except subprocess.TimeoutExpired as e:
        logger.error(f"samba-tool dns timed out: {e.cmd}")
        raise SambaToolError("DNS Operation timed out")
    except subprocess.CalledProcessError as e:
        logger.error(f"samba-tool dns failed: {e.cmd} | stderr: {e.stderr}")
        raise SambaToolError(f"DNS Operation Failed: {e.stderr.strip() or e.stdout.strip()}")


def list_zones() -> List[Dict[str, Any]]:
    """List all DNS zones."""
    try:
        stdout = run_samba_dns_cmd("zonelist")
        # Parse the output
        zones = []
        # samba-tool dns zonelist outputs like:
        #   2 zone(s) found
        # 
        #   pszZoneName                 : swat.local
        #   Flags                       : 0x0...
        #   ZoneType                    : ...
        
        current_zone: Dict[str, Any] = {}
        for line in stdout.splitlines():
            line = line.strip()
            if line.startswith("pszZoneName"):
                if current_zone:
                    zones.append(current_zone)
                current_zone = {"name": line.split(":", 1)[1].strip()}
            elif line.startswith("ZoneType") and current_zone:
                current_zone["type"] = line.split(":", 1)[1].strip()
            # Determine record count via query if needed, but zonelist doesn't provide it
        
        if current_zone:
            zones.append(current_zone)
        
        # Hydrate with record count (optional but good for UI)
        for z in zones:
            z["recordsCount"] = len(list_records(z["name"]))
            
        return zones
    except SambaToolError as e:
        logger.error(f"Failed to list zones: {e}")
        return []

def create_zone(zone_name: str) -> str:
    """Create a new DNS zone."""
    output = run_samba_dns_cmd("zonecreate", zone_name)
    return output

def delete_zone(zone_name: str) -> str:
    """Delete a DNS zone."""
    output = run_samba_dns_cmd("zonedelete", zone_name)
    return output

def list_records(zone_name: str) -> List[Dict[str, Any]]:
    """List all DNS records in a zone."""
    try:
        stdout = run_samba_dns_cmd("query", zone_name, "@", "ALL")
        records = []
        # samba-tool dns query outputs like:
        #   Name=dc1, Records=1, Children=0
        #     A: 172.20.0.10 (flags=f0, serial=1, ttl=900)
        
        current_node = ""
        for line in stdout.splitlines():
            if not line.strip():
                continue
            
            # Skip warnings
            if line.startswith("WARNING:"):
                continue

            # This is a new node
            if line.startswith("  Name="):
                parts = {}
                for p in line.split(","):
                    k, v = p.split("=", 1)
                    parts[k.strip()] = v.strip()
                current_node = parts.get("Name", "")
            
            # This is a record under the node
            elif line.startswith("    ") and ":" in line:
                rec_part = line.strip()
                record_type, data_info = rec_part.split(":", 1)
                
                # data_info could be: 172.20.0.10 (flags=f0, serial=1, ttl=900)
                # or SOA, NS, etc.
                data = data_info.split("(")[0].strip()
                
                records.append({
                    "name": current_node or "@",
                    "type": record_type.strip(),
                    "data": data,
                })
        return records
    except Exception as e:
        logger.error(f"Failed to list records for zone {zone_name}: {e}")
        return []

def add_record(zone_name: str, name: str, rtype: str, data: str) -> str:
    """Add a new DNS record."""
    # e.g: samba-tool dns add 172.20.0.10 swat.local test A 192.168.1.100
    output = run_samba_dns_cmd("add", zone_name, name, rtype, data)
    return output

def delete_record(zone_name: str, name: str, rtype: str, data: str) -> str:
    """Delete a DNS record."""
    # Deleting requires the EXACT data value too
    output = run_samba_dns_cmd("delete", zone_name, name, rtype, data)
    return output

def update_record(zone_name: str, name: str, rtype: str, old_data: str, new_data: str) -> str:
    """Update a DNS record."""
    output = run_samba_dns_cmd("update", zone_name, name, rtype, old_data, new_data)
    return output
