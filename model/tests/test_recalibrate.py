import pytest
from model.eval.recalibrate import refit_calibrator_and_report_ece, ingest_feedback_entries


def test_recalibrate_report():
    sample_feedback = [
        {"findingId": "f1", "verdict": "correct", "claimVerdict": "SUPPORTED", "confidenceScore": 0.92},
        {"findingId": "f2", "verdict": "incorrect", "claimVerdict": "CONTRADICTED", "confidenceScore": 0.88},
        {"findingId": "f3", "verdict": "correct", "claimVerdict": "UNSUPPORTED", "confidenceScore": 0.75},
    ]

    report = refit_calibrator_and_report_ece(sample_feedback)

    assert report["status"] == "success"
    assert "ece_before" in report
    assert "ece_after" in report
    assert "calibration_drift" in report
    assert report["total_feedback_ingested"] == 3
    assert "temperature" in report["calibrator_params"]
