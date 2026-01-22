"""Unit tests for provider configurations with auto-tuning."""

import pytest
from unittest.mock import Mock, MagicMock

from services.provider_configs import (
    AnthropicConfig,
    GeminiConfig,
    OllamaConfig,
    MockConfig,
    get_provider_config,
    GEMINI_JSON_SCHEMA,
    OLLAMA_SIMPLIFIED_SYSTEM_PROMPT,
)


class TestGeminiConfig:
    """Test Gemini provider configuration."""

    @pytest.fixture
    def config(self):
        """Create Gemini config instance."""
        return GeminiConfig(
            model="gemini-2.5-flash",
            timeout_seconds=30.0,
            max_tokens=4096,
        )

    def test_gemini_config_has_lower_temperature(self, config):
        """Gemini should have lower default temperature for determinism."""
        assert config.temperature_default == 0.3

    def test_gemini_get_generation_params(self, config):
        """Gemini generation params should include max_tokens and temperature."""
        params = config.get_generation_params(temperature=0.5)
        assert params["max_output_tokens"] == 4096
        assert params["temperature"] == 0.5

    def test_gemini_generation_params_use_default_temperature(self, config):
        """Gemini should use default temperature when None is passed."""
        params = config.get_generation_params(temperature=None)
        assert params["temperature"] == 0.3

    def test_gemini_parse_response_extracts_text_and_tokens(self, config):
        """Gemini should extract text and token counts from response."""
        mock_response = Mock()
        mock_response.text = "Valid response"
        mock_response.usage_metadata.prompt_token_count = 100
        mock_response.usage_metadata.candidates_token_count = 50

        text, input_tokens, output_tokens = config.parse_response(mock_response)

        assert text == "Valid response"
        assert input_tokens == 100
        assert output_tokens == 50

    def test_gemini_parse_response_raises_on_missing_text(self, config):
        """Gemini should raise if response has no text attribute."""
        mock_response = Mock(spec=[])  # No text attribute

        with pytest.raises(ValueError, match="malformed response"):
            config.parse_response(mock_response)

    def test_gemini_parse_response_raises_on_empty_text(self, config):
        """Gemini should raise if response text is empty."""
        mock_response = Mock()
        mock_response.text = ""

        with pytest.raises(ValueError, match="empty response"):
            config.parse_response(mock_response)

    def test_gemini_parse_response_handles_missing_usage_metadata(self, config):
        """Gemini should use 0 tokens if usage_metadata is missing."""
        mock_response = Mock()
        mock_response.text = "Valid response"
        mock_response.usage_metadata = Mock(spec=[])  # No token attributes

        text, input_tokens, output_tokens = config.parse_response(mock_response)

        assert text == "Valid response"
        assert input_tokens == 0
        assert output_tokens == 0

    def test_gemini_json_schema_auto_applied(self, config):
        """Gemini should auto-apply JSON schema when json_mode=True."""
        schema = config.get_json_schema(json_mode=True)

        assert schema is not None
        assert schema == GEMINI_JSON_SCHEMA
        assert "executive_summary" in schema["properties"]
        assert "options" in schema["properties"]
        assert "confidence" in schema["properties"]

    def test_gemini_no_schema_when_json_mode_false(self, config):
        """Gemini should not return schema when json_mode=False."""
        schema = config.get_json_schema(json_mode=False)

        assert schema is None

    def test_gemini_error_retryable_server_error(self, config):
        """Gemini should retry on server errors."""
        from google.genai.errors import ServerError

        error = ServerError("Service unavailable")
        assert config.is_error_retryable(error) is True

    def test_gemini_error_not_retryable_client_error(self, config):
        """Gemini should not retry on client errors."""
        from google.genai.errors import ClientError

        error = ClientError("Invalid request")
        assert config.is_error_retryable(error) is False


class TestAnthropicConfig:
    """Test Anthropic provider configuration."""

    @pytest.fixture
    def config(self):
        """Create Anthropic config instance."""
        return AnthropicConfig(
            model="claude-haiku-4-5-20251001",
            timeout_seconds=30.0,
            max_tokens=4096,
        )

    def test_anthropic_config_has_balanced_temperature(self, config):
        """Anthropic should have 0.7 temperature for balanced output."""
        assert config.temperature_default == 0.7

    def test_anthropic_get_generation_params(self, config):
        """Anthropic generation params should include max_tokens and temperature."""
        params = config.get_generation_params(temperature=0.6)
        assert params["max_tokens"] == 4096
        assert params["temperature"] == 0.6

    def test_anthropic_parse_response_extracts_text_and_tokens(self, config):
        """Anthropic should extract text and token counts from response."""
        mock_response = Mock()
        mock_response.content = [Mock(text="Valid response")]
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 50

        text, input_tokens, output_tokens = config.parse_response(mock_response)

        assert text == "Valid response"
        assert input_tokens == 100
        assert output_tokens == 50

    def test_anthropic_parse_response_handles_missing_tokens(self, config):
        """Anthropic should use 0 tokens if usage is missing."""
        mock_response = Mock()
        mock_response.content = [Mock(text="Valid response")]
        mock_response.usage = Mock(spec=[])

        text, input_tokens, output_tokens = config.parse_response(mock_response)

        assert text == "Valid response"
        assert input_tokens == 0
        assert output_tokens == 0

    def test_anthropic_no_json_schema(self, config):
        """Anthropic should not need JSON schema (native structured output)."""
        schema = config.get_json_schema(json_mode=True)
        assert schema is None

    def test_anthropic_error_retryable_connection_error(self, config):
        """Anthropic should retry on connection errors."""
        from anthropic import APIConnectionError

        error = APIConnectionError("Connection failed")
        assert config.is_error_retryable(error) is True

    def test_anthropic_error_not_retryable_auth_error(self, config):
        """Anthropic should not retry on auth errors."""
        from anthropic import AnthropicError

        error = AnthropicError("Invalid API key")
        assert config.is_error_retryable(error) is False


