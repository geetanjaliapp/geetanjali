"""Repository for User model operations."""

from datetime import datetime

from sqlalchemy.orm import Session

from db.repositories.base import BaseRepository
from models.user import User


class UserRepository(BaseRepository):
    """Repository for user CRUD operations."""

    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> User | None:
        """
        Get user by email address.

        Args:
            email: Email address

        Returns:
            User if found, None otherwise
        """
        return self.db.query(User).filter(User.email == email).first()

    def email_exists(self, email: str) -> bool:
        """
        Check if email already exists.

        Args:
            email: Email address to check

        Returns:
            True if email exists, False otherwise
        """
        return self.db.query(User).filter(User.email == email).first() is not None

    def create_user(
        self, email: str, name: str, password_hash: str, role: str = "user"
    ) -> User:
        """
        Create a new user with hashed password.

        Args:
            email: User email
            name: User name
            password_hash: Hashed password
            role: User role (default: "user")

        Returns:
            Created user
        """
        user_data = {
            "email": email,
            "name": name,
            "password_hash": password_hash,
            "role": role,
            "email_verified": False,
        }
        result: User = self.create(user_data)  # type: ignore[assignment]
        return result

    def get_by_reset_token_id(self, token_id: str) -> User | None:
        """
        Get user by reset token ID (O(1) indexed lookup).

        Used for password reset token verification.
        Token ID is a SHA-256 hash of the token, allowing indexed lookup.

        Args:
            token_id: SHA-256 hash of the reset token

        Returns:
            User if found with valid (non-expired) token, None otherwise
        """
        return (
            self.db.query(User)
            .filter(User.reset_token_id == token_id)
            .filter(User.reset_token_expires > datetime.utcnow())
            .first()
        )

    def get_by_email_verification_token(self, token: str) -> User | None:
        """
        Get user by email verification token (O(1) indexed lookup).

        Args:
            token: Email verification token

        Returns:
            User if found, None otherwise (does not check expiry)
        """
        return (
            self.db.query(User).filter(User.email_verification_token == token).first()
        )

    def set_email_verification_token(
        self, user: User, token: str, expires_at: datetime
    ) -> None:
        """
        Set email verification token for user.

        Args:
            user: User to update
            token: Verification token
            expires_at: Token expiration datetime
        """
        user.email_verification_token = token
        user.email_verification_expires_at = expires_at
        self.db.commit()

    def verify_user_email(self, user: User) -> None:
        """
        Mark user email as verified and clear token fields.

        Args:
            user: User to verify
        """
        user.email_verified = True
        user.email_verified_at = datetime.utcnow()
        user.email_verification_token = None
        user.email_verification_expires_at = None
        self.db.commit()

    def clear_email_verification_token(self, user: User) -> None:
        """
        Clear email verification token without verifying.

        Used when token expires or is invalidated.

        Args:
            user: User to update
        """
        user.email_verification_token = None
        user.email_verification_expires_at = None
        self.db.commit()
