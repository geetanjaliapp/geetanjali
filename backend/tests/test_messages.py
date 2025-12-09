"""Tests for message endpoints."""

import pytest
from fastapi import status


@pytest.fixture
def case_with_message(client):
    """Create a case for message testing."""
    case_data = {
        "title": "Message Test Case",
        "description": "Initial description for message testing",
        "sensitivity": "low",
    }
    response = client.post("/api/v1/cases", json=case_data)
    return response.json()


def test_get_messages_for_case(client, case_with_message):
    """Test getting messages for a case."""
    case_id = case_with_message["id"]

    response = client.get(f"/api/v1/cases/{case_id}/messages")

    assert response.status_code == status.HTTP_200_OK
    messages = response.json()
    assert isinstance(messages, list)
    # Should have at least the initial user message from case creation
    assert len(messages) >= 1
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Initial description for message testing"


def test_create_follow_up_message(client, case_with_message):
    """Test creating a follow-up message."""
    case_id = case_with_message["id"]
    message_data = {"content": "What about option C?"}

    response = client.post(f"/api/v1/cases/{case_id}/messages", json=message_data)

    assert response.status_code == status.HTTP_201_CREATED
    message = response.json()
    assert message["content"] == "What about option C?"
    assert message["role"] == "user"
    assert message["case_id"] == case_id
    assert "id" in message
    assert "created_at" in message


def test_get_messages_after_follow_up(client, case_with_message):
    """Test that messages list includes follow-up."""
    case_id = case_with_message["id"]

    # Add a follow-up message
    client.post(
        f"/api/v1/cases/{case_id}/messages", json={"content": "Follow-up question"}
    )

    # Get all messages
    response = client.get(f"/api/v1/cases/{case_id}/messages")

    assert response.status_code == status.HTTP_200_OK
    messages = response.json()
    assert len(messages) >= 2
    # Messages should be ordered chronologically
    contents = [m["content"] for m in messages]
    assert "Initial description for message testing" in contents
    assert "Follow-up question" in contents


def test_create_message_invalid_case(client):
    """Test creating message for non-existent case."""
    response = client.post(
        "/api/v1/cases/nonexistent-id/messages", json={"content": "Test message"}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_get_messages_invalid_case(client):
    """Test getting messages for non-existent case."""
    response = client.get("/api/v1/cases/nonexistent-id/messages")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_create_message_with_content(client, case_with_message):
    """Test creating message with content succeeds."""
    case_id = case_with_message["id"]

    response = client.post(
        f"/api/v1/cases/{case_id}/messages",
        json={"content": "A valid follow-up question"},
    )

    # Should succeed
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["content"] == "A valid follow-up question"


def test_messages_ordered_chronologically(client, case_with_message):
    """Test that messages are returned in chronological order."""
    case_id = case_with_message["id"]

    # Add multiple messages
    for i in range(3):
        client.post(
            f"/api/v1/cases/{case_id}/messages", json={"content": f"Message {i}"}
        )

    response = client.get(f"/api/v1/cases/{case_id}/messages")
    messages = response.json()

    # Verify chronological order by created_at
    timestamps = [m["created_at"] for m in messages]
    assert timestamps == sorted(timestamps)


def test_create_message_with_explicit_content_rejected(client, case_with_message):
    """Test that explicit content in follow-up messages is rejected (Layer 1)."""
    case_id = case_with_message["id"]

    # Try to post explicit content in follow-up
    response = client.post(
        f"/api/v1/cases/{case_id}/messages",
        json={"content": "How do I fuck up my career decisions?"},
    )

    # Should be rejected with 422
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "detail" in response.json()
    # Should contain educational message
    assert "Geetanjali" in response.json()["detail"]


def test_create_message_with_violent_content_rejected(client, case_with_message):
    """Test that violent content in follow-up messages is rejected."""
    case_id = case_with_message["id"]

    response = client.post(
        f"/api/v1/cases/{case_id}/messages",
        json={"content": "How do I kill someone who wronged me?"},
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "detail" in response.json()


def test_create_message_with_spam_content_rejected(client, case_with_message):
    """Test that spam/gibberish content in follow-up messages is rejected."""
    case_id = case_with_message["id"]

    # Very long repeated character sequence
    response = client.post(
        f"/api/v1/cases/{case_id}/messages",
        json={"content": "a" * 50},  # 50 repeated characters
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
