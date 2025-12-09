"""Tests for metrics collector and Prometheus instrumentation."""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

from services.metrics_collector import (
    collect_metrics,
    _collect_business_metrics,
    _collect_redis_metrics,
)


class TestMetricsCollector:
    """Tests for the metrics collector module."""

    @patch("services.metrics_collector.SessionLocal")
    @patch("services.metrics_collector.get_redis_client")
    def test_collect_metrics_runs_without_error(self, mock_redis, mock_session):
        """Test that collect_metrics runs without raising exceptions."""
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        mock_db.query.return_value.filter.return_value.filter.return_value.scalar.return_value = 0
        mock_db.query.return_value.scalar.return_value = 0
        mock_db.query.return_value.filter.return_value.scalar.return_value = 0

        mock_redis.return_value = None  # Redis unavailable

        # Should not raise
        collect_metrics()

    @patch("services.metrics_collector.SessionLocal")
    @patch("services.metrics_collector.consultations_total")
    @patch("services.metrics_collector.verses_served_total")
    @patch("services.metrics_collector.exports_total")
    @patch("services.metrics_collector.registered_users_total")
    @patch("services.metrics_collector.active_users_24h")
    def test_collect_business_metrics_sets_gauges(
        self,
        mock_active,
        mock_users,
        mock_exports,
        mock_verses,
        mock_consultations,
        mock_session,
    ):
        """Test that business metrics are properly collected and set."""
        mock_db = MagicMock()
        mock_session.return_value = mock_db

        # Mock scalar returns for different queries
        mock_db.query.return_value.filter.return_value.filter.return_value.scalar.return_value = (
            10  # consultations
        )
        mock_db.query.return_value.scalar.side_effect = [
            100,  # verses
            50,   # exports
            25,   # users
        ]
        mock_db.query.return_value.filter.return_value.scalar.return_value = 5  # active

        _collect_business_metrics()

        mock_consultations.set.assert_called_once_with(10)
        mock_verses.set.assert_called_once_with(100)
        mock_exports.set.assert_called_once_with(50)
        mock_users.set.assert_called_once_with(25)
        mock_active.set.assert_called_once_with(5)
        mock_db.close.assert_called_once()

    @patch("services.metrics_collector.SessionLocal")
    def test_collect_business_metrics_handles_none_values(self, mock_session):
        """Test that None values from queries are handled as 0."""
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        mock_db.query.return_value.filter.return_value.filter.return_value.scalar.return_value = (
            None
        )
        mock_db.query.return_value.scalar.return_value = None
        mock_db.query.return_value.filter.return_value.scalar.return_value = None

        # Should not raise
        _collect_business_metrics()
        mock_db.close.assert_called_once()

    @patch("services.metrics_collector.SessionLocal")
    def test_collect_business_metrics_handles_exception(self, mock_session):
        """Test that database exceptions are caught and logged."""
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        mock_db.query.side_effect = Exception("Database error")

        # Should not raise
        _collect_business_metrics()
        mock_db.close.assert_called_once()

    @patch("services.metrics_collector.get_redis_client")
    @patch("services.metrics_collector.redis_connections")
    @patch("services.metrics_collector.redis_memory_usage_percent")
    @patch("services.metrics_collector.queue_depth")
    @patch("services.metrics_collector.worker_count")
    def test_collect_redis_metrics_sets_gauges(
        self, mock_worker, mock_queue, mock_memory, mock_connections, mock_redis
    ):
        """Test that Redis metrics are properly collected."""
        mock_client = MagicMock()
        mock_redis.return_value = mock_client
        mock_client.info.return_value = {
            "connected_clients": 5,
            "used_memory": 1000000,
            "maxmemory": 10000000,
        }
        mock_client.llen.return_value = 3
        mock_client.smembers.return_value = {"worker1", "worker2"}

        _collect_redis_metrics()

        mock_connections.set.assert_called_once_with(5)
        mock_memory.set.assert_called_once_with(10.0)  # 10% usage
        mock_queue.set.assert_called_once_with(3)
        mock_worker.set.assert_called_once_with(2)

    @patch("services.metrics_collector.get_redis_client")
    @patch("services.metrics_collector.redis_connections")
    @patch("services.metrics_collector.redis_memory_usage_percent")
    @patch("services.metrics_collector.queue_depth")
    @patch("services.metrics_collector.worker_count")
    def test_collect_redis_metrics_handles_no_maxmemory(
        self, mock_worker, mock_queue, mock_memory, mock_connections, mock_redis
    ):
        """Test Redis metrics when maxmemory is not set."""
        mock_client = MagicMock()
        mock_redis.return_value = mock_client
        mock_client.info.return_value = {
            "connected_clients": 3,
            "used_memory": 500000,
            "maxmemory": 0,
        }
        mock_client.llen.return_value = 0
        mock_client.smembers.return_value = set()

        _collect_redis_metrics()

        mock_connections.set.assert_called_once_with(3)
        mock_memory.set.assert_called_once_with(0)

    @patch("services.metrics_collector.get_redis_client")
    @patch("services.metrics_collector.redis_connections")
    @patch("services.metrics_collector.redis_memory_usage_percent")
    @patch("services.metrics_collector.queue_depth")
    @patch("services.metrics_collector.worker_count")
    def test_collect_redis_metrics_handles_unavailable_redis(
        self, mock_worker, mock_queue, mock_memory, mock_connections, mock_redis
    ):
        """Test Redis metrics when Redis is unavailable."""
        mock_redis.return_value = None

        _collect_redis_metrics()

        mock_connections.set.assert_called_once_with(0)
        mock_memory.set.assert_called_once_with(0)
        mock_queue.set.assert_called_once_with(0)
        mock_worker.set.assert_called_once_with(0)

    @patch("services.metrics_collector.get_redis_client")
    @patch("services.metrics_collector.redis_connections")
    @patch("services.metrics_collector.redis_memory_usage_percent")
    @patch("services.metrics_collector.queue_depth")
    @patch("services.metrics_collector.worker_count")
    def test_collect_redis_metrics_handles_exception(
        self, mock_worker, mock_queue, mock_memory, mock_connections, mock_redis
    ):
        """Test Redis metrics when an exception occurs."""
        mock_client = MagicMock()
        mock_redis.return_value = mock_client
        mock_client.info.side_effect = Exception("Redis error")

        # Should not raise
        _collect_redis_metrics()

        mock_connections.set.assert_called_with(0)
        mock_memory.set.assert_called_with(0)
        mock_queue.set.assert_called_with(0)
        mock_worker.set.assert_called_with(0)


class TestMetricsScheduler:
    """Tests for the metrics scheduler."""

    @patch("utils.metrics_scheduler._scheduler")
    def test_start_metrics_scheduler(self, mock_scheduler):
        """Test that scheduler starts correctly."""
        from utils.metrics_scheduler import start_metrics_scheduler

        mock_func = MagicMock()
        start_metrics_scheduler(mock_func, interval_seconds=60)

        # Scheduler should be started
        mock_scheduler.start.assert_called_once()

    @patch("utils.metrics_scheduler._scheduler")
    def test_stop_metrics_scheduler(self, mock_scheduler):
        """Test that scheduler stops correctly."""
        from utils.metrics_scheduler import stop_metrics_scheduler

        mock_scheduler.running = True
        stop_metrics_scheduler()

        mock_scheduler.shutdown.assert_called_once()
