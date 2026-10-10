"""
Span alignment utilities.

Given a claim text (possibly paraphrased or truncated by the LLM) and the
original answer string, this module finds the best character-offset match and
validates / repairs the returned span.

Algorithm:
  1. Exact substring search (fastest, most precise).
  2. Sentence-level fuzzy match: find the answer sentence with the highest
     token-overlap with the claim, then expand to a clean sentence boundary.
  3. If nothing is found, return None so the caller can discard the claim.

All offsets are 0-based, end-exclusive, into the *original* answer string.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class AlignedSpan:
    start: int   # 0-based, inclusive
    end: int     # 0-based, exclusive


def _tokenize(text: str) -> set[str]:
    """Lower-case word tokens (letters + digits only)."""
    return set(re.findall(r"[a-zA-Z0-9]+", text.lower()))


def _sentence_spans(text: str) -> list[tuple[int, int]]:
    """Return (start, end) character spans for every sentence in *text*."""
    spans: list[tuple[int, int]] = []
    prev = 0
    for m in re.finditer(r"(?<=[.!?])\s+", text):
        end = m.start() + 1
        if text[prev:end].strip():
            spans.append((prev, end))
        prev = m.end()
    tail = text[prev:]
    if tail.strip():
        spans.append((prev, len(text)))
    return spans


def align_span(
    claim_text: str,
    answer: str,
    *,
    raw_start: int | None = None,
    raw_end: int | None = None,
    fuzzy_threshold: float = 0.30,
) -> AlignedSpan | None:
    """
    Return the best-matching span of *claim_text* inside *answer*.

    Strategy:
      1. If raw_start/raw_end are valid (``answer[s:e]`` matches *claim_text*
         exactly), use them as-is.
      2. Exact substring search for *claim_text* in *answer*.
      3. Sentence-level fuzzy overlap search.
      4. Return None if all strategies fail.

    Args:
        claim_text: Text of the extracted claim (may be paraphrased).
        answer:     The original answer string.
        raw_start:  LLM-provided start offset (may be incorrect).
        raw_end:    LLM-provided end offset (may be incorrect).
        fuzzy_threshold: Minimum Jaccard-like token overlap (0–1) for fuzzy match.

    Returns:
        An :class:`AlignedSpan` or *None* if no acceptable match was found.
    """
    if not claim_text or not answer:
        return None

    # --- 1. Validate raw offsets from the LLM ---------------------------------
    if raw_start is not None and raw_end is not None:
        s, e = int(raw_start), int(raw_end)
        if 0 <= s < e <= len(answer):
            extracted = answer[s:e]
            # Accept if the extracted text *contains* the claim or vice-versa
            if claim_text in extracted or extracted in claim_text:
                return AlignedSpan(s, e)

    # --- 2. Exact substring search -------------------------------------------
    idx = answer.find(claim_text)
    if idx != -1:
        return AlignedSpan(idx, idx + len(claim_text))

    # Try stripping outer whitespace from the claim
    stripped = claim_text.strip()
    idx = answer.find(stripped)
    if idx != -1:
        return AlignedSpan(idx, idx + len(stripped))

    # --- 3. Sentence-level fuzzy token overlap --------------------------------
    claim_tokens = _tokenize(claim_text)
    if not claim_tokens:
        return None

    sentences = _sentence_spans(answer)
    best_score = fuzzy_threshold
    best_span: AlignedSpan | None = None

    for s, e in sentences:
        sent_tokens = _tokenize(answer[s:e])
        if not sent_tokens:
            continue
        intersection = len(claim_tokens & sent_tokens)
        union = len(claim_tokens | sent_tokens)
        score = intersection / union if union else 0.0
        if score > best_score:
            best_score = score
            best_span = AlignedSpan(s, e)

    return best_span


def validate_span(span: AlignedSpan, answer: str) -> bool:
    """Return True iff ``answer[span.start : span.end]`` is a non-empty string."""
    return (
        0 <= span.start < span.end <= len(answer)
        and bool(answer[span.start : span.end].strip())
    )
