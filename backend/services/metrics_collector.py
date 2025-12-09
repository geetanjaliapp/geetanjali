"""Metrics collector for Prometheus gauges.

Collects business and infrastructure metrics from the database and Redis,
updating Prometheus gauges for scraping.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import func, text

from db.connection import SessionLocal
from models.user import User
from models.case import Case
from models.output import Output
from models.verse import Verse
from services.cache import get_redis_client
from utils.metrics import (
    consultations_total,
    verses_served_total,
    exports_total,
    registered_users_total,
    active_users_24h,
    redis_connections,
    redis_memory_usage_percent,
)

logger = logging.getLogger(__name__)


def collect_metrics() -> None:
    """Collect all application metrics and update Prometheus gauges."""
    try:
        _collect_business_metrics()
        _collect_redis_metrics()
        logger.debug("Metrics collection completed")
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")


def _collect_business_metrics() -> None:
    """Collect business metrics from the database."""
    db = SessionLocal()
    try:
        # Total consultations (completed cases)
        consultation_count = (
            db.query(func.count(Case.id))
            .filter(Case.status == "completed")
            .filter(Case.is_deleted == False)
            .scalar()
            or 0
        )
        consultations_total.set(consultation_count)

        # Total verses served (count verses referenced in outputs)
        # Each output contains verse references in result_json
        verse_count = db.query(func.count(Verse.id)).scalar() or 0
        verses_served_total.set(verse_count)

        # Total exports (outputs generated)
        export_count = db.query(func.count(Output.id)).scalar() or 0
        exports_total.set(export_count)

        # Total registered users
        user_count = db.query(func.count(User.id)).scalar() or 0
        registered_users_total.set(user_count)

        # Active users in last 24 hours
        yesterday = datetime.utcnow() - timedelta(hours=24)
        active_count = (
            db.query(func.count(User.id))
            .filter(User.last_login >= yesterday)
            .scalar()
            or 0
        )
        active_users_24h.set(active_count)

        logger.debug(
            f"Business metrics: consultations={consultation_count}, "
            f"verses={verse_count}, exports={export_count}, "
            f"users={user_count}, active_24h={active_count}"
        )
    except Exception as e:
        logger.error(f"Failed to collect business metrics: {e}")
    finally:
        db.close()


def _collect_redis_metrics() -> None:
    """Collect Redis infrastructure metrics."""
    client = get_redis_client()
    if not client:
        redis_connections.set(0)
        redis_memory_usage_percent.set(0)
        return

    try:
        info = client.info()

        # Active connections
        connected_clients = info.get("connected_clients", 0)
        redis_connections.set(connected_clients)

        # Memory usage percentage
        used_memory = info.get("used_memory", 0)
        maxmemory = info.get("maxmemory", 0)
        if maxmemory > 0:
            memory_pct = (used_memory / maxmemory) * 100
            redis_memory_usage_percent.set(round(memory_pct, 2))
        else:
            # No maxmemory set, report 0
            redis_memory_usage_percent.set(0)

        logger.debug(
            f"Redis metrics: connections={connected_clients}, "
            f"memory_used={used_memory}, maxmemory={maxmemory}"
        )
    except Exception as e:
        logger.error(f"Failed to collect Redis metrics: {e}")
        redis_connections.set(0)
        redis_memory_usage_percent.set(0)
