"""
Tests for pipeline/nli.py
"""

from model.pipeline.nli import score_nli_pairs, NLIScore


def test_nli_entailment_case():
    pairs = [("Aspirin is indicated for fever reduction in adults.", "Aspirin reduces fever in adults.")]
    scores = score_nli_pairs(pairs)
    assert len(scores) == 1
    assert isinstance(scores[0], NLIScore)
    assert scores[0].label == "entailment"
    assert scores[0].entailment > 0.50


def test_nli_contradiction_case():
    pairs = [("The adult dose is 300-900 mg daily.", "The adult dose is 5000 mg daily.")]
    scores = score_nli_pairs(pairs)
    assert len(scores) == 1
    assert scores[0].label == "contradiction"
    assert scores[0].contradiction > 0.50


def test_nli_empty_pairs():
    scores = score_nli_pairs([])
    assert scores == []
