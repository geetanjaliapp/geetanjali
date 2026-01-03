"""Base repository class."""

from typing import Any, Generic, TypeVar

from sqlalchemy.orm import Session

from models.base import Base

# TypeVar bound to SQLAlchemy Base for proper model typing
ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Base repository for common database operations."""

    model: type[ModelType]

    def __init__(self, model: type[ModelType], db: Session):
        """
        Initialize repository.

        Args:
            model: SQLAlchemy model class
            db: Database session
        """
        self.model = model
        self.db = db

    def get(self, id: str) -> ModelType | None:
        """
        Get a single record by ID.

        Args:
            id: Record ID

        Returns:
            Record or None if not found
        """
        # Use getattr to access id column dynamically (works with any model)
        id_column: Any = getattr(self.model, "id", None)
        if id_column is None:
            return None
        return self.db.query(self.model).filter(id_column == id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> list[ModelType]:
        """
        Get all records with pagination.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of records
        """
        return self.db.query(self.model).offset(skip).limit(limit).all()

    def create(self, obj_in: dict) -> ModelType:
        """
        Create a new record.

        Args:
            obj_in: Dictionary of field values

        Returns:
            Created record
        """
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def update(self, id: str, obj_in: dict) -> ModelType | None:
        """
        Update a record.

        Args:
            id: Record ID
            obj_in: Dictionary of field values to update

        Returns:
            Updated record or None if not found
        """
        db_obj = self.get(id)
        if not db_obj:
            return None

        for field, value in obj_in.items():
            setattr(db_obj, field, value)

        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, id: str) -> bool:
        """
        Delete a record.

        Args:
            id: Record ID

        Returns:
            True if deleted, False if not found
        """
        db_obj = self.get(id)
        if not db_obj:
            return False

        self.db.delete(db_obj)
        self.db.commit()
        return True
