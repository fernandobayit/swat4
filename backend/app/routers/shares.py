from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.auth.rbac import require_role, require_permission, can_manage_share_folder
from app.services import share_service
from app.models.schemas import ShareCreate, ShareUpdate, ShareResponse, ShareFolderCreate, ShareFolderInfo
from app.database import log_activity, list_share_folders

router = APIRouter()

# Compartilhamentos: criacao/edicao/exclusao restritos a Domain Admins.
# Account Operators permanecem apenas com leitura (listar/detalhar).


@router.get("", response_model=List[ShareResponse])
async def list_shares(
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """List all file shares."""
    try:
        shares = share_service.list_shares()
        return shares
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{name}", response_model=ShareResponse)
async def get_share(
    name: str,
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """Get a share by name."""
    share = share_service.get_share(name)
    if share is None:
        raise HTTPException(status_code=404, detail="Share not found")
    return share


@router.post("", response_model=dict)
async def create_share(
    share: ShareCreate,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Create a new file share (Domain Admins only)."""
    try:
        config = {
            "path": share.path,
            "comment": share.comment or "",
        }
        if share.veto_files:
            config["veto files"] = share.veto_files
        if share.write_list:
            config["write list"] = share.write_list
        share_service.add_share(share.name, config)
        log_activity(current_user.get("username", "system"), "CREATE", "Share", share.name, f"Created file share at {share.path}")
        return {"message": "Share created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{name}", response_model=dict)
async def update_share(
    name: str,
    share: ShareUpdate,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Update an existing file share (Domain Admins only)."""
    try:
        config = {}
        if share.path is not None:
            config["path"] = share.path
        if share.comment is not None:
            config["comment"] = share.comment
        if share.veto_files is not None:
            config["veto files"] = share.veto_files
        if share.write_list is not None:
            config["write list"] = share.write_list

        share_service.update_share(name, config)
        log_activity(current_user.get("username", "system"), "UPDATE", "Share", name, "Updated file share configuration")
        return {"message": "Share updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{name}", response_model=dict)
async def delete_share(
    name: str,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Delete a file share (Domain Admins only; cascata subpastas e grupos)."""
    try:
        share_service.delete_share(name)
        log_activity(current_user.get("username", "system"), "DELETE", "Share", name, "Deleted file share")
        return {"message": "Share deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Subpastas nivel 1 ─────────────────────────────────
@router.get("/{name}/folders", response_model=List[ShareFolderInfo])
async def list_folders(
    name: str,
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"])),
):
    """List registered level-1 folders of a share."""
    if share_service.get_share(name) is None:
        raise HTTPException(status_code=404, detail="Share not found")
    return list_share_folders(name)


@router.post("/{name}/folders", response_model=dict)
async def create_folder(
    name: str,
    body: ShareFolderCreate,
    current_user: dict = Depends(require_permission("manage_shares")),
):
    """Create a level-1 folder with its own access groups.

    Domain Admins always; Account Operators only in granted shares.
    """
    if not can_manage_share_folder(current_user, name):
        raise HTTPException(status_code=403, detail="Sem permissao para criar subpastas neste compartilhamento")
    try:
        share_service.add_share_folder(name, body.folder, current_user.get("username", "system"))
        log_activity(current_user.get("username", "system"), "CREATE", "ShareFolder", f"{name}/{body.folder}", f"Created level-1 folder with access groups")
        return {"message": "Folder created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{name}/folders/{folder}", response_model=dict)
async def delete_folder(
    name: str,
    folder: str,
    current_user: dict = Depends(require_permission("manage_shares")),
):
    """Delete a level-1 folder (pasta, grupos e registro).

    Domain Admins always; Account Operators only in granted shares.
    """
    if not can_manage_share_folder(current_user, name):
        raise HTTPException(status_code=403, detail="Sem permissao para excluir subpastas neste compartilhamento")
    try:
        share_service.delete_share_folder(name, folder)
        log_activity(current_user.get("username", "system"), "DELETE", "ShareFolder", f"{name}/{folder}", "Deleted level-1 folder with access groups")
        return {"message": "Folder deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
