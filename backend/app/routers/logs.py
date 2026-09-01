from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from app.auth.rbac import require_role
from app.services import log_service
from app.models.schemas import LogResponse

router = APIRouter()


@router.get("/files", response_model=List[str])
async def list_log_files(
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """List available samba log files."""
    try:
        return log_service.list_log_files()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{filename}", response_model=LogResponse)
async def read_log(
    filename: str,
    lines: int = Query(200, ge=10, le=5000),
    level: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """Read a samba log file with optional filtering."""
    try:
        return log_service.read_log(
            filename=filename,
            lines=lines,
            level_filter=level,
            search=search,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))