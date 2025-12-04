"""JWT token utilities for authentication."""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import secrets
import hashlib

from config import settings


def create_access_token(user_id: str, role: str) -> str:
    """
    Create a JWT access token.

    Args:
        user_id: User ID to encode in token
        role: User role to encode in token

    Returns:
        Encoded JWT access token string
    """
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,  # Subject (user ID)
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }
    return str(
        jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    )


def create_refresh_token() -> str:
    """
    Create a secure random refresh token.

    Returns:
        Random token string (64 hex characters)
    """
    return secrets.token_urlsafe(48)  # 48 bytes = 64 base64 characters


def hash_token(token: str) -> str:
    """
    Hash a refresh token for secure storage.

    Args:
        token: Refresh token to hash

    Returns:
        SHA256 hash of token
    """
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.

    Args:
        token: JWT token string to decode

    Returns:
        Decoded payload dict, or None if invalid/expired
    """
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )

        # Verify token type
        if payload.get("type") != "access":
            return None

        # Extract user_id and role
        user_id: str = payload.get("sub")
        role: str = payload.get("role")

        if user_id is None:
            return None

        return {"user_id": user_id, "role": role or "user", "exp": payload.get("exp")}

    except JWTError:
        return None
    except (KeyError, ValueError, TypeError):
        # Handle malformed payload or type mismatches
        return None