class TestOllamaConfig:
    """Test Ollama provider configuration."""

    @pytest.fixture
    def config(self):
        """Create Ollama config instance."""
        return OllamaConfig(
            model="qwen2.5:3b",
            timeout_seconds=300.0,
            max_tokens=4096,
        )

    def test_ollama_config_has_low_temperature(self, config):
        """Ollama should have low temperature for determinism."""
        assert config.temperature_default == 0.3

    def test_ollama_get_generation_params(self, config):
        """Ollama generation params should match Ollama API format."""
        params = config.get_generation_params(temperature=0.4)
        assert params["temperature"] == 0.4
        assert params["num_predict"] == 4096

    def test_ollama_simplified_prompt_auto_applied(self, config):
        """Ollama should auto-apply simplified system prompt."""
        base_prompt = "Some base system prompt with lots of detail and instructions"
        customized = config.customize_system_prompt(base_prompt)

        # Should return simplified prompt, not base
        assert customized == OLLAMA_SIMPLIFIED_SYSTEM_PROMPT
        assert "QUALITY RULES" in customized
        assert len(customized) < len(base_prompt)

    def test_ollama_parse_response_extracts_text_and_tokens(self, config):
        """Ollama should extract text and token counts from response."""
        mock_response = {
            "response": "Valid response",
            "eval_count": 50,
        }

        text, input_tokens, output_tokens = config.parse_response(mock_response)

        assert text == "Valid response"
        assert input_tokens == 0  # Ollama doesn't provide input tokens
        assert output_tokens == 50

    def test_ollama_parse_response_raises_on_empty_text(self, config):
        """Ollama should raise if response text is empty."""
        mock_response = {"response": ""}

        with pytest.raises(ValueError, match="empty response"):
            config.parse_response(mock_response)

    def test_ollama_no_json_schema(self, config):
        """Ollama should not use JSON schema (uses format param)."""
        schema = config.get_json_schema(json_mode=True)
        assert schema is None

    def test_ollama_error_always_retryable(self, config):
        """Ollama should retry on timeout (connection issues)."""
        import httpx

        error = httpx.TimeoutException("Request timed out")
        assert config.is_error_retryable(error) is True


class TestMockConfig:
    """Test Mock provider configuration."""

    @pytest.fixture
    def config(self):
        """Create Mock config instance."""
        return MockConfig(
            model="mock",
            timeout_seconds=1.0,
            max_tokens=1000,
        )

    def test_mock_config_instant_response(self, config):
        """Mock should have minimal timeout."""
        assert config.timeout_seconds == 1.0

    def test_mock_parse_response(self, config):
        """Mock should extract response from dict."""
        mock_response = {"response": "Mock response"}

        text, input_tokens, output_tokens = config.parse_response(mock_response)

        assert text == "Mock response"
        assert input_tokens == 0
        assert output_tokens == 0

    def test_mock_error_never_retryable(self, config):
        """Mock should never retry (for deterministic testing)."""
        error = Exception("Test error")
        assert config.is_error_retryable(error) is False


