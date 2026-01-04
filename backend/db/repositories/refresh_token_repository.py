"""Repository for RefreshToken model operations."""

from datetime import datetime

from sqlalchemy.orm import Session

from db.repositories.base import BaseRepository
from models.refresh_token import RefreshToken
from utils.jwt import hash_token


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    """Repository for refresh token CRUD operations."""

    def __init__(self, db: Session):
        super().__init__(RefreshToken, db)

    def create_for_user(self, user_id: str, token: str) -> RefreshToken:
        """
        Create a new refresh token for a user.

        Args:
            user_id: User ID
            token: Plain refresh token (will be hashed before storage)

        Returns:
            Created RefreshToken
        """
        token_data = {
            "user_id": user_id,
            "token_hash": hash_token(token),
            "expires_at": RefreshToken.default_expiry(),
            "revoked": False,
        }
        result: RefreshToken = self.create(token_data)
        return result

    def get_by_token(self, token: str) -> RefreshToken | None:
        """
        Get refresh token by plain token value.

        Args:
            token: Plain refresh token

        Returns:
            RefreshToken if found, None otherwise
        """
        token_hash_value = hash_token(token)
        return (
            self.db.query(RefreshToken)
            .filter(RefreshToken.token_hash == token_hash_value)
            .first()
        )

    def revoke_token(self, token_id: str) -> bool:
        """
        Revoke a specific refresh token.

        Args:
            token_id: Token ID to revoke

        Returns:
            True if revoked, False if not found
        """
        token = self.get(token_id)
        if not token:
            return False

        token.revoked = True
        self.db.commit()
        return True

    def revoke_all_for_user(self, user_id: str) -> int:
        """
        Revoke all refresh tokens for a user (logout from all devices).

        Args:
            user_id: User ID

        Returns:
            Number of tokens revoked
        """
        count = (
            self.db.query(RefreshToken)
            .filter(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
            .update({"revoked": True})
        )
        self.db.commit()
        return count

    def cleanup_expired(self) -> int:
        """
        Delete expired and revoked tokens (cleanup job).

        Returns:
            Number of tokens deleted
        """
        count = (
            self.db.query(RefreshToken)
            .filter(RefreshToken.expires_at < datetime.utcnow())
            .delete()
        )
        self.db.commit()
        return count
