"""Tests for LLM service."""

import time
from unittest.mock import MagicMock, patch

import pytest

# Mark all tests in this module as unit tests (fast, mocked externals)
pytestmark = pytest.mark.unit


class TestLLMCircuitBreaker:
    """Tests for LLM circuit breaker functionality."""

    def test_circuit_breaker_initial_state(self):
        """Test circuit breaker starts in closed state."""
        from services.llm import LLMCircuitBreaker

        cb = LLMCircuitBreaker(provider="test")
        assert cb.state == "closed"
        assert cb.failure_count == 0

    def test_circuit_breaker_opens_after_failures(self):
        """Test circuit breaker opens after threshold failures."""
        from services.llm import LLMCircuitBreaker

        cb = LLMCircuitBreaker(
            provider="test", failure_threshold=3, recovery_timeout=60
        )

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "closed"
        assert cb.allow_request()

        cb.record_failure()  # Third failure should open circuit
        assert cb.state == "open"
        assert not cb.allow_request()

    def test_circuit_breaker_resets_on_success(self):
        """Test circuit breaker resets to closed on success."""
        from services.llm import LLMCircuitBreaker

        cb = LLMCircuitBreaker(provider="test", failure_threshold=3)

        # Accumulate some failures
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2

        # Success resets
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.state == "closed"

    def test_circuit_breaker_half_open_after_timeout(self):
        """Test circuit breaker transitions to half_open after recovery timeout."""
        from services.llm import LLMCircuitBreaker

        cb = LLMCircuitBreaker(
            provider="test", failure_threshold=2, recovery_timeout=0.1
        )

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"
        assert not cb.allow_request()

        # Wait for recovery
        time.sleep(0.15)

        # Should transition to half_open
        assert cb.allow_request()
        assert cb.state == "half_open"

    def test_circuit_breaker_half_open_success_closes(self):
        """Test successful request in half_open state closes circuit."""
        from services.llm import LLMCircuitBreaker

        cb = LLMCircuitBreaker(
            provider="test", failure_threshold=2, recovery_timeout=0.1
        )

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for recovery
        time.sleep(0.15)
        cb.allow_request()  # Transition to half_open

        # Success should close circuit
        cb.record_success()
        assert cb.state == "closed"
        assert cb.failure_count == 0

    def test_circuit_breaker_half_open_failure_reopens(self):
        """Test failed request in half_open state reopens circuit."""
        from services.llm import LLMCircuitBreaker

        cb = LLMCircuitBreaker(
            provider="test", failure_threshold=2, recovery_timeout=0.1
        )

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for recovery
        time.sleep(0.15)
        cb.allow_request()  # Transition to half_open

        # Failure should reopen circuit
        cb.record_failure()
        assert cb.state == "open"

    def test_provider_specific_metrics(self):
        """Test each provider has its own metric label."""
        from services.llm import LLMCircuitBreaker

        cb_anthropic = LLMCircuitBreaker(provider="anthropic")
        cb_gemini = LLMCircuitBreaker(provider="gemini")
        cb_ollama = LLMCircuitBreaker(provider="ollama")

        # Verify names are different
        assert cb_anthropic.name == "llm-anthropic"
        assert cb_gemini.name == "llm-gemini"
        assert cb_ollama.name == "llm-ollama"

    def test_gemini_circuit_breaker_opens_after_failures(self):
        """Test Gemini circuit breaker opens after threshold failures."""
        from services.llm import LLMCircuitBreaker

        breaker = LLMCircuitBreaker(provider="gemini", failure_threshold=3)
        for _ in range(3):
            breaker.record_failure()
        assert not breaker.allow_request()
        assert breaker.state == "open"

    def test_gemini_circuit_breaker_recovers(self):
        """Test Gemini circuit breaker transitions to half-open after timeout."""
        from services.llm import LLMCircuitBreaker

        breaker = LLMCircuitBreaker(
            provider="gemini",
            failure_threshold=3,
            recovery_timeout=0.1,
        )
        for _ in range(3):
            breaker.record_failure()
        time.sleep(0.15)
        assert breaker.allow_request()  # half-open
        assert breaker.state == "half_open"


