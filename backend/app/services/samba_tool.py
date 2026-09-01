"""
LDAP-based operations for managing AD objects.
Replaces samba-tool subprocess calls with pure python-ldap operations.
"""
import ldap
import ldap.modlist
import uuid
import logging
from typing import Optional, List, Dict
from app.config import settings
from app.auth.ldap_auth import get_admin_connection
from app.exceptions import SambaToolError

logger = logging.getLogger(__name__)

# Allow self-signed certificates for LDAPS
ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)



def _decode(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value) if value else ""


# ── User Operations ──────────────────────────────────
def create_user(
    username: str,
    password: str,
    given_name: str = "",
    surname: str = "",
    email: str = "",
    ou: str = "",
) -> str:
    """Create a new AD user via LDAP."""
    conn = get_admin_connection()
    try:
        # Determine target OU
        if ou:
            parent_dn = ou if "DC=" in ou else f"{ou},{settings.samba_base_dn}"
        else:
            parent_dn = f"CN=Users,{settings.samba_base_dn}"
        
        display_name = f"{given_name} {surname}".strip() or username
        user_dn = f"CN={display_name},{parent_dn}"
        
        attrs = {
            "objectClass": [b"top", b"person", b"organizationalPerson", b"user"],
            "cn": [display_name.encode("utf-8")],
            "sAMAccountName": [username.encode("utf-8")],
            "userPrincipalName": [f"{username}@{settings.samba_realm}".encode("utf-8")],
            "displayName": [display_name.encode("utf-8")],
            "userAccountControl": [b"544"],  # NORMAL_ACCOUNT + PASSWD_NOTREQD (temp)
        }
        
        if given_name:
            attrs["givenName"] = [given_name.encode("utf-8")]
        if surname:
            attrs["sn"] = [surname.encode("utf-8")]
        if email:
            attrs["mail"] = [email.encode("utf-8")]
        
        # Create user
        conn.add_s(user_dn, ldap.modlist.addModlist(attrs))
        
        # Set password (AD requires unicode encoding)
        unicode_pass = f'"{password}"'.encode("utf-16-le")
        conn.modify_s(user_dn, [
            (ldap.MOD_REPLACE, "unicodePwd", [unicode_pass]),
        ])
        
        # Enable account (set UAC = 512 = NORMAL_ACCOUNT)
        conn.modify_s(user_dn, [
            (ldap.MOD_REPLACE, "userAccountControl", [b"512"]),
        ])
        
        return f"User '{username}' created successfully"
    except ldap.ALREADY_EXISTS:
        raise SambaToolError(f"User '{username}' already exists")
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        info = e.args[0].get("info", "") if e.args else ""
        raise SambaToolError(f"Failed to create user '{username}': {desc} {info}")
    finally:
        conn.unbind_s()


def delete_user(username: str) -> str:
    """Delete an AD user via LDAP."""
    conn = get_admin_connection()
    try:
        user_dn = _find_user_dn(conn, username)
        if not user_dn:
            raise SambaToolError(f"User '{username}' not found")
        conn.delete_s(user_dn)
        return f"User '{username}' deleted successfully"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to delete user '{username}': {desc}")
    finally:
        conn.unbind_s()


def disable_user(username: str) -> str:
    """Disable an AD user by setting ACCOUNTDISABLE flag."""
    conn = get_admin_connection()
    try:
        user_dn = _find_user_dn(conn, username)
        if not user_dn:
            raise SambaToolError(f"User '{username}' not found")
        
        # Get current UAC
        result = conn.search_s(user_dn, ldap.SCOPE_BASE, "(objectClass=*)", ["userAccountControl"])
        uac = int(_decode(result[0][1]["userAccountControl"][0]))
        new_uac = uac | 0x2  # Set ACCOUNTDISABLE bit
        
        conn.modify_s(user_dn, [
            (ldap.MOD_REPLACE, "userAccountControl", [str(new_uac).encode("utf-8")])
        ])
        return f"User '{username}' disabled"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to disable user: {desc}")
    finally:
        conn.unbind_s()


def enable_user(username: str) -> str:
    """Enable an AD user by clearing ACCOUNTDISABLE flag."""
    conn = get_admin_connection()
    try:
        user_dn = _find_user_dn(conn, username)
        if not user_dn:
            raise SambaToolError(f"User '{username}' not found")
        
        result = conn.search_s(user_dn, ldap.SCOPE_BASE, "(objectClass=*)", ["userAccountControl"])
        uac = int(_decode(result[0][1]["userAccountControl"][0]))
        new_uac = uac & ~0x2  # Clear ACCOUNTDISABLE bit
        
        conn.modify_s(user_dn, [
            (ldap.MOD_REPLACE, "userAccountControl", [str(new_uac).encode("utf-8")])
        ])
        return f"User '{username}' enabled"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to enable user: {desc}")
    finally:
        conn.unbind_s()


def set_password(username: str, password: str) -> str:
    """Set/reset user password via LDAP."""
    conn = get_admin_connection()
    try:
        user_dn = _find_user_dn(conn, username)
        if not user_dn:
            raise SambaToolError(f"User '{username}' not found")
        
        unicode_pass = f'"{password}"'.encode("utf-16-le")
        conn.modify_s(user_dn, [
            (ldap.MOD_REPLACE, "unicodePwd", [unicode_pass]),
        ])
        return f"Password changed for '{username}'"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to set password: {desc}")
    finally:
        conn.unbind_s()


def modify_user_attributes(username: str, attrs: dict) -> str:
    """Modify LDAP attributes of a user (givenName, sn, displayName, mail, etc)."""
    conn = get_admin_connection()
    try:
        user_dn = _find_user_dn(conn, username)
        if not user_dn:
            raise SambaToolError(f"User '{username}' not found")
        
        # We split modifications into replaces and deletes
        # because deletes can fail with NO_SUCH_ATTRIBUTE if the attribute doesn't exist.
        # Replacing works even if the attribute doesn't exist (it creates it).
        
        replaces = []
        deletes = []
        for attr_name, attr_value in attrs.items():
            if attr_value:
                replaces.append((ldap.MOD_REPLACE, attr_name, [attr_value.encode("utf-8")]))
            else:
                deletes.append(attr_name)
        
        # Apply all replacements in one atomic operation if any
        if replaces:
            conn.modify_s(user_dn, replaces)
            
        # Apply deletions individually to be robust against "No such attribute"
        for attr_name in deletes:
            try:
                conn.modify_s(user_dn, [(ldap.MOD_DELETE, attr_name, None)])
            except ldap.NO_SUCH_ATTRIBUTE:
                pass  # Already doesn't exist, ignore
        
        return f"User '{username}' attributes updated"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to update user attributes: {desc}")
    finally:
        conn.unbind_s()


def _find_user_dn(conn, username: str) -> Optional[str]:
    """Find a user's DN by sAMAccountName."""
    result = conn.search_s(
        settings.samba_base_dn, ldap.SCOPE_SUBTREE,
        f"(&(objectClass=user)(sAMAccountName={username}))",
        ["distinguishedName"]
    )
    if result and result[0][0]:
        dn = result[0][0]
        return dn if isinstance(dn, str) else dn.decode("utf-8")
    return None


# ── Group Operations ─────────────────────────────────
def create_group(name: str, description: str = "", ou: str = "", group_type: str = "Security") -> str:
    """Create a new AD security group via LDAP."""
    conn = get_admin_connection()
    try:
        if ou:
            parent_dn = ou if "DC=" in ou else f"{ou},{settings.samba_base_dn}"
        else:
            parent_dn = f"CN=Users,{settings.samba_base_dn}"
        
        group_dn = f"CN={name},{parent_dn}"
        
        # Security group: -2147483646 (Global Security)
        gt = b"-2147483646" if group_type == "Security" else b"-2147483644"
        
        attrs = {
            "objectClass": [b"top", b"group"],
            "cn": [name.encode("utf-8")],
            "sAMAccountName": [name.encode("utf-8")],
            "groupType": [gt],
        }
        
        if description:
            attrs["description"] = [description.encode("utf-8")]
        
        conn.add_s(group_dn, ldap.modlist.addModlist(attrs))
        return f"Group '{name}' created successfully"
    except ldap.ALREADY_EXISTS:
        raise SambaToolError(f"Group '{name}' already exists")
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to create group: {desc}")
    finally:
        conn.unbind_s()


