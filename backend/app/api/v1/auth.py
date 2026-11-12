import uuid
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    BootstrapAdminRequest,
    LoginResponse,
    UserLoginRequest,
    UserRead,
)
from app.services.auth import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    hash_password,
    set_auth_cookie,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user with email and Argon2id password, setting secure HttpOnly cookie."""
    user = await db.scalar(
        select(User).where(func.lower(User.email) == payload.email.lower().strip())
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact administrator.",
        )

    expiry = 86400 * 30 if payload.remember_me else 86400 * 7
    token = create_access_token(user.id, user.email, user.role, expires_in_seconds=expiry)
    set_auth_cookie(response, token, max_age=expiry)

    return LoginResponse(
        status="success",
        message="Authentication successful",
        user=UserRead.model_validate(user),
        token=token,
    )


@router.post("/logout")
async def logout(response: Response):
    """Clear session authentication cookie."""
    clear_auth_cookie(response)
    return {"status": "success", "message": "Logged out successfully"}


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return current authenticated user profile."""
    return UserRead.model_validate(current_user)


@router.post("/bootstrap", response_model=UserRead)
async def bootstrap_admin(
    payload: BootstrapAdminRequest,
    db: AsyncSession = Depends(get_db),
):
    """Bootstrap initial administrator account if no admin user exists."""
    existing = await db.scalar(
        select(User).where(func.lower(User.email) == payload.email.lower().strip())
    )
    if existing:
        return UserRead.model_validate(existing)

    user = User(
        id=uuid.uuid4(),
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)

