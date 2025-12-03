"""Initialize database with all tables."""

import sys
from pathlib import Path

# Add parent directory to path so we can import from backend
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from config import settings
from models.base import Base
from models.user import User
from models.case import Case
from models.message import Message
from models.output import Output
from models.refresh_token import RefreshToken
from models.verse import Verse, Translation

def init_database():
    """Create all database tables."""
    print(f"Initializing database: {settings.DATABASE_URL}")

    # Create engine
    engine = create_engine(settings.DATABASE_URL, echo=True)

    # Drop all tables (clean slate)
    print("Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)

    # Create all tables
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    print("✅ Database initialized successfully!")
    print(f"Tables created: {list(Base.metadata.tables.keys())}")

if __name__ == "__main__":
    init_database()
