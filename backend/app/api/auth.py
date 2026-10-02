from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    LogoutResponse,
)
from app.utils.auth import verify_password, create_access_token
from app.dependencies import get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates username and password.
    Returns JWT access token on success.
    Returns generic 401 on failure without revealing which field was incorrect.
    """
    user = db.query(User).filter(User.username == request.username.strip()).first()

    # Generic check to prevent user enumeration
    if not user or not verify_password(request.password, user.hashed_password):
        logger.warning(f"Failed login attempt for username: '{request.username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Issue JWT token
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    logger.info(f"Successful login for user '{user.username}' (Role: '{user.role}')")

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", response_model=LogoutResponse)
def logout():
    """
    Handles logout for stateless JWT architecture.
    The client removes the token from local storage / memory upon receiving this response.
    """
    return LogoutResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile and role.
    Requires a valid JWT Bearer token.
    """
    return UserResponse.model_validate(current_user)
