"""
Verifier pipeline module.

Combines NLI cross-encoder scoring and an evidence-constrained LLM judge to produce:
  - Final Verdict (SUPPORTED, CONTRADICTED, UNSUPPORTED, UNVERIFIABLE, AMBIGUOUS)
  - Error Category (HALLUCINATED_FACT, CONTRADICTS_SOURCE, NUMERIC_MISMATCH, etc.)
  - Verbatim Evidence excerpts with exact 0-based character spans in original source text
  - Confidence scoring and uncertainty reasons
  - Precise Error Localization via localizer & ambiguity modules
"""

from typing import List, Optional
from model.config import settings
from model.llm import LLMClient
from model.schemas.primitives import Source
from model.schemas.result import (
    Claim,
    Verdict,
    ErrorCategory,
    Evidence,
    EvidenceRelation,
    Confidence,
    ConfidenceLevel,
)
from model.schemas.pipeline import ExtractedClaimOut
from model.pipeline.retriever import retrieve_chunks
from model.pipeline.nli import score_nli_pairs
from model.pipeline.judge import run_multi_judge, JudgeOutput
from model.pipeline.localizer import localize_error
from model.pipeline.confidence import compute_confidence


async def verify_claim(
    claim_input: ExtractedClaimOut,
    sources: List[Source],
    llm_client: Optional[LLMClient] = None,
    answer_text: Optional[str] = None,
) -> Claim:
    """
    Verifies a single extracted claim against provided source documents.
    """
    # 1. Handle Opinion / Subjective Claims
    if claim_input.claimType == "opinion" or claim_input.is_opinion:
        loc = localize_error(
            claim_text=claim_input.text,
            answer_text=answer_text or claim_input.text,
            answer_span=claim_input.answerSpan,
            verdict="UNVERIFIABLE",
            evidence_list=[],
            claim_type="opinion",
            explanation_hint="Claim is an opinion or subjective statement and cannot be verified against factual source documentation.",
        )
        return Claim(
            id=claim_input.id,
            text=claim_input.text,
            answerSpan=claim_input.answerSpan,
            claimType="opinion",
            verdict=loc.verdict,
            errorCategory=loc.errorCategory,
            errorSpan=loc.errorSpan,
            explanation=loc.explanation,
            evidence=[],
            confidence=Confidence(
                score=1.0,
                level="high",
                uncertaintyReasons=["Subjective opinion claim."],
            ),
            judgeVotes=[],
            contested=False,
        )

    # 2. Handle empty sources
    if not sources:
        loc = localize_error(
            claim_text=claim_input.text,
            answer_text=answer_text or claim_input.text,
            answer_span=claim_input.answerSpan,
            verdict="UNSUPPORTED",
            evidence_list=[],
            claim_type=claim_input.claimType,
            explanation_hint="No source documentation was provided to verify this claim.",
        )
        return Claim(
            id=claim_input.id,
            text=claim_input.text,
            answerSpan=claim_input.answerSpan,
            claimType=claim_input.claimType,  # type: ignore
            verdict=loc.verdict,
            errorCategory=loc.errorCategory,
            errorSpan=loc.errorSpan,
            explanation=loc.explanation,
            evidence=[],
            confidence=Confidence(
                score=0.90,
                level="high",
                uncertaintyReasons=["No source documents provided."],
            ),
            judgeVotes=[],
            contested=False,
        )

    # 3. Hybrid Retrieval
    retrieved_chunks = retrieve_chunks(claim_input.text, sources, top_k=settings.RETRIEVER_TOP_K)
    if not retrieved_chunks:
        loc = localize_error(
            claim_text=claim_input.text,
            answer_text=answer_text or claim_input.text,
            answer_span=claim_input.answerSpan,
            verdict="UNSUPPORTED",
            evidence_list=[],
            claim_type=claim_input.claimType,
            explanation_hint="No relevant passages found in provided source documents.",
        )
        return Claim(
            id=claim_input.id,
            text=claim_input.text,
            answerSpan=claim_input.answerSpan,
            claimType=claim_input.claimType,  # type: ignore
            verdict=loc.verdict,
            errorCategory=loc.errorCategory,
            errorSpan=loc.errorSpan,
            explanation=loc.explanation,
            evidence=[],
            confidence=Confidence(
                score=0.85,
                level="medium",
                uncertaintyReasons=["No matching passages retrieved."],
            ),
            judgeVotes=[],
            contested=False,
        )

    # 4. NLI Scoring
    pairs = [(chunk.text, claim_input.text) for chunk in retrieved_chunks]
    nli_scores = score_nli_pairs(pairs)

    # 5. Multi-LLM Judge with NLI Fallback
    if llm_client is None:
        llm_client = LLMClient()

    used_nli_fallback = False
    judge_output: Optional[JudgeOutput] = None
    judge_votes = []
    is_contested = False

    try:
        judge_output, judge_votes, is_contested = await run_multi_judge(
            claim_input.text, claim_input.claimType, retrieved_chunks, llm_client
        )
    except Exception:
        used_nli_fallback = True
        judge_output = None
        judge_votes = []
        is_contested = False

    # 6. Determine final verdict & error category
    verdict: Verdict = "UNSUPPORTED"
    error_category: Optional[ErrorCategory] = None
    explanation: str = ""
    supporting_indices: List[int] = []
    contradicting_indices: List[int] = []

    if judge_output is not None and not used_nli_fallback:
        verdict = judge_output.verdict
        error_category = judge_output.errorCategory
        explanation = judge_output.explanation
        supporting_indices = judge_output.supporting_passage_indices
        contradicting_indices = judge_output.contradicting_passage_indices
    else:
        # NLI-Only Fallback logic
        used_nli_fallback = True
        max_ent = max((score.entailment for score in nli_scores), default=0.0)
        max_con = max((score.contradiction for score in nli_scores), default=0.0)

        if max_ent >= 0.65 and max_con < 0.5:
            verdict = "SUPPORTED"
            error_category = None
            explanation = "Passages strongly entail the claim [NLI-only fallback]."
        elif max_con >= 0.65 and max_ent < 0.5:
            verdict = "CONTRADICTED"
            error_category = "CONTRADICTS_SOURCE"
            explanation = "Source documentation contradicts the claim [NLI-only fallback]."
        elif max_ent >= 0.5 and max_con >= 0.5:
            verdict = "AMBIGUOUS"
            error_category = "AMBIGUOUS_STATEMENT"
            explanation = "Source documentation provides conflicting entailment and contradiction signals [NLI-only fallback]."
        else:
            verdict = "UNSUPPORTED"
            error_category = "UNSUPPORTED_CLAIM"
            explanation = "Provided source documentation does not contain sufficient evidence [NLI-only fallback]."

        for idx, score in enumerate(nli_scores):
            if score.entailment >= 0.60:
                supporting_indices.append(idx)
            if score.contradiction >= 0.60:
                contradicting_indices.append(idx)

    # 7. Construct Evidence list
    evidence_list: List[Evidence] = []
    for idx, chunk in enumerate(retrieved_chunks):
        nli_score = nli_scores[idx] if idx < len(nli_scores) else None

        relation: EvidenceRelation = "related"
        if idx in supporting_indices or (nli_score and nli_score.entailment >= 0.60):
            relation = "supports"
        elif idx in contradicting_indices or (nli_score and nli_score.contradiction >= 0.60):
            relation = "contradicts"

        relevance = chunk.score
        if nli_score:
            if relation == "supports":
                relevance = round((chunk.score + nli_score.entailment) / 2.0, 4)
            elif relation == "contradicts":
                relevance = round((chunk.score + nli_score.contradiction) / 2.0, 4)

        evidence_list.append(
            Evidence(
                sourceId=chunk.source_id,
                span=chunk.span,
                text=chunk.text,
                relation=relation,
                score=min(1.0, max(0.0, relevance)),
            )
        )

    evidence_list.sort(key=lambda e: (0 if e.relation in ("supports", "contradicts") else 1, -e.score))

    # 8. Precise Error Localization via localizer & ambiguity modules
    localization = localize_error(
        claim_text=claim_input.text,
        answer_text=answer_text or claim_input.text,
        answer_span=claim_input.answerSpan,
        verdict=verdict,
        evidence_list=evidence_list[:5],
        claim_type=claim_input.claimType,
        llm_client=llm_client,
        error_category_hint=error_category,
        explanation_hint=explanation,
    )

    verdict = localization.verdict
    error_category = localization.errorCategory
    error_span = localization.errorSpan
    explanation = localization.explanation

    # 9. Compute Calibrated Confidence Score & Level
    source_text_full = "\n".join(s.text for s in sources) if sources else ""
    confidence_res = compute_confidence(
        verdict=verdict,
        claim_text=claim_input.text,
        evidence_list=evidence_list[:5],
        nli_scores=nli_scores,
        judge_output=judge_output,
        is_opinion=(claim_input.claimType == "opinion"),
        is_ambiguous=(verdict == "AMBIGUOUS"),
        source_text=source_text_full,
    )

    if used_nli_fallback:
        confidence_res.uncertaintyReasons.append("NLI-only fallback mode used (LLM judge unavailable).")

    if is_contested:
        vote_summary = ", ".join(f"{v.name}: {v.verdict}" for v in judge_votes)
        confidence_res.uncertaintyReasons.append(f"Judges disagreed on verdict ({vote_summary}).")
        confidence_res.score = round(max(0.1, confidence_res.score - 0.20), 4)
        if confidence_res.score < 0.60:
            confidence_res.level = "low"
        elif confidence_res.score < 0.85:
            confidence_res.level = "medium"

    return Claim(
        id=claim_input.id,
        text=claim_input.text,
        answerSpan=claim_input.answerSpan,
        claimType=claim_input.claimType,  # type: ignore
        verdict=verdict,
        errorCategory=error_category,
        errorSpan=error_span,
        explanation=explanation,
        evidence=evidence_list[:5],
        confidence=confidence_res,
        judgeVotes=judge_votes,
        contested=is_contested,
    )
