from fastapi import APIRouter, Depends, HTTPException
import ldap
from app.auth.rbac import require_role
from app.auth.ldap_auth import get_admin_connection
from app.config import settings
from app.models.schemas import PasswordPolicy, PasswordPolicyUpdate
from app.database import log_activity

router = APIRouter()

def _decode(val):
    if not val: return 0
    if isinstance(val, list): val = val[0]
    if isinstance(val, bytes): val = val.decode()
    return int(val)

@router.get("/password-policy", response_model=PasswordPolicy)
async def get_password_policy(
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"]))
):
    """Get the domain password policy."""
    conn = get_admin_connection()
    try:
        attrs = [
            "minPwdLength", "minPwdAge", "maxPwdAge", 
            "pwdHistoryLength", "pwdProperties", 
            "lockoutDuration", "lockoutThreshold", "lockOutObservationWindow"
        ]
        res = conn.search_s(settings.samba_base_dn, ldap.SCOPE_BASE, "(objectClass=*)", attrs)
        if not res:
            raise HTTPException(status_code=404, detail="Domain attributes not found")
        
        _, entry = res[0]
        
        prop_val = _decode(entry.get("pwdProperties", [1]))
        complexity = bool(prop_val & 1)
        store_plaintext = bool(prop_val & 16)
        
        return PasswordPolicy(
            min_pwd_length=_decode(entry.get("minPwdLength", [0])),
            history_length=_decode(entry.get("pwdHistoryLength", [0])),
            min_pwd_age_days=abs(_decode(entry.get("minPwdAge", [0]))) // (10000000 * 60 * 60 * 24),
            max_pwd_age_days=abs(_decode(entry.get("maxPwdAge", [0]))) // (10000000 * 60 * 60 * 24),
            lockout_duration_mins=abs(_decode(entry.get("lockoutDuration", [0]))) // (10000000 * 60),
            lockout_threshold=_decode(entry.get("lockoutThreshold", [0])),
            reset_lockout_after_mins=abs(_decode(entry.get("lockOutObservationWindow", [0]))) // (10000000 * 60),
            complexity_enabled=complexity,
            store_plaintext=store_plaintext
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.unbind_s()

@router.put("/password-policy", response_model=dict)
async def update_password_policy(
    policy: PasswordPolicyUpdate,
    current_user: dict = Depends(require_role(["Domain Admins"]))
):
    """Update the domain password policy. Requires Domain Admins."""
    conn = get_admin_connection()
    try:
        mod_list = []
        
        if policy.min_pwd_length is not None:
            mod_list.append((ldap.MOD_REPLACE, "minPwdLength", [str(policy.min_pwd_length).encode()]))
            
        if policy.history_length is not None:
            mod_list.append((ldap.MOD_REPLACE, "pwdHistoryLength", [str(policy.history_length).encode()]))
            
        if policy.lockout_threshold is not None:
            mod_list.append((ldap.MOD_REPLACE, "lockoutThreshold", [str(policy.lockout_threshold).encode()]))
            
        if policy.min_pwd_age_days is not None:
            val = str(-1 * policy.min_pwd_age_days * 24 * 60 * 60 * 10000000).encode()
            mod_list.append((ldap.MOD_REPLACE, "minPwdAge", [val]))
            
        if policy.max_pwd_age_days is not None:
            val = str(-1 * policy.max_pwd_age_days * 24 * 60 * 60 * 10000000).encode()
            mod_list.append((ldap.MOD_REPLACE, "maxPwdAge", [val]))
            
        if policy.lockout_duration_mins is not None:
            val = str(-1 * policy.lockout_duration_mins * 60 * 10000000).encode()
            mod_list.append((ldap.MOD_REPLACE, "lockoutDuration", [val]))
            
        if policy.reset_lockout_after_mins is not None:
            val = str(-1 * policy.reset_lockout_after_mins * 60 * 10000000).encode()
            mod_list.append((ldap.MOD_REPLACE, "lockOutObservationWindow", [val]))
            
        if policy.complexity_enabled is not None or policy.store_plaintext is not None:
            # First fetch current pwdProperties
            res = conn.search_s(settings.samba_base_dn, ldap.SCOPE_BASE, "(objectClass=*)", ["pwdProperties"])
            current_props = _decode(res[0][1].get("pwdProperties", [1]))
            
            if policy.complexity_enabled is not None:
                if policy.complexity_enabled:
                    current_props |= 1
                else:
                    current_props &= ~1
                    
            if policy.store_plaintext is not None:
                if policy.store_plaintext:
                    current_props |= 16
                else:
                    current_props &= ~16
                    
            mod_list.append((ldap.MOD_REPLACE, "pwdProperties", [str(current_props).encode()]))
            
        if mod_list:
            conn.modify_s(settings.samba_base_dn, mod_list)
            log_activity(current_user.get("username", "system"), "UPDATE", "Domain Policy", "Password Settings", "Modified AD password policies")
            
        return {"message": "Password policy updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.unbind_s()
