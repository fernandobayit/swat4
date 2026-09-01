from fastapi import Depends, HTTPException, status
from typing import List
from app.auth.dependencies import get_current_user
from app.database import get_role_settings

ADMIN_ROLE = "Domain Admins"
OPERATOR_ROLE = "Account Operators"

PERMISSION_FIELD_MAP = {
    "manage_users": "can_manage_users",
    "manage_groups": "can_manage_groups",
    "manage_shares": "can_manage_shares",
    "view_dns": "can_view_dns",
}


def require_role(allowed_roles: List[str]):
    """
    Dependency generator to enforce RBAC based on user group membership.
    If the user does not have at least one of the allowed roles, returns 403 Forbidden.
    """
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_groups = current_user.get("groups", [])

        has_role = any(role in allowed_roles for role in user_groups)

        if not has_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}"
            )
        return current_user

    return role_checker


def require_permission(permission: str):
    """
    Dependency generator to enforce granular RBAC permissions.

    Two-tier check:
    1. Domain Admins always have access to everything.
    2. Account Operators are checked against their role_settings in the database.
       The permission string maps to a boolean field in RoleSettingsSchema.
    3. Any other user gets 403.

    Permission mapping:
      "manage_users"  -> can_manage_users
      "manage_groups" -> can_manage_groups
      "manage_shares" -> can_manage_shares
      "view_dns"      -> can_view_dns
    """
    def permission_checker(current_user: dict = Depends(get_current_user)):
        user_groups = current_user.get("groups", [])

        if ADMIN_ROLE in user_groups:
            return current_user

        if OPERATOR_ROLE in user_groups:
            settings_field = PERMISSION_FIELD_MAP.get(permission)
            if settings_field is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Unknown permission: {permission}"
                )

            role_settings = get_role_settings(OPERATOR_ROLE)
            allowed = role_settings.get(settings_field, False)

            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Account Operators do not have permission: {permission}"
                )
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Requires Domain Admins or Account Operators role."
        )

    return permission_checker


def can_manage_users(current_user: dict = Depends(get_current_user)):
    """Check if user can manage users (Domain Admins always can)."""
    if ADMIN_ROLE in (current_user.get("groups") or []):
        return True
    if OPERATOR_ROLE in (current_user.get("groups") or []):
        return get_role_settings(OPERATOR_ROLE).get("can_manage_users", False)
    return False


def can_manage_groups(current_user: dict = Depends(get_current_user)):
    """Check if user can manage groups (Domain Admins always can)."""
    if ADMIN_ROLE in (current_user.get("groups") or []):
        return True
    if OPERATOR_ROLE in (current_user.get("groups") or []):
        return get_role_settings(OPERATOR_ROLE).get("can_manage_groups", False)
    return False


def can_manage_shares(current_user: dict = Depends(get_current_user)):
    """Check if user can manage shares (Domain Admins always can)."""
    if ADMIN_ROLE in (current_user.get("groups") or []):
        return True
    if OPERATOR_ROLE in (current_user.get("groups") or []):
        return get_role_settings(OPERATOR_ROLE).get("can_manage_shares", False)
    return False


def can_view_dns(current_user: dict = Depends(get_current_user)):
    """Check if user can view DNS (Domain Admins always can)."""
    if ADMIN_ROLE in (current_user.get("groups") or []):
        return True
    if OPERATOR_ROLE in (current_user.get("groups") or []):
        return get_role_settings(OPERATOR_ROLE).get("can_view_dns", False)
    return False