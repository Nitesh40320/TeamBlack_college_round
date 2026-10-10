"""
Tests for error localization, ambiguity detection, category assignment,
and offset validation in model/pipeline/localizer.py and model/pipeline/ambiguity.py.
"""

import pytest
from model.schemas.primitives import Span
from model.schemas.result import Evidence
from model.pipeline.ambiguity import detect_ambiguity
from model.pipeline.localizer import localize_error, map_phrase_to_answer_span


# ---------------------------------------------------------------------------
# 1. AMBIGUOUS_STATEMENT Category Tests (3 cases)
# ---------------------------------------------------------------------------

def test_ambiguity_vague_quantifiers():
    answer = "Taking antipyretics usually helps quickly."
    claim_text = "Taking antipyretics usually helps quickly."
    span = Span(start=0, end=len(answer))

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="AMBIGUOUS",
        evidence_list=[],
    )

    assert res.verdict == "AMBIGUOUS"
    assert res.errorCategory == "AMBIGUOUS_STATEMENT"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "usually" in extracted.lower()
    assert res.error_phrase in answer


def test_ambiguity_unresolved_pronouns():
    answer = "This is effective for pain relief."
    claim_text = "This is effective for pain relief."
    span = Span(start=0, end=len(answer))

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="AMBIGUOUS",
        evidence_list=[],
    )

    assert res.errorCategory == "AMBIGUOUS_STATEMENT"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert extracted == "This"


def test_ambiguity_hedges_and_opinion():
    answer = "Aspirin allegedly improves outcomes better than other drugs."
    claim_text = "Aspirin allegedly improves outcomes better than other drugs."
    span = Span(start=0, end=len(answer))

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="UNVERIFIABLE",
        evidence_list=[],
        claim_type="opinion",
    )

    assert res.errorCategory == "AMBIGUOUS_STATEMENT"
    assert res.errorSpan is not None
    assert answer[res.errorSpan.start : res.errorSpan.end] in answer


# ---------------------------------------------------------------------------
# 2. NUMERIC_MISMATCH Category Tests (3 cases)
# ---------------------------------------------------------------------------

def test_numeric_mismatch_dosage():
    answer = "The standard dose is 1000 mg every 4 hours."
    claim_text = "The standard dose is 1000 mg every 4 hours."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours.",
            relation="contradicts",
            score=0.95,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "NUMERIC_MISMATCH"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert extracted == "1000 mg"


def test_numeric_mismatch_percentage():
    answer = "Patient outcomes improve by exactly 87.5% when taking aspirin."
    claim_text = "Patient outcomes improve by exactly 87.5% when taking aspirin."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin provides mild-to-moderate pain and fever reduction.",
            relation="related",
            score=0.80,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="UNSUPPORTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "NUMERIC_MISMATCH"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "87.5%" in extracted


def test_numeric_mismatch_quantity():
    answer = "The trial enrolled 5000 patients across Europe."
    claim_text = "The trial enrolled 5000 patients across Europe."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="The trial enrolled 350 patients across 4 clinical sites in Europe.",
            relation="contradicts",
            score=0.92,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "NUMERIC_MISMATCH"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "5000" in extracted


# ---------------------------------------------------------------------------
# 3. HALLUCINATED_FACT Category Tests (3 cases)
# ---------------------------------------------------------------------------

def test_hallucinated_fact_historical_detail():
    answer = "Aspirin was synthesized by ancient Egyptian physicians in 2000 BC."
    claim_text = "Aspirin was synthesized by ancient Egyptian physicians in 2000 BC."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin (acetylsalicylic acid) is indicated for fever and pain.",
            relation="related",
            score=0.70,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="UNSUPPORTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "HALLUCINATED_FACT"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "2000 BC" in extracted or "Egyptian" in extracted


