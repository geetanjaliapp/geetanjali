"""Message model for conversation threading."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    """

    __tablename__ = "messages"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Content
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    output_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("outputs.id", ondelete="SET NULL"), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )

    # Relationships
    case = relationship("Case", back_populates="messages")
    output = relationship("Output", back_populates="message")

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, case_id={self.case_id}, role={self.role})>"
