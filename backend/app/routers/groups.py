from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from app.auth.rbac import require_role, require_permission
from app.services import ldap_service
from app.services import samba_tool
from app.models.schemas import GroupCreate, GroupUpdate, GroupResponse, GroupMemberAction
from app.auth.dependencies import get_current_user
from app.exceptions import SambaToolError
from app.database import get_role_settings, log_activity
import re

router = APIRouter()

ADMIN_ROLE = "Domain Admins"
OPERATOR_ROLE = "Account Operators"


@router.get("", response_model=List[GroupResponse])
async def list_groups(
    ou: Optional[str] = Query(None, description="Filter by OU DN"),
    current_user: dict = Depends(require_role([ADMIN_ROLE, OPERATOR_ROLE])),
):
    """List security groups. Admins see all, Operators see filtered list."""
    try:
        groups = ldap_service.list_groups(ou)

        if ADMIN_ROLE not in current_user.get("groups", []):
            role_settings = get_role_settings(OPERATOR_ROLE)
            regex_pattern = role_settings.get("visible_groups_regex", "")
            explicit_list = [name.lower() for name in role_settings.get("visible_groups_list", [])]

            compiled_regex = None
            if regex_pattern:
                try:
                    compiled_regex = re.compile(regex_pattern, re.IGNORECASE)
                except re.error:
                    pass

            if compiled_regex or explicit_list:
                groups = [
                    g for g in groups
                    if (compiled_regex and compiled_regex.search(g["name"])) or (g["name"].lower() in explicit_list)
                ]
            else:
                groups = [g for g in groups if "admin" not in g["name"].lower()]

        return groups
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{name}", response_model=GroupResponse)
async def get_group(
    name: str,
    current_user: dict = Depends(require_role([ADMIN_ROLE, OPERATOR_ROLE])),
):
    """Get a single group by name."""
    group = ldap_service.get_group(name)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.post("", response_model=dict)
async def create_group(
    group: GroupCreate,
    current_user: dict = Depends(require_permission("manage_groups")),
):
    """Create a new security group."""
    try:
        result = samba_tool.create_group(
            name=group.name,
            description=group.description or "",
            ou=group.ou or "",
            group_type=group.group_type,
        )
        log_activity(current_user.get("username", "system"), "CREATE", "Group", group.name, "Created security group")
        return {"message": "Group created successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{name}", response_model=dict)
async def update_group(
    name: str,
    group: GroupUpdate,
    current_user: dict = Depends(require_permission("manage_groups")),
):
    """Update group details."""
    try:
        existing = ldap_service.get_group(name)
        if existing is None:
            raise HTTPException(status_code=404, detail="Group not found")

        if group.description is not None:
            samba_tool.modify_group_description(name, group.description)

        log_activity(current_user.get("username", "system"), "UPDATE", "Group", name, "Updated group details")
        return {"message": "Group updated successfully"}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{name}", response_model=dict)
async def delete_group(
    name: str,
    current_user: dict = Depends(require_permission("manage_groups")),
):
    """Delete a security group."""
    try:
        existing = ldap_service.get_group(name)
        if existing is None:
            raise HTTPException(status_code=404, detail="Group not found")

        result = samba_tool.delete_group(name)
        log_activity(current_user.get("username", "system"), "DELETE", "Group", name, "Deleted group")
        return {"message": "Group deleted successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{name}/members", response_model=dict)
async def add_members(
    name: str,
    action: GroupMemberAction,
    current_user: dict = Depends(require_permission("manage_groups")),
):
    """Add members to a group."""
    try:
        result = samba_tool.add_group_members(name, action.members)
        log_activity(current_user.get("username", "system"), "UPDATE", "Group", name, f"Added members: {', '.join(action.members)}")
        return {"message": "Members added successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{name}/members", response_model=dict)
async def remove_members(
    name: str,
    action: GroupMemberAction,
    current_user: dict = Depends(require_permission("manage_groups")),
):
    """Remove members from a group."""
    try:
        result = samba_tool.remove_group_members(name, action.members)
        log_activity(current_user.get("username", "system"), "UPDATE", "Group", name, f"Removed members: {', '.join(action.members)}")
        return {"message": "Members removed successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))