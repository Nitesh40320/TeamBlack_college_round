"""
Claim extraction pipeline stage.

Breaks an AI-generated answer into atomic, self-contained, decontextualized
claims using an LLM, then validates and repairs answer-span offsets.

Key design decisions
---------------------
* The LLM receives a **strict JSON schema** (defined here as a Pydantic model
  and passed to ``LLMClient.generate_json``).
* Pronouns / demonstratives in claims are resolved in the LLM prompt so each
  claim stands on its own.
* ``claimType="opinion"`` claims are flagged ``is_opinion=True`` so the
  verification stage can immediately label them UNVERIFIABLE without source
  lookup.
* Spans are validated/repaired by :mod:`model.pipeline.span_aligner`.
  Claims whose spans cannot be repaired are **discarded** with a warning.
* All offsets are 0-based, end-exclusive, relative to the original answer.

Prompt-injection safety: answer and question are embedded as literal DATA
strings inside a delimited block, never as top-level instructions.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from pydantic import BaseModel, Field

from model.llm import LLMClient
from model.logging_config import logger
from model.pipeline.span_aligner import AlignedSpan, align_span, validate_span
from model.schemas.primitives import Span


# ---------------------------------------------------------------------------
# Schema fed to the LLM  (strict JSON schema via Pydantic model)
# ---------------------------------------------------------------------------

class _LLMClaim(BaseModel):
    """Shape the LLM must return for each extracted claim."""

    text: str = Field(
        ...,
        description=(
            "The full, self-contained claim sentence.  Resolve all pronouns "
            "and demonstratives so the sentence is unambiguous without context."
        ),
    )
    claimType: str = Field(
        ...,
        description=(
            "One of: factual | numeric | causal | recommendation | opinion.  "
            "Use 'opinion' for subjective, evaluative, or preferential statements "
            "that cannot be objectively verified against a source document."
        ),
    )
    answerSpanStart: int = Field(
        ..., ge=0,
        description="0-based inclusive character offset of this claim in the answer.",
    )
    answerSpanEnd: int = Field(
        ..., ge=0,
        description="0-based exclusive character offset of this claim in the answer.",
    )


class _LLMClaimsResponse(BaseModel):
    claims: list[_LLMClaim]


# ---------------------------------------------------------------------------
# Public data class returned by this module
# ---------------------------------------------------------------------------

class ExtractedClaim(BaseModel):
    id: str
    text: str
    answerSpan: Span
    claimType: str          # factual|numeric|causal|recommendation|opinion
    is_opinion: bool        # True → verifier should set verdict=UNVERIFIABLE


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTION = """\
You are a precise claim-extraction assistant.

TASK
----
Break the ANSWER below into a list of atomic, self-contained claims.

Rules:
1. One claim per verifiable or opinionated statement (do NOT merge claims).
2. Decontextualize: replace pronouns ("it", "they", "this") with the full noun
   they refer to, so each claim is understandable without context.
3. Preserve the original wording as closely as possible.
4. Classify each claim:
   factual        – objective fact about the world
   numeric        – involves a specific number, quantity, percentage, or date
   causal         – X causes / leads to / results in Y
   recommendation – advises an action ("should", "must", "recommend")
   opinion        – subjective, evaluative, or preference statement that cannot
                    be objectively verified from a document
5. For answerSpanStart / answerSpanEnd, provide the character offsets of the
   claim text inside the ANSWER (0-based, end-exclusive).  If the claim is a
   paraphrase, use the span of the source sentence in the answer.
6. Do NOT include the question or any meta-commentary in the output.
7. Output ONLY a JSON object. Do not include markdown code fences.

<<< ANSWER START >>>
{answer}
<<< ANSWER END >>>
"""

_QUESTION_ADDENDUM = """
The answer was produced in response to this question (context only — do not
extract claims from it):

<<< QUESTION START >>>
{question}
<<< QUESTION END >>>
"""


def _build_prompt(answer: str, question: Optional[str]) -> str:
    """Build the extraction prompt, treating answer & question as untrusted data."""
    prompt = _SYSTEM_INSTRUCTION.format(answer=answer)
    if question:
        prompt += _QUESTION_ADDENDUM.format(question=question)
    return prompt


# ---------------------------------------------------------------------------
# Main extraction function
# ---------------------------------------------------------------------------

async def extract_claims(
    answer: str,
    question: Optional[str] = None,
    *,
    llm_client: Optional[LLMClient] = None,
) -> list[ExtractedClaim]:
    """
    Extract atomic claims from *answer* using the LLM.

    Args:
        answer:     The AI-generated answer text (treated as untrusted data).
        question:   Optional user question for context (treated as untrusted data).
        llm_client: Injected LLM client (uses default provider if None).

    Returns:
        List of :class:`ExtractedClaim` objects with validated spans.
        Claims whose spans cannot be aligned to the original answer are discarded.
    """
    if not answer.strip():
        return []

    client = llm_client or LLMClient()
    prompt = _build_prompt(answer, question)

    try:
        raw = await client.generate_json(prompt, schema=_LLMClaimsResponse)
        response = _LLMClaimsResponse.model_validate(raw)
    except Exception as exc:
        logger.error("Claim extraction LLM call failed: %s", exc)
        return []

    valid_claim_types = {"factual", "numeric", "causal", "recommendation", "opinion"}
    results: list[ExtractedClaim] = []

    for raw_claim in response.claims:
        # Sanitise claim type
        ct = raw_claim.claimType.strip().lower()
        if ct not in valid_claim_types:
            ct = "factual"

        # Align + validate span
        aligned: AlignedSpan | None = align_span(
            raw_claim.text,
            answer,
            raw_start=raw_claim.answerSpanStart,
            raw_end=raw_claim.answerSpanEnd,
        )

        if aligned is None or not validate_span(aligned, answer):
            logger.warning(
                "Discarding claim with invalid span: text=%r start=%d end=%d",
                raw_claim.text[:60],
                raw_claim.answerSpanStart,
                raw_claim.answerSpanEnd,
            )
            continue

        results.append(
            ExtractedClaim(
                id=str(uuid.uuid4()),
                text=raw_claim.text,
                answerSpan=Span(start=aligned.start, end=aligned.end),
                claimType=ct,
                is_opinion=(ct == "opinion"),
            )
        )

    logger.info(
        "Extracted %d valid claims (%d discarded) from answer of %d chars",
        len(results),
        len(response.claims) - len(results),
        len(answer),
    )
    return results
