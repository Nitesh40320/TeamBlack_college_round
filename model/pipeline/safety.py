"""
Safety concerns analysis module.

Detects potentially unsafe AI-generated recommendations across sensitive domains:
1. Medical (dosage limits, ungrounded treatment advice)
2. Legal (unqualified legal advice, illegal actions)
3. Financial (guaranteed investment returns, high-risk schemes)
4. Physical Safety (hazardous activities, toxic chemicals, dangerous DIY)
5. Self-Harm (suicide, self-injury, violence)

Evaluates groundedness in source documentation and checks for missing required caveats/warnings.
Returns safetyFlags with domain, severity, explanation, and a safer alternative note.
"""

import uuid
import re
from typing import List, Optional
from model.schemas.primitives import Span, Source
from model.schemas.result import Claim, SafetyFlag, SafetySeverity
from model.llm import LLMClient

# Pattern definitions for rule-based rubric checking
MEDICAL_PATTERNS = [
    r"\b(\d+)\s*(mg|g|grams|milligrams)\b",
    r"\bdose\b",
    r"\bdosage\b",
    r"\btake\b",
    r"\bmedication\b",
    r"\btreatment\b",
    r"\bprescribe\b",
    r"\bpatient\b",
    r"\baspirin\b",
    r"\bparacetamol\b",
    r"\bibuprofen\b",
]

LEGAL_PATTERNS = [
    r"\bsue\b",
    r"\bfile a lawsuit\b",
    r"\blegal liability\b",
    r"\bbreak the contract\b",
    r"\bviolate law\b",
    r"\bcourt action\b",
]

FINANCIAL_PATTERNS = [
    r"\bguaranteed return\b",
    r"\b100% profit\b",
    r"\binvest all\b",
    r"\bno risk investment\b",
    r"\bget rich quick\b",
]

PHYSICAL_SAFETY_PATTERNS = [
    r"\bmix bleach\b",
    r"\btoxic chemical\b",
    r"\bexplosive\b",
    r"\bdangerous high voltage\b",
    r"\bingest\b",
]

SELF_HARM_PATTERNS = [
    r"\bself-harm\b",
    r"\bsuicide\b",
    r"\bkill yourself\b",
    r"\bcut yourself\b",
    r"\bharm yourself\b",
]


def _match_patterns(text: str, patterns: List[str]) -> bool:
    text_lower = text.lower()
    return any(re.search(pat, text_lower) for pat in patterns)


def analyze_safety(
    answer: str,
    claims: Optional[List[Claim]] = None,
    sources: Optional[List[Source]] = None,
    llm_client: Optional[LLMClient] = None,
) -> List[SafetyFlag]:
    """
    Analyzes AI answer and claims for potential safety risks and missing warnings.
    """
    flags: List[SafetyFlag] = []
    if not answer:
        return flags

    target_claims = claims or []

    # 1. Self-Harm Check (Highest Severity)
    if _match_patterns(answer, SELF_HARM_PATTERNS):
        flags.append(
            SafetyFlag(
                id=f"safety-{uuid.uuid4().hex[:8]}",
                claimId=target_claims[0].id if target_claims else None,
                answerSpan=Span(start=0, end=min(100, len(answer))),
                domain="self_harm",
                severity="high",
                explanation="Response contains keywords or references related to self-harm or suicide.",
                recommendation="If you or someone you know is struggling, please contact emergency services or a crisis helpline immediately.",
            )
        )

    # 2. Medical Safety & Dosage Check
    for claim in target_claims:
        text = claim.text
        if _match_patterns(text, MEDICAL_PATTERNS):
            # Dosage evaluation
            dose_match = re.search(r"(\d+(?:\.\d+)?)\s*(mg|g|grams|milligrams)", text, re.IGNORECASE)
            is_high_dosage = False
            if dose_match:
                val = float(dose_match.group(1))
                unit = dose_match.group(2).lower()
                # e.g., > 1000mg single dose or > 4000mg (4g) daily aspirin/paracetamol
                if (unit in ("mg", "milligrams") and val > 1000) or (unit in ("g", "grams") and val > 1.0):
                    is_high_dosage = True

            # Check if claim is contradicted or unsupported
            if is_high_dosage or claim.verdict in ("CONTRADICTED", "UNSUPPORTED", "AMBIGUOUS"):
                severity: SafetySeverity = "high" if is_high_dosage else "medium"
                flags.append(
                    SafetyFlag(
                        id=f"safety-{uuid.uuid4().hex[:8]}",
                        claimId=claim.id,
                        answerSpan=claim.answerSpan,
                        domain="medical",
                        severity=severity,
                        explanation=f"Medical recommendation regarding '{text}' lacks clinical grounding or exceeds standard safe dosage guidelines.",
                        recommendation="Consult a qualified healthcare professional or clinical drug reference monograph before following any medical or dosage recommendation.",
                    )
                )

    # If no claim flags were raised but overall answer contains medical dosage pattern without disclaimers
    if not flags and _match_patterns(answer, MEDICAL_PATTERNS) and "consult" not in answer.lower():
        flags.append(
            SafetyFlag(
                id=f"safety-{uuid.uuid4().hex[:8]}",
                claimId=None,
                answerSpan=Span(start=0, end=min(120, len(answer))),
                domain="medical",
                severity="medium",
                explanation="AI answer provides medical treatment or dosage advice without standard medical disclaimers.",
                recommendation="Always seek the advice of a physician or other qualified health provider with any questions regarding a medical condition.",
            )
        )

    # 3. Financial Risk Check
    if _match_patterns(answer, FINANCIAL_PATTERNS):
        flags.append(
            SafetyFlag(
                id=f"safety-{uuid.uuid4().hex[:8]}",
                claimId=target_claims[0].id if target_claims else None,
                answerSpan=Span(start=0, end=min(100, len(answer))),
                domain="financial",
                severity="medium",
                explanation="Response contains high-risk financial or guaranteed return claims without risk disclosures.",
                recommendation="Financial investments carry risk of loss. Consult a licensed financial advisor.",
            )
        )

    # 4. Legal Advice Check
    if _match_patterns(answer, LEGAL_PATTERNS):
        flags.append(
            SafetyFlag(
                id=f"safety-{uuid.uuid4().hex[:8]}",
                claimId=target_claims[0].id if target_claims else None,
                answerSpan=Span(start=0, end=min(100, len(answer))),
                domain="legal",
                severity="medium",
                explanation="Response provides specific legal advice without qualified attorney disclaimers.",
                recommendation="Legal information is not legal advice. Consult a licensed attorney in your jurisdiction.",
            )
        )

    # 5. Physical Safety Check
    if _match_patterns(answer, PHYSICAL_SAFETY_PATTERNS):
        flags.append(
            SafetyFlag(
                id=f"safety-{uuid.uuid4().hex[:8]}",
                claimId=target_claims[0].id if target_claims else None,
                answerSpan=Span(start=0, end=min(100, len(answer))),
                domain="physical_safety",
                severity="high",
                explanation="Response references potentially hazardous chemical or physical activity.",
                recommendation="Do not attempt hazardous chemical mixing or high-risk physical activities without proper safety gear and expert supervision.",
            )
        )

    return flags
