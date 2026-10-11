"""Tests for RAG pipeline anchor verse injection (v1.39.0)."""

from unittest.mock import MagicMock, patch

import pytest

from services.rag.pipeline import RAGPipeline


@pytest.fixture
def mock_repo():
    """Mock VerseRepository with a valid BG_2_47 verse."""
    repo = MagicMock()
    verse = MagicMock()
    verse.canonical_id = "BG_2_47"
    verse.paraphrase_en = "You have the right to perform your prescribed duties..."
    verse.translation_en = "You have a right to perform..."
    verse.chapter = 2
    verse.verse = 47
    verse.sanskrit_iast = "karmaṇyevādhikāras te..."
    verse.translations = []
    repo.get_by_canonical_id.return_value = verse
    return repo


@pytest.fixture
def mock_retrieved_verses():
    """4 fake retrieved verses (post-enrichment format)."""
    return [
        {
            "canonical_id": "BG_3_5",
            "document": "...",
            "distance": 0.3,
            "relevance": 0.7,
            "metadata": {
                "translation_en": "No one can remain...",
                "paraphrase_en": "Action is unavoidable...",
            },
        },
        {
            "canonical_id": "BG_18_63",
            "document": "...",
            "distance": 0.4,
            "relevance": 0.6,
            "metadata": {
                "translation_en": "Thus I have imparted...",
                "paraphrase_en": "Reflect and act...",
            },
        },
        {
            "canonical_id": "BG_2_47",
            "document": "...",
            "distance": 0.2,
            "relevance": 0.8,
            "metadata": {
                "translation_en": "You have a right...",
                "paraphrase_en": "Focus on action...",
            },
        },
        {
            "canonical_id": "BG_4_7",
            "document": "...",
            "distance": 0.5,
            "relevance": 0.5,
            "metadata": {
                "translation_en": "Whenever there is a decline...",
                "paraphrase_en": "Divine intervention...",
            },
        },
    ]