def test_hallucinated_fact_green_tea():
    answer = "Outcomes improve when taking aspirin with green tea."
    claim_text = "Outcomes improve when taking aspirin with green tea."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin should be taken with food or water to avoid gastric irritation.",
            relation="related",
            score=0.75,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="UNSUPPORTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "HALLUCINATED_FACT"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "green tea" in extracted.lower()


def test_hallucinated_fact_date_year():
    answer = "The formula was patented in 2000 BC by chemists."
    claim_text = "The formula was patented in 2000 BC by chemists."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin was patented by Bayer in 1899.",
            relation="contradicts",
            score=0.90,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory in ("HALLUCINATED_FACT", "NUMERIC_MISMATCH")
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "2000 BC" in extracted


# ---------------------------------------------------------------------------
# 4. ENTITY_MISMATCH Category Tests (3 cases)
# ---------------------------------------------------------------------------

def test_entity_mismatch_brand():
    answer = "Aspirin is manufactured exclusively by Pfizer Corporation."
    claim_text = "Aspirin is manufactured exclusively by Pfizer Corporation."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin was historically developed and patented by Bayer.",
            relation="contradicts",
            score=0.91,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "ENTITY_MISMATCH"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert extracted == "Pfizer Corporation"


def test_entity_mismatch_location():
    answer = "The clinical trials took place at Boston General Hospital."
    claim_text = "The clinical trials took place at Boston General Hospital."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Clinical trials were conducted at St Thomas Hospital in London.",
            relation="contradicts",
            score=0.88,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "ENTITY_MISMATCH"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert extracted == "Boston General Hospital"


def test_entity_mismatch_subject():
    answer = "Children under 12 should take adult aspirin."
    claim_text = "Children under 12 should take adult aspirin."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin is contraindicated in children under 16 due to Reye syndrome risk.",
            relation="contradicts",
            score=0.95,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory in ("ENTITY_MISMATCH", "CONTRADICTS_SOURCE")
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "Children" in extracted or "aspirin" in extracted


# ---------------------------------------------------------------------------
# 5. CONTRADICTS_SOURCE Category Tests (3 cases)
# ---------------------------------------------------------------------------

def test_contradicts_source_cardiovascular_prophylaxis():
    answer = "It also prevents heart attacks in all adults over 40."
    claim_text = "It also prevents heart attacks in all adults over 40."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=120),
            text="Aspirin is not recommended as routine prophylaxis for cardiovascular events in low-risk adults due to bleeding risk.",
            relation="contradicts",
            score=0.98,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.verdict == "CONTRADICTED"
    assert res.errorCategory == "CONTRADICTS_SOURCE"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "prevents" in extracted.lower()


def test_contradicts_source_pregnancy_safety():
    answer = "High dose aspirin is safe for pregnant women in the third trimester."
    claim_text = "High dose aspirin is safe for pregnant women in the third trimester."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="High dose aspirin is contraindicated during third trimester due to risk of premature closure of ductus arteriosus.",
            relation="contradicts",
            score=0.96,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory == "CONTRADICTS_SOURCE"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert "safe" in extracted.lower()


def test_contradicts_source_curative_claim():
    answer = "Aspirin cures diabetes within two weeks."
    claim_text = "Aspirin cures diabetes within two weeks."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin has no curative effect on metabolic diabetes.",
            relation="contradicts",
            score=0.94,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="CONTRADICTED",
        evidence_list=evidence,
    )

    assert res.errorCategory in ("CONTRADICTS_SOURCE", "NUMERIC_MISMATCH")
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert extracted in answer


# ---------------------------------------------------------------------------
# 6. UNSUPPORTED_CLAIM Category Tests (3 cases)
# ---------------------------------------------------------------------------

def test_unsupported_claim_blue_glass_bottles():
    answer = "Aspirin was originally packaged in blue glass bottles."
    claim_text = "Aspirin was originally packaged in blue glass bottles."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever.",
            relation="related",
            score=0.60,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="UNSUPPORTED",
        evidence_list=evidence,
    )

    assert res.verdict == "UNSUPPORTED"
    assert res.errorCategory == "UNSUPPORTED_CLAIM"
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert extracted == claim_text


