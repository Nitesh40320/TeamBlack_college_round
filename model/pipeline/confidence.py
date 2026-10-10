"""
Confidence Calculation & Calibration Pipeline Module.

Computes confidence per finding from features:
  - NLI probability margin
  - Retrieval semantic relevance score
  - Evidence count and agreement
  - LLM-judge agreement / self-consistency
  - Claim ambiguity (vague quantifiers / opinion)
  - Source token coverage

Calibrates confidence scores using temperature scaling fitted on dev split.
Generates human-readable uncertainty reasons.

CRITICAL NOTE:
Confidence describes how sure the system is about the FINDING and is NEVER a correctness guarantee.
"""

import json
import math
import os
from typing import List, Optional, Dict, Any
from model.schemas.result import Confidence, ConfidenceLevel, Evidence, Verdict


class Calibrator:
    """Temperature scaling calibrator for mapping raw confidence scores to calibrated probabilities."""

    def __init__(self, temperature: float = 1.25, shift: float = 0.05):
        self.temperature = temperature
        self.shift = shift

    def calibrate(self, raw_score: float) -> float:
        """Applies temperature scaling calibration curve."""
        raw_score = max(0.0, min(1.0, raw_score))
        logit = math.log(max(1e-5, raw_score) / max(1e-5, 1.0 - raw_score))
        calibrated_logit = (logit - self.shift) / max(0.1, self.temperature)
        calibrated = 1.0 / (1.0 + math.exp(-calibrated_logit))
        return round(max(0.05, min(0.99, calibrated)), 4)

    def fit(self, raw_scores: List[float], binary_labels: List[int]) -> None:
        """Fits temperature and shift parameters on calibration data."""
        if not raw_scores or not binary_labels or len(raw_scores) != len(binary_labels):
            return

        # Simple grid search optimizer over temperature and shift
        best_brier = float("inf")
        best_temp = 1.0
        best_shift = 0.0

        for t in [0.8, 1.0, 1.2, 1.5, 1.8, 2.0]:
            for s in [-0.2, -0.1, 0.0, 0.1, 0.2]:
                self.temperature = t
                self.shift = s
                brier = sum(
                    (self.calibrate(score) - label) ** 2
                    for score, label in zip(raw_scores, binary_labels)
                ) / float(len(raw_scores))
                if brier < best_brier:
                    best_brier = brier
                    best_temp = t
                    best_shift = s

        self.temperature = best_temp
        self.shift = best_shift

    def save(self, filepath: str) -> None:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump({"temperature": self.temperature, "shift": self.shift}, f, indent=2)

    def load(self, filepath: str) -> None:
        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.temperature = data.get("temperature", 1.25)
                    self.shift = data.get("shift", 0.05)
            except Exception:
                pass


# Global calibrator instance
DEFAULT_CALIBRATOR_PATH = "model/eval/calibrator.json"
_global_calibrator = Calibrator()
if os.path.exists(DEFAULT_CALIBRATOR_PATH):
    _global_calibrator.load(DEFAULT_CALIBRATOR_PATH)
elif os.path.exists("eval/calibrator.json"):
    _global_calibrator.load("eval/calibrator.json")


def compute_confidence(
    verdict: Verdict,
    claim_text: str,
    evidence_list: List[Evidence],
    nli_scores: Optional[List[Any]] = None,
    judge_output: Optional[Any] = None,
    is_opinion: bool = False,
    is_ambiguous: bool = False,
    source_text: Optional[str] = None,
    calibrator: Optional[Calibrator] = None,
) -> Confidence:
    """
    Computes confidence per finding from features:
      - NLI probability margin
      - Retrieval score
      - Evidence count and agreement
      - LLM-judge agreement / self-consistency
      - Claim ambiguity
      - Source coverage
    """
    if calibrator is None:
        calibrator = _global_calibrator

    uncertainty_reasons: List[str] = []

    # 1. Feature: Retrieval Score & Evidence Count
    evidence_count = len(evidence_list)
    top_retrieval_score = max((e.score for e in evidence_list), default=0.0)

    if evidence_count == 0:
        uncertainty_reasons.append("No direct evidence passages retrieved from source text.")

    # 2. Feature: NLI Margin & Agreement
    nli_margin = 0.5
    if nli_scores and len(nli_scores) > 0:
        top_ent = max((s.entailment for s in nli_scores), default=0.0)
        top_con = max((s.contradiction for s in nli_scores), default=0.0)
        nli_margin = abs(top_ent - top_con)
        if nli_margin < 0.25:
            uncertainty_reasons.append("NLI entailment and contradiction signals are close or margin is narrow.")

    # 3. Feature: Evidence Agreement
    agreeing_evidence = [
        e for e in evidence_list
        if (verdict == "SUPPORTED" and e.relation == "supports")
        or (verdict == "CONTRADICTED" and e.relation == "contradicts")
    ]
    evidence_agreement = (
        len(agreeing_evidence) / float(evidence_count) if evidence_count > 0 else 0.5
    )
    if evidence_count > 0 and evidence_agreement < 0.6:
        uncertainty_reasons.append("Retrieved evidence passages exhibit conflicting or partial signals.")

    # 4. Feature: LLM Judge Agreement
    judge_agreement = 1.0
    if judge_output is not None:
        if getattr(judge_output, "verdict", "") != verdict:
            judge_agreement = 0.5
            uncertainty_reasons.append("LLM judge decision diverged from NLI cross-encoder heuristics.")

    # 5. Feature: Claim Ambiguity / Opinion
    ambiguity_penalty = 0.0
    if is_opinion:
        ambiguity_penalty += 0.3
        uncertainty_reasons.append("Claim represents a subjective opinion or value judgment.")
    if is_ambiguous:
        ambiguity_penalty += 0.2
        uncertainty_reasons.append("Claim contains vague quantifiers, hedges, or ambiguous phrasing.")

    # 6. Feature: Source Coverage
    source_coverage = 0.8
    if source_text and claim_text:
        claim_words = set(w.lower() for w in claim_text.split() if len(w) > 3)
        if claim_words:
            matched = sum(1 for w in claim_words if w in source_text.lower())
            source_coverage = matched / float(len(claim_words))
            if source_coverage < 0.4:
                uncertainty_reasons.append("Low source text keyword coverage for claim terms.")

    # Compute raw score via feature weighting
    raw_score = (
        0.30 * (top_retrieval_score if evidence_count > 0 else 0.4)
        + 0.25 * nli_margin
        + 0.20 * evidence_agreement
        + 0.15 * judge_agreement
        + 0.10 * source_coverage
        - ambiguity_penalty
    )

    # Calibrate score
    calibrated_score = calibrator.calibrate(raw_score)

    # Map level
    if calibrated_score >= 0.85:
        level: ConfidenceLevel = "high"
    elif calibrated_score >= 0.65:
        level: ConfidenceLevel = "medium"
    else:
        level: ConfidenceLevel = "low"

    return Confidence(
        score=calibrated_score,
        level=level,
        uncertaintyReasons=uncertainty_reasons,
    )
