#!/usr/bin/env python3
"""Initialize database with all tables."""

from sqlalchemy import text
from db.connection import engine
from models.case import Case
from models.output import Output
from models.message import Message
from models.verse import Verse
from models.base import Base

def init_db():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully!")

    # Verify tables were created
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result]
        print(f"✓ Tables created: {', '.join(tables)}")

if __name__ == "__main__":
    init_db()
