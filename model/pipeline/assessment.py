"""
Overall Audit Assessment Module.

Computes:
  - Overall accuracy score (0.0 to 100.0)
  - Letter grade (A, B, C, D, F)
  - Verdict counts (SUPPORTED, CONTRADICTED, UNSUPPORTED, UNVERIFIABLE, AMBIGUOUS)
  - Concise 2 to 3 sentence natural language summary highlighting key audit findings
"""

from typing import List, Optional
from model.schemas.result import (
    Claim,
    ReasoningIssue,
    SafetyFlag,
    VerdictCounts,
    OverallScore,
    Grade,
)


def compute_overall_assessment(
    claims: List[Claim],
    reasoning_issues: Optional[List[ReasoningIssue]] = None,
    safety_flags: Optional[List[SafetyFlag]] = None,
) -> OverallScore:
    """
    Computes overall score (0-100), letter grade (A-F), verdict counts,
    and a concise 2-3 sentence audit summary.
    """
    if reasoning_issues is None:
        reasoning_issues = []
    if safety_flags is None:
        safety_flags = []

    # 1. Calculate verdict counts
    counts = VerdictCounts()
    for claim in claims:
        v = claim.verdict
        if v == "SUPPORTED":
            counts.SUPPORTED += 1
        elif v == "CONTRADICTED":
            counts.CONTRADICTED += 1
        elif v == "UNSUPPORTED":
            counts.UNSUPPORTED += 1
        elif v == "UNVERIFIABLE":
            counts.UNVERIFIABLE += 1
        elif v == "AMBIGUOUS":
            counts.AMBIGUOUS += 1

    total_claims = len(claims)

    # 2. Penalty-based score calculation
    if total_claims == 0:
        raw_score = 100.0
    else:
        penalty = 0.0
        penalty += counts.CONTRADICTED * 25.0
        penalty += counts.UNSUPPORTED * 12.0
        penalty += counts.AMBIGUOUS * 8.0
        penalty += counts.UNVERIFIABLE * 8.0

        # Additional penalties for reasoning flaws and safety flags
        penalty += len(reasoning_issues) * 10.0

        for flag in safety_flags:
            if flag.severity == "high":
                penalty += 25.0
            elif flag.severity == "medium":
                penalty += 15.0
            else:
                penalty += 8.0

        raw_score = max(0.0, 100.0 - (penalty / max(1.0, total_claims / 3.0)))

    score = round(max(0.0, min(100.0, raw_score)), 1)

    # 3. Assign letter grade
    if score >= 90.0:
        grade: Grade = "A"
    elif score >= 80.0:
        grade: Grade = "B"
    elif score >= 70.0:
        grade: Grade = "C"
    elif score >= 60.0:
        grade: Grade = "D"
    else:
        grade: Grade = "F"

    # 4. Generate 2-3 sentence natural language summary
    summary_sentences = []

    if total_claims == 0:
        summary_sentences.append("No extracted factual claims were found to audit in the response.")
    else:
        summary_sentences.append(
            f"Audit evaluated {total_claims} claim{'s' if total_claims > 1 else ''}: "
            f"{counts.SUPPORTED} supported, {counts.CONTRADICTED} contradicted, "
            f"and {counts.UNSUPPORTED} unsupported by source documentation."
        )

    # Highlight top errors
    error_highlights = []
    if counts.CONTRADICTED > 0:
        error_highlights.append(f"{counts.CONTRADICTED} claim contradiction{'s' if counts.CONTRADICTED > 1 else ''}")
    if counts.UNSUPPORTED > 0:
        error_highlights.append(f"{counts.UNSUPPORTED} unsupported claim{'s' if counts.UNSUPPORTED > 1 else ''}")
    if counts.AMBIGUOUS > 0 or counts.UNVERIFIABLE > 0:
        error_highlights.append(f"{counts.AMBIGUOUS + counts.UNVERIFIABLE} ambiguous/unverifiable statement(s)")

    if error_highlights:
        summary_sentences.append(
            f"Key findings include {', '.join(error_highlights)} requiring verification."
        )
    else:
        summary_sentences.append("All claims are fully grounded and verified against source documentation.")

    # Highlight reasoning issues / safety flags
    extra_alerts = []
    if reasoning_issues:
        extra_alerts.append(f"{len(reasoning_issues)} reasoning flaw(s)")
    if safety_flags:
        high_safety = sum(1 for f in safety_flags if f.severity == "high")
        if high_safety > 0:
            extra_alerts.append(f"{high_safety} high-severity safety risk alert(s)")
        else:
            extra_alerts.append(f"{len(safety_flags)} safety flag(s)")

    if extra_alerts:
        summary_sentences.append(f"Additional attention required for {', '.join(extra_alerts)}.")

    summary = " ".join(summary_sentences)

    return OverallScore(
        score=score,
        grade=grade,
        summary=summary,
        counts=counts,
    )
