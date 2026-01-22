# Provider Configuration Framework (v1.34.1)

## Overview

Fire-and-forget provider-specific auto-tuning system. No feature flags. Each provider has optimized defaults applied automatically based on its capabilities and constraints.

## File Structure

```
backend/services/
├── provider_configs.py          # Provider config classes (new)
└── llm.py                        # Will integrate configs in Phase 2

backend/tests/
└── test_provider_configs.py     # Unit tests for configs (new)
```

## Architecture

### ProviderConfig Base Class (ABC)

All provider configs inherit from `ProviderConfig`:

```python
@dataclass
class ProviderConfig(ABC):
    name: str                      # Provider name
    model: str                     # Model identifier
    timeout_seconds: float         # Timeout in seconds (normalized)
    max_tokens: int               # Max output tokens
    temperature_default: float     # Default temperature

    @abstractmethod
    def get_generation_params(temperature) -> dict   # API-specific params
    @abstractmethod
    def parse_response(raw_response) -> tuple        # Extract (text, input_tokens, output_tokens)
    def customize_system_prompt(base_prompt) -> str  # Provider-specific tweaks
    def customize_user_prompt(base_prompt) -> str    # Provider-specific tweaks
    def get_json_schema(json_mode) -> dict|None      # Schema for structured output
    def is_error_retryable(error) -> bool           # Retry classification
```

### Concrete Implementations

#### GeminiConfig
**Auto-applied optimizations:**
- Temperature: 0.3 (determinism with schema mode)
- JSON Schema: Explicit schema for structural compliance
- Timeout: Converted from milliseconds to seconds
- Response Parsing: Handles `usage_metadata` for tokens

```python
config = GeminiConfig(
    model="gemini-2.5-flash",
    timeout_seconds=30.0,
    max_tokens=4096
)
schema = config.get_json_schema(json_mode=True)  # Returns GEMINI_JSON_SCHEMA
```

#### AnthropicConfig
**Auto-applied optimizations:**
- Temperature: 0.7 (balanced for creative + structured output)
- JSON Schema: None (Claude has native JSON excellence)
- Response Parsing: Extracts from `content[0].text` and `usage`

#### OllamaConfig
**Auto-applied optimizations:**
- Temperature: 0.3 (determinism for local inference)
- Simplified System Prompt: Auto-applied (resource efficiency)
- Response Parsing: Handles eval_count for tokens

```python
config = OllamaConfig(model="qwen2.5:3b", timeout_seconds=300, max_tokens=4096)
simplified = config.customize_system_prompt(full_prompt)  # Returns OLLAMA_SIMPLIFIED_SYSTEM_PROMPT
```

#### MockConfig
**Auto-applied optimizations:**
- Temperature: 0.5 (irrelevant)
- Errors: Never retryable (deterministic testing)
- Response: Instant, no external dependencies

### Factory Function

```python
from services.provider_configs import get_provider_config

# Auto-loads settings, creates provider config with all optimizations
config = get_provider_config("gemini")  # or "anthropic", "ollama", "mock"

# Use config in LLM service
params = config.get_generation_params(temperature=0.3)
text, input_tokens, output_tokens = config.parse_response(raw_response)
```

## Fire-and-Forget Auto-Tuning

**Key Principle:** No feature flags. Provider defaults are baked in.

When `LLM_PROVIDER=gemini` is set:
- ✅ JSON schema is auto-applied (if json_mode=True)
- ✅ Temperature defaults to 0.3 (determinism)
- ✅ Timeout is normalized from ms to seconds
- ✅ No config entries needed
- ✅ System "just works"

When `LLM_PROVIDER=ollama` is set:
- ✅ Simplified system prompt is auto-applied
- ✅ Temperature defaults to 0.3
- ✅ No config entries needed
- ✅ Lower token usage automatically

## JSON Schemas

### Gemini JSON Schema (GEMINI_JSON_SCHEMA)

Defines the consultation response structure:

```json
{
  "type": "object",
  "required": ["executive_summary", "options", "recommended_action", "reflection_prompts", "sources", "confidence", "scholar_flag"],
  "properties": {
    "executive_summary": {"type": "string"},
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title", "description", "pros", "cons", "sources"],
        "properties": {
          "title": {"type": "string"},
          "description": {"type": "string"},
          "pros": {"type": "array", "items": {"type": "string"}},
          "cons": {"type": "array", "items": {"type": "string"}},
          "sources": {"type": "array", "items": {"type": "string"}}
        }
      }
    },
    "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    ...
  }
}
```

