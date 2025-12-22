"""Metrics collector for Prometheus gauges.

Collects business and infrastructure metrics from the database and Redis,
updating Prometheus gauges for scraping.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import func, text
import httpx

from config import settings
from db.connection import SessionLocal
from models.user import User
from models.case import Case
from models.output import Output
from models.verse import Verse
from models.message import Message
from services.cache import get_redis_client
from utils.metrics import (
    consultations_total,
    verses_served_total,
    exports_total,
    registered_users_total,
    active_users_24h,
    consultations_24h,
    signups_24h,
    consultation_completion_rate,
    exports_24h,
    avg_messages_per_case,
    redis_connections,
    redis_memory_usage_percent,
    queue_depth,
    worker_count,
    postgres_connections_active,
    postgres_connections_idle,
    postgres_database_size_bytes,
    postgres_up,
    ollama_up,
    ollama_models_loaded,
    chromadb_up,
    chromadb_collection_count,
    newsletter_subscribers_total,
    newsletter_subscribers_by_time,
    newsletter_emails_sent_24h,
    shared_cases_total,
    case_views_24h,
    feedback_positive_rate,
)

logger = logging.getLogger(__name__)


def collect_metrics() -> None:
    """Collect all application metrics and update Prometheus gauges."""
    try:
        _collect_business_metrics()
        _collect_engagement_metrics()
        _collect_postgres_metrics()
        _collect_redis_metrics()
        _collect_ollama_metrics()
        _collect_chromadb_metrics()
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
            .filter(Case.is_deleted.is_(False))
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
            db.query(func.count(User.id)).filter(User.last_login >= yesterday).scalar()
            or 0
        )
        active_users_24h.set(active_count)

        # Consultations completed in last 24 hours
        consultations_24h_count = (
            db.query(func.count(Case.id))
            .filter(Case.status == "completed")
            .filter(Case.is_deleted.is_(False))
            .filter(Case.updated_at >= yesterday)
            .scalar()
            or 0
        )
        consultations_24h.set(consultations_24h_count)

        # New signups in last 24 hours
        signups_24h_count = (
            db.query(func.count(User.id))
            .filter(User.created_at >= yesterday)
            .scalar()
            or 0
        )
        signups_24h.set(signups_24h_count)

        # Consultation completion rate (completed / total non-deleted)
        total_cases = (
            db.query(func.count(Case.id))
            .filter(Case.is_deleted.is_(False))
            .scalar()
            or 0
        )
        if total_cases > 0:
            completion_rate = consultation_count / total_cases
            consultation_completion_rate.set(round(completion_rate, 3))
        else:
            consultation_completion_rate.set(0)

        # Exports in last 24 hours
        exports_24h_count = (
            db.query(func.count(Output.id))
            .filter(Output.created_at >= yesterday)
            .scalar()
            or 0
        )
        exports_24h.set(exports_24h_count)

        # Average messages per case (completed cases only)
        total_messages = db.query(func.count(Message.id)).scalar() or 0
        cases_with_messages = (
            db.query(func.count(func.distinct(Message.case_id))).scalar() or 0
        )
        if cases_with_messages > 0:
            avg_msgs = total_messages / cases_with_messages
            avg_messages_per_case.set(round(avg_msgs, 1))
        else:
            avg_messages_per_case.set(0)

        logger.debug(
            f"Business metrics: consultations={consultation_count}, "
            f"verses={verse_count}, exports={export_count}, "
            f"users={user_count}, active_24h={active_count}, "
            f"consultations_24h={consultations_24h_count}, signups_24h={signups_24h_count}, "
            f"completion_rate={completion_rate if total_cases > 0 else 0}"
        )
    except Exception as e:
        logger.error(f"Failed to collect business metrics: {e}")
    finally:
        db.close()


def _collect_engagement_metrics() -> None:
    """Collect newsletter and engagement metrics from the database."""
    db = SessionLocal()
    try:
        # Import models here to avoid circular imports
        from models.subscriber import Subscriber
        from models.feedback import Feedback

        yesterday = datetime.utcnow() - timedelta(hours=24)

        # Newsletter subscribers total (verified only)
        subscribers_count = (
            db.query(func.count(Subscriber.id))
            .filter(Subscriber.verified.is_(True))
            .filter(Subscriber.unsubscribed_at.is_(None))
            .scalar()
            or 0
        )
        newsletter_subscribers_total.set(subscribers_count)

        # Subscribers by send time
        for send_time in ["morning", "afternoon", "evening"]:
            count = (
                db.query(func.count(Subscriber.id))
                .filter(Subscriber.verified.is_(True))
                .filter(Subscriber.unsubscribed_at.is_(None))
                .filter(Subscriber.send_time == send_time)
                .scalar()
                or 0
            )
            newsletter_subscribers_by_time.labels(send_time=send_time).set(count)

        # Emails sent in last 24h (count subscribers with recent last_verse_sent_at)
        emails_24h = (
            db.query(func.count(Subscriber.id))
            .filter(Subscriber.last_verse_sent_at >= yesterday)
            .scalar()
            or 0
        )
        newsletter_emails_sent_24h.set(emails_24h)

        # Shared cases by mode
        for mode in ["public", "unlisted"]:
            count = (
                db.query(func.count(Case.id))
                .filter(Case.share_mode == mode)
                .filter(Case.is_deleted.is_(False))
                .scalar()
                or 0
            )
            shared_cases_total.labels(mode=mode).set(count)

        # Case views in last 24h (sum of view_count for recently viewed cases)
        # Since we don't track view timestamps, we use total view_count for shared cases
        total_views = (
            db.query(func.sum(Case.view_count))
            .filter(Case.share_mode.in_(["public", "unlisted"]))
            .filter(Case.is_deleted.is_(False))
            .scalar()
            or 0
        )
        case_views_24h.set(total_views)

        # Feedback positive rate
        total_feedback = db.query(func.count(Feedback.id)).scalar() or 0
        positive_feedback = (
            db.query(func.count(Feedback.id))
            .filter(Feedback.is_positive.is_(True))
            .scalar()
            or 0
        )
        if total_feedback > 0:
            positive_rate = positive_feedback / total_feedback
            feedback_positive_rate.set(round(positive_rate, 3))
        else:
            feedback_positive_rate.set(0)

        logger.debug(
            f"Engagement metrics: subscribers={subscribers_count}, "
            f"emails_24h={emails_24h}, views={total_views}, "
            f"feedback_positive_rate={positive_rate if total_feedback > 0 else 0}"
        )
    except Exception as e:
        logger.error(f"Failed to collect engagement metrics: {e}")
    finally:
        db.close()


def _collect_redis_metrics() -> None:
    """Collect Redis infrastructure metrics."""
    client = get_redis_client()
    if not client:
        redis_connections.set(0)
        redis_memory_usage_percent.set(0)
        queue_depth.set(0)
        worker_count.set(0)
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

        # RQ Queue depth (jobs waiting in geetanjali queue)
        queue_len = client.llen("rq:queue:geetanjali") or 0
        queue_depth.set(queue_len)

        # RQ Worker count (active workers)
        # RQ 2.x uses individual keys rq:worker:<name> instead of rq:workers set
        workers = client.keys("rq:worker:*") or []
        active_workers = len(workers)
        worker_count.set(active_workers)

        logger.debug(
            f"Redis metrics: connections={connected_clients}, "
            f"memory_used={used_memory}, maxmemory={maxmemory}, "
            f"queue_depth={queue_len}, workers={active_workers}"
        )
    except Exception as e:
        logger.error(f"Failed to collect Redis metrics: {e}")
        redis_connections.set(0)
        redis_memory_usage_percent.set(0)
        queue_depth.set(0)
        worker_count.set(0)


def _collect_postgres_metrics() -> None:
    """Collect PostgreSQL infrastructure metrics."""
    db = SessionLocal()
    try:
        # Check if PostgreSQL is up (implicit - if we can query, it's up)
        postgres_up.set(1)

        # Active and idle connections from pg_stat_activity
        result = db.execute(
            text(
                """
                SELECT
                    COUNT(*) FILTER (WHERE state = 'active') as active,
                    COUNT(*) FILTER (WHERE state = 'idle') as idle
                FROM pg_stat_activity
                WHERE datname = current_database()
            """
            )
        ).fetchone()

        active_conns = result[0] if result else 0
        idle_conns = result[1] if result else 0
        postgres_connections_active.set(active_conns)
        postgres_connections_idle.set(idle_conns)

        # Database size in bytes
        size_result = db.execute(
            text("SELECT pg_database_size(current_database())")
        ).scalar()
        postgres_database_size_bytes.set(size_result or 0)

        logger.debug(
            f"PostgreSQL metrics: active={active_conns}, idle={idle_conns}, "
            f"db_size={size_result}"
        )
    except Exception as e:
        logger.error(f"Failed to collect PostgreSQL metrics: {e}")
        postgres_up.set(0)
        postgres_connections_active.set(0)
        postgres_connections_idle.set(0)
        postgres_database_size_bytes.set(0)
    finally:
        db.close()


def _collect_ollama_metrics() -> None:
    """Collect Ollama/LLM infrastructure metrics."""
    try:
        # Check Ollama health and get loaded models
        response = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)

        if response.status_code == 200:
            ollama_up.set(1)
            data = response.json()
            models = data.get("models", [])
            ollama_models_loaded.set(len(models))
            logger.debug(f"Ollama metrics: up=1, models_loaded={len(models)}")
        else:
            ollama_up.set(0)
            ollama_models_loaded.set(0)
            logger.warning(f"Ollama returned status {response.status_code}")

    except Exception as e:
        logger.error(f"Failed to collect Ollama metrics: {e}")
        ollama_up.set(0)
        ollama_models_loaded.set(0)


def _collect_chromadb_metrics() -> None:
    """Collect ChromaDB/Vector store infrastructure metrics."""
    try:
        # Build ChromaDB URL from settings
        chroma_host = settings.CHROMA_HOST or "localhost"
        chroma_port = settings.CHROMA_PORT or 8000

        # Check ChromaDB heartbeat (using v2 API)
        response = httpx.get(
            f"http://{chroma_host}:{chroma_port}/api/v2/heartbeat", timeout=5.0
        )

        if response.status_code == 200:
            chromadb_up.set(1)

            # Get collection count (using v2 API)
            try:
                collections_response = httpx.get(
                    f"http://{chroma_host}:{chroma_port}/api/v2/tenants/default_tenant/databases/default_database/collections",
                    timeout=5.0,
                )
                if collections_response.status_code == 200:
                    collections = collections_response.json()
                    # Find gita_verses collection and get its count
                    for coll in collections:
                        if coll.get("name") == settings.CHROMA_COLLECTION_NAME:
                            # Get collection count via API
                            coll_id = coll.get("id")
                            base = f"http://{chroma_host}:{chroma_port}"
                            path = f"/api/v2/tenants/default_tenant/databases/default_database/collections/{coll_id}/count"
                            count_response = httpx.get(
                                f"{base}{path}",
                                timeout=5.0,
                            )
                            if count_response.status_code == 200:
                                chromadb_collection_count.set(count_response.json())
                            break
            except Exception as count_err:
                logger.debug(f"Could not get ChromaDB collection count: {count_err}")

            logger.debug("ChromaDB metrics: up=1")
        else:
            chromadb_up.set(0)
            chromadb_collection_count.set(0)
            logger.warning(f"ChromaDB returned status {response.status_code}")

    except Exception as e:
        logger.error(f"Failed to collect ChromaDB metrics: {e}")
        chromadb_up.set(0)
        chromadb_collection_count.set(0)
