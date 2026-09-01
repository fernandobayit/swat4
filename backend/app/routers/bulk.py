from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import csv
import io
from app.auth.rbac import require_role
from app.services import samba_tool
from app.database import log_activity
from app.exceptions import SambaToolError

router = APIRouter()

@router.post("/users", response_model=dict)
async def bulk_import_users(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["Domain Admins", "Account Operators"]))
):
    """
    Import users from a CSV file.
    Expected columns: username, password, givenName, surname, email, ou
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    content = await file.read()
    try:
        decoded_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Must be UTF-8.")
        
    reader = csv.DictReader(io.StringIO(decoded_content))
    
    success_count = 0
    errors = []
    
    for row_num, row in enumerate(reader, start=2): # Headers are row 1
        username = row.get("username", "").strip()
        password = row.get("password", "").strip()
        given_name = row.get("givenName", "").strip()
        surname = row.get("surname", "").strip()
        email = row.get("email", "").strip()
        ou = row.get("ou", "").strip()
        
        if not username or not password:
            errors.append(f"Row {row_num}: Missing username or password")
            continue
            
        try:
            samba_tool.create_user(
                username=username,
                password=password,
                given_name=given_name,
                surname=surname,
                email=email,
                ou=ou,
            )
            success_count += 1
        except Exception as e:
            errors.append(f"Row {row_num} ({username}): {str(e)}")
            
    if success_count > 0:
        log_activity(current_user.get("username", "system"), "CREATE", "Bulk Users", f"{success_count} users", f"Bulk import. {len(errors)} errors.")
        
    return {
        "message": f"Bulk import complete. {success_count} succeeded, {len(errors)} failed.",
        "success_count": success_count,
        "failed_count": len(errors),
        "errors": errors
    }


@router.post("/groups", response_model=dict)
async def bulk_import_groups(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["Domain Admins"]))
):
    """
    Import groups from a CSV file.
    Expected columns: name, description, ou, groupType
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    content = await file.read()
    try:
        decoded_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Must be UTF-8.")
        
    reader = csv.DictReader(io.StringIO(decoded_content))
    
    success_count = 0
    errors = []
    
    for row_num, row in enumerate(reader, start=2): 
        name = row.get("name", "").strip()
        description = row.get("description", "").strip()
        ou = row.get("ou", "").strip()
        group_type = row.get("groupType", "Security").strip()
        
        if not name:
            errors.append(f"Row {row_num}: Missing group name")
            continue
            
        try:
            samba_tool.create_group(
                name=name,
                description=description,
                ou=ou,
                group_type=group_type,
            )
            success_count += 1
        except Exception as e:
            errors.append(f"Row {row_num} ({name}): {str(e)}")
            
    if success_count > 0:
        log_activity(current_user.get("username", "system"), "CREATE", "Bulk Groups", f"{success_count} groups", f"Bulk import. {len(errors)} errors.")
        
    return {
        "message": f"Bulk import complete. {success_count} succeeded, {len(errors)} failed.",
        "success_count": success_count,
        "failed_count": len(errors),
        "errors": errors
    }
