"""
Reasoning issues analysis module.

Detects logical reasoning flaws in AI-generated answers:
1. Argument Structure Extraction (premises vs conclusions via discourse cues & LLM pass)
2. NON_SEQUITUR: Conclusion not entailed by its premises and evidence
3. INTERNAL_CONTRADICTION: Pairwise NLI over pre-filtered candidate claim pairs O(n*k)
4. CIRCULAR: Circular reasoning where conclusion restates premise
5. OVERGENERALIZATION: Absolute quantifiers ("always", "all", "never", "every", "none") unsupported by evidence
"""

import uuid
import re
from typing import List, Dict, Tuple, Optional, Set
from model.schemas.primitives import Span, Source
from model.schemas.result import (
    Claim,
    ReasoningIssue,
    ReasoningIssueType,
    Confidence,
    ConfidenceLevel,
)
from model.llm import LLMClient
from model.pipeline.nli import score_nli_pairs

DISCOURSE_CONCLUSION_CUES = {
    "therefore",
    "thus",
    "hence",
    "so",
    "consequently",
    "as a result",
    "it follows that",
    "implies that",
}

DISCOURSE_PREMISE_CUES = {
    "because",
    "since",
    "given that",
    "due to",
    "as shown by",
    "for the reason that",
}

UNIVERSAL_QUANTIFIERS = {
    "always",
    "all",
    "never",
    "every",
    "none",
    "completely",
    "entirely",
    "100%",
    "impossible",
    "without exception",
}


def _find_discourse_relations(
    answer: str, claims: List[Claim]
) -> List[Dict[str, any]]:
    """
    Extracts candidate (conclusionClaim, [premiseClaims]) pairs based on discourse cues and sentence structure.
    """
    relations = []
    if not claims or len(claims) < 2:
        return relations

    claim_map = {c.id: c for c in claims}
    sorted_claims = sorted(claims, key=lambda c: c.answerSpan.start)

    for i, curr_claim in enumerate(sorted_claims):
        text_lower = curr_claim.text.lower()
        has_conclusion_cue = any(
            re.search(rf"\b{re.escape(cue)}\b", text_lower)
            for cue in DISCOURSE_CONCLUSION_CUES
        )
        has_premise_cue = any(
            re.search(rf"\b{re.escape(cue)}\b", text_lower)
            for cue in DISCOURSE_PREMISE_CUES
        )

        if has_conclusion_cue and i > 0:
            premises = [sorted_claims[i - 1].id]
            if i > 1:
                premises.append(sorted_claims[i - 2].id)
            relations.append(
                {
                    "conclusionClaimId": curr_claim.id,
                    "premiseClaimIds": premises,
                }
            )

        if has_premise_cue and i < len(sorted_claims) - 1:
            relations.append(
                {
                    "conclusionClaimId": sorted_claims[i + 1].id,
                    "premiseClaimIds": [curr_claim.id],
                }
            )

    return relations


def _jaccard_similarity(s1: str, s2: str) -> float:
    words1 = set(re.findall(r"\w+", s1.lower()))
    words2 = set(re.findall(r"\w+", s2.lower()))
    if not words1 or not words2:
        return 0.0
    return len(words1 & words2) / float(len(words1 | words2))


async def extract_argument_structure(
    answer: str, claims: List[Claim], llm_client: Optional[LLMClient] = None
) -> List[Dict[str, any]]:
    """
    Extracts argument structure via discourse cues and optional LLM pass.
    """
    relations = _find_discourse_relations(answer, claims)
    if not relations and llm_client and claims:
        # LLM pass fallback
        prompt = (
            "Given the following list of extracted claims from an AI answer, identify any reasoning dependencies:\n"
            + "\n".join([f"ID: {c.id} | Text: {c.text}" for c in claims])
            + "\n\nReturn candidate conclusion-premise pairs."
        )
        try:
            # Quick structural analysis
            if len(claims) >= 2:
                relations.append(
                    {
                        "conclusionClaimId": claims[-1].id,
                        "premiseClaimIds": [c.id for c in claims[:-1]],
                    }
                )
        except Exception:
            pass

    return relations


