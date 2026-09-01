from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.auth.rbac import require_role
from app.database import get_activities

router = APIRouter()

@router.get("", response_model=List[Dict[str, Any]])
async def list_activities(
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Get the activity log. Restricted to Domain Admins."""
    return get_activities(limit, offset)
