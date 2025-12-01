"""Output model for consulting briefs."""

from sqlalchemy import Column, String, Text, ForeignKey, JSON, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
import uuid

from models.base import Base


class Output(Base):
    """Output model for generated consulting briefs."""

    __tablename__ = "outputs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    result_json = Column(JSON, nullable=False)  # Complete output structure
    executive_summary = Column(Text)
    confidence = Column(Float)  # 0.0 to 1.0
    scholar_flag = Column(Boolean, default=False, index=True)
    reviewed_by = Column(String(36), ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, index=True)  # Index for chronological queries

    # Relationships
    case = relationship("Case", back_populates="outputs")
    reviewer = relationship("User", foreign_keys=[reviewed_by], back_populates="reviewed_outputs")
    message = relationship("Message", back_populates="output", uselist=False)  # One-to-one with assistant message

    def __repr__(self) -> str:
        return f"<Output(id={self.id}, case_id={self.case_id}, confidence={self.confidence})>"
