"""
Sentence-aware source text chunker.

Splits a source document into overlapping chunks where every chunk carries
0-based, end-exclusive character offsets into the *original* source text.

Key invariants (tested):
  - chunk.span.start >= 0
  - chunk.span.end <= len(source_text)
  - source_text[chunk.span.start : chunk.span.end] == chunk.text  (exactly)
  - Adjacent chunks overlap by `overlap` characters (best-effort; last chunk
    may be shorter).
"""

import re
from dataclasses import dataclass

from model.logging_config import logger


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    start: int   # 0-based, inclusive, into original source text
    end: int     # 0-based, exclusive, into original source text


# ---------------------------------------------------------------------------
# Sentence boundary detection
# ---------------------------------------------------------------------------

# A minimal sentence-end pattern: period / exclamation / question followed by
# whitespace or end-of-string.  We intentionally keep this simple and fast.
_SENTENCE_END = re.compile(r'(?<=[.!?])\s+')


def _split_sentences(text: str) -> list[tuple[str, int, int]]:
    """
    Return a list of (sentence_text, start, end) tuples.
    start/end are character offsets into `text` (0-based, end-exclusive).
    """
    sentences: list[tuple[str, int, int]] = []
    prev_end = 0
    for match in _SENTENCE_END.finditer(text):
        end = match.start() + 1          # include the punctuation
        sentence = text[prev_end:end]
        if sentence.strip():
            sentences.append((sentence, prev_end, end))
        prev_end = match.end()

    # tail (last sentence with no trailing whitespace)
    tail = text[prev_end:]
    if tail.strip():
        sentences.append((tail, prev_end, len(text)))

    return sentences


# ---------------------------------------------------------------------------
# Public chunker
# ---------------------------------------------------------------------------

def chunk_source(
    source_text: str,
    *,
    sentences_per_chunk: int = 4,
    overlap_sentences: int = 1,
) -> list[Chunk]:
    """
    Split *source_text* into sentence-aware chunks.

    Args:
        source_text: The full plaintext of a source document.
        sentences_per_chunk: Target number of sentences per chunk (3–5 recommended).
        overlap_sentences: Number of sentences to repeat at the start of the
                           next chunk (creates a rolling window).

    Returns:
        An ordered list of :class:`Chunk` objects.  Each chunk satisfies::

            source_text[chunk.start : chunk.end] == chunk.text
    """
    if not source_text:
        return []

    sentences = _split_sentences(source_text)
    if not sentences:
        # Fallback: treat the entire text as a single chunk
        return [Chunk(index=0, text=source_text, start=0, end=len(source_text))]

    chunks: list[Chunk] = []
    step = max(1, sentences_per_chunk - overlap_sentences)
    chunk_idx = 0
    i = 0

    while i < len(sentences):
        window = sentences[i : i + sentences_per_chunk]
        _, start, _ = window[0]
        _, _, end = window[-1]
        text = source_text[start:end]

        # Verify the invariant before appending
        if source_text[start:end] != text:
            logger.error(
                "Chunk offset invariant violated at index %d: "
                "source_text[%d:%d] != chunk.text",
                chunk_idx, start, end,
            )
        else:
            chunks.append(Chunk(index=chunk_idx, text=text, start=start, end=end))

        chunk_idx += 1
        i += step

    return chunks
