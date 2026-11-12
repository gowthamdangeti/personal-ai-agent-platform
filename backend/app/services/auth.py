import base64
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

ph = PasswordHasher()


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_access_token(user_id: uuid.UUID, email: str, role: str, expires_in_seconds: int = 86400 * 7) -> str:
    """Create a signed HMAC-SHA256 session token with expiration timestamp."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": int(time.time()) + expires_in_seconds,
        "iat": int(time.time()),
    }
    raw_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw_json).decode("utf-8").rstrip("=")
    
    secret = settings.secret_key.encode("utf-8")
    sig = hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")
    
    return f"{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    """Verify HMAC signature and expiration, returning claims."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts
        
        # Verify signature
        secret = settings.secret_key.encode("utf-8")
        expected_sig = hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).digest()
        
        # Pad base64 strings
        pad = len(sig_b64) % 4
        padded_sig = sig_b64 + ("=" * (4 - pad) if pad else "")
        provided_sig = base64.urlsafe_b64decode(padded_sig.encode("utf-8"))
        
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
        
        pad_p = len(payload_b64) % 4
        padded_payload = payload_b64 + ("=" * (4 - pad_p) if pad_p else "")
        payload_bytes = base64.urlsafe_b64decode(padded_payload.encode("utf-8"))
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        if payload.get("exp", 0) < time.time():
            return None
            
        return payload
    except Exception:
        return None


def set_auth_cookie(response: Response, token: str, max_age: int = 86400 * 7):
    """Set secure HttpOnly authentication cookie."""
    response.set_cookie(
        key="agent_auth_session",
        value=token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=False,  # dev friendly; set True behind https reverse proxy
        path="/",
    )


def clear_auth_cookie(response: Response):
    """Clear the session cookie upon logout."""
    response.delete_cookie(
        key="agent_auth_session",
        path="/",
        httponly=True,
        samesite="lax",
    )


async def get_current_user_optional(
    agent_auth_session: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Extract and verify user from HttpOnly cookie or Authorization Bearer header."""
    token = agent_auth_session
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    
    if not token:
        return None
        
    claims = decode_access_token(token)
    if not claims or "sub" not in claims:
        return None
        
    try:
        user_uuid = uuid.UUID(claims["sub"])
        user = await db.scalar(select(User).where(User.id == user_uuid, User.is_active == True))
        return user
    except Exception:
        return None


async def get_current_user(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Enforce authentication requirement."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