def test_unsupported_claim_storage_temperature():
    answer = "Vials must be stored at -80 degrees Celsius."
    claim_text = "Vials must be stored at -80 degrees Celsius."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Store tablets below 25 degrees Celsius in a dry place.",
            relation="contradicts",
            score=0.85,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="UNSUPPORTED",
        evidence_list=evidence,
    )

    assert res.errorCategory in ("UNSUPPORTED_CLAIM", "NUMERIC_MISMATCH", "ENTITY_MISMATCH")
    assert res.errorSpan is not None
    extracted = answer[res.errorSpan.start : res.errorSpan.end]
    assert extracted in answer


def test_unsupported_claim_secondary_indication():
    answer = "Aspirin relieves toothache within 5 minutes."
    claim_text = "Aspirin relieves toothache within 5 minutes."
    span = Span(start=0, end=len(answer))
    evidence = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Indicated for mild-to-moderate pain and fever.",
            relation="supports",
            score=0.70,
        )
    ]

    res = localize_error(
        claim_text=claim_text,
        answer_text=answer,
        answer_span=span,
        verdict="UNSUPPORTED",
        evidence_list=evidence,
    )

    assert res.verdict == "UNSUPPORTED"
    assert res.errorCategory in ("UNSUPPORTED_CLAIM", "NUMERIC_MISMATCH")
    assert res.errorSpan is not None
    assert answer[res.errorSpan.start : res.errorSpan.end] in answer


# ---------------------------------------------------------------------------
# 7. Explicit Test: UNSUPPORTED ≠ CONTRADICTED
# ---------------------------------------------------------------------------

def test_unsupported_is_not_contradicted():
    """
    Demonstrates that an unbacked claim (absent from source) yields UNSUPPORTED,
    whereas a refuting claim yields CONTRADICTED.
    """
    answer_unbacked = "Aspirin was packaged in blue glass bottles."
    span_unbacked = Span(start=0, end=len(answer_unbacked))
    evidence_unbacked = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin is indicated for fever.",
            relation="related",
            score=0.60,
        )
    ]

    res_unsupported = localize_error(
        claim_text=answer_unbacked,
        answer_text=answer_unbacked,
        answer_span=span_unbacked,
        verdict="UNSUPPORTED",
        evidence_list=evidence_unbacked,
    )

    answer_refuted = "Aspirin prevents heart attacks in all adults over 40."
    span_refuted = Span(start=0, end=len(answer_refuted))
    evidence_refuted = [
        Evidence(
            sourceId="src-1",
            span=Span(start=0, end=100),
            text="Aspirin is not recommended as routine prophylaxis for cardiovascular events due to bleeding risk.",
            relation="contradicts",
            score=0.98,
        )
    ]

    res_contradicted = localize_error(
        claim_text=answer_refuted,
        answer_text=answer_refuted,
        answer_span=span_refuted,
        verdict="CONTRADICTED",
        evidence_list=evidence_refuted,
    )

    # Assert distinct verdicts and categories
    assert res_unsupported.verdict == "UNSUPPORTED"
    assert res_unsupported.errorCategory == "UNSUPPORTED_CLAIM"

    assert res_contradicted.verdict == "CONTRADICTED"
    assert res_contradicted.errorCategory == "CONTRADICTS_SOURCE"

    assert res_unsupported.verdict != res_contradicted.verdict
    assert res_unsupported.errorCategory != res_contradicted.errorCategory

    # Verify offset correctness on both
    assert answer_unbacked[res_unsupported.errorSpan.start : res_unsupported.errorSpan.end] == answer_unbacked
    assert answer_refuted[res_contradicted.errorSpan.start : res_contradicted.errorSpan.end] in answer_refuted
