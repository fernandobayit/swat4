from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.auth.rbac import require_role, require_permission
from app.services import dns_tool
from app.models.schemas import DNSZoneResponse, DNSZoneCreate, DNSRecordResponse, DNSRecordCreate, DNSRecordUpdate
from app.exceptions import SambaToolError
from app.database import log_activity

router = APIRouter()

@router.get("", response_model=List[DNSZoneResponse])
def list_dns_zones(
    current_user: dict = Depends(require_permission("view_dns")),
):
    """List DNS zones. Requires view_dns permission."""
    try:
        zones = dns_tool.list_zones()
        return zones
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("", response_model=dict)
def create_dns_zone(
    zone: DNSZoneCreate,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Create a new DNS zone. Restricted to Domain Admins."""
    try:
        result = dns_tool.create_zone(zone.name)
        log_activity(current_user.get("username", "system"), "CREATE", "DNS Zone", zone.name, "Created DNS Zone")
        return {"message": "Zone created successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{zone_name}", response_model=dict)
def delete_dns_zone(
    zone_name: str,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Delete a DNS zone. Restricted to Domain Admins."""
    try:
        result = dns_tool.delete_zone(zone_name)
        log_activity(current_user.get("username", "system"), "DELETE", "DNS Zone", zone_name, "Deleted DNS Zone")
        return {"message": "Zone deleted successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{zone_name}/records", response_model=List[DNSRecordResponse])
def list_dns_records(
    zone_name: str,
    current_user: dict = Depends(require_permission("view_dns")),
):
    """List DNS records for a zone. Requires view_dns permission."""
    try:
        records = dns_tool.list_records(zone_name)
        return records
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{zone_name}/records", response_model=dict)
def add_dns_record(
    zone_name: str,
    record: DNSRecordCreate,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Add a new DNS record to a zone. Restricted to Domain Admins."""
    try:
        result = dns_tool.add_record(zone_name, record.name, record.type, record.data)
        log_activity(current_user.get("username", "system"), "CREATE", "DNS Record", record.name, f"Added {record.type} record to {zone_name}")
        return {"message": "Record added successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{zone_name}/records", response_model=dict)
def delete_dns_record(
    zone_name: str,
    name: str,
    type: str,
    data: str,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Delete a DNS record from a zone. Restricted to Domain Admins."""
    try:
        result = dns_tool.delete_record(zone_name, name, type, data)
        log_activity(current_user.get("username", "system"), "DELETE", "DNS Record", name, f"Deleted {type} record from {zone_name}")
        return {"message": "Record deleted successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{zone_name}/records", response_model=dict)
def update_dns_record(
    zone_name: str,
    name: str,
    type: str,
    record: DNSRecordUpdate,
    current_user: dict = Depends(require_role(["Domain Admins"])),
):
    """Update a DNS record in a zone. Restricted to Domain Admins."""
    try:
        result = dns_tool.update_record(zone_name, name, type, record.old_data, record.new_data)
        log_activity(current_user.get("username", "system"), "UPDATE", "DNS Record", name, f"Updated {type} record in {zone_name}")
        return {"message": "Record updated successfully", "detail": result}
    except SambaToolError as e:
        raise HTTPException(status_code=400, detail=str(e))