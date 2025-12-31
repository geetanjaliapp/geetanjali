"""Tests for follow-up conversation endpoint and pipeline."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import status

from services.follow_up import FollowUpPipeline, FollowUpResult
from services.prompts import FOLLOW_UP_SYSTEM_PROMPT, build_follow_up_prompt

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


# ============================================================================
# Unit Tests for Prompts
# ============================================================================


class TestFollowUpPrompts:
    """Unit tests for follow-up prompt building."""

    @pytest.mark.unit
    def test_build_follow_up_prompt_basic(self):
        """Test basic prompt building."""
        prompt = build_follow_up_prompt(
            case_description="I need to decide whether to take a new job offer.",
            prior_output={
                "executive_summary": "This is a career decision requiring wisdom.",
                "options": [
                    {
                        "title": "Accept the offer",
                        "description": "Take the new opportunity",
                    },
                    {"title": "Stay put", "description": "Remain in current role"},
                    {"title": "Negotiate", "description": "Counter-offer"},
                ],
                "recommended_action": {"option": 1},
                "sources": [
                    {"canonical_id": "BG_2_47", "paraphrase": "Act without attachment"},
                ],
            },
            conversation=[],
            follow_up_question="What about work-life balance?",
        )

        # Check key sections are present
        assert "# Original Dilemma" in prompt
        assert "I need to decide" in prompt
        assert "# Prior Consultation Summary" in prompt
        assert "Accept the offer" in prompt
        assert "# Current Question" in prompt
        assert "work-life balance" in prompt

    @pytest.mark.unit
    def test_build_follow_up_prompt_with_conversation(self):
        """Test prompt building with conversation history."""
        prompt = build_follow_up_prompt(
            case_description="Career dilemma",
            prior_output={
                "executive_summary": "Summary",
                "options": [],
                "sources": [],
            },
            conversation=[
                {"role": "user", "content": "First question"},
                {"role": "assistant", "content": "First answer"},
                {"role": "user", "content": "Second question"},
                {"role": "assistant", "content": "Second answer"},
            ],
            follow_up_question="Third question?",
        )

        assert "# Recent Conversation" in prompt
        assert "First question" in prompt
        assert "First answer" in prompt
        assert "Second question" in prompt

    @pytest.mark.unit
    def test_build_follow_up_prompt_rolling_window(self):
        """Test that conversation is limited to rolling window."""
        # Create 12 messages (exceeds default 8) with unique identifiers
        conversation = [
            {
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"UniqueMsg_{i:02d}_content",
            }
            for i in range(12)
        ]

        prompt = build_follow_up_prompt(
            case_description="Test",
            prior_output={"executive_summary": "Summary", "options": [], "sources": []},
            conversation=conversation,
            follow_up_question="Question?",
            max_conversation_messages=8,
        )

        # First 4 messages should not be present (only last 8 are kept)
        assert "UniqueMsg_00_content" not in prompt
        assert "UniqueMsg_01_content" not in prompt
        assert "UniqueMsg_02_content" not in prompt
        assert "UniqueMsg_03_content" not in prompt
        # Last 8 messages should be present
        assert "UniqueMsg_04_content" in prompt
        assert "UniqueMsg_11_content" in prompt

    @pytest.mark.unit
    def test_follow_up_system_prompt_exists(self):
        """Test that system prompt has expected content."""
        assert "Geetanjali" in FOLLOW_UP_SYSTEM_PROMPT
        assert "Bhagavad Geeta" in FOLLOW_UP_SYSTEM_PROMPT
        assert "BG_X_Y" in FOLLOW_UP_SYSTEM_PROMPT
        assert "new consultation" in FOLLOW_UP_SYSTEM_PROMPT.lower()


# ============================================================================
# Unit Tests for FollowUpPipeline
# ============================================================================


class TestFollowUpPipeline:
    """Unit tests for FollowUpPipeline."""

    @pytest.mark.unit
    def test_pipeline_run_returns_result(self):
        """Test that pipeline.run returns FollowUpResult."""
        mock_llm = MagicMock()
        mock_llm.generate.return_value = {
            "response": "This is a follow-up response.",
            "model": "test-model",
            "provider": "mock",
            "input_tokens": 100,
            "output_tokens": 50,
        }

        with patch("services.follow_up.get_llm_service", return_value=mock_llm):
            pipeline = FollowUpPipeline()
            result = pipeline.run(
                case_description="Test case",
                prior_output={
                    "executive_summary": "Summary",
                    "options": [],
                    "sources": [],
                },
                conversation=[],
                follow_up_question="What about this?",
            )

        assert isinstance(result, FollowUpResult)
        assert result.content == "This is a follow-up response."
        assert result.model == "test-model"
        assert result.provider == "mock"
        assert result.input_tokens == 100
        assert result.output_tokens == 50


# ============================================================================
# Integration Tests for Follow-up Endpoint
# ============================================================================


@pytest.fixture
def case_with_output(client, db_session):
    """Create a case with a completed consultation (Output)."""
    import uuid
    from datetime import datetime

    from models.case import Case
    from models.message import Message, MessageRole
    from models.output import Output

    # Create case with session ID
    session_id = str(uuid.uuid4())
    case = Case(
        title="Test Case for Follow-up",
        description="I need to make a difficult decision about my career.",
        status="completed",
        role="Individual",
        stakeholders=["self"],
        constraints=[],
        horizon="short",
        sensitivity="low",
        session_id=session_id,
    )
    db_session.add(case)
    db_session.flush()

    # Create initial user message
    user_msg = Message(
        case_id=case.id,
        role=MessageRole.USER,
        content="I need to make a difficult decision about my career.",
        created_at=datetime.utcnow(),
    )
    db_session.add(user_msg)
    db_session.flush()

    # Create output
    output = Output(
        case_id=case.id,
        result_json={
            "executive_summary": "This is a career decision requiring careful consideration.",
            "options": [
                {
                    "title": "Option 1: Take the leap",
                    "description": "Accept the new opportunity",
                    "pros": ["Growth", "Challenge"],
                    "cons": ["Risk", "Uncertainty"],
                    "sources": ["BG_2_47"],
                },
                {
                    "title": "Option 2: Stay steady",
                    "description": "Remain in current position",
                    "pros": ["Stability", "Known"],
                    "cons": ["Stagnation"],
                    "sources": ["BG_3_19"],
                },
                {
                    "title": "Option 3: Negotiate",
                    "description": "Seek middle ground",
                    "pros": ["Balanced"],
                    "cons": ["Complex"],
                    "sources": ["BG_18_63"],
                },
            ],
            "recommended_action": {
                "option": 1,
                "steps": ["Reflect", "Decide", "Act"],
                "sources": ["BG_2_47"],
            },
            "reflection_prompts": ["What is my dharma?"],
            "sources": [
                {
                    "canonical_id": "BG_2_47",
                    "paraphrase": "Act without attachment to fruits",
                    "relevance": 0.9,
                },
            ],
            "confidence": 0.85,
            "scholar_flag": False,
        },
        executive_summary="This is a career decision requiring careful consideration.",
        confidence=0.85,
        scholar_flag=False,
    )
    db_session.add(output)
    db_session.flush()

    # Create assistant message
    assistant_msg = Message(
        case_id=case.id,
        role=MessageRole.ASSISTANT,
        content="This is a career decision requiring careful consideration.",
        output_id=output.id,
        created_at=datetime.utcnow(),
    )
    db_session.add(assistant_msg)
    db_session.commit()

    return {"case": case, "output": output, "session_id": session_id}


@pytest.fixture
def case_without_output(client, db_session):
    """Create a case without any consultation (no Output)."""
    import uuid

    from models.case import Case

    session_id = str(uuid.uuid4())
    case = Case(
        title="Pending Case",
        description="This case has no consultation yet.",
        status="pending",
        role="Individual",
        stakeholders=["self"],
        constraints=[],
        horizon="short",
        sensitivity="low",
        session_id=session_id,
    )
    db_session.add(case)
    db_session.commit()

    return {"case": case, "session_id": session_id}


def test_follow_up_requires_completed_consultation(client, case_without_output):
    """Test that follow-up fails if case has no Output."""
    case_id = case_without_output["case"].id
    session_id = case_without_output["session_id"]
    headers = {"X-Session-ID": session_id}

    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": "What about option 2?"},
        headers=headers,
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "no consultation" in response.json()["detail"].lower()


def test_follow_up_validates_content(client, case_with_output):
    """Test that follow-up applies content filter."""
    case_id = case_with_output["case"].id
    session_id = case_with_output["session_id"]
    headers = {"X-Session-ID": session_id}

    # Try explicit content
    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": "How do I fuck up my competitors?"},
        headers=headers,
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_follow_up_returns_response(client, case_with_output):
    """Test successful follow-up returns 202 Accepted with user message."""
    case_id = case_with_output["case"].id
    session_id = case_with_output["session_id"]
    headers = {"X-Session-ID": session_id}

    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": "Tell me more about Option 2"},
        headers=headers,
    )

    # Async endpoint returns 202 Accepted with user message immediately
    assert response.status_code == status.HTTP_202_ACCEPTED
    data = response.json()
    assert "id" in data
    assert data["case_id"] == case_id
    assert data["content"] == "Tell me more about Option 2"
    assert data["role"] == "user"
    assert "created_at" in data


def test_follow_up_creates_user_message(client, case_with_output, db_session):
    """Test that follow-up creates user message immediately (async processing)."""
    from models.case import Case
    from models.message import Message

    case_id = case_with_output["case"].id
    session_id = case_with_output["session_id"]
    headers = {"X-Session-ID": session_id}

    # Count messages before
    messages_before = (
        db_session.query(Message).filter(Message.case_id == case_id).count()
    )

    _response = client.post(  # noqa: F841 - response unused, testing side effects
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": "My follow-up question"},
        headers=headers,
    )

    # Refresh session to see changes
    db_session.expire_all()

    # Count messages after
    messages_after = (
        db_session.query(Message).filter(Message.case_id == case_id).count()
    )

    # Should have 1 more message (user message created immediately)
    # Assistant message is created in background task
    assert messages_after == messages_before + 1

    # Check that case status is set to processing
    case = db_session.query(Case).filter(Case.id == case_id).first()
    assert case.status == "processing"

    # Verify the user message content
    latest_message = (
        db_session.query(Message)
        .filter(Message.case_id == case_id)
        .order_by(Message.created_at.desc())
        .first()
    )
    assert latest_message.content == "My follow-up question"
    assert latest_message.role.value == "user"


def test_follow_up_invalid_case(client):
    """Test follow-up for non-existent case."""
    response = client.post(
        "/api/v1/cases/nonexistent-id/follow-up",
        json={"content": "Question?"},
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_follow_up_empty_content_rejected(client, case_with_output):
    """Test that empty content is rejected."""
    case_id = case_with_output["case"].id
    session_id = case_with_output["session_id"]
    headers = {"X-Session-ID": session_id}

    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": ""},
        headers=headers,
    )

    # Pydantic should reject empty content (min_length=1)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_follow_up_rejects_when_already_processing(
    client, case_with_output, db_session
):
    """Test that follow-up returns 409 Conflict when case is already processing."""
    from models.case import Case, CaseStatus

    case_id = case_with_output["case"].id
    session_id = case_with_output["session_id"]
    headers = {"X-Session-ID": session_id}

    # Set case status to processing
    case = db_session.query(Case).filter(Case.id == case_id).first()
    case.status = CaseStatus.PROCESSING.value
    db_session.commit()

    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": "Another follow-up question"},
        headers=headers,
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert "already being processed" in response.json()["detail"]
