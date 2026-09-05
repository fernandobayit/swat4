from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.config import settings
from app.auth.rbac import require_role, get_visible_ous, is_ou_visible
from app.services import ldap_service
from app.services import samba_tool
from app.models.schemas import OUNode, OUCreate
from app.exceptions import SambaToolError
from app.database import log_activity

router = APIRouter()


def _prune_tree(nodes, visible):
    kept = []
    for node in nodes:
        node["children"] = _prune_tree(node.get("children", []), visible)
        if is_ou_visible(node["dn"], visible) or node["children"]:
            kept.append(node)
    return kept


@router.get("", response_model=List[OUNode])
async def get_ou_tree(
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """Get the full OU tree."""
    try:
        tree = ldap_service.get_ou_tree()
        visible = get_visible_ous(current_user)
        if visible is not None:
            tree = _prune_tree(tree, visible)
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=dict)
async def create_ou(
    ou: OUCreate,
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """Create a new Organizational Unit."""
    visible = get_visible_ous(current_user)
    base = ou.parent_dn or settings.samba_base_dn
    target = f"OU={ou.name},{base}"
    if not is_ou_visible(target, visible):
        raise HTTPException(status_code=403, detail="OU fora das OUs visiveis do perfil")

    try:
        result = samba_tool.create_ou(ou.name, ou.parent_dn)
        log_activity(current_user.get("username", "system"), "CREATE", "OU", ou.name, f"Created Organizational Unit under {ou.parent_dn or 'root'}")
        return {"message": "OU created successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("", response_model=dict)
async def delete_ou(
    ou_dn: str,
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """Delete an Organizational Unit."""
    visible = get_visible_ous(current_user)
    if not is_ou_visible(ou_dn, visible):
        raise HTTPException(status_code=403, detail="OU fora das OUs visiveis do perfil")

    try:
        result = samba_tool.delete_ou(ou_dn)
        log_activity(current_user.get("username", "system"), "DELETE", "OU", ou_dn, "Deleted Organizational Unit")
        return {"message": "OU deleted successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))