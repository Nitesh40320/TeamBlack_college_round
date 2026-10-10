"""
Tests for pipeline/span_aligner.py
"""

import pytest
from model.pipeline.span_aligner import align_span, validate_span, AlignedSpan


class TestAlignSpan:
    ANSWER = (
        "Aspirin reduces fever in adults. "
        "The standard dose is 300-900 mg. "
        "It prevents heart attacks."
    )

    def test_exact_match_uses_raw_offsets(self):
        # answer[0:31] = "Aspirin reduces fever in adults."
        span = align_span(
            "Aspirin reduces fever in adults.",
            self.ANSWER,
            raw_start=0,
            raw_end=32,
        )
        assert span is not None
        assert validate_span(span, self.ANSWER)
        assert self.ANSWER[span.start:span.end].strip() != ""

    def test_exact_substring_no_raw(self):
        claim = "The standard dose is 300-900 mg."
        span = align_span(claim, self.ANSWER)
        assert span is not None
        assert self.ANSWER[span.start:span.end] == claim

    def test_bad_raw_offsets_fall_through_to_exact(self):
        claim = "The standard dose is 300-900 mg."
        # Deliberately wrong raw offsets
        span = align_span(claim, self.ANSWER, raw_start=0, raw_end=5)
        assert span is not None
        assert self.ANSWER[span.start:span.end] == claim

    def test_fuzzy_match_finds_best_sentence(self):
        # A paraphrase that shares tokens with the third sentence
        claim = "Aspirin helps prevent cardiac arrest."
        span = align_span(claim, self.ANSWER, fuzzy_threshold=0.1)
        assert span is not None
        assert validate_span(span, self.ANSWER)

    def test_completely_unrelated_claim_returns_none(self):
        span = align_span(
            "Quantum physics governs subatomic particles.",
            self.ANSWER,
            fuzzy_threshold=0.99,  # near-impossible threshold
        )
        assert span is None

    def test_empty_claim_returns_none(self):
        assert align_span("", self.ANSWER) is None

    def test_empty_answer_returns_none(self):
        assert align_span("some claim", "") is None

    def test_stripped_whitespace_claim(self):
        claim = "  Aspirin reduces fever in adults.  "
        span = align_span(claim, self.ANSWER)
        assert span is not None
        assert validate_span(span, self.ANSWER)


class TestValidateSpan:
    def test_valid_span(self):
        answer = "Hello world"
        assert validate_span(AlignedSpan(0, 5), answer) is True

    def test_start_equals_end(self):
        assert validate_span(AlignedSpan(3, 3), "Hello") is False

    def test_start_gt_end(self):
        assert validate_span(AlignedSpan(5, 2), "Hello") is False

    def test_end_exceeds_length(self):
        assert validate_span(AlignedSpan(0, 100), "Hi") is False

    def test_only_whitespace_span(self):
        # "Hello world"[5:6] == " "  → strip() == "" → False
        assert validate_span(AlignedSpan(5, 6), "Hello world") is False
        # "Hello "[5:6] == " " → strip() == "" → False
        assert validate_span(AlignedSpan(5, 6), "Hello ") is False
        # "Hello world"[6:11] == "world" → valid
        assert validate_span(AlignedSpan(6, 11), "Hello world") is True

