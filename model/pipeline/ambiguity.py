"""
Ambiguity & Subjectivity detection pipeline module.

Detects:
  - Vague quantifiers & temporal terms ("many", "some", "usually", "quickly", "a lot", etc.)
  - Unresolved pronouns ("this", "that", "it", "they" without clear antecedent)
  - Hedges & modal speculations ("allegedly", "possibly", "might", "could", "seems")
  - Subjective opinion & multi-interpretation statements ("better", "great", "poor")

Labels detected statements as AMBIGUOUS or UNVERIFIABLE with category AMBIGUOUS_STATEMENT.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional, Set
from model.schemas.result import Verdict, ErrorCategory

VAGUE_QUANTIFIERS: Set[str] = {
    "many",
    "some",
    "usually",
    "quickly",
    "a lot",
    "several",
    "often",
    "sometimes",
    "most",
    "few",
    "recently",
    "substantially",
    "frequently",
    "generally",
    "normally",
    "a bunch",
    "a significant amount",
}

UNRESOLVED_PRONOUNS: Set[str] = {
    "this",
    "that",
    "these",
    "those",
    "he",
    "she",
    "it",
    "they",
    "them",
    "their",
}

HEDGES: Set[str] = {
    "allegedly",
    "possibly",
    "might",
    "could",
    "reportedly",
    "presumably",
    "appears to",
    "seems",
    "arguably",
    "maybe",
    "supposedly",
    "likely",
    "potentially",
}

SUBJECTIVE_TERMS: Set[str] = {
    "better",
    "best",
    "worst",
    "great",
    "poor",
    "nice",
    "tasty",
    "bad",
    "superior",
    "inferior",
}


@dataclass
class AmbiguityCheck:
    is_ambiguous: bool
    verdict: Verdict
    errorCategory: Optional[ErrorCategory]
    ambiguous_phrase: Optional[str]
    reason: str
    explanation: str


def detect_ambiguity(claim_text: str, claim_type: str = "factual") -> AmbiguityCheck:
    """
    Analyzes claim_text for vague terms, unresolved pronouns, hedges, or subjectivity.
    """
    if not claim_text:
        return AmbiguityCheck(
            is_ambiguous=False,
            verdict="SUPPORTED",
            errorCategory=None,
            ambiguous_phrase=None,
            reason="Empty claim",
            explanation="",
        )

    text_lower = claim_text.lower()
    words = re.findall(r"\b[a-z']+\b", text_lower)

    # 1. Opinion / Subjective Claim Type
    if claim_type == "opinion":
        # Find subjective word if present
        subj_match = next((w for w in words if w in SUBJECTIVE_TERMS), None)
        phrase = subj_match or claim_text.strip()
        return AmbiguityCheck(
            is_ambiguous=True,
            verdict="UNVERIFIABLE",
            errorCategory="AMBIGUOUS_STATEMENT",
            ambiguous_phrase=phrase,
            reason="Subjective opinion claim",
            explanation=f"The statement is a subjective opinion ('{phrase}') that cannot be objectively verified against empirical source data.",
        )

    # 2. Check for Hedges
    for hedge in HEDGES:
        if re.search(r"\b" + re.escape(hedge) + r"\b", text_lower):
            return AmbiguityCheck(
                is_ambiguous=True,
                verdict="AMBIGUOUS",
                errorCategory="AMBIGUOUS_STATEMENT",
                ambiguous_phrase=hedge,
                reason="Hedged or speculative language",
                explanation=f"The claim uses hedged or speculative phrasing ('{hedge}') that admits multiple interpretations.",
            )

    # 3. Check for Subjective terms
    for subj in SUBJECTIVE_TERMS:
        if re.search(r"\b" + re.escape(subj) + r"\b", text_lower):
            return AmbiguityCheck(
                is_ambiguous=True,
                verdict="UNVERIFIABLE",
                errorCategory="AMBIGUOUS_STATEMENT",
                ambiguous_phrase=subj,
                reason="Subjective valuation term",
                explanation=f"The claim uses a subjective term ('{subj}') which lacks quantitative empirical bounds.",
            )

    # 4. Check for Vague Quantifiers (e.g. "usually helps quickly")
    matched_vague = []
    for vq in VAGUE_QUANTIFIERS:
        if re.search(r"\b" + re.escape(vq) + r"\b", text_lower):
            matched_vague.append(vq)

    if matched_vague:
        # Build minimal phrase containing vague quantifier(s)
        # e.g., if "usually" and "quickly" match in "Taking antipyretics usually helps quickly."
        # phrase = "usually helps quickly" or first matched quantifier
        phrase = matched_vague[0]
        if len(matched_vague) >= 2:
            # Extract span between first and last matched vague quantifier
            m1 = re.search(r"\b" + re.escape(matched_vague[0]) + r"\b", claim_text, re.I)
            m2 = re.search(r"\b" + re.escape(matched_vague[-1]) + r"\b", claim_text, re.I)
            if m1 and m2:
                s, e = min(m1.start(), m2.start()), max(m1.end(), m2.end())
                phrase = claim_text[s:e]

        return AmbiguityCheck(
            is_ambiguous=True,
            verdict="AMBIGUOUS",
            errorCategory="AMBIGUOUS_STATEMENT",
            ambiguous_phrase=phrase,
            reason="Vague quantifier or temporal term",
            explanation=f"The phrase '{phrase}' contains vague quantifiers that lack precise clinical or empirical parameters.",
        )

    # 5. Check for Unresolved Pronoun at sentence start or standalone
    first_word = words[0] if words else ""
    if first_word in UNRESOLVED_PRONOUNS and len(words) < 8:
        return AmbiguityCheck(
            is_ambiguous=True,
            verdict="AMBIGUOUS",
            errorCategory="AMBIGUOUS_STATEMENT",
            ambiguous_phrase=first_word,
            reason="Unresolved pronoun",
            explanation=f"The claim starts with an unresolved pronoun ('{first_word}') creating an ambiguous reference.",
        )

    return AmbiguityCheck(
        is_ambiguous=False,
        verdict="SUPPORTED",
        errorCategory=None,
        ambiguous_phrase=None,
        reason="No ambiguity detected",
        explanation="",
    )
