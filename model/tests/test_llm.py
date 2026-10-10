import pytest
from pydantic import BaseModel
from model.llm import (
    FakeLLMProvider,
    LLMClient,
    repair_and_parse_json,
)


class SampleSchema(BaseModel):
    name: str
    score: int


def test_repair_and_parse_json_markdown_block():
    raw = """Here is your output:
```json
{
    "name": "test",
    "score": 42,
}
```
"""
    result = repair_and_parse_json(raw)
    assert result == {"name": "test", "score": 42}


@pytest.mark.asyncio
async def test_llm_client_generate_json_with_fake_provider():
    fake_provider = FakeLLMProvider(
        response_text='```json\n{"name": "Alice", "score": 95}\n```'
    )
    client = LLMClient(provider=fake_provider)

    result = await client.generate_json(
        prompt="Generate sample data",
        schema=SampleSchema,
    )
    assert result == {"name": "Alice", "score": 95}
    assert fake_provider.call_count == 1


@pytest.mark.asyncio
async def test_llm_client_retry_on_invalid_json():
    # First call will fail parsing, provider will be called again
    class FlakyFakeProvider(FakeLLMProvider):
        def __init__(self):
            super().__init__()
            self.calls = 0

        async def generate(self, prompt: str) -> str:
            self.calls += 1
            if self.calls == 1:
                return "Not a json response"
            return '{"name": "Bob", "score": 88}'

    flaky_provider = FlakyFakeProvider()
    client = LLMClient(provider=flaky_provider)

    result = await client.generate_json(
        prompt="Generate sample data",
        schema=SampleSchema,
        max_retries=2,
    )
    assert result == {"name": "Bob", "score": 88}
    assert flaky_provider.calls == 2
