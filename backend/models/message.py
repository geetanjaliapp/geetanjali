"""Message model for conversation threading."""

from sqlalchemy import Column, String, Text, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
import enum

from models.base import Base


class MessageRole(str, enum.Enum):
    """Message role enumeration."""
    USER = "user"
    ASSISTANT = "assistant"


class Message(Base):
    """
    Message model for conversation threading.

    Each message represents either:
    - A user's question/follow-up (role=USER)
    - An assistant's response (role=ASSISTANT, linked to an Output)

    Messages are ordered chronologically to form a conversation thread within a Case.
    """

    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(MessageRole), nullable=False, index=True)
    content = Column(Text, nullable=False)  # User's question or assistant's summary
    output_id = Column(String(36), ForeignKey("outputs.id", ondelete="SET NULL"), nullable=True)  # Only for assistant messages
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    case = relationship("Case", back_populates="messages")
    output = relationship("Output", back_populates="message")

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, case_id={self.case_id}, role={self.role})>"
