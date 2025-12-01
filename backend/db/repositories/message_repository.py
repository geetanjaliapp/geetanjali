"""Repository for Message model operations."""

from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from models.message import Message, MessageRole
from db.repositories.base import BaseRepository


class MessageRepository(BaseRepository):
    """Repository for Message CRUD operations."""

    def __init__(self, db: Session):
        super().__init__(Message, db)

    def get_by_case(self, case_id: str) -> List[Message]:
        """
        Get all messages for a case, ordered chronologically.

        Args:
            case_id: Case ID

        Returns:
            List of messages ordered by created_at
        """
        return (
            self.db.query(Message)
            .filter(Message.case_id == case_id)
            .order_by(Message.created_at.asc())
            .all()
        )

    def create_user_message(self, case_id: str, content: str) -> Message:
        """
        Create a new user message.

        Args:
            case_id: Case ID
            content: Message content

        Returns:
            Created message
        """
        message_data = {
            "case_id": case_id,
            "role": MessageRole.USER,
            "content": content,
            "created_at": datetime.utcnow(),
        }
        return self.create(message_data)

    def create_assistant_message(
        self, case_id: str, content: str, output_id: str
    ) -> Message:
        """
        Create a new assistant message linked to an output.

        Args:
            case_id: Case ID
            content: Message content (typically executive summary)
            output_id: Associated output ID

        Returns:
            Created message
        """
        message_data = {
            "case_id": case_id,
            "role": MessageRole.ASSISTANT,
            "content": content,
            "output_id": output_id,
            "created_at": datetime.utcnow(),
        }
        return self.create(message_data)

    def get_last_user_message(self, case_id: str) -> Optional[Message]:
        """
        Get the most recent user message for a case.

        Args:
            case_id: Case ID

        Returns:
            Most recent user message or None
        """
        return (
            self.db.query(Message)
            .filter(Message.case_id == case_id, Message.role == MessageRole.USER)
            .order_by(Message.created_at.desc())
            .first()
        )
