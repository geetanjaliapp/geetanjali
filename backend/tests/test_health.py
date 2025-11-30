"""Tests for health check endpoints."""

import pytest
from fastapi import status


def test_health_check(client):
    """Test basic health check endpoint."""
    response = client.get("/health")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "Geetanjali"
    assert "environment" in data


def test_liveness_check(client):
    """Test liveness probe endpoint."""
    response = client.get("/health/live")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "alive"


def test_readiness_check(client):
    """Test readiness probe endpoint."""
    response = client.get("/health/ready")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "status" in data
    assert "checks" in data
    assert "database" in data["checks"]


def test_root_endpoint(client):
    """Test root endpoint."""
    response = client.get("/")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Geetanjali"
    assert data["status"] == "running"
    assert data["docs"] == "/docs"
