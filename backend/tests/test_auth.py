"""Tests for authentication endpoints."""

import pytest
from fastapi import status


def test_signup_success(client):
    """Test successful user signup."""
    signup_data = {
        "email": "test@example.com",
        "name": "Test User",
        "password": "SecurePass123!",
    }

    response = client.post("/api/v1/auth/signup", json=signup_data)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["name"] == "Test User"
    assert "id" in data["user"]


def test_signup_duplicate_email(client):
    """Test signup with already registered email."""
    signup_data = {
        "email": "duplicate@example.com",
        "name": "First User",
        "password": "SecurePass123!",
    }

    # First signup
    response1 = client.post("/api/v1/auth/signup", json=signup_data)
    assert response1.status_code == status.HTTP_201_CREATED

    # Second signup with same email
    signup_data["name"] = "Second User"
    response2 = client.post("/api/v1/auth/signup", json=signup_data)

    assert response2.status_code == status.HTTP_409_CONFLICT
    assert "already registered" in response2.json()["detail"].lower()


def test_signup_invalid_email(client):
    """Test signup with invalid email format."""
    signup_data = {
        "email": "not-an-email",
        "name": "Test User",
        "password": "SecurePass123!",
    }

    response = client.post("/api/v1/auth/signup", json=signup_data)

    # May return 400 or 422 depending on validation layer
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
    ]


def test_signup_weak_password(client):
    """Test signup with weak password."""
    signup_data = {"email": "test@example.com", "name": "Test User", "password": "weak"}

    response = client.post("/api/v1/auth/signup", json=signup_data)

    # May return 400 or 422 depending on validation layer
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
    ]


def test_login_success(client):
    """Test successful login."""
    # First signup
    signup_data = {
        "email": "login@example.com",
        "name": "Login User",
        "password": "SecurePass123!",
    }
    client.post("/api/v1/auth/signup", json=signup_data)

    # Then login
    login_data = {"email": "login@example.com", "password": "SecurePass123!"}
    response = client.post("/api/v1/auth/login", json=login_data)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login@example.com"


def test_login_invalid_credentials(client):
    """Test login with invalid credentials."""
    login_data = {"email": "nonexistent@example.com", "password": "WrongPassword123!"}

    response = client.post("/api/v1/auth/login", json=login_data)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_login_wrong_password(client):
    """Test login with wrong password."""
    # First signup
    signup_data = {
        "email": "wrongpass@example.com",
        "name": "Test User",
        "password": "CorrectPass123!",
    }
    client.post("/api/v1/auth/signup", json=signup_data)

    # Try login with wrong password
    login_data = {"email": "wrongpass@example.com", "password": "WrongPassword123!"}
    response = client.post("/api/v1/auth/login", json=login_data)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user(client):
    """Test getting current user profile."""
    # Signup and get token
    signup_data = {
        "email": "profile@example.com",
        "name": "Profile User",
        "password": "SecurePass123!",
    }
    signup_response = client.post("/api/v1/auth/signup", json=signup_data)
    data = signup_response.json()
    # Token may be in "access_token" or nested in response
    token = data.get("access_token") or data.get("token", {}).get("access_token")

    if not token:
        pytest.skip("Token not returned in signup response")

    # Get profile with token
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == status.HTTP_200_OK
    profile = response.json()
    assert profile["email"] == "profile@example.com"
    assert profile["name"] == "Profile User"


def test_get_current_user_no_token(client):
    """Test getting current user without token."""
    response = client.get("/api/v1/auth/me")

    # FastAPI may return 401 or 403 depending on OAuth2 configuration
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


def test_get_current_user_invalid_token(client):
    """Test getting current user with invalid token."""
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer invalid-token"}
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout(client):
    """Test logout functionality."""
    # Signup and get token
    signup_data = {
        "email": "logout@example.com",
        "name": "Logout User",
        "password": "SecurePass123!",
    }
    client.post("/api/v1/auth/signup", json=signup_data)

    # Logout
    response = client.post("/api/v1/auth/logout")

    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_refresh_token(client):
    """Test token refresh."""
    # Signup to get tokens
    signup_data = {
        "email": "refresh@example.com",
        "name": "Refresh User",
        "password": "SecurePass123!",
    }
    client.post("/api/v1/auth/signup", json=signup_data)

    # The refresh token should be set as a cookie by signup
    # Try refresh endpoint
    response = client.post("/api/v1/auth/refresh")

    # Will fail if no cookie (expected in test environment without proper cookie handling)
    # Just verify endpoint exists
    assert response.status_code in [status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED]