When `get_json_schema(json_mode=True)` is called on GeminiConfig, this schema is passed to Gemini's `response_schema` parameter to constrain output structure.

## Simplified Prompts

### Ollama Simplified System Prompt (OLLAMA_SIMPLIFIED_SYSTEM_PROMPT)

Significantly shorter than full system prompt:
- Removes verbose instructions
- Focuses on key rules (be specific, direct, concrete)
- Reduces token usage for local inference
- Still maintains quality expectations

Used automatically when `LLM_PROVIDER=ollama`.

## Usage in LLMService (Phase 2)

```python
from services.provider_configs import get_provider_config

class LLMService:
    def __init__(self):
        self.primary_config = get_provider_config(settings.LLM_PROVIDER)
        self.fallback_config = get_provider_config(settings.LLM_FALLBACK_PROVIDER)

    def _generate_with_config(self, config, prompt, system_prompt):
        # Auto-apply customizations
        customized_system = config.customize_system_prompt(system_prompt)

        # Get generation params (including schema if applicable)
        params = config.get_generation_params(temperature=0.3)
        schema = config.get_json_schema(json_mode=True)
        if schema:
            params["response_schema"] = schema

        # Call provider API
        response = self.call_provider(config.model, params, prompt, customized_system)

        # Parse response
        text, input_tokens, output_tokens = config.parse_response(response)

        return {"response": text, "input_tokens": input_tokens, "output_tokens": output_tokens}
```

## Testing

### Test Coverage

30+ unit tests covering:

- **Config instantiation**: All 4 providers, settings loading
- **Generation params**: Provider-specific API formats
- **Response parsing**: Text extraction, token counting, error handling
- **Prompt customization**: Simplified prompts applied correctly
- **JSON schema**: Structure validation, field requirements
- **Error retryability**: Transient vs permanent errors per provider
- **Factory function**: Provider lookup, case insensitivity, unknown providers

Run tests:

```bash
make test                    # All tests via Docker
pytest backend/tests/test_provider_configs.py  # Local (if deps installed)
```

## Adding a New Provider

1. Create new config class:

```python
@dataclass
class NewProviderConfig(ProviderConfig):
    name: str = "new_provider"
    temperature_default: float = 0.5

    def get_generation_params(self, temperature):
        temp = temperature if temperature is not None else self.temperature_default
        return {...}

    def parse_response(self, raw_response):
        return text, input_tokens, output_tokens

    def is_error_retryable(self, error):
        return True/False based on error type
```

2. Add to factory:

```python
def get_provider_config(provider_name, settings=None):
    ...
    elif provider_name == "new_provider":
        return NewProviderConfig(
            model=settings.NEW_PROVIDER_MODEL,
            timeout_seconds=settings.NEW_PROVIDER_TIMEOUT,
            max_tokens=settings.NEW_PROVIDER_MAX_TOKENS
        )
```

3. Add settings entries to `config.py`:

```python
NEW_PROVIDER_MODEL: str = "new-model-name"
NEW_PROVIDER_TIMEOUT: int = 30
NEW_PROVIDER_MAX_TOKENS: int = 4096
```

4. Add config class to settings validation if provider requires API key

5. Write unit tests for new config

Done. No changes needed to llm.py or pipeline.py - they just use the config!

## Design Decisions

### Why Fire-and-Forget (No Feature Flags)?

- **Simplicity**: One setting (LLM_PROVIDER) controls everything
- **Safety**: Can't accidentally misconfigure a provider
- **Transparency**: Defaults are explicit in code, easy to audit
- **Extensibility**: Adding new provider is localized to provider_configs.py

### Why Dataclass + ABC?

- **Immutability**: Configs are frozen after creation
- **Type safety**: Fields are type-hinted
- **Polymorphism**: Each provider can override methods
- **Simplicity**: Less boilerplate than pure classes

### Why Factory Function?

- **Single source of truth**: Settings → Config mapping is centralized
- **Easy testing**: Can pass mock settings to factory
- **Future-proof**: Can add caching or provider registry without changing callers

## Future Improvements (Phase 2+)

- Per-provider metrics tracking (which customizations are active)
- Gemini JSON schema enforcement validation (does it actually work?)
- Circuit breaker integration (move to config?)
- Provider-specific retry strategies (per provider, not global)
- Structured logging with provider labels

---

**Status:** Phase 1 Complete. Ready for Phase 2 LLMService integration.
