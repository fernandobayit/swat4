from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserInfo"


class UserInfo(BaseModel):
    username: str
    display_name: str
    email: Optional[str] = None
    dn: str
    groups: List[str] = []


# ── Users ─────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=4)
    given_name: str = Field(..., alias="givenName")
    surname: str = Field(..., alias="sn")
    display_name: Optional[str] = Field(None, alias="displayName")
    email: Optional[str] = None
    ou: Optional[str] = None  # Target OU DN
    enabled: bool = True

    class Config:
        populate_by_name = True


class UserUpdate(BaseModel):
    given_name: Optional[str] = Field(None, alias="givenName")
    surname: Optional[str] = Field(None, alias="sn")
    display_name: Optional[str] = Field(None, alias="displayName")
    email: Optional[str] = None
    enabled: Optional[bool] = None
    password: Optional[str] = None

    class Config:
        populate_by_name = True


class UserResponse(BaseModel):
    dn: str
    username: str
    given_name: Optional[str] = None
    surname: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    enabled: bool = True
    when_created: Optional[str] = None
    member_of: List[str] = []
    ou: Optional[str] = None


# ── Groups ────────────────────────────────────────────
class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    description: Optional[str] = None
    ou: Optional[str] = None
    group_type: str = "Security"  # Security or Distribution


class GroupUpdate(BaseModel):
    description: Optional[str] = None


class GroupResponse(BaseModel):
    dn: str
    name: str
    description: Optional[str] = None
    members: List[str] = []
    member_count: int = 0
    group_type: Optional[str] = None
    ou: Optional[str] = None


class GroupMemberAction(BaseModel):
    members: List[str]  # List of usernames to add/remove


# ── GPOs ──────────────────────────────────────────────
class GPOCreate(BaseModel):
    display_name: str = Field(..., min_length=1)


class GPOUpdate(BaseModel):
    display_name: Optional[str] = None


class GPOResponse(BaseModel):
    name: str  # GUID
    display_name: str
    path: Optional[str] = None
    dn: Optional[str] = None
    version: Optional[str] = None
    flags: Optional[str] = None
    linked_ous: List[str] = []


class GPOLinkAction(BaseModel):
    ou_dn: str


# ── Shares ────────────────────────────────────────────
class ShareCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    path: str
    comment: Optional[str] = None
    veto_files: Optional[str] = None
    write_list: Optional[str] = None


class ShareUpdate(BaseModel):
    path: Optional[str] = None
    comment: Optional[str] = None
    veto_files: Optional[str] = None
    write_list: Optional[str] = None


class ShareResponse(BaseModel):
    name: str
    path: Optional[str] = None
    comment: Optional[str] = None
    veto_files: Optional[str] = None
    write_list: Optional[str] = None


# ── OUs ───────────────────────────────────────────────
class OUNode(BaseModel):
    dn: str
    name: str
    children: List["OUNode"] = []
    has_users: bool = False
    has_groups: bool = False
    has_gpos: bool = False


class OUCreate(BaseModel):
    name: str
    parent_dn: Optional[str] = None


# ── Logs ──────────────────────────────────────────────
class LogEntry(BaseModel):
    timestamp: Optional[str] = None
    level: Optional[str] = None
    source: Optional[str] = None
    message: str


class LogResponse(BaseModel):
    entries: List[LogEntry]
    total: int
    file: str


# ── DNS ───────────────────────────────────────────────
class DNSZoneResponse(BaseModel):
    name: str
    type: Optional[str] = None
    recordsCount: Optional[int] = 0

class DNSZoneCreate(BaseModel):
    name: str

class DNSRecordResponse(BaseModel):
    name: str
    type: str
    data: str

class DNSRecordCreate(BaseModel):
    name: str
    type: str # A, CNAME, TXT, etc.
    data: str

class DNSRecordUpdate(BaseModel):
    old_data: str
    new_data: str

# ── Domain ────────────────────────────────────────────
class PasswordPolicy(BaseModel):
    complexity_enabled: bool
    store_plaintext: bool
    history_length: int
    min_pwd_length: int
    min_pwd_age_days: int
    max_pwd_age_days: int
    lockout_duration_mins: int
    lockout_threshold: int
    reset_lockout_after_mins: int

class PasswordPolicyUpdate(BaseModel):
    complexity_enabled: Optional[bool] = None
    store_plaintext: Optional[bool] = None
    history_length: Optional[int] = None
    min_pwd_length: Optional[int] = None
    min_pwd_age_days: Optional[int] = None
    max_pwd_age_days: Optional[int] = None
    lockout_duration_mins: Optional[int] = None
    lockout_threshold: Optional[int] = None
    reset_lockout_after_mins: Optional[int] = None

# ── Roles ─────────────────────────────────────────────
class RoleSettingsSchema(BaseModel):
    visible_groups_regex: str = "^.*$"
    visible_groups_list: List[str] = []
    can_view_dns: bool = False
    can_manage_users: bool = False
    can_manage_groups: bool = False
    can_manage_shares: bool = False

# Rebuild models for forward references
OUNode.model_rebuild()
TokenResponse.model_rebuild()
