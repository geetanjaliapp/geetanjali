"""Tests for daily digest job and verse selection logic."""

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from jobs.daily_digest import (
    get_principles_for_goals,
    get_goal_labels,
    get_subscriber_name,
    should_show_reflection,
    get_reflection_prompt,
    update_30d_window,
    select_verse_for_subscriber,
    send_daily_digest,
    MILESTONE_MESSAGES,
    REFLECTION_PROMPTS,
    TIME_GREETINGS,
)


# =============================================================================
# Test get_principles_for_goals
# =============================================================================


class TestGetPrinciplesForGoals:
    """Tests for principle union logic."""

    def test_empty_goals_returns_empty_set(self):
        """Empty goal list returns empty set."""
        assert get_principles_for_goals([]) == set()

    def test_exploring_only_returns_empty_set(self):
        """Exploring goal has no principles."""
        assert get_principles_for_goals(["exploring"]) == set()

    def test_single_goal_returns_its_principles(self):
        """Single goal returns its mapped principles."""
        principles = get_principles_for_goals(["inner_peace"])
        # inner_peace maps to: samatvam, sthitaprajna, dhyana, tyaga
        assert "samatvam" in principles
        assert "dhyana" in principles
        assert len(principles) == 4

    def test_multiple_goals_returns_union(self):
        """Multiple goals return union of all principles."""
        principles = get_principles_for_goals(["inner_peace", "resilience"])
        # Both goals share some principles, union should have more
        assert "samatvam" in principles  # in both
        assert "shraddha" in principles  # in resilience
        assert "dhyana" in principles  # in inner_peace

    def test_exploring_mixed_with_real_goals(self):
        """Exploring mixed with real goals is filtered out."""
        principles = get_principles_for_goals(["exploring", "leadership"])
        # Should only get leadership principles
        assert "seva" in principles
        assert "dharma" in principles

    def test_invalid_goal_id_ignored(self):
        """Invalid goal IDs are silently ignored."""
        principles = get_principles_for_goals(["invalid_goal", "inner_peace"])
        # Should only get inner_peace principles
        assert len(principles) == 4


# =============================================================================
# Test get_goal_labels
# =============================================================================


class TestGetGoalLabels:
    """Tests for goal label formatting."""

    def test_empty_goals(self):
        """Empty goals returns default text."""
        assert get_goal_labels([]) == "exploring the Gita's wisdom"

    def test_single_goal(self):
        """Single goal returns its label."""
        label = get_goal_labels(["inner_peace"])
        assert label == "Inner Peace"

    def test_two_goals(self):
        """Two goals joined with 'and'."""
        label = get_goal_labels(["inner_peace", "resilience"])
        assert "Inner Peace" in label
        assert "Resilience" in label
        assert " and " in label

    def test_three_or_more_goals(self):
        """Three+ goals use Oxford comma."""
        label = get_goal_labels(["inner_peace", "resilience", "leadership"])
        assert ", and " in label

    def test_invalid_goal_id(self):
        """Invalid goal IDs are filtered out."""
        label = get_goal_labels(["invalid_goal"])
        assert label == "exploring the Gita's wisdom"


# =============================================================================
# Test get_subscriber_name
# =============================================================================


class TestGetSubscriberName:
    """Tests for subscriber name extraction."""

    def test_uses_name_when_present(self):
        """Uses subscriber name when available."""
        subscriber = MagicMock()
        subscriber.name = "John"
        subscriber.email = "john@example.com"
        assert get_subscriber_name(subscriber) == "John"

    def test_extracts_email_prefix_when_no_name(self):
        """Extracts and capitalizes email prefix when no name."""
        subscriber = MagicMock()
        subscriber.name = None
        subscriber.email = "jane.doe@example.com"
        assert get_subscriber_name(subscriber) == "Jane.doe"

    def test_capitalizes_email_prefix(self):
        """Email prefix is capitalized."""
        subscriber = MagicMock()
        subscriber.name = None
        subscriber.email = "user123@test.com"
        assert get_subscriber_name(subscriber) == "User123"


# =============================================================================
# Test reflection prompt logic
# =============================================================================