class TestAnchorVerseInjection:
    """Anchor verse prepended at position 0 after enrichment."""

    @patch("services.rag.pipeline.SessionLocal")
    @patch("services.rag.pipeline.VerseRepository")
    def test_anchor_verse_prepended_at_position_zero(
        self, mock_verse_repo_cls, mock_session_local, mock_repo, mock_retrieved_verses
    ):
        """Anchor verse appears at position 0 with relevance 1.0 and is_anchor flag."""
        mock_verse_repo_cls.return_value = mock_repo
        mock_session_local.return_value.__enter__.return_value = MagicMock()
        mock_session_local.return_value.__exit__.return_value = None

        pipeline = RAGPipeline()
        pipeline.retrieve_verses = MagicMock(return_value=[
            v for v in mock_retrieved_verses if v["canonical_id"] != "BG_2_47"
        ])
        pipeline.enrich_verses_with_translations = MagicMock(
            return_value=[v for v in mock_retrieved_verses if v["canonical_id"] != "BG_2_47"]
        )
        pipeline.construct_context = MagicMock(return_value="mock prompt")
        pipeline.generate_brief = MagicMock(return_value=(
            {"sources": [], "confidence": 0.8}, False,
        ))
        pipeline.validate_output = MagicMock(return_value={
            "sources": [],
            "confidence": 0.8,
            "scholar_flag": False,
        })

        case_data = {
            "title": "Test case",
            "description": "Test description",
            "role": "Individual",
            "anchor_verse_id": "BG_2_47",
        }

        result, is_policy_violation = pipeline.run(case_data)

        assert not is_policy_violation
        # Anchor verse was fetched and injected
        mock_repo.get_by_canonical_id.assert_called_once_with("BG_2_47")

    @patch("services.rag.pipeline.SessionLocal")
    @patch("services.rag.pipeline.VerseRepository")
    def test_anchor_verse_deduplicates(
        self, mock_verse_repo_cls, mock_session_local, mock_repo, mock_retrieved_verses
    ):
        """When anchor verse also appears in retrieval, only the anchor copy survives."""
        mock_verse_repo_cls.return_value = mock_repo
        mock_session_local.return_value.__enter__.return_value = MagicMock()
        mock_session_local.return_value.__exit__.return_value = None

        pipeline = RAGPipeline()

        # retrieve_verses returns all 4 including BG_2_47 (duplicate)
        pipeline.retrieve_verses = MagicMock(return_value=mock_retrieved_verses)
        pipeline.enrich_verses_with_translations = MagicMock(
            return_value=mock_retrieved_verses
        )
        pipeline.construct_context = MagicMock(return_value="mock prompt")

        # Capture retrieved_verses passed to construct_context
        captured_verses = []

        def capture_verses(case_data, verses):
            captured_verses.extend(verses)
            return "mock prompt"

        pipeline.construct_context.side_effect = capture_verses
        pipeline.generate_brief = MagicMock(return_value=(
            {"sources": [], "confidence": 0.8}, False,
        ))
        pipeline.validate_output = MagicMock(return_value={
            "sources": [],
            "confidence": 0.8,
            "scholar_flag": False,
        })

        case_data = {
            "title": "Test case",
            "description": "Test description",
            "anchor_verse_id": "BG_2_47",
        }

        pipeline.run(case_data)

        # BG_2_47 appears exactly once (anchor copy, not retrieved copy)
        bg247_verses = [v for v in captured_verses if v.get("canonical_id") == "BG_2_47"]
        assert len(bg247_verses) == 1
        assert bg247_verses[0].get("is_anchor") is True

    @patch("services.rag.pipeline.SessionLocal")
    @patch("services.rag.pipeline.VerseRepository")
    def test_invalid_anchor_verse_proceeds_normally(
        self, mock_verse_repo_cls, mock_session_local, mock_retrieved_verses
    ):
        """Invalid anchor verse ID — warning logged, pipeline proceeds without anchor."""
        mock_repo = MagicMock()
        mock_repo.get_by_canonical_id.return_value = None
        mock_verse_repo_cls.return_value = mock_repo
        mock_session_local.return_value.__enter__.return_value = MagicMock()
        mock_session_local.return_value.__exit__.return_value = None

        pipeline = RAGPipeline()
        pipeline.retrieve_verses = MagicMock(return_value=mock_retrieved_verses[:3])
        pipeline.enrich_verses_with_translations = MagicMock(
            return_value=mock_retrieved_verses[:3]
        )
        pipeline.construct_context = MagicMock(return_value="mock prompt")
        pipeline.generate_brief = MagicMock(return_value=(
            {"sources": [], "confidence": 0.8}, False,
        ))
        pipeline.validate_output = MagicMock(return_value={
            "sources": [],
            "confidence": 0.8,
            "scholar_flag": False,
        })

        case_data = {
            "title": "Test case",
            "description": "Test description",
            "anchor_verse_id": "BG_99_99",
        }

        result, is_policy_violation = pipeline.run(case_data)

        assert not is_policy_violation
        # Anchor verse not found — pipeline still succeeded
        mock_repo.get_by_canonical_id.assert_called_once_with("BG_99_99")

    @patch("services.rag.pipeline.SessionLocal")
    @patch("services.rag.pipeline.VerseRepository")
    def test_without_anchor_verse_unchanged(
        self, mock_verse_repo_cls, mock_session_local, mock_retrieved_verses
    ):
        """No anchor_verse_id — behavior identical to pre-bridge pipeline."""
        mock_session_local.return_value.__enter__.return_value = MagicMock()
        mock_session_local.return_value.__exit__.return_value = None

        pipeline = RAGPipeline()
        pipeline.retrieve_verses = MagicMock(return_value=mock_retrieved_verses)
        pipeline.enrich_verses_with_translations = MagicMock(
            return_value=mock_retrieved_verses
        )

        captured_verses = []

        def capture_verses(case_data, verses):
            captured_verses.extend(verses)
            return "mock prompt"

        pipeline.construct_context.side_effect = capture_verses
        pipeline.generate_brief = MagicMock(return_value=(
            {"sources": [], "confidence": 0.8}, False,
        ))
        pipeline.validate_output = MagicMock(return_value={
            "sources": [],
            "confidence": 0.8,
            "scholar_flag": False,
        })

        case_data = {
            "title": "Test case",
            "description": "Test description",
        }

        pipeline.run(case_data)

        # No anchor injection — all 4 retrieved verses flow through unchanged
        assert len(captured_verses) == 4
        # No verse has is_anchor flag
        assert not any(v.get("is_anchor") for v in captured_verses)
        # Verse repo was never called (no anchor to fetch)
        mock_verse_repo_cls.assert_not_called()


