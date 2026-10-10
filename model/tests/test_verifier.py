"""
Tests for pipeline/verifier.py and POST /v1/verify API endpoint.
"""

import json
import pytest
from fastapi.testclient import TestClient

from model.main import app
from model.llm import LLMClient
from model.llm.providers import BaseLLMProvider
from model.schemas import Source, Span
from model.schemas.pipeline import ExtractedClaimOut
from model.pipeline.verifier import verify_claim

client = TestClient(app)


@pytest.fixture
def sample_sources():
    return [
        Source(
            id="src-1",
            title="Aspirin Monograph",
            text="Aspirin is indicated for mild-to-moderate pain and fever. The recommended adult dose is 300-900 mg every 4-6 hours.",
        ),
        Source(
            id="src-2",
            title="Cardiology Guidelines",
            text="Aspirin is not recommended as routine prophylaxis for heart attacks in low-risk adults.",
        ),
    ]


class FailingLLMProvider(BaseLLMProvider):
    """Fake LLM Provider that raises an exception to test NLI-only fallback."""

    async def generate(self, prompt: str) -> str:
        raise RuntimeError("LLM service timeout or unreachable")


class FixtureLLMProvider(BaseLLMProvider):
    """Fake LLM Provider returning specific JSON fixture string matching JudgeOutput."""

    def __init__(self, verdict: str, error_category=None):
        self.verdict = verdict
        self.error_category = error_category

    async def generate(self, prompt: str) -> str:
        return json.dumps({
            "verdict": self.verdict,
            "errorCategory": self.error_category,
            "explanation": f"Judge verdict test for {self.verdict}.",
            "supporting_passage_indices": [0] if self.verdict == "SUPPORTED" else [],
            "contradicting_passage_indices": [0] if self.verdict == "CONTRADICTED" else [],
        })


@pytest.mark.asyncio
async def test_verify_supported_claim(sample_sources):
    claim = ExtractedClaimOut(
        id="c-1",
        text="Aspirin is used to reduce fever in adults.",
        answerSpan=Span(start=0, end=40),
        claimType="factual",
        is_opinion=False,
    )
    fake_llm = LLMClient(provider=FixtureLLMProvider("SUPPORTED"))
    verified = await verify_claim(claim, sample_sources, llm_client=fake_llm)

    assert verified.verdict == "SUPPORTED"
    assert verified.errorCategory is None
    assert len(verified.evidence) > 0
    assert verified.evidence[0].relation == "supports"


@pytest.mark.asyncio
async def test_verify_contradicted_claim(sample_sources):
    claim = ExtractedClaimOut(
        id="c-2",
        text="The standard adult dose of aspirin is 5000 mg every hour.",
        answerSpan=Span(start=41, end=95),
        claimType="numeric",
        is_opinion=False,
    )
    fake_llm = LLMClient(provider=FixtureLLMProvider("CONTRADICTED", "NUMERIC_MISMATCH"))
    verified = await verify_claim(claim, sample_sources, llm_client=fake_llm)

    assert verified.verdict == "CONTRADICTED"
    assert verified.errorCategory == "NUMERIC_MISMATCH"
    assert len(verified.evidence) > 0


@pytest.mark.asyncio
async def test_verify_unsupported_claim(sample_sources):
    claim = ExtractedClaimOut(
        id="c-3",
        text="Aspirin was first created in 3000 BC by ancient Romans.",
        answerSpan=Span(start=96, end=150),
        claimType="factual",
        is_opinion=False,
    )
    fake_llm = LLMClient(provider=FixtureLLMProvider("UNSUPPORTED", "UNSUPPORTED_CLAIM"))
    verified = await verify_claim(claim, sample_sources, llm_client=fake_llm)

    assert verified.verdict == "UNSUPPORTED"
    assert verified.errorCategory == "UNSUPPORTED_CLAIM"


@pytest.mark.asyncio
async def test_verify_opinion_claim(sample_sources):
    claim = ExtractedClaimOut(
        id="c-4",
        text="Taking aspirin makes people feel much better quickly.",
        answerSpan=Span(start=151, end=200),
        claimType="opinion",
        is_opinion=True,
    )
    verified = await verify_claim(claim, sample_sources)

    assert verified.verdict == "UNVERIFIABLE"
    assert verified.claimType == "opinion"


@pytest.mark.asyncio
async def test_verify_ambiguous_claim(sample_sources):
    claim = ExtractedClaimOut(
        id="c-5",
        text="Aspirin is universally recommended for heart health.",
        answerSpan=Span(start=201, end=250),
        claimType="recommendation",
        is_opinion=False,
    )
    fake_llm = LLMClient(provider=FixtureLLMProvider("AMBIGUOUS", "AMBIGUOUS_STATEMENT"))
    verified = await verify_claim(claim, sample_sources, llm_client=fake_llm)

    assert verified.verdict == "AMBIGUOUS"
    assert verified.errorCategory == "AMBIGUOUS_STATEMENT"


@pytest.mark.asyncio
async def test_nli_only_fallback_when_llm_fails(sample_sources):
    claim = ExtractedClaimOut(
        id="c-6",
        text="Aspirin is indicated for mild-to-moderate pain and fever.",
        answerSpan=Span(start=0, end=55),
        claimType="factual",
        is_opinion=False,
    )
    failing_llm = LLMClient(provider=FailingLLMProvider())
    verified = await verify_claim(claim, sample_sources, llm_client=failing_llm)

    assert verified.verdict in ("SUPPORTED", "CONTRADICTED", "UNSUPPORTED", "AMBIGUOUS")
    assert any("NLI-only fallback" in reason for reason in verified.confidence.uncertaintyReasons) or "[NLI-only fallback]" in verified.explanation


def test_verify_api_endpoint(sample_sources):
    payload = {
        "claim": {
            "id": "c-7",
            "text": "Aspirin is used to reduce fever in adults.",
            "answerSpan": {"start": 0, "end": 40},
            "claimType": "factual",
            "is_opinion": False,
        },
        "sources": [s.model_dump() for s in sample_sources],
    }

    response = client.post("/v1/verify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "c-7"
    assert "verdict" in data
    assert "evidence" in data
    assert "confidence" in data
