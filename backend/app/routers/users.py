from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from app.auth.rbac import require_role, require_permission
from app.services import ldap_service
from app.services import samba_tool
from app.models.schemas import UserCreate, UserUpdate, UserResponse
from app.exceptions import SambaToolError
from app.database import log_activity

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def list_users(
    ou: Optional[str] = Query(None, description="Filter by OU DN"),
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """List all users, optionally filtered by OU."""
    try:
        users = ldap_service.list_users(ou)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{username}", response_model=UserResponse)
async def get_user(
    username: str,
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """Get a single user by username."""
    user = ldap_service.get_user(username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", response_model=dict)
async def create_user(
    user: UserCreate,
    current_user: dict = Depends(require_permission("manage_users")),
):
    """Create a new AD user."""
    try:
        result = samba_tool.create_user(
            username=user.username,
            password=user.password,
            given_name=user.given_name or "",
            surname=user.surname or "",
            email=user.email or "",
            ou=user.ou or "",
        )
        log_activity(current_user.get("username", "system"), "CREATE", "User", user.username, "Created user successfully")
        return {"message": "User created successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{username}", response_model=dict)
async def update_user(
    username: str,
    user: UserUpdate,
    current_user: dict = Depends(require_permission("manage_users")),
):
    """Update an existing user."""
    try:
        existing = ldap_service.get_user(username)
        if existing is None:
            raise HTTPException(status_code=404, detail="User not found")

        if user.enabled is not None:
            if user.enabled:
                samba_tool.enable_user(username)
            else:
                samba_tool.disable_user(username)

        if user.password:
            samba_tool.set_password(username, user.password)

        attrs_to_update = {}
        if user.given_name is not None:
            attrs_to_update["givenName"] = user.given_name
        if user.surname is not None:
            attrs_to_update["sn"] = user.surname
        if user.display_name is not None:
            attrs_to_update["displayName"] = user.display_name
        if user.email is not None:
            attrs_to_update["mail"] = user.email

        if attrs_to_update:
            samba_tool.modify_user_attributes(username, attrs_to_update)

        log_activity(current_user.get("username", "system"), "UPDATE", "User", username, "Updated user attributes/status")
        return {"message": "User updated successfully"}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{username}", response_model=dict)
async def delete_user(
    username: str,
    current_user: dict = Depends(require_permission("manage_users")),
):
    """Delete an AD user."""
    try:
        existing = ldap_service.get_user(username)
        if existing is None:
            raise HTTPException(status_code=404, detail="User not found")

        result = samba_tool.delete_user(username)
        log_activity(current_user.get("username", "system"), "DELETE", "User", username, "Deleted user")
        return {"message": "User deleted successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))