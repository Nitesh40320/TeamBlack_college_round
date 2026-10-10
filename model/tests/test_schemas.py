from model.pipeline import get_mock_audit_result
from model.schemas import AuditRequest, AuditResult, Source


def test_audit_request_validation():
    req = AuditRequest(
        question="What is aspirin used for?",
        answer="Aspirin is used to treat mild pain and fever.",
        sources=[
            Source(
                id="src-1",
                title="BNF Aspirin",
                text="Aspirin is indicated for mild pain and fever.",
            )
        ],
    )
    assert req.answer == "Aspirin is used to treat mild pain and fever."
    assert len(req.sources) == 1


def test_mock_audit_result_fixture():
    result = get_mock_audit_result()
    assert isinstance(result, AuditResult)
    assert result.status == "completed"
    assert len(result.claims) == 5

    # Check all 5 verdicts are represented
    verdicts = {c.verdict for c in result.claims}
    expected_verdicts = {
        "SUPPORTED",
        "CONTRADICTED",
        "UNSUPPORTED",
        "UNVERIFIABLE",
        "AMBIGUOUS",
    }
    assert verdicts == expected_verdicts

    # Check reasoning issues and safety flags
    assert len(result.reasoningIssues) == 1
    assert result.reasoningIssues[0].type == "NON_SEQUITUR"

    assert len(result.safetyFlags) == 1
    assert result.safetyFlags[0].severity == "high"

    # Check overall counts
    assert result.overall.counts.SUPPORTED == 1
    assert result.overall.counts.CONTRADICTED == 1
    assert result.overall.counts.UNSUPPORTED == 1
    assert result.overall.counts.UNVERIFIABLE == 1
    assert result.overall.counts.AMBIGUOUS == 1
