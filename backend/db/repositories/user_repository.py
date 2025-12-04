"""Repository for User model operations."""

from typing import Optional
from sqlalchemy.orm import Session

from models.user import User
from db.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    """Repository for user CRUD operations."""

    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
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
