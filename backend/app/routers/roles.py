from fastapi import APIRouter, Depends, HTTPException
from app.auth.rbac import require_role
from app.auth.dependencies import get_current_user
from app.models.schemas import RoleSettingsSchema
from app.database import get_role_settings, set_role_settings, log_activity

router = APIRouter()

@router.get("/{role_name}/settings", response_model=RoleSettingsSchema)
async def get_role_settings_route(
    role_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the specific RBAC settings for a given role (AD Group).
    Domain Admins can read any role's settings.
    Account Operators can only read their own role's settings.
    """
    user_groups = current_user.get("groups", [])
    is_admin = "Domain Admins" in user_groups
    is_operator = "Account Operators" in user_groups
    allowed_role_names = ["Account Operators"]

    if not is_admin and not (is_operator and role_name in allowed_role_names):
        raise HTTPException(status_code=403, detail="Access denied")

    settings_dict = get_role_settings(role_name)
    if not settings_dict:
        return RoleSettingsSchema()
    return RoleSettingsSchema(**settings_dict)

@router.put("/{role_name}/settings", response_model=RoleSettingsSchema)
async def update_role_settings_route(
    role_name: str,
    settings: RoleSettingsSchema,
    current_user: dict = Depends(require_role(["Domain Admins"]))
):
    """Update setting values for a given role."""
    set_role_settings(role_name, settings.dict())
    log_activity(
        current_user.get("username", "system"), 
        "UPDATE", 
        "Role Profile", 
        role_name, 
        "Updated RBAC profile settings for group"
    )
    return settings
