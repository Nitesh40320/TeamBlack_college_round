from model.schemas.result import (
    AuditResult,
    Claim,
    Confidence,
    Evidence,
    Meta,
    ModelVersions,
    OverallScore,
    ReasoningIssue,
    SafetyFlag,
    Timings,
    VerdictCounts,
)


def get_mock_audit_result() -> AuditResult:
    claims = [
        Claim(
            id="c0000001-0000-0000-0000-000000000001",
            text="Aspirin is commonly used to reduce fever in adults.",
            answerSpan={"start": 0, "end": 50},
            claimType="factual",
            verdict="SUPPORTED",
            errorCategory=None,
            errorSpan=None,
            explanation="The source confirms aspirin is indicated for mild-to-moderate pain and fever.",
            evidence=[
                Evidence(
                    sourceId="src-1",
                    span={"start": 0, "end": 80},
                    text="Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever.",
                    relation="supports",
                    score=0.97,
                )
            ],
            confidence=Confidence(
                score=0.96,
                level="high",
                uncertaintyReasons=[],
            ),
        ),
        Claim(
            id="c0000001-0000-0000-0000-000000000002",
            text="The standard dose is 1000 mg every 4 hours, not exceeding 4 g per day.",
            answerSpan={"start": 51, "end": 121},
            claimType="numeric",
            verdict="CONTRADICTED",
            errorCategory="NUMERIC_MISMATCH",
            errorSpan={"start": 72, "end": 79},
            explanation="The source states 300-900 mg per dose; 1000 mg exceeds documented single dose limits.",
            evidence=[
                Evidence(
                    sourceId="src-1",
                    span={"start": 81, "end": 170},
                    text="The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily.",
                    relation="contradicts",
                    score=0.99,
                )
            ],
            confidence=Confidence(
                score=0.94,
                level="high",
                uncertaintyReasons=[],
            ),
        ),
        Claim(
            id="c0000001-0000-0000-0000-000000000003",
            text="Aspirin was first synthesized by ancient Egyptian physicians in 2000 BC.",
            answerSpan={"start": 122, "end": 192},
            claimType="factual",
            verdict="UNSUPPORTED",
            errorCategory="UNSUPPORTED_CLAIM",
            errorSpan={"start": 122, "end": 192},
            explanation="The provided source document makes no mention of ancient Egyptian synthesis.",
            evidence=[],
            confidence=Confidence(
                score=0.88,
                level="medium",
                uncertaintyReasons=["Source document context does not cover ancient history."],
            ),
        ),
        Claim(
            id="c0000001-0000-0000-0000-000000000004",
            text="Patient outcomes improve by exactly 87.5% when taking aspirin with warm green tea.",
            answerSpan={"start": 193, "end": 275},
            claimType="numeric",
            verdict="UNVERIFIABLE",
            errorCategory="HALLUCINATED_FACT",
            errorSpan={"start": 235, "end": 275},
            explanation="Specific synergy claim with warm green tea cannot be verified against clinical sources.",
            evidence=[],
            confidence=Confidence(
                score=0.90,
                level="high",
                uncertaintyReasons=["Unsubstantiated quantitative outcome claim."],
            ),
        ),
        Claim(
            id="c0000001-0000-0000-0000-000000000005",
            text="Taking antipyretics usually helps quickly.",
            answerSpan={"start": 276, "end": 317},
            claimType="opinion",
            verdict="AMBIGUOUS",
            errorCategory="AMBIGUOUS_STATEMENT",
            errorSpan={"start": 296, "end": 317},
            explanation="The terms 'usually' and 'quickly' lack precise measurable clinical criteria.",
            evidence=[],
            confidence=Confidence(
                score=0.75,
                level="medium",
                uncertaintyReasons=["Subjective and vague phrasing."],
            ),
        ),
    ]

    reasoning_issues = [
        ReasoningIssue(
            id="r0000001-0000-0000-0000-000000000001",
            claimIds=[
                "c0000001-0000-0000-0000-000000000002",
                "c0000001-0000-0000-0000-000000000005",
            ],
            answerSpan={"start": 51, "end": 317},
            type="NON_SEQUITUR",
            explanation="Recommending an excessive dose while asserting antipyretics usually help quickly is a logical non-sequitur without clinical qualification.",
            confidence=Confidence(
                score=0.85,
                level="medium",
                uncertaintyReasons=[],
            ),
        )
    ]

    safety_flags = [
        SafetyFlag(
            id="sf000001-0000-0000-0000-000000000001",
            claimId="c0000001-0000-0000-0000-000000000002",
            answerSpan={"start": 51, "end": 121},
            domain="medical",
            severity="high",
            explanation="High dosage recommendation exceeds standard single dose guidelines and poses potential overdose risk.",
            recommendation="Advise user to follow official medical guidelines (300-900 mg per dose) and consult a healthcare professional.",
        )
    ]

    return AuditResult(
        id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        status="completed",
        claims=claims,
        reasoningIssues=reasoning_issues,
        safetyFlags=safety_flags,
        overall=OverallScore(
            score=45.0,
            grade="F",
            summary="The answer contains 1 supported claim, 1 contradicted claim, 1 unsupported claim, 1 unverifiable claim, and 1 ambiguous statement. High-risk medical safety flag identified.",
            counts=VerdictCounts(
                SUPPORTED=1,
                CONTRADICTED=1,
                UNSUPPORTED=1,
                UNVERIFIABLE=1,
                AMBIGUOUS=1,
            ),
        ),
        meta=Meta(
            timings=Timings(
                totalMs=1250.0,
                chunkingMs=15.0,
                extractionMs=320.0,
                verificationMs=650.0,
                analysisMs=265.0,
            ),
            modelVersions=ModelVersions(
                embedder="text-embedding-3-small@2024-02",
                verifier="gpt-4o-mini@2024-07-18",
                analyzer="gpt-4o@2024-08-06",
            ),
            mode="mock",
        ),
        createdAt="2024-09-01T12:00:00.000Z",
        updatedAt="2024-09-01T12:00:01.250Z",
    )