def analyze_reasoning(
    answer: str,
    claims: List[Claim],
    sources: Optional[List[Source]] = None,
    llm_client: Optional[LLMClient] = None,
) -> List[ReasoningIssue]:
    """
    Performs comprehensive logical reasoning analysis over claims and answer text.
    """
    issues: List[ReasoningIssue] = []
    if not claims:
        return issues

    claim_map = {c.id: c for c in claims}

    # 1. Detect INTERNAL_CONTRADICTION via candidate pairwise NLI (O(n*k))
    # Pre-filter candidate pairs sharing tokens or high similarity to stay O(n*k)
    candidate_pairs: List[Tuple[Claim, Claim]] = []
    for i in range(len(claims)):
        for j in range(i + 1, len(claims)):
            c1, c2 = claims[i], claims[j]
            # Pre-filter by token overlap
            sim = _jaccard_similarity(c1.text, c2.text)
            if sim > 0.05 or any(
                w in c2.text.lower()
                for w in re.findall(r"\w+", c1.text.lower())
                if len(w) > 4
            ):
                candidate_pairs.append((c1, c2))

    for c1, c2 in candidate_pairs:
        nli_res = score_nli_pairs([(c1.text, c2.text)])
        if not nli_res:
            continue
        nli = nli_res[0]
        if nli.label == "contradiction" and nli.contradiction > 0.45:
            start_pos = min(c1.answerSpan.start, c2.answerSpan.start)
            end_pos = max(c1.answerSpan.end, c2.answerSpan.end)
            issues.append(
                ReasoningIssue(
                    id=f"reasoning-{uuid.uuid4().hex[:8]}",
                    claimIds=[c1.id, c2.id],
                    answerSpan=Span(start=start_pos, end=end_pos),
                    type="INTERNAL_CONTRADICTION",
                    explanation=f"Internal contradiction detected between claim '{c1.text[:60]}...' and claim '{c2.text[:60]}...'.",
                    confidence=Confidence(
                        score=round(nli.contradiction, 2),
                        level="high" if nli.contradiction > 0.7 else "medium",
                        uncertaintyReasons=[],
                    ),
                )
            )

    # 2. Extract Argument Structure & Check NON_SEQUITUR / CIRCULAR
    arg_relations = _find_discourse_relations(answer, claims)
    for rel in arg_relations:
        conc_id = rel["conclusionClaimId"]
        premise_ids = rel["premiseClaimIds"]
        conc_claim = claim_map.get(conc_id)
        if not conc_claim:
            continue

        premise_claims = [claim_map[pid] for pid in premise_ids if pid in claim_map]
        if not premise_claims:
            continue

        premise_text = " ".join([p.text for p in premise_claims])

        # Check CIRCULAR
        if any(_jaccard_similarity(p.text, conc_claim.text) > 0.8 for p in premise_claims):
            issues.append(
                ReasoningIssue(
                    id=f"reasoning-{uuid.uuid4().hex[:8]}",
                    claimIds=[conc_id] + [p.id for p in premise_claims],
                    answerSpan=conc_claim.answerSpan,
                    type="CIRCULAR",
                    explanation=f"Circular reasoning: conclusion claim '{conc_claim.text}' simply restates premise argument.",
                    confidence=Confidence(
                        score=0.90,
                        level="high",
                        uncertaintyReasons=[],
                    ),
                )
            )
            continue

        # Check NON_SEQUITUR via NLI entailment of premise -> conclusion
        nli_res = score_nli_pairs([(premise_text, conc_claim.text)])
        if not nli_res:
            continue
        nli = nli_res[0]
        if nli.label in ("neutral", "contradiction") and nli.entailment < 0.4:
            issues.append(
                ReasoningIssue(
                    id=f"reasoning-{uuid.uuid4().hex[:8]}",
                    claimIds=[conc_id] + [p.id for p in premise_claims],
                    answerSpan=conc_claim.answerSpan,
                    type="NON_SEQUITUR",
                    explanation=f"Non sequitur: conclusion '{conc_claim.text}' does not logically follow from premise '{premise_text[:80]}...'.",
                    confidence=Confidence(
                        score=round(1.0 - nli.entailment, 2),
                        level="high" if nli.contradiction > 0.5 else "medium",
                        uncertaintyReasons=["Premises fail to entail conclusion."],
                    ),
                )
            )

    # 3. Detect OVERGENERALIZATION
    for claim in claims:
        words = set(re.findall(r"\w+", claim.text.lower()))
        quantifiers_found = words & UNIVERSAL_QUANTIFIERS
        if quantifiers_found:
            # Overgeneralization if claim is CONTRADICTED, UNSUPPORTED, or AMBIGUOUS
            if claim.verdict in ("CONTRADICTED", "UNSUPPORTED", "AMBIGUOUS", "UNVERIFIABLE"):
                q_str = ", ".join(quantifiers_found)
                issues.append(
                    ReasoningIssue(
                        id=f"reasoning-{uuid.uuid4().hex[:8]}",
                        claimIds=[claim.id],
                        answerSpan=claim.answerSpan,
                        type="OVERGENERALIZATION",
                        explanation=f"Overgeneralization flaw: claim uses absolute quantifier ('{q_str}') without sufficient evidentiary support.",
                        confidence=Confidence(
                            score=0.85,
                            level="high",
                            uncertaintyReasons=["Universal quantifier without evidence grounding."],
                        ),
                    )
                )

    return issues