def delete_group(name: str) -> str:
    """Delete an AD group via LDAP."""
    conn = get_admin_connection()
    try:
        group_dn = _find_group_dn(conn, name)
        if not group_dn:
            raise SambaToolError(f"Group '{name}' not found")
        conn.delete_s(group_dn)
        return f"Group '{name}' deleted successfully"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to delete group: {desc}")
    finally:
        conn.unbind_s()


def modify_group_description(name: str, description: str) -> str:
    """Modify group description via LDAP."""
    conn = get_admin_connection()
    try:
        group_dn = _find_group_dn(conn, name)
        if not group_dn:
            raise SambaToolError(f"Group '{name}' not found")
        
        if description:
            conn.modify_s(group_dn, [
                (ldap.MOD_REPLACE, "description", [description.encode("utf-8")])
            ])
        else:
            try:
                conn.modify_s(group_dn, [(ldap.MOD_DELETE, "description", None)])
            except ldap.NO_SUCH_ATTRIBUTE:
                pass
        
        return f"Group '{name}' description updated"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to update group description: {desc}")
    finally:
        conn.unbind_s()


def add_group_members(group_name: str, members: List[str]) -> str:
    """Add members to a group."""
    conn = get_admin_connection()
    try:
        group_dn = _find_group_dn(conn, group_name)
        if not group_dn:
            raise SambaToolError(f"Group '{group_name}' not found")
        
        for member in members:
            member_dn = _find_user_dn(conn, member) or _find_group_dn(conn, member)
            if not member_dn:
                raise SambaToolError(f"Member '{member}' not found")
            try:
                conn.modify_s(group_dn, [
                    (ldap.MOD_ADD, "member", [member_dn.encode("utf-8")])
                ])
            except ldap.TYPE_OR_VALUE_EXISTS:
                pass  # Already a member
        
        return f"Members added to '{group_name}'"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to add members: {desc}")
    finally:
        conn.unbind_s()


def remove_group_members(group_name: str, members: List[str]) -> str:
    """Remove members from a group."""
    conn = get_admin_connection()
    try:
        group_dn = _find_group_dn(conn, group_name)
        if not group_dn:
            raise SambaToolError(f"Group '{group_name}' not found")
        
        for member in members:
            member_dn = _find_user_dn(conn, member) or _find_group_dn(conn, member)
            if not member_dn:
                continue
            try:
                conn.modify_s(group_dn, [
                    (ldap.MOD_DELETE, "member", [member_dn.encode("utf-8")])
                ])
            except ldap.NO_SUCH_ATTRIBUTE:
                pass  # Not a member
        
        return f"Members removed from '{group_name}'"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to remove members: {desc}")
    finally:
        conn.unbind_s()


def _find_group_dn(conn, name: str) -> Optional[str]:
    """Find a group's DN by cn."""
    result = conn.search_s(
        settings.samba_base_dn, ldap.SCOPE_SUBTREE,
        f"(&(objectClass=group)(cn={name}))",
        ["distinguishedName"]
    )
    if result and result[0][0]:
        dn = result[0][0]
        return dn if isinstance(dn, str) else dn.decode("utf-8")
    return None


