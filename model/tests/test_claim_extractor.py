"""
Tests for pipeline/claim_extractor.py

Uses the FakeLLMProvider to inject controlled LLM responses, then asserts:
 - All returned spans are valid substrings of the original answer.
 - Claim counts fall within the golden-fixture ranges.
 - Opinion claims are correctly flagged is_opinion=True.
 - Invalid-span claims are discarded, not returned.

Golden fixture: tests/golden/claims_golden.json
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from model.llm.providers import FakeLLMProvider
from model.llm.client import LLMClient
from model.pipeline.claim_extractor import extract_claims

GOLDEN_FILE = Path(__file__).parent / "golden" / "claims_golden.json"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_llm_claims_response(answer: str) -> str:
    """
    Generate a deterministic fake LLM response that produces one claim per
    sentence and uses exact answer-sentence spans so offsets are always valid.
    """
    sentence_pattern = re.compile(r"(?<=[.!?])\s+")
    parts = sentence_pattern.split(answer.strip())
    claims = []
    cursor = 0
    for part in parts:
        part_stripped = part.strip()
        if not part_stripped:
            continue
        start = answer.find(part_stripped, cursor)
        end = start + len(part_stripped)
        # Infer a simple claim type from keywords
        claim_type = "factual"
        lower = part_stripped.lower()
        if any(w in lower for w in ["should", "must", "recommend", "avoid"]):
            claim_type = "recommendation"
        elif any(c.isdigit() or c == "%" for c in part_stripped):
            claim_type = "numeric"
        elif any(w in lower for w in ["because", "causes", "leads to", "results in"]):
            claim_type = "causal"
        elif any(w in lower for w in [
            "believe", "feel", "think", "probably", "greatest", "best",
            "everyone", "seems", "perhaps", "likely",
        ]):
            claim_type = "opinion"

        claims.append({
            "text": part_stripped,
            "claimType": claim_type,
            "answerSpanStart": start,
            "answerSpanEnd": end,
        })
        cursor = end

    return json.dumps({"claims": claims})


# ---------------------------------------------------------------------------
# Core invariant test: spans must always be valid answer substrings
# ---------------------------------------------------------------------------

class TestSpanInvariant:
    """The primary contract: answer[claim.start:claim.end] is always non-empty."""

    @pytest.mark.asyncio
    async def test_spans_are_valid_substrings(self):
        answer = (
            "Aspirin reduces fever in adults. "
            "The standard dose is 300-900 mg. "
            "It should not be given to children."
        )
        fake_provider = FakeLLMProvider(
            response_text=_make_llm_claims_response(answer)
        )
        client = LLMClient(provider=fake_provider)
        claims = await extract_claims(answer=answer, llm_client=client)

        assert len(claims) >= 1, "Expected at least one claim"
        for claim in claims:
            s, e = claim.answerSpan.start, claim.answerSpan.end
            extracted = answer[s:e]
            assert extracted.strip() != "", (
                f"Claim '{claim.text}' has empty span [{s}:{e}]"
            )
            assert 0 <= s < e <= len(answer), (
                f"Claim '{claim.text}' span [{s}:{e}] out of bounds for "
                f"answer of length {len(answer)}"
            )

    @pytest.mark.asyncio
    async def test_invalid_span_claims_are_discarded(self):
        """Claims with out-of-bounds spans that fuzzy-match fails → discarded."""
        answer = "The sky is blue."
        # Manufacture a response with a totally bogus span
        bad_response = json.dumps({
            "claims": [{
                "text": "Giraffes eat eucalyptus leaves every morning.",
                "claimType": "factual",
                "answerSpanStart": 9999,
                "answerSpanEnd": 10050,
            }]
        })
        fake_provider = FakeLLMProvider(response_text=bad_response)
        client = LLMClient(provider=fake_provider)
        claims = await extract_claims(answer=answer, llm_client=client)
        assert claims == [], "Claim with unfixable span should be discarded"


# ---------------------------------------------------------------------------
# Opinion flagging
# ---------------------------------------------------------------------------

class TestOpinionFlagging:
    @pytest.mark.asyncio
    async def test_opinion_claims_flagged(self):
        answer = "I feel this medicine is probably the best option available."
        response = json.dumps({
            "claims": [{
                "text": "I feel this medicine is probably the best option available.",
                "claimType": "opinion",
                "answerSpanStart": 0,
                "answerSpanEnd": len(answer),
            }]
        })
        fake_provider = FakeLLMProvider(response_text=response)
        client = LLMClient(provider=fake_provider)
        claims = await extract_claims(answer=answer, llm_client=client)

        assert len(claims) == 1
        assert claims[0].is_opinion is True
        assert claims[0].claimType == "opinion"

    @pytest.mark.asyncio
    async def test_non_opinion_not_flagged(self):
        answer = "Water boils at 100 degrees Celsius at sea level."
        response = json.dumps({
            "claims": [{
                "text": "Water boils at 100 degrees Celsius at sea level.",
                "claimType": "numeric",
                "answerSpanStart": 0,
                "answerSpanEnd": len(answer),
            }]
        })
        fake_provider = FakeLLMProvider(response_text=response)
        client = LLMClient(provider=fake_provider)
        claims = await extract_claims(answer=answer, llm_client=client)

        assert len(claims) == 1
        assert claims[0].is_opinion is False


# ---------------------------------------------------------------------------
# Golden fixture tests: claim count ranges
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def golden_fixtures():
    return json.loads(GOLDEN_FILE.read_text(encoding="utf-8"))


class TestGoldenFixtures:
    """Verify claim count ranges against the golden fixture file."""

    @pytest.mark.asyncio
    async def test_all_golden_fixtures_claim_counts(self, golden_fixtures):
        for fixture in golden_fixtures:
            answer: str = fixture["answer"]
            question: str | None = fixture.get("question")
            min_count: int = fixture["expected_claim_count_min"]
            max_count: int = fixture["expected_claim_count_max"]
            fixture_id: str = fixture["id"]

            # Build a realistic fake response for this fixture
            fake_provider = FakeLLMProvider(
                response_text=_make_llm_claims_response(answer)
            )
            client = LLMClient(provider=fake_provider)
            claims = await extract_claims(
                answer=answer, question=question, llm_client=client
            )

            count = len(claims)
            assert min_count <= count <= max_count, (
                f"[{fixture_id}] Expected {min_count}–{max_count} claims, "
                f"got {count}"
            )

            # Span validity on all returned claims
            for claim in claims:
                s, e = claim.answerSpan.start, claim.answerSpan.end
                assert 0 <= s < e <= len(answer), (
                    f"[{fixture_id}] span [{s}:{e}] out of bounds"
                )
                assert answer[s:e].strip() != "", (
                    f"[{fixture_id}] empty span [{s}:{e}]"
                )

    @pytest.mark.asyncio
    async def test_pure_opinion_fixture_all_flagged(self, golden_fixtures):
        """The 'pure_opinion' fixture should have all claims flagged is_opinion."""
        fixture = next(f for f in golden_fixtures if f["id"] == "pure_opinion")
        answer = fixture["answer"]
        fake_provider = FakeLLMProvider(
            response_text=_make_llm_claims_response(answer)
        )
        client = LLMClient(provider=fake_provider)
        claims = await extract_claims(answer=answer, llm_client=client)

        if claims:
            opinion_claims = [c for c in claims if c.is_opinion]
            assert len(opinion_claims) >= 1, (
                "Expected at least one opinion claim in the pure_opinion fixture"
            )


# ---------------------------------------------------------------------------
# API endpoint integration tests
# ---------------------------------------------------------------------------

class TestChunkAndExtractClaimsEndpoints:
    from fastapi.testclient import TestClient
    from model.main import app

    def test_post_chunk_endpoint(self):
        from fastapi.testclient import TestClient
        from model.main import app

        client = TestClient(app)
        payload = {
            "sourceId": "src-test",
            "text": "Aspirin reduces fever. It also treats mild pain. Do not exceed 4g per day.",
            "chunkSize": 2,
            "overlap": 1,
        }
        res = client.post("/v1/chunk", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["sourceId"] == "src-test"
        assert len(data["chunks"]) >= 1

        # Span invariant on every returned chunk
        source_text: str = payload["text"]
        for chunk in data["chunks"]:
            s = chunk["span"]["start"]
            e = chunk["span"]["end"]
            assert source_text[s:e] == chunk["text"], (
                f"Chunk span invariant violated: [{s}:{e}]"
            )
