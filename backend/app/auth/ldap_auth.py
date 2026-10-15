import ldap
import logging
from typing import Optional, List, Tuple
from app.config import settings

logger = logging.getLogger(__name__)

# Allow self-signed certificates for LDAPS
ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)


def get_admin_connection() -> ldap.ldapobject.LDAPObject:
    """Get an LDAP connection using admin credentials."""
    conn = ldap.initialize(settings.ldap_url)
    conn.set_option(ldap.OPT_REFERRALS, 0)
    conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
    admin_dn = f"{settings.samba_admin_user}@{settings.samba_realm}"
    conn.simple_bind_s(admin_dn, settings.samba_admin_password)
    return conn


def _escape_ldap_filter(value: str) -> str:
    return value.replace("\\", "\\5c").replace("(", "\\28").replace(")", "\\29")


def _expand_nested_groups(conn, group_dns: List[str]) -> List[str]:
    """Retorna DNs de grupos ancestrais que contem (direta ou indiretamente)
    os DNs informados.

    O atributo memberOf NAO e transitivo no AD: se o usuario esta em
    "Time-DEV" e "Time-DEV" e membro de "Account Operators", o memberOf do
    usuario traz apenas "Time-DEV". Esta funcao sobe a cadeia de memberships
    para que permissoes aninhadas sejam herdadas no login/RBAC.
    """
    seen = {d.lower() for d in group_dns}
    queue = list(group_dns)
    parents: List[str] = []
    while queue:
        current = queue.pop(0)
        try:
            result = conn.search_s(
                settings.samba_base_dn, ldap.SCOPE_SUBTREE,
                f"(&(objectClass=group)(member={_escape_ldap_filter(current)}))",
                ["distinguishedName"],
            )
        except ldap.LDAPError:
            continue
        for dn, _entry in result:
            if dn is None:
                continue
            dn_str = dn if isinstance(dn, str) else dn.decode("utf-8")
            key = dn_str.lower()
            if key in seen:
                continue
            seen.add(key)
            parents.append(dn_str)
            queue.append(dn_str)
    return parents


def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Authenticate user via LDAP bind and return user info."""
    try:
        conn = ldap.initialize(settings.ldap_url)
        conn.set_option(ldap.OPT_REFERRALS, 0)
        conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
        
        user_dn = f"{username}@{settings.samba_realm}"
        conn.simple_bind_s(user_dn, password)
        
        # Search for user details
        search_filter = f"(&(objectClass=user)(sAMAccountName={username}))"
        attrs = ["cn", "displayName", "mail", "memberOf", "distinguishedName",
                 "sAMAccountName", "userAccountControl", "primaryGroupID"]
        
        result = conn.search_s(
            settings.samba_base_dn,
            ldap.SCOPE_SUBTREE,
            search_filter,
            attrs
        )
        
        conn.unbind_s()
        
        if not result:
            return None
        
        dn, entry = result[0]
        if dn is None:
            return None
        
        member_of = [
            m.decode("utf-8") if isinstance(m, bytes) else m
            for m in entry.get("memberOf", [])
        ]
        
        group_names = []
        for m in member_of:
            parts = m.split(",")
            for p in parts:
                if p.startswith("CN="):
                    group_names.append(p[3:])
                    break

        # memberOf nao e transitivo: expande grupos aninhados (cadeia de
        # memberships) usando conexao de servico, para herdar permissoes
        # de grupos pai (ex.: Time-DEV -> Account Operators).
        nested_dns = []
        try:
            admin_conn = get_admin_connection()
            try:
                nested_dns = _expand_nested_groups(admin_conn, list(member_of))
            finally:
                admin_conn.unbind_s()
        except ldap.LDAPError:
            logger.warning("Failed to expand nested groups; using direct memberships only")

        for dn_str in nested_dns:
            for p in dn_str.split(","):
                if p.startswith("CN="):
                    gname = p[3:]
                    if gname not in group_names:
                        group_names.append(gname)
                    break
        
        # Handle primary group (Domain Users = 513, Domain Admins = 512)
        # Primary group is NOT listed in memberOf, only in primaryGroupID
        primary_group_id = _decode(entry.get("primaryGroupID", [b""])[0])
        PRIMARY_GROUP_MAP = {
            "513": "Domain Users",
            "512": "Domain Admins",
            "514": "Domain Guests",
            "515": "Domain Computers",
        }
        primary_group = PRIMARY_GROUP_MAP.get(primary_group_id)
        if primary_group and primary_group not in group_names:
            group_names.append(primary_group)
        
        return {
            "username": _decode(entry.get("sAMAccountName", [b""])[0]),
            "display_name": _decode(entry.get("displayName", entry.get("cn", [b""]))[0]),
            "email": _decode(entry.get("mail", [b""])[0]) or None,
            "dn": dn if isinstance(dn, str) else dn.decode("utf-8"),
            "groups": group_names,
        }
    except ldap.INVALID_CREDENTIALS:
        logger.warning(f"Invalid credentials for user: {username}")
        return None
    except ldap.SERVER_DOWN:
        logger.error("LDAP server is down")
        raise
    except Exception as e:
        logger.error(f"LDAP auth error: {e}")
        return None


def check_group_membership(groups: List[str], allowed_groups: List[str]) -> bool:
    """Check if user belongs to any of the allowed groups."""
    for group in groups:
        if group in allowed_groups:
            return True
    return False


def _decode(value) -> str:
    """Decode bytes to str."""
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value) if value else ""
