from abc import ABC, abstractmethod
from typing import Optional
from model.config import settings
from model.logging_config import logger


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str) -> str:
        """Generate text response from LLM."""
        pass


class FakeLLMProvider(BaseLLMProvider):
    def __init__(self, response_text: Optional[str] = None):
        self.response_text = response_text
        self.last_prompt: Optional[str] = None
        self.call_count: int = 0

    async def generate(self, prompt: str) -> str:
        self.last_prompt = prompt
        self.call_count += 1
        if self.response_text:
            return self.response_text
        return '{"status": "ok", "mock_response": true}'


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or settings.LLM_API_KEY
        self.model_name = model_name or settings.LLM_MODEL_NAME or "gemini-1.5-pro"

    async def generate(self, prompt: str) -> str:
        if not self.api_key:
            logger.warning("Gemini API key not set, using fallback response")
            return '{"error": "Gemini API key missing"}'
        # Provider stub for Gemini SDK / REST API call
        return f'{{"provider": "gemini", "model": "{self.model_name}", "status": "simulated"}}'


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or settings.LLM_API_KEY
        self.model_name = model_name or settings.LLM_MODEL_NAME or "gpt-4o"

    async def generate(self, prompt: str) -> str:
        if not self.api_key:
            logger.warning("OpenAI API key not set, using fallback response")
            return '{"error": "OpenAI API key missing"}'
        # Provider stub for OpenAI SDK / REST API call
        return f'{{"provider": "openai", "model": "{self.model_name}", "status": "simulated"}}'


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or settings.LLM_API_KEY
        self.model_name = model_name or settings.LLM_MODEL_NAME or "claude-3-5-sonnet-20240620"

    async def generate(self, prompt: str) -> str:
        if not self.api_key:
            logger.warning("Anthropic API key not set, using fallback response")
            return '{"error": "Anthropic API key missing"}'
        # Provider stub for Anthropic SDK / REST API call
        return f'{{"provider": "anthropic", "model": "{self.model_name}", "status": "simulated"}}'


def get_llm_provider(provider_name: Optional[str] = None) -> BaseLLMProvider:
    name = (provider_name or settings.LLM_PROVIDER).lower()
    if name == "gemini":
        return GeminiProvider()
    elif name == "openai":
        return OpenAIProvider()
    elif name == "anthropic":
        return AnthropicProvider()
    elif name == "fake":
        return FakeLLMProvider()
    else:
        raise ValueError(f"Unsupported LLM provider: {name}")