class TestReflectionPrompts:
    """Tests for reflection prompt timing."""

    def test_no_reflection_on_first_email(self):
        """No reflection prompt on first email."""
        assert should_show_reflection(1) is False

    def test_reflection_on_7th_email(self):
        """Reflection prompt on 7th email."""
        assert should_show_reflection(7) is False  # 7 is a milestone
        assert should_show_reflection(14) is True

    def test_no_reflection_on_milestones(self):
        """No reflection on milestone days."""
        for milestone in MILESTONE_MESSAGES.keys():
            assert should_show_reflection(milestone) is False

    def test_reflection_every_7th_non_milestone(self):
        """Reflection shows every 7th email (not on milestones)."""
        assert should_show_reflection(14) is True
        assert should_show_reflection(21) is True
        assert should_show_reflection(28) is True

    def test_get_reflection_prompt_rotates(self):
        """Reflection prompts rotate through the list."""
        prompts = [get_reflection_prompt(i * 7) for i in range(2, 10)]
        # Should cycle through REFLECTION_PROMPTS
        assert REFLECTION_PROMPTS[0] in prompts
        assert REFLECTION_PROMPTS[1] in prompts

    def test_get_reflection_prompt_returns_none_when_not_applicable(self):
        """Returns None when not a reflection day."""
        assert get_reflection_prompt(1) is None
        assert get_reflection_prompt(5) is None
        assert get_reflection_prompt(7) is None  # milestone


# =============================================================================
# Test 30-day window update
# =============================================================================


class TestUpdate30dWindow:
    """Tests for rolling window logic."""

    def test_adds_new_verse(self):
        """Adds new verse to the list."""
        result = update_30d_window(["v1", "v2"], "v3")
        assert result == ["v1", "v2", "v3"]

    def test_handles_empty_list(self):
        """Handles empty initial list."""
        result = update_30d_window([], "v1")
        assert result == ["v1"]

    def test_handles_none_list(self):
        """Handles None as initial list."""
        result = update_30d_window(None, "v1")
        assert result == ["v1"]

    def test_respects_max_size(self):
        """Keeps only last max_size entries."""
        initial = [f"v{i}" for i in range(30)]
        result = update_30d_window(initial, "v30", max_size=30)
        assert len(result) == 30
        assert "v0" not in result
        assert "v30" in result

    def test_custom_max_size(self):
        """Custom max_size is respected."""
        result = update_30d_window(["v1", "v2", "v3"], "v4", max_size=3)
        assert result == ["v2", "v3", "v4"]


# =============================================================================
# Test verse selection (integration with mock DB)
# =============================================================================


@pytest.mark.integration
@pytest.mark.postgresql
class TestSelectVerseForSubscriber:
    """Tests for verse selection logic (requires PostgreSQL for JSONB)."""

    @pytest.mark.skip(reason="Requires PostgreSQL JSONB (SQLite used in CI)")
    def test_selects_verse_by_principles(self, db_session):
        """Selects verse matching subscriber's goal principles."""
        from models import Verse, Subscriber

        # Create verse with matching principle
        verse = Verse(
            id="test-verse-1",
            canonical_id="BG_TEST_1",
            chapter=1,
            verse=1,
            consulting_principles=["dharma", "seva"],
        )
        db_session.add(verse)

        # Create subscriber with leadership goal (has dharma, seva)
        subscriber = Subscriber(
            id="test-sub-1",
            email="test@example.com",
            goal_ids=["leadership"],
            send_time="morning",
            verified=True,
        )
        db_session.add(subscriber)
        db_session.commit()

        result = select_verse_for_subscriber(db_session, subscriber, [])
        assert result is not None
        assert result.canonical_id == "BG_TEST_1"

    @pytest.mark.skip(reason="Requires PostgreSQL JSONB (SQLite used in CI)")
    def test_uses_featured_when_no_principles(self, db_session):
        """Uses featured verses when subscriber has no goals."""
        from models import Verse, Subscriber

        # Create featured verse
        featured = Verse(
            id="test-featured",
            canonical_id="BG_FEATURED_1",
            chapter=2,
            verse=47,
            is_featured=True,
        )
        # Create non-featured verse
        regular = Verse(
            id="test-regular",
            canonical_id="BG_REGULAR_1",
            chapter=3,
            verse=1,
            is_featured=False,
        )
        db_session.add_all([featured, regular])

        # Subscriber with exploring goal (no principles)
        subscriber = Subscriber(
            id="test-sub-2",
            email="explorer@example.com",
            goal_ids=["exploring"],
            send_time="morning",
            verified=True,
        )
        db_session.add(subscriber)
        db_session.commit()

        result = select_verse_for_subscriber(db_session, subscriber, [])
        assert result is not None
        assert result.is_featured is True

    @pytest.mark.skip(reason="Requires PostgreSQL JSONB (SQLite used in CI)")
    def test_excludes_recently_sent(self, db_session):
        """Excludes verses in the exclude list."""
        from models import Verse, Subscriber

        # Create two verses
        v1 = Verse(
            id="v1",
            canonical_id="BG_1_1",
            chapter=1,
            verse=1,
            is_featured=True,
        )
        v2 = Verse(
            id="v2",
            canonical_id="BG_1_2",
            chapter=1,
            verse=2,
            is_featured=True,
        )
        db_session.add_all([v1, v2])

        subscriber = Subscriber(
            id="test-sub-3",
            email="test3@example.com",
            goal_ids=[],
            send_time="morning",
            verified=True,
        )
        db_session.add(subscriber)
        db_session.commit()

        # Exclude first verse
        result = select_verse_for_subscriber(db_session, subscriber, ["BG_1_1"])
        assert result is not None
        assert result.canonical_id == "BG_1_2"


