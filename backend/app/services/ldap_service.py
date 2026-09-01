import ldap
import logging
from typing import List, Optional, Dict, Any
from app.config import settings
from app.auth.ldap_auth import get_admin_connection

logger = logging.getLogger(__name__)


def _decode(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value) if value else ""


def _decode_list(values) -> List[str]:
    return [_decode(v) for v in values] if values else []


def get_ou_tree() -> List[Dict]:
    """Get the full OU tree from LDAP."""
    conn = get_admin_connection()
    try:
        search_filter = "(objectClass=organizationalUnit)"
        attrs = ["ou", "distinguishedName"]
        result = conn.search_s(
            settings.samba_base_dn, ldap.SCOPE_SUBTREE, search_filter, attrs
        )
        
        ous = []
        for dn, entry in result:
            if dn is None:
                continue
            dn_str = dn if isinstance(dn, str) else dn.decode("utf-8")
            ous.append({
                "dn": dn_str,
                "name": _decode(entry.get("ou", [b""])[0]),
            })
        
        return _build_tree(ous)
    finally:
        conn.unbind_s()


def _build_tree(ous: List[Dict]) -> List[Dict]:
    """Build a hierarchical OU tree."""
    dn_map = {ou["dn"]: {**ou, "children": []} for ou in ous}
    roots = []
    
    for ou in ous:
        parent_dn = ",".join(ou["dn"].split(",")[1:])
        if parent_dn in dn_map:
            dn_map[parent_dn]["children"].append(dn_map[ou["dn"]])
        else:
            roots.append(dn_map[ou["dn"]])
    
    return roots


def list_users(ou_dn: Optional[str] = None) -> List[Dict]:
    """List all users, optionally filtered by OU."""
    conn = get_admin_connection()
    try:
        base = ou_dn or settings.samba_base_dn
        search_filter = "(&(objectClass=user)(objectCategory=person)(!(objectClass=computer)))"
        attrs = [
            "sAMAccountName", "cn", "displayName", "givenName", "sn",
            "mail", "memberOf", "distinguishedName", "userAccountControl",
            "whenCreated"
        ]
        
        result = conn.search_s(base, ldap.SCOPE_SUBTREE, search_filter, attrs)
        
        users = []
        for dn, entry in result:
            if dn is None:
                continue
            dn_str = dn if isinstance(dn, str) else dn.decode("utf-8")
            
            uac = int(_decode(entry.get("userAccountControl", [b"512"])[0]))
            enabled = not bool(uac & 0x2)
            
            # Extract OU from DN
            dn_parts = dn_str.split(",")
            ou_parts = [p for p in dn_parts[1:] if p.startswith("OU=") or p.startswith("CN=")]
            ou = ",".join(ou_parts + [p for p in dn_parts if p.startswith("DC=")])
            
            users.append({
                "dn": dn_str,
                "username": _decode(entry.get("sAMAccountName", [b""])[0]),
                "given_name": _decode(entry.get("givenName", [b""])[0]) or None,
                "surname": _decode(entry.get("sn", [b""])[0]) or None,
                "display_name": _decode(entry.get("displayName", entry.get("cn", [b""]))[0]) or None,
                "email": _decode(entry.get("mail", [b""])[0]) or None,
                "enabled": enabled,
                "when_created": _decode(entry.get("whenCreated", [b""])[0]) or None,
                "member_of": _decode_list(entry.get("memberOf", [])),
                "ou": ou,
            })
        
        return users
    finally:
        conn.unbind_s()


def get_user(username: str) -> Optional[Dict]:
    """Get a single user by sAMAccountName."""
    conn = get_admin_connection()
    try:
        search_filter = f"(&(objectClass=user)(sAMAccountName={username}))"
        attrs = [
            "sAMAccountName", "cn", "displayName", "givenName", "sn",
            "mail", "memberOf", "distinguishedName", "userAccountControl",
            "whenCreated"
        ]
        
        result = conn.search_s(
            settings.samba_base_dn, ldap.SCOPE_SUBTREE, search_filter, attrs
        )
        
        if not result or result[0][0] is None:
            return None
        
        dn, entry = result[0]
        dn_str = dn if isinstance(dn, str) else dn.decode("utf-8")
        uac = int(_decode(entry.get("userAccountControl", [b"512"])[0]))
        
        return {
            "dn": dn_str,
            "username": _decode(entry.get("sAMAccountName", [b""])[0]),
            "given_name": _decode(entry.get("givenName", [b""])[0]) or None,
            "surname": _decode(entry.get("sn", [b""])[0]) or None,
            "display_name": _decode(entry.get("displayName", entry.get("cn", [b""]))[0]) or None,
            "email": _decode(entry.get("mail", [b""])[0]) or None,
            "enabled": not bool(uac & 0x2),
            "when_created": _decode(entry.get("whenCreated", [b""])[0]) or None,
            "member_of": _decode_list(entry.get("memberOf", [])),
        }
    finally:
        conn.unbind_s()


def list_groups(ou_dn: Optional[str] = None) -> List[Dict]:
    """List security groups, optionally filtered by OU."""
    conn = get_admin_connection()
    try:
        base = ou_dn or settings.samba_base_dn
        # Security groups have groupType with bit 0x80000000 set
        search_filter = "(&(objectClass=group)(groupType:1.2.840.113556.1.4.803:=2147483648))"
        attrs = [
            "cn", "description", "member", "distinguishedName",
            "groupType", "sAMAccountName"
        ]
        
        result = conn.search_s(base, ldap.SCOPE_SUBTREE, search_filter, attrs)
        
        groups = []
        for dn, entry in result:
            if dn is None:
                continue
            dn_str = dn if isinstance(dn, str) else dn.decode("utf-8")
            members = _decode_list(entry.get("member", []))
            
            dn_parts = dn_str.split(",")
            ou_parts = [p for p in dn_parts[1:] if p.startswith("OU=") or p.startswith("CN=")]
            ou = ",".join(ou_parts + [p for p in dn_parts if p.startswith("DC=")])
            
            groups.append({
                "dn": dn_str,
                "name": _decode(entry.get("cn", [b""])[0]),
                "description": _decode(entry.get("description", [b""])[0]) or None,
                "members": members,
                "member_count": len(members),
                "group_type": _decode(entry.get("groupType", [b""])[0]) or None,
                "ou": ou,
            })
        
        return groups
    finally:
        conn.unbind_s()


def get_group(name: str) -> Optional[Dict]:
    """Get a single group by name."""
    conn = get_admin_connection()
    try:
        search_filter = f"(&(objectClass=group)(cn={name}))"
        attrs = ["cn", "description", "member", "distinguishedName", "groupType"]
        
        result = conn.search_s(
            settings.samba_base_dn, ldap.SCOPE_SUBTREE, search_filter, attrs
        )
        
        if not result or result[0][0] is None:
            return None
        
        dn, entry = result[0]
        dn_str = dn if isinstance(dn, str) else dn.decode("utf-8")
        members = _decode_list(entry.get("member", []))
        
        return {
            "dn": dn_str,
            "name": _decode(entry.get("cn", [b""])[0]),
            "description": _decode(entry.get("description", [b""])[0]) or None,
            "members": members,
            "member_count": len(members),
            "group_type": _decode(entry.get("groupType", [b""])[0]) or None,
        }
    finally:
        conn.unbind_s()