def get_group_sid(name: str) -> Optional[str]:
    """Retrieve the SID of a group by its cn or sAMAccountName."""
    conn = get_admin_connection()
    try:
        result = conn.search_s(
            settings.samba_base_dn, ldap.SCOPE_SUBTREE,
            f"(&(objectClass=group)(|(cn={name})(sAMAccountName={name})))",
            ["objectSid"]
        )
        if result and result[0][1] and 'objectSid' in result[0][1]:
            binary_sid = result[0][1]['objectSid'][0]
            revision = int(binary_sid[0])
            sub_count = int(binary_sid[1])
            identifier_auth = int.from_bytes(binary_sid[2:8], byteorder='big')
            sub_auths = [int.from_bytes(binary_sid[8 + (i * 4): 12 + (i * 4)], byteorder='little') for i in range(sub_count)]
            return f"S-{revision}-{identifier_auth}-" + "-".join(map(str, sub_auths))
        return None
    except Exception as e:
        logger.error(f"Failed to retrieve SID for group '{name}': {e}")
        return None
    finally:
        conn.unbind_s()


# ── GPO Operations ───────────────────────────────────
def list_gpos() -> List[Dict]:
    """List all GPOs via LDAP."""
    conn = get_admin_connection()
    try:
        gpo_container = f"CN=Policies,CN=System,{settings.samba_base_dn}"
        result = conn.search_s(
            gpo_container, ldap.SCOPE_ONELEVEL,
            "(objectClass=groupPolicyContainer)",
            ["cn", "displayName", "gPCFileSysPath", "versionNumber", "flags", "distinguishedName"]
        )
        
        gpos = []
        for dn, entry in result:
            if dn is None:
                continue
            dn_str = dn if isinstance(dn, str) else dn.decode("utf-8")
            gpos.append({
                "name": _decode(entry.get("cn", [b""])[0]),
                "display_name": _decode(entry.get("displayName", [b""])[0]),
                "path": _decode(entry.get("gPCFileSysPath", [b""])[0]),
                "dn": dn_str,
                "version": _decode(entry.get("versionNumber", [b"0"])[0]),
                "flags": _decode(entry.get("flags", [b"0"])[0]),
            })
        
        return gpos
    except ldap.NO_SUCH_OBJECT:
        return []
    except ldap.LDAPError as e:
        logger.error(f"Failed to list GPOs: {e}")
        return []
    finally:
        conn.unbind_s()


def create_gpo(display_name: str) -> str:
    """Create a new GPO via LDAP."""
    conn = get_admin_connection()
    try:
        gpo_guid = "{" + str(uuid.uuid4()).upper() + "}"
        gpo_container = f"CN=Policies,CN=System,{settings.samba_base_dn}"
        gpo_dn = f"CN={gpo_guid},{gpo_container}"
        
        attrs = {
            "objectClass": [b"top", b"container", b"groupPolicyContainer"],
            "cn": [gpo_guid.encode("utf-8")],
            "displayName": [display_name.encode("utf-8")],
            "flags": [b"0"],
            "versionNumber": [b"0"],
            "gPCFunctionalityVersion": [b"2"],
            "gPCFileSysPath": [f"\\\\{settings.samba_realm}\\sysvol\\{settings.samba_realm.lower()}\\Policies\\{gpo_guid}".encode("utf-8")],
        }
        
        conn.add_s(gpo_dn, ldap.modlist.addModlist(attrs))
        return f"GPO '{display_name}' created with GUID {gpo_guid}"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to create GPO: {desc}")
    finally:
        conn.unbind_s()


def delete_gpo(gpo_guid: str) -> str:
    """Delete a GPO via LDAP."""
    # Normalize GUID — ensure it has curly braces
    gpo_guid = gpo_guid.strip()
    if not gpo_guid.startswith("{"):
        gpo_guid = "{" + gpo_guid
    if not gpo_guid.endswith("}"):
        gpo_guid = gpo_guid + "}"
    
    conn = get_admin_connection()
    try:
        gpo_container = f"CN=Policies,CN=System,{settings.samba_base_dn}"
        gpo_dn = f"CN={gpo_guid},{gpo_container}"
        
        # Delete child objects first (Machine, User sub-containers)
        try:
            children = conn.search_s(gpo_dn, ldap.SCOPE_ONELEVEL, "(objectClass=*)", ["dn"])
            for child_dn, _ in children:
                if child_dn:
                    child_dn_str = child_dn if isinstance(child_dn, str) else child_dn.decode("utf-8")
                    conn.delete_s(child_dn_str)
        except ldap.NO_SUCH_OBJECT:
            pass
        
        conn.delete_s(gpo_dn)
        return f"GPO '{gpo_guid}' deleted successfully"
    except ldap.NO_SUCH_OBJECT:
        raise SambaToolError(f"GPO '{gpo_guid}' not found")
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to delete GPO: {desc}")
    finally:
        conn.unbind_s()


