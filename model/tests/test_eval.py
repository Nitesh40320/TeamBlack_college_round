import json
import os
import pytest
from fastapi.testclient import TestClient

from model.main import app
from model.pipeline.confidence import compute_confidence, Calibrator
from model.pipeline.assessment import compute_overall_assessment
from model.eval.generator import write_benchmark_files
from model.eval.run_eval import run_evaluation_on_split, compute_span_iou
from model.schemas.result import Claim, ReasoningIssue, SafetyFlag, VerdictCounts

client = TestClient(app)


def test_compute_span_iou():
    span1 = {"start": 0, "end": 10}
    span2 = {"start": 5, "end": 15}
    iou = compute_span_iou(span1, span2)
    assert iou == round(5 / 15.0, 4)

    assert compute_span_iou({"start": 0, "end": 5}, {"start": 10, "end": 20}) == 0.0


def test_confidence_computation_and_calibrator(tmp_path):
    conf_res = compute_confidence(
        verdict="SUPPORTED",
        claim_text="Sample factual claim text",
        evidence_list=[],
        is_opinion=False,
        is_ambiguous=False,
    )
    assert 0.0 <= conf_res.score <= 1.0
    assert conf_res.level in ["low", "medium", "high"]
    assert isinstance(conf_res.uncertaintyReasons, list)

    calib_file = os.path.join(tmp_path, "calibrator.json")
    calib = Calibrator()
    calib.fit(raw_scores=[0.2, 0.5, 0.8, 0.95], binary_labels=[0, 0, 1, 1])
    calib.save(calib_file)

    loaded_calib = Calibrator()
    loaded_calib.load(calib_file)
    assert loaded_calib.temperature > 0
    calibrated_val = loaded_calib.calibrate(0.8)
    assert 0.0 <= calibrated_val <= 1.0


def test_overall_assessment_computation():
    claims = [
        Claim(
            id="c1",
            text="Claim 1",
            claimType="factual",
            answerSpan={"start": 0, "end": 10},
            verdict="SUPPORTED",
            confidence={"score": 0.9, "level": "high", "uncertaintyReasons": []},
            explanation="Claim is fully supported",
            category="FACTUAL",
            evidence=[],
        ),
        Claim(
            id="c2",
            text="Claim 2",
            claimType="factual",
            answerSpan={"start": 11, "end": 20},
            verdict="CONTRADICTED",
            confidence={"score": 0.85, "level": "high", "uncertaintyReasons": []},
            explanation="Claim is directly contradicted",
            category="FACTUAL",
            evidence=[],
        ),
    ]

    reasoning_issues = [
        ReasoningIssue(
            id="r1",
            type="NON_SEQUITUR",
            explanation="Unjustified inference",
            claimIds=["c2"],
            answerSpan={"start": 11, "end": 20},
            confidence={"score": 0.88, "level": "high", "uncertaintyReasons": []},
        )
    ]

    safety_flags = [
        SafetyFlag(
            id="s1",
            domain="medical",
            severity="high",
            recommendation="Take 500mg aspirin daily",
            explanation="Incorrect dosage advice",
            answerSpan={"start": 11, "end": 20},
            saferAlternative="Consult a doctor",
            isGrounded=False,
        )
    ]

    overall = compute_overall_assessment(claims, reasoning_issues, safety_flags)
    assert 0 <= overall.score <= 100
    assert overall.grade in ["A", "B", "C", "D", "F"]
    assert len(overall.summary) > 10
    assert overall.counts.SUPPORTED == 1
    assert overall.counts.CONTRADICTED == 1


def test_run_eval_and_api():
    # Ensure benchmark files exist
    write_benchmark_files()

    res = run_evaluation_on_split("model/eval/data/test.jsonl")
    assert "macro_f1" in res
    assert "contradiction_precision" in res
    assert "span_overlap_f1" in res
    assert "brier_score" in res
    assert "ece" in res
    assert "reliability_diagram" in res
    assert len(res["reliability_diagram"]) == 10

    # Test GET /v1/eval/latest endpoint
    response = client.get("/v1/eval/latest")
    assert response.status_code == 200
    data = response.json()
    assert "macro_f1" in data
    assert "reliability_diagram" in data