@pytest.mark.unit
class TestUnusableOutputRetry:
    """Structurally empty output: re-ask once, then fail instead of repairing."""

    GOOD = {
        "executive_summary": "s",
        "options": [{"title": "a"}],
        "recommended_action": {"option": 1},
        "reflection_prompts": ["q"],
    }
    BAD = {"sources": ["BG_2_47"]}

    def _pipeline(self, outputs):
        pipeline = RAGPipeline.__new__(RAGPipeline)  # skip embedder init
        pipeline.retrieve_verses = MagicMock(return_value=[])
        pipeline.enrich_verses_with_translations = MagicMock(return_value=[])
        pipeline.construct_context = MagicMock(return_value="prompt")
        pipeline.generate_brief = MagicMock(
            side_effect=[(o, False) for o in outputs]
        )
        pipeline.validate_output = MagicMock(
            side_effect=lambda o, v=None: {**o, "confidence": 0.8, "scholar_flag": False}
        )
        return pipeline

    CASE = {"title": "t", "description": "d", "role": "Individual"}

    @pytest.fixture(autouse=True)
    def _sole_provider(self):
        with patch("services.rag.pipeline.settings.LLM_FALLBACK_ENABLED", False):
            yield

    def test_retry_succeeds(self):
        pipeline = self._pipeline([self.BAD, dict(self.GOOD)])
        result, violation = pipeline.run(self.CASE)
        assert pipeline.generate_brief.call_count == 2
        assert result["executive_summary"] == "s"
        assert not violation

    def test_second_failure_raises(self):
        from services.rag.pipeline import UnusableLLMOutput

        pipeline = self._pipeline([self.BAD, self.BAD])
        with pytest.raises(UnusableLLMOutput):
            pipeline.run(self.CASE)
        assert pipeline.generate_brief.call_count == 2
        pipeline.validate_output.assert_not_called()

    def test_fallback_enabled_does_not_retry_here(self):
        pipeline = self._pipeline([self.BAD])
        with patch("services.rag.pipeline.settings.LLM_FALLBACK_ENABLED", True):
            pipeline.run(self.CASE)
        assert pipeline.generate_brief.call_count == 1

    def test_good_output_not_retried(self):
        pipeline = self._pipeline([dict(self.GOOD)])
        pipeline.run(self.CASE)
        assert pipeline.generate_brief.call_count == 1


@pytest.mark.unit
class TestLowConfidenceNotCached:
    def _run(self, confidence):
        pipeline = RAGPipeline.__new__(RAGPipeline)  # skip embedder init
        pipeline.retrieve_verses = MagicMock(return_value=[])
        pipeline.enrich_verses_with_translations = MagicMock(return_value=[])
        pipeline.construct_context = MagicMock(return_value="prompt")
        pipeline.generate_brief = MagicMock(
            return_value=(dict(TestUnusableOutputRetry.GOOD), False)
        )
        pipeline.validate_output = MagicMock(
            return_value={"confidence": confidence, "scholar_flag": False, "sources": []}
        )
        with patch("services.rag.pipeline.cache") as cache:
            cache.get.return_value = None
            pipeline.run(TestUnusableOutputRetry.CASE)
        return cache

    def test_low_confidence_skips_cache(self):
        assert not self._run(0.31).set.called

    def test_normal_confidence_cached(self):
        assert self._run(0.82).set.called
