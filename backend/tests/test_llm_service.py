"""Tests for LLM service."""

import pytest
from unittest.mock import patch, MagicMock


class TestLLMService:
    """Tests for LLM service."""

    def test_llm_service_mock_mode(self):
        """Test LLM service initializes in mock mode."""
        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = True
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True

            from services.llm import LLMService

            service = LLMService()

            assert service.use_mock is True
            assert service.mock_service is not None

    def test_llm_service_health_check_mock(self):
        """Test health check returns True in mock mode."""
        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = True
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True

            from services.llm import LLMService

            service = LLMService()

            assert service.check_health() is True

    def test_llm_service_generate_mock(self):
        """Test generate returns mock response in mock mode."""
        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = True
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True

            from services.llm import LLMService

            service = LLMService()
            result = service.generate(
                prompt="Test prompt",
                system_prompt="You are a helpful assistant.",
            )

            assert "response" in result
            assert "provider" in result
            assert result["provider"] == "mock"

    def test_llm_service_ollama_disabled(self):
        """Test Ollama check returns False when disabled."""
        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "ollama"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.ANTHROPIC_API_KEY = None

            from services.llm import LLMService

            service = LLMService()

            assert service._check_ollama_health() is False

    def test_llm_error_used_for_failures(self):
        """Test that LLMError is raised for failures."""
        from utils.exceptions import LLMError

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300

            from services.llm import LLMService

            service = LLMService()

            with pytest.raises(LLMError):
                service._generate_anthropic(
                    prompt="Test",
                    system_prompt="Test",
                )

    def test_get_llm_service_singleton(self):
        """Test get_llm_service returns singleton instance."""
        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = True
            mock_settings.LLM_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True

            # Reset singleton
            import services.llm
            services.llm._llm_service = None

            from services.llm import get_llm_service

            service1 = get_llm_service()
            service2 = get_llm_service()

            assert service1 is service2
