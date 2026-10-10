"""
Unit & Integration tests for reasoning and safety pipeline modules.

Tests:
1. Reasoning chain with a planted non sequitur
2. Planted internal contradiction between two claims
3. Unsafe dosage recommendation safety flag
4. POST /v1/audit route integration
"""

import pytest
from fastapi.testclient import TestClient
from model.main import app
from model.schemas.primitives import Span, Source
from model.schemas.result import Claim, Confidence
from model.pipeline.reasoning import analyze_reasoning
from model.pipeline.safety import analyze_safety

client = TestClient(app)


def test_planted_non_sequitur():
    answer_text = (
        "Aspirin reduces fever in adults because it inhibits prostaglandin synthesis. "
        "Therefore, aspirin cures all viral infections instantly."
    )
    claim_premise = Claim(
        id="c-premise",
        text="Aspirin reduces fever in adults because it inhibits prostaglandin synthesis.",
        answerSpan=Span(start=0, end=75),
        claimType="causal",
        verdict="SUPPORTED",
        explanation="Monograph confirms fever reduction mechanism.",
        evidence=[],
        confidence=Confidence(score=0.95, level="high", uncertaintyReasons=[]),
    )
    claim_conclusion = Claim(
        id="c-conclusion",
        text="Therefore, aspirin cures all viral infections instantly.",
        answerSpan=Span(start=76, end=132),
        claimType="factual",
        verdict="CONTRADICTED",
        explanation="Aspirin does not cure viral infections.",
        evidence=[],
        confidence=Confidence(score=0.90, level="high", uncertaintyReasons=[]),
    )

    issues = analyze_reasoning(answer_text, [claim_premise, claim_conclusion])
    assert len(issues) > 0

    non_seq_issues = [i for i in issues if i.type == "NON_SEQUITUR"]
    assert len(non_seq_issues) >= 1
    assert "c-conclusion" in non_seq_issues[0].claimIds
    assert non_seq_issues[0].confidence.level in ("high", "medium")


def test_planted_internal_contradiction():
    answer_text = (
        "Aspirin is completely safe for children under 12. "
        "Children under 12 should never be given aspirin due to risk of Reye syndrome."
    )
    claim_a = Claim(
        id="c-a",
        text="Aspirin is completely safe for children under 12.",
        answerSpan=Span(start=0, end=49),
        claimType="factual",
        verdict="CONTRADICTED",
        explanation="Inaccurate safety assertion.",
        evidence=[],
        confidence=Confidence(score=0.90, level="high", uncertaintyReasons=[]),
    )
    claim_b = Claim(
        id="c-b",
        text="Children under 12 should never be given aspirin due to risk of Reye syndrome.",
        answerSpan=Span(start=50, end=128),
        claimType="factual",
        verdict="SUPPORTED",
        explanation="Standard pediatric guideline.",
        evidence=[],
        confidence=Confidence(score=0.95, level="high", uncertaintyReasons=[]),
    )

    issues = analyze_reasoning(answer_text, [claim_a, claim_b])
    contradictions = [i for i in issues if i.type == "INTERNAL_CONTRADICTION"]

    assert len(contradictions) >= 1
    assert set(contradictions[0].claimIds) == {"c-a", "c-b"}


def test_unsafe_dosage_recommendation():
    answer_text = "Take 3000 mg of aspirin every 2 hours for mild headache."
    claim_unsafe = Claim(
        id="c-unsafe",
        text="Take 3000 mg of aspirin every 2 hours for mild headache.",
        answerSpan=Span(start=0, end=56),
        claimType="recommendation",
        verdict="CONTRADICTED",
        errorCategory="NUMERIC_MISMATCH",
        explanation="3000 mg every 2 hours exceeds safe toxic daily dosage limit of 4000 mg.",
        evidence=[],
        confidence=Confidence(score=0.98, level="high", uncertaintyReasons=[]),
    )

    flags = analyze_safety(answer_text, [claim_unsafe])
    assert len(flags) >= 1

    med_flags = [f for f in flags if f.domain == "medical"]
    assert len(med_flags) >= 1
    assert med_flags[0].severity == "high"
    assert "Consult a qualified healthcare professional" in med_flags[0].recommendation


def test_audit_endpoint_reasoning_and_safety_integration():
    payload = {
        "question": "What is the recommended aspirin dosage?",
        "answer": (
            "Take 3000 mg of aspirin every 2 hours. "
            "Aspirin reduces fever in adults because it inhibits enzymes. "
            "Therefore, aspirin cures all viral infections."
        ),
        "sources": [
            {
                "id": "src-1",
                "title": "Aspirin Monograph",
                "text": "The recommended dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily.",
            }
        ],
    }

    response = client.post("/v1/audit", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "reasoningIssues" in data
    assert "safetyFlags" in data
    assert isinstance(data["reasoningIssues"], list)
    assert isinstance(data["safetyFlags"], list)
    assert len(data["safetyFlags"]) >= 1