def link_gpo(gpo_guid: str, ou_dn: str) -> str:
    """Link a GPO to an OU."""
    conn = get_admin_connection()
    try:
        gpo_link = f"[LDAP://CN={gpo_guid},CN=Policies,CN=System,{settings.samba_base_dn};0]"
        
        # Get current gPLink
        result = conn.search_s(ou_dn, ldap.SCOPE_BASE, "(objectClass=*)", ["gPLink"])
        current = _decode(result[0][1].get("gPLink", [b""])[0]) if result[0][1].get("gPLink") else ""
        
        if gpo_guid in current:
            return f"GPO already linked to {ou_dn}"
        
        new_link = current + gpo_link
        conn.modify_s(ou_dn, [
            (ldap.MOD_REPLACE, "gPLink", [new_link.encode("utf-8")])
        ])
        return f"GPO linked to {ou_dn}"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to link GPO: {desc}")
    finally:
        conn.unbind_s()


def unlink_gpo(gpo_guid: str, ou_dn: str) -> str:
    """Unlink a GPO from an OU."""
    conn = get_admin_connection()
    try:
        result = conn.search_s(ou_dn, ldap.SCOPE_BASE, "(objectClass=*)", ["gPLink"])
        current = _decode(result[0][1].get("gPLink", [b""])[0]) if result[0][1].get("gPLink") else ""
        
        # Remove the specific GPO link
        import re
        pattern = rf"\[LDAP://CN={re.escape(gpo_guid)},CN=Policies,CN=System,[^;]+;\d+\]"
        new_link = re.sub(pattern, "", current)
        
        if new_link:
            conn.modify_s(ou_dn, [
                (ldap.MOD_REPLACE, "gPLink", [new_link.encode("utf-8")])
            ])
        else:
            conn.modify_s(ou_dn, [
                (ldap.MOD_DELETE, "gPLink", None)
            ])
        
        return f"GPO unlinked from {ou_dn}"
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to unlink GPO: {desc}")
    finally:
        conn.unbind_s()


# ── OU Operations ────────────────────────────────────
def create_ou(name: str, parent_dn: Optional[str] = None) -> str:
    """Create a new OU via LDAP."""
    conn = get_admin_connection()
    try:
        base = parent_dn or settings.samba_base_dn
        ou_dn = f"OU={name},{base}"
        
        attrs = {
            "objectClass": [b"top", b"organizationalUnit"],
            "ou": [name.encode("utf-8")],
        }
        
        conn.add_s(ou_dn, ldap.modlist.addModlist(attrs))
        return f"OU '{name}' created successfully"
    except ldap.ALREADY_EXISTS:
        raise SambaToolError(f"OU '{name}' already exists")
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to create OU: {desc}")
    finally:
        conn.unbind_s()


def delete_ou(ou_dn: str) -> str:
    """Delete an OU via LDAP."""
    conn = get_admin_connection()
    try:
        conn.delete_s(ou_dn)
        return f"OU deleted successfully"
    except ldap.NOT_ALLOWED_ON_NONLEAF:
        raise SambaToolError("Cannot delete OU that contains objects")
    except ldap.LDAPError as e:
        desc = e.args[0].get("desc", str(e)) if e.args else str(e)
        raise SambaToolError(f"Failed to delete OU: {desc}")
    finally:
        conn.unbind_s()