class TestLLMServiceCircuitBreakerIntegration:
    """Tests for circuit breaker integration with LLM service."""

    def test_circuit_breaker_not_triggered_during_retries(self):
        """Test that retries don't prematurely open the circuit breaker."""
        from services.llm import LLMCircuitBreaker

        # With threshold of 3, we want to verify that 3 retry attempts
        # from a single request don't open the circuit
        cb = LLMCircuitBreaker(provider="test", failure_threshold=3)

        # Simulate what happens during tenacity retries:
        # The circuit breaker should NOT record failure during retry attempts
        # Only after all retries exhaust should ONE failure be recorded
        assert cb.state == "closed"
        assert cb.failure_count == 0

        # Simulate 3 separate failed requests (each with its own retries)
        cb.record_failure()  # First request fails after retries
        assert cb.state == "closed"
        cb.record_failure()  # Second request fails after retries
        assert cb.state == "closed"
        cb.record_failure()  # Third request fails after retries
        assert cb.state == "open"  # Now circuit opens

    def test_anthropic_circuit_breaker_blocks_when_open(self):
        """Test Anthropic requests are blocked when circuit is open."""
        from services.llm import LLMService
        from utils.circuit_breaker import CircuitBreakerOpen

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.ANTHROPIC_MODEL = "claude-3-sonnet"
            mock_settings.ANTHROPIC_MAX_TOKENS = 1024
            mock_settings.ANTHROPIC_TIMEOUT = 60
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            with patch("services.llm.Anthropic"):
                service = LLMService()

            # Open the circuit manually
            service._anthropic_breaker.record_failure()
            service._anthropic_breaker.record_failure()
            service._anthropic_breaker.record_failure()

            # Should raise CircuitBreakerOpen
            with pytest.raises(CircuitBreakerOpen):
                service._generate_anthropic(
                    prompt="Test",
                    system_prompt="Test",
                )

    def test_ollama_circuit_breaker_blocks_when_open(self):
        """Test Ollama requests are blocked when circuit is open."""
        from services.llm import LLMService
        from utils.circuit_breaker import CircuitBreakerOpen

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "ollama"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = True
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            service = LLMService()

            # Open the circuit manually
            service._ollama_breaker.record_failure()
            service._ollama_breaker.record_failure()
            service._ollama_breaker.record_failure()

            # Should raise CircuitBreakerOpen
            with pytest.raises(CircuitBreakerOpen):
                service._generate_ollama(
                    prompt="Test",
                    system_prompt="Test",
                )

    def test_fallback_triggered_when_primary_circuit_open(self):
        """Test fallback provider is used when primary circuit is open."""
        from services.llm import LLMService

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.ANTHROPIC_MODEL = "claude-3-sonnet"
            mock_settings.ANTHROPIC_MAX_TOKENS = 1024
            mock_settings.ANTHROPIC_TIMEOUT = 60
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            with patch("services.llm.Anthropic"):
                service = LLMService()

            # Open the Anthropic circuit
            service._anthropic_breaker.record_failure()
            service._anthropic_breaker.record_failure()
            service._anthropic_breaker.record_failure()

            # Should fallback to mock
            result = service.generate(
                prompt="Test prompt",
                system_prompt="Test system",
            )

            assert result["provider"] == "mock"

    def test_timeout_error_triggers_retry_not_immediate_circuit_failure(self):
        """Test APITimeoutError triggers retry, doesn't immediately record circuit failure."""
        from anthropic import APITimeoutError

        from services.llm import LLMService

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.ANTHROPIC_MODEL = "claude-3-sonnet"
            mock_settings.ANTHROPIC_MAX_TOKENS = 1024
            mock_settings.ANTHROPIC_TIMEOUT = 60
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300

            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_response.content = [MagicMock(text='{"key": "value"}')]
            mock_response.usage = MagicMock(input_tokens=10, output_tokens=20)

            # First call times out, second succeeds
            mock_client.messages.create.side_effect = [
                APITimeoutError(request=MagicMock()),
                mock_response,
            ]

            with patch("services.llm.Anthropic", return_value=mock_client):
                service = LLMService()

            assert service._anthropic_breaker.failure_count == 0

            # Generate should succeed after retry
            result = service._generate_anthropic(
                prompt="Test prompt",
                system_prompt="Test system",
            )

            # Circuit breaker should NOT have recorded a failure (retry succeeded)
            assert service._anthropic_breaker.failure_count == 0
            assert "key" in result["response"]

    def test_connection_error_triggers_retry(self):
        """Test APIConnectionError triggers retry before circuit breaker failure."""
        from anthropic import APIConnectionError

        from services.llm import LLMService

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.ANTHROPIC_MODEL = "claude-3-sonnet"
            mock_settings.ANTHROPIC_MAX_TOKENS = 1024
            mock_settings.ANTHROPIC_TIMEOUT = 60
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300

            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_response.content = [MagicMock(text='{"result": "success"}')]
            mock_response.usage = MagicMock(input_tokens=10, output_tokens=20)

            # First call has connection error, second succeeds
            mock_client.messages.create.side_effect = [
                APIConnectionError(request=MagicMock()),
                mock_response,
            ]

            with patch("services.llm.Anthropic", return_value=mock_client):
                service = LLMService()

            # Generate should succeed after retry
            result = service._generate_anthropic(
                prompt="Test prompt",
                system_prompt="Test system",
            )

            # Circuit breaker should NOT have recorded a failure
            assert service._anthropic_breaker.failure_count == 0
            assert "result" in result["response"]


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


