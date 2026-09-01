from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.ldap_auth import authenticate_user, check_group_membership
from app.auth.jwt_handler import create_access_token
from app.auth.dependencies import get_current_user
from app.models.schemas import LoginRequest, TokenResponse, UserInfo
from app.config import settings

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate user via LDAP and return JWT token."""
    user_data = authenticate_user(request.username, request.password)
    
    if user_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    # Check group membership
    if not check_group_membership(user_data["groups"], settings.allowed_groups_list):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of an authorized group",
        )
    
    # Create JWT
    token_data = {
        "sub": user_data["username"],
        "display_name": user_data["display_name"],
        "email": user_data["email"],
        "dn": user_data["dn"],
        "groups": user_data["groups"],
    }
    
    access_token = create_access_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        user=UserInfo(**user_data),
    )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info (from token)."""
    return current_user
