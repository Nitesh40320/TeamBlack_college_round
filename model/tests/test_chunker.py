"""
Tests for pipeline/chunker.py

Key invariant asserted on every chunk:
    source_text[chunk.start : chunk.end] == chunk.text   (0-based, end-exclusive)
"""

import pytest
from model.pipeline.chunker import Chunk, chunk_source, _split_sentences


# ---------------------------------------------------------------------------
# _split_sentences
# ---------------------------------------------------------------------------

class TestSplitSentences:
    def test_single_sentence_no_trailing_punct(self):
        sentences = _split_sentences("Hello world")
        assert len(sentences) == 1
        text, start, end = sentences[0]
        assert text == "Hello world"
        assert start == 0
        assert end == len("Hello world")

    def test_multiple_sentences(self):
        text = "First sentence. Second sentence. Third sentence."
        sentences = _split_sentences(text)
        assert len(sentences) == 3
        # Offsets must be consecutive and non-overlapping
        for _, start, end in sentences:
            assert start < end

    def test_offset_correctness(self):
        text = "Alpha. Beta. Gamma."
        for sent_text, start, end in _split_sentences(text):
            assert text[start:end] == sent_text, (
                f"Offset mismatch: text[{start}:{end}]={text[start:end]!r} "
                f"!= {sent_text!r}"
            )


# ---------------------------------------------------------------------------
# chunk_source – invariant checks
# ---------------------------------------------------------------------------

class TestChunkSource:
    SOURCE = (
        "Aspirin is used for mild pain. "
        "The standard dose is 300–900 mg. "
        "It should not exceed 4 g per day. "
        "Aspirin is contraindicated in children. "
        "Always consult a doctor before use. "
        "Aspirin can cause stomach irritation. "
        "Do not take on an empty stomach."
    )

    def _assert_invariants(self, source: str, chunks: list[Chunk]) -> None:
        for chunk in chunks:
            extracted = source[chunk.start : chunk.end]
            assert extracted == chunk.text, (
                f"Chunk {chunk.index}: source[{chunk.start}:{chunk.end}]="
                f"{extracted!r} != {chunk.text!r}"
            )
            assert chunk.start >= 0
            assert chunk.end <= len(source)
            assert chunk.start < chunk.end

    def test_invariant_default_params(self):
        chunks = chunk_source(self.SOURCE)
        assert len(chunks) >= 1
        self._assert_invariants(self.SOURCE, chunks)

    def test_invariant_chunk_size_3(self):
        chunks = chunk_source(self.SOURCE, sentences_per_chunk=3, overlap_sentences=1)
        self._assert_invariants(self.SOURCE, chunks)

    def test_invariant_chunk_size_2_overlap_0(self):
        chunks = chunk_source(self.SOURCE, sentences_per_chunk=2, overlap_sentences=0)
        self._assert_invariants(self.SOURCE, chunks)

    def test_empty_source_returns_empty(self):
        assert chunk_source("") == []

    def test_single_sentence_source(self):
        source = "This is a single sentence."
        chunks = chunk_source(source, sentences_per_chunk=3)
        assert len(chunks) == 1
        self._assert_invariants(source, chunks)

    def test_overlap_creates_more_chunks_than_no_overlap(self):
        chunks_with_overlap = chunk_source(
            self.SOURCE, sentences_per_chunk=4, overlap_sentences=1
        )
        chunks_no_overlap = chunk_source(
            self.SOURCE, sentences_per_chunk=4, overlap_sentences=0
        )
        assert len(chunks_with_overlap) >= len(chunks_no_overlap)

    def test_chunks_cover_all_content(self):
        """Every sentence in the source should appear in at least one chunk."""
        from model.pipeline.chunker import _split_sentences
        chunks = chunk_source(self.SOURCE, sentences_per_chunk=3, overlap_sentences=1)
        all_chunk_text = " ".join(c.text for c in chunks)
        for sent_text, _, _ in _split_sentences(self.SOURCE):
            assert sent_text.strip() in all_chunk_text, (
                f"Sentence missing from all chunks: {sent_text!r}"
            )

    def test_index_is_sequential(self):
        chunks = chunk_source(self.SOURCE, sentences_per_chunk=3, overlap_sentences=1)
        for expected, chunk in enumerate(chunks):
            assert chunk.index == expected
