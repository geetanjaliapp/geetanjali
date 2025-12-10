"""Tests for follow-up conversation endpoint and pipeline."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status

from services.follow_up import FollowUpPipeline, FollowUpResult
from services.prompts import build_follow_up_prompt, FOLLOW_UP_SYSTEM_PROMPT

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
                    {"title": "Accept the offer", "description": "Take the new opportunity"},
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
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"UniqueMsg_{i:02d}_content"}
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
                prior_output={"executive_summary": "Summary", "options": [], "sources": []},
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
    from models.case import Case
    from models.output import Output
    from models.message import Message, MessageRole
    from datetime import datetime

    # Create case
    case = Case(
        title="Test Case for Follow-up",
        description="I need to make a difficult decision about my career.",
        status="completed",
        role="Individual",
        stakeholders=["self"],
        constraints=[],
        horizon="short",
        sensitivity="low",
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
            "recommended_action": {"option": 1, "steps": ["Reflect", "Decide", "Act"], "sources": ["BG_2_47"]},
            "reflection_prompts": ["What is my dharma?"],
            "sources": [
                {"canonical_id": "BG_2_47", "paraphrase": "Act without attachment to fruits", "relevance": 0.9},
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

    return {"case": case, "output": output}


@pytest.fixture
def case_without_output(client, db_session):
    """Create a case without any consultation (no Output)."""
    from models.case import Case

    case = Case(
        title="Pending Case",
        description="This case has no consultation yet.",
        status="pending",
        role="Individual",
        stakeholders=["self"],
        constraints=[],
        horizon="short",
        sensitivity="low",
    )
    db_session.add(case)
    db_session.commit()

    return {"case": case}


def test_follow_up_requires_completed_consultation(client, case_without_output):
    """Test that follow-up fails if case has no Output."""
    case_id = case_without_output["case"].id

    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": "What about option 2?"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "no consultation" in response.json()["detail"].lower()


def test_follow_up_validates_content(client, case_with_output):
    """Test that follow-up applies content filter."""
    case_id = case_with_output["case"].id

    # Try explicit content
    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": "How do I fuck up my competitors?"},
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_follow_up_returns_response(client, case_with_output):
    """Test successful follow-up returns markdown response."""
    case_id = case_with_output["case"].id

    # Mock the LLM service to avoid actual API calls
    mock_result = FollowUpResult(
        content="Option 2 (Stay steady) emphasizes stability, as taught in BG_3_19.",
        model="test-model",
        provider="mock",
        input_tokens=100,
        output_tokens=50,
    )

    with patch("api.follow_up.get_follow_up_pipeline") as mock_pipeline:
        mock_pipeline.return_value.run.return_value = mock_result

        response = client.post(
            f"/api/v1/cases/{case_id}/follow-up",
            json={"content": "Tell me more about Option 2"},
        )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message_id" in data
    assert data["content"] == "Option 2 (Stay steady) emphasizes stability, as taught in BG_3_19."
    assert data["role"] == "assistant"
    assert "created_at" in data


def test_follow_up_creates_messages(client, case_with_output, db_session):
    """Test that follow-up creates both user and assistant messages."""
    from models.message import Message

    case_id = case_with_output["case"].id

    # Count messages before
    messages_before = db_session.query(Message).filter(Message.case_id == case_id).count()

    # Mock the LLM service
    mock_result = FollowUpResult(
        content="Follow-up response",
        model="test-model",
        provider="mock",
    )

    with patch("api.follow_up.get_follow_up_pipeline") as mock_pipeline:
        mock_pipeline.return_value.run.return_value = mock_result

        client.post(
            f"/api/v1/cases/{case_id}/follow-up",
            json={"content": "My follow-up question"},
        )

    # Count messages after
    messages_after = db_session.query(Message).filter(Message.case_id == case_id).count()

    # Should have 2 more messages (user question + assistant response)
    assert messages_after == messages_before + 2


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

    response = client.post(
        f"/api/v1/cases/{case_id}/follow-up",
        json={"content": ""},
    )

    # Pydantic should reject empty content (min_length=1)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
