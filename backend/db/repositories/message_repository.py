"""Repository for Message model operations."""

from datetime import datetime

from sqlalchemy.orm import Session

from db.repositories.base import BaseRepository
from models.message import Message, MessageRole


class MessageRepository(BaseRepository[Message]):
    """Repository for Message CRUD operations."""

    def __init__(self, db: Session):
        super().__init__(Message, db)

    def get_by_case(self, case_id: str) -> list[Message]:
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
        result: Message = self.create(message_data)
        return result

    def create_assistant_message(
        self, case_id: str, content: str, output_id: str | None = None
    ) -> Message:
        """
        Create a new assistant message, optionally linked to an output.

        For initial consultations, output_id links to the full Output record.
        For follow-up conversations, output_id is None (no Output generated).

        Args:
            case_id: Case ID
            content: Message content (executive summary or follow-up response)
            output_id: Associated output ID (None for follow-up responses)

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
        result: Message = self.create(message_data)
        return result

    def get_last_user_message(self, case_id: str) -> Message | None:
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

    def delete_assistant_messages_after(
        self, case_id: str, after_timestamp: datetime
    ) -> int:
        """
        Delete all assistant messages for a case created after the given timestamp.
        Used during retry to clean up orphaned/duplicate assistant messages.

        Args:
            case_id: Case ID
            after_timestamp: Delete messages created after this time

        Returns:
            Number of deleted messages
        """
        deleted = (
            self.db.query(Message)
            .filter(
                Message.case_id == case_id,
                Message.role == MessageRole.ASSISTANT,
                Message.created_at > after_timestamp,
            )
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return deleted