# =============================================================================
# Test send_daily_digest (with mocks)
# =============================================================================


class TestSendDailyDigest:
    """Tests for main digest orchestration."""

    def test_invalid_send_time_raises(self):
        """Invalid send_time raises ValueError."""
        with pytest.raises(ValueError, match="Invalid send_time"):
            send_daily_digest("invalid_time")

    @patch("jobs.daily_digest.SessionLocal")
    def test_returns_stats_when_no_subscribers(self, mock_session):
        """Returns stats with zeros when no subscribers."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []
        mock_session.return_value = mock_db

        stats = send_daily_digest("morning", dry_run=True)

        assert stats["subscribers_found"] == 0
        assert stats["sent"] == 0
        assert stats["failed"] == 0

    @pytest.mark.skip(reason="Requires PostgreSQL JSONB (SQLite used in CI)")
    def test_dry_run_does_not_send_email(self, db_session):
        """Dry run logs but doesn't send emails."""
        from models import Verse, Subscriber
        import secrets

        # Setup test data
        verse = Verse(
            id="test-v",
            canonical_id="BG_2_47",
            chapter=2,
            verse=47,
            is_featured=True,
            sanskrit_devanagari="कर्मण्येवाधिकारस्ते",
            translation_en="You have the right to work only.",
            paraphrase_en="Focus on action, not results.",
        )
        subscriber = Subscriber(
            id="test-s",
            email="dryrun@example.com",
            name="Dry Runner",
            goal_ids=["exploring"],
            send_time="morning",
            verified=True,
            verification_token=secrets.token_urlsafe(32),
            verses_sent_30d=[],
            verses_sent_count=0,
        )
        db_session.add_all([verse, subscriber])
        db_session.commit()

        with patch("jobs.daily_digest.SessionLocal", return_value=db_session):
            with patch("services.email.send_newsletter_digest_email") as mock_send:
                stats = send_daily_digest("morning", dry_run=True)

                # Email function should NOT be called in dry-run
                mock_send.assert_not_called()
                assert stats["sent"] == 1
                assert stats["failed"] == 0


# =============================================================================
# Test constants
# =============================================================================


class TestConstants:
    """Tests for module constants."""

    def test_time_greetings_complete(self):
        """All send times have greetings."""
        assert "morning" in TIME_GREETINGS
        assert "afternoon" in TIME_GREETINGS
        assert "evening" in TIME_GREETINGS

    def test_milestone_messages_at_expected_days(self):
        """Milestone messages at day 7, 30, 100, 365."""
        assert 7 in MILESTONE_MESSAGES
        assert 30 in MILESTONE_MESSAGES
        assert 100 in MILESTONE_MESSAGES
        assert 365 in MILESTONE_MESSAGES

    def test_reflection_prompts_not_empty(self):
        """Reflection prompts list is not empty."""
        assert len(REFLECTION_PROMPTS) > 0