class TestProviderConfigFactory:
    """Test get_provider_config factory function."""

    @pytest.fixture
    def mock_settings(self):
        """Create mock settings object."""
        settings = Mock()
        settings.GEMINI_MODEL = "gemini-2.5-flash"
        settings.GEMINI_TIMEOUT = 30000  # milliseconds
        settings.GEMINI_MAX_TOKENS = 4096

        settings.ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
        settings.ANTHROPIC_TIMEOUT = 30
        settings.ANTHROPIC_MAX_TOKENS = 4096

        settings.OLLAMA_MODEL = "qwen2.5:3b"
        settings.OLLAMA_TIMEOUT = 300
        settings.OLLAMA_MAX_TOKENS = 4096

        return settings

    def test_get_provider_config_gemini(self, mock_settings):
        """Factory should create Gemini config."""
        config = get_provider_config("gemini", mock_settings)

        assert isinstance(config, GeminiConfig)
        assert config.name == "gemini"
        assert config.model == "gemini-2.5-flash"
        assert config.timeout_seconds == 30.0  # Converted from 30000 ms

    def test_get_provider_config_anthropic(self, mock_settings):
        """Factory should create Anthropic config."""
        config = get_provider_config("anthropic", mock_settings)

        assert isinstance(config, AnthropicConfig)
        assert config.name == "anthropic"
        assert config.model == "claude-haiku-4-5-20251001"

    def test_get_provider_config_ollama(self, mock_settings):
        """Factory should create Ollama config."""
        config = get_provider_config("ollama", mock_settings)

        assert isinstance(config, OllamaConfig)
        assert config.name == "ollama"
        assert config.model == "qwen2.5:3b"

    def test_get_provider_config_mock(self, mock_settings):
        """Factory should create Mock config."""
        config = get_provider_config("mock", mock_settings)

        assert isinstance(config, MockConfig)
        assert config.name == "mock"

    def test_get_provider_config_case_insensitive(self, mock_settings):
        """Factory should handle provider names case-insensitively."""
        config1 = get_provider_config("GEMINI", mock_settings)
        config2 = get_provider_config("Gemini", mock_settings)
        config3 = get_provider_config("gemini", mock_settings)

        assert all(isinstance(c, GeminiConfig) for c in [config1, config2, config3])

    def test_get_provider_config_unknown_provider(self, mock_settings):
        """Factory should raise ValueError for unknown provider."""
        with pytest.raises(ValueError, match="Unknown provider"):
            get_provider_config("unknown_provider", mock_settings)

    def test_get_provider_config_gemini_timeout_conversion(self, mock_settings):
        """Factory should convert Gemini timeout from ms to seconds."""
        mock_settings.GEMINI_TIMEOUT = 45000  # 45 seconds in milliseconds

        config = get_provider_config("gemini", mock_settings)

        assert config.timeout_seconds == 45.0


class TestJSONSchemaStructure:
    """Test Gemini JSON schema structure."""

    def test_gemini_schema_has_required_fields(self):
        """Gemini schema should define all required consultation fields."""
        required = GEMINI_JSON_SCHEMA["required"]

        assert "executive_summary" in required
        assert "options" in required
        assert "recommended_action" in required
        assert "reflection_prompts" in required
        assert "sources" in required
        assert "confidence" in required
        assert "scholar_flag" in required

    def test_gemini_schema_options_structure(self):
        """Gemini schema should define options array with required fields."""
        options_schema = GEMINI_JSON_SCHEMA["properties"]["options"]

        assert options_schema["type"] == "array"
        option_item = options_schema["items"]
        assert "title" in option_item["required"]
        assert "description" in option_item["required"]
        assert "pros" in option_item["required"]
        assert "cons" in option_item["required"]
        assert "sources" in option_item["required"]

    def test_gemini_schema_sources_structure(self):
        """Gemini schema should define sources with canonical_id, paraphrase, relevance."""
        sources_schema = GEMINI_JSON_SCHEMA["properties"]["sources"]

        assert sources_schema["type"] == "array"
        source_item = sources_schema["items"]
        assert "canonical_id" in source_item["required"]
        assert "paraphrase" in source_item["required"]
        assert "relevance" in source_item["required"]

        # Relevance should be 0.0-1.0
        relevance_schema = source_item["properties"]["relevance"]
        assert relevance_schema["minimum"] == 0.0
        assert relevance_schema["maximum"] == 1.0

    def test_gemini_schema_confidence_bounded(self):
        """Gemini schema should constrain confidence to 0.0-1.0."""
        confidence_schema = GEMINI_JSON_SCHEMA["properties"]["confidence"]

        assert confidence_schema["minimum"] == 0.0
        assert confidence_schema["maximum"] == 1.0


class TestOllamaSimplifiedPrompt:
    """Test Ollama simplified system prompt."""

    def test_ollama_prompt_is_shorter_than_full_prompt(self):
        """Ollama prompt should be significantly shorter."""
        from services.prompts import SYSTEM_PROMPT

        assert len(OLLAMA_SIMPLIFIED_SYSTEM_PROMPT) < len(SYSTEM_PROMPT)

    def test_ollama_prompt_has_quality_rules(self):
        """Ollama prompt should have quality guidance."""
        assert "QUALITY RULES" in OLLAMA_SIMPLIFIED_SYSTEM_PROMPT
        assert "specific" in OLLAMA_SIMPLIFIED_SYSTEM_PROMPT.lower()
        assert "direct" in OLLAMA_SIMPLIFIED_SYSTEM_PROMPT.lower()

    def test_ollama_prompt_expects_json_output(self):
        """Ollama prompt should specify JSON output."""
        assert "JSON" in OLLAMA_SIMPLIFIED_SYSTEM_PROMPT
        assert "Output ONLY valid JSON" in OLLAMA_SIMPLIFIED_SYSTEM_PROMPT
