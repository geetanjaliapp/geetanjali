"""Database connection and session management."""

from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from config import settings

is_sqlite = "sqlite" in settings.DATABASE_URL

engine_kwargs: dict[str, Any] = {
    # SQL echo is very verbose - only enable explicitly, not with general DEBUG
    "echo": settings.DB_ECHO,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_recycle": settings.DB_POOL_RECYCLE,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "pool_pre_ping": settings.DB_POOL_PRE_PING,
            "connect_args": {"connect_timeout": 10},
        }
    )

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.

    Yields:
        Database session

    Usage:
        @app.get("/endpoint")
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection(timeout: int = 2) -> bool:
    """
    Check if database connection is healthy.

    Args:
        timeout: Maximum time to wait in seconds

    Returns:
        True if connection is healthy, False otherwise
    """
    try:
        import signal

        def timeout_handler(signum, frame):
            raise TimeoutError("Database health check timeout")

        # Set timeout alarm (Unix only)
        try:
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(timeout)

            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()

            signal.alarm(0)  # Cancel alarm
            return True
        except AttributeError:
            # SIGALRM not available (Windows), do basic check without timeout
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            return True
    except TimeoutError:
        return False
    except (OperationalError, SQLAlchemyError):
        # Database connection or query errors
        return False
