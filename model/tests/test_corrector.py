import pytest
from model.schemas.primitives import Span, Source
from model.schemas.result import Claim, Confidence, Evidence
from model.pipeline.corrector import generate_corrections


@pytest.mark.asyncio
async def test_generate_corrections_mock():
    sources = [
        Source(
            id="src-1",
            title="Medical Monograph",
            text="The recommended adult dose for aspirin antipyresis is 300-900 mg every 4-6 hours.",
        )
    ]
    claims = [
        Claim(
            id="c1",
            text="The standard dose is 1000 mg every 4 hours.",
            answerSpan=Span(start=0, end=42),
            claimType="numeric",
            verdict="CONTRADICTED",
            explanation="1000 mg exceeds maximum dose.",
            evidence=[
                Evidence(
                    sourceId="src-1",
                    span=Span(start=0, end=70),
                    text="The recommended adult dose for aspirin antipyresis is 300-900 mg every 4-6 hours.",
                    relation="contradicts",
                    score=0.95,
                )
            ],
            confidence=Confidence(score=0.9, level="high", uncertaintyReasons=[]),
        )
    ]
    answer = "The standard dose is 1000 mg every 4 hours."

    res = await generate_corrections(
        audit_id="audit-test-1",
        claims=claims,
        sources=sources,
        answer_text=answer,
    )

    assert res.auditId == "audit-test-1"
    assert len(res.corrections) == 1
    corr = res.corrections[0]
    assert corr.claimId == "c1"
    assert corr.action in ("rewrite", "remove")
    assert res.correctedAnswer is not None