class TestGeminiProvider:
    """Tests for Gemini provider integration."""

    def test_gemini_provider_enum(self):
        """Test Gemini is a valid LLM provider."""
        from services.llm import LLMProvider

        assert LLMProvider.GEMINI.value == "gemini"
        assert LLMProvider("gemini") == LLMProvider.GEMINI

    def test_gemini_circuit_breaker_blocks_when_open(self):
        """Test Gemini requests are blocked when circuit is open."""
        from services.llm import LLMService
        from utils.circuit_breaker import CircuitBreakerOpen

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            with patch("services.llm.genai") as mock_genai:
                mock_genai.Client.return_value = MagicMock()
                service = LLMService()

            # Open the circuit manually
            service._gemini_breaker.record_failure()
            service._gemini_breaker.record_failure()
            service._gemini_breaker.record_failure()

            # Should raise CircuitBreakerOpen
            with pytest.raises(CircuitBreakerOpen):
                service._generate_gemini(
                    prompt="Test",
                    system_prompt="Test",
                )

    def test_generate_gemini_success(self):
        """Test successful Gemini generation with mocked client."""
        from services.llm import LLMService

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            # Create mock response
            mock_response = MagicMock()
            mock_response.text = "Test response from Gemini"
            mock_response.usage_metadata.prompt_token_count = 10
            mock_response.usage_metadata.candidates_token_count = 20

            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response

            with patch("services.llm.genai") as mock_genai:
                mock_genai.Client.return_value = mock_client
                service = LLMService()

            result = service._generate_gemini("Test prompt")

            assert result["provider"] == "gemini"
            assert result["response"] == "Test response from Gemini"
            assert result["input_tokens"] == 10
            assert result["output_tokens"] == 20
            assert result["model"] == "gemini-2.5-flash"

    def test_gemini_health_check(self):
        """Test health check returns True when Gemini client initialized."""
        from services.llm import LLMService

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = True
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            with patch("services.llm.genai") as mock_genai:
                mock_genai.Client.return_value = MagicMock()
                service = LLMService()

            assert service.check_health() is True

    def test_fallback_to_gemini_when_anthropic_fails(self):
        """Test Gemini is used as fallback when Anthropic circuit opens."""
        from services.llm import LLMService

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.LLM_FALLBACK_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_ENABLED = True
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.ANTHROPIC_MODEL = "claude-3-sonnet"
            mock_settings.ANTHROPIC_MAX_TOKENS = 1024
            mock_settings.ANTHROPIC_TIMEOUT = 60
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            # Create mock Gemini response
            mock_response = MagicMock()
            mock_response.text = "Fallback response from Gemini"
            mock_response.usage_metadata.prompt_token_count = 10
            mock_response.usage_metadata.candidates_token_count = 20

            mock_gemini_client = MagicMock()
            mock_gemini_client.models.generate_content.return_value = mock_response

            with patch("services.llm.Anthropic"), patch(
                "services.llm.genai"
            ) as mock_genai:
                mock_genai.Client.return_value = mock_gemini_client
                service = LLMService()

            # Open the Anthropic circuit
            service._anthropic_breaker.record_failure()
            service._anthropic_breaker.record_failure()
            service._anthropic_breaker.record_failure()

            # Should fallback to Gemini
            result = service.generate(
                prompt="Test prompt",
                system_prompt="Test system",
            )

            assert result["provider"] == "gemini"
            assert "Fallback response from Gemini" in result["response"]

    def test_gemini_empty_response_raises_error(self):
        """Test that empty Gemini response raises LLMError."""
        from services.llm import LLMService
        from utils.exceptions import LLMError

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            # Create mock response with empty text
            mock_response = MagicMock()
            mock_response.text = ""
            mock_response.usage_metadata.prompt_token_count = 10
            mock_response.usage_metadata.candidates_token_count = 0

            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response

            with patch("services.llm.genai") as mock_genai:
                mock_genai.Client.return_value = mock_client
                service = LLMService()

            with pytest.raises(LLMError, match="empty response"):
                service._generate_gemini("Test prompt")

    def test_gemini_server_error_triggers_retry(self):
        """Test that ServerError triggers retry, not immediate circuit breaker."""
        from google.genai.errors import ServerError

        from services.llm import LLMService
        from utils.exceptions import RetryableLLMError

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            mock_client = MagicMock()
            # ServerError requires code and response_json with proper structure
            mock_client.models.generate_content.side_effect = ServerError(
                503, {"error": {"message": "Service unavailable"}}
            )

            with patch("services.llm.genai") as mock_genai, patch(
                "services.llm.genai_types"
            ) as mock_genai_types:
                mock_genai.Client.return_value = mock_client
                mock_genai_types.HttpOptions.return_value = MagicMock()
                service = LLMService()

            # ServerError should raise RetryableLLMError (caught by tenacity)
            # and should NOT record circuit breaker failure
            initial_failures = service._gemini_breaker.failure_count

            with pytest.raises(RetryableLLMError):
                service._generate_gemini("Test prompt")

            # Circuit breaker should NOT have recorded failure on retryable error
            assert service._gemini_breaker.failure_count == initial_failures

    def test_gemini_client_error_immediate_failure(self):
        """Test that ClientError fails immediately and records circuit breaker failure."""
        from google.genai.errors import ClientError

        from services.llm import LLMService
        from utils.exceptions import LLMError

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            mock_client = MagicMock()
            # ClientError requires code and response_json with proper structure
            mock_client.models.generate_content.side_effect = ClientError(
                401, {"error": {"message": "Unauthorized"}}
            )

            with patch("services.llm.genai") as mock_genai, patch(
                "services.llm.genai_types"
            ) as mock_genai_types:
                mock_genai.Client.return_value = mock_client
                mock_genai_types.HttpOptions.return_value = MagicMock()
                service = LLMService()

            # ClientError should raise LLMError and record circuit breaker failure
            initial_failures = service._gemini_breaker.failure_count

            with pytest.raises(LLMError, match="Gemini request failed"):
                service._generate_gemini("Test prompt")

            # Circuit breaker SHOULD have recorded failure on permanent error
            assert service._gemini_breaker.failure_count == initial_failures + 1

    def test_gemini_malformed_response_raises_error(self):
        """Test that malformed response (missing .text) raises LLMError."""
        from services.llm import LLMService
        from utils.exceptions import LLMError

        # Create a response class that raises AttributeError on .text access
        class MalformedResponse:
            @property
            def text(self):
                raise AttributeError("no text attribute")

        with patch("services.llm.settings") as mock_settings:
            mock_settings.USE_MOCK_LLM = False
            mock_settings.LLM_PROVIDER = "gemini"
            mock_settings.LLM_FALLBACK_PROVIDER = "mock"
            mock_settings.LLM_FALLBACK_ENABLED = False
            mock_settings.GOOGLE_API_KEY = "test-key"
            mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
            mock_settings.GEMINI_MAX_TOKENS = 2048
            mock_settings.GEMINI_TIMEOUT = 30
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OLLAMA_ENABLED = False
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_MODEL = "qwen2.5:3b"
            mock_settings.OLLAMA_TIMEOUT = 300
            mock_settings.CB_LLM_FAILURE_THRESHOLD = 3
            mock_settings.CB_LLM_RECOVERY_TIMEOUT = 60

            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = MalformedResponse()

            with patch("services.llm.genai") as mock_genai, patch(
                "services.llm.genai_types"
            ) as mock_genai_types:
                mock_genai.Client.return_value = mock_client
                mock_genai_types.HttpOptions.return_value = MagicMock()
                service = LLMService()

            with pytest.raises(LLMError, match="malformed response"):
                service._generate_gemini("Test prompt")
