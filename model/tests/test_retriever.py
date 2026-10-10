"""
Tests for pipeline/retriever.py
"""

import pytest
from model.schemas.primitives import Source
from model.pipeline.retriever import retrieve_chunks, RetrievedChunk


@pytest.fixture
def sample_sources():
    return [
        Source(
            id="src-1",
            title="Aspirin Info",
            text="Aspirin is commonly used to reduce fever in adults. The recommended dose is 300-900 mg every 4-6 hours.",
        ),
        Source(
            id="src-2",
            title="Penicillin Info",
            text="Penicillin is an antibiotic discovered by Alexander Fleming in 1928 to treat bacterial infections.",
        ),
    ]


def test_retriever_returns_top_k(sample_sources):
    retrieved = retrieve_chunks("Aspirin reduces fever", sample_sources, top_k=2)
    assert len(retrieved) <= 2
    assert isinstance(retrieved[0], RetrievedChunk)
    assert retrieved[0].source_id == "src-1"
    assert "Aspirin" in retrieved[0].text


def test_retriever_caching_and_empty_handling():
    empty_res = retrieve_chunks("Random query", [], top_k=3)
    assert empty_res == []

    src = [Source(id="src-3", title="Test", text="Short test document for checking caching behavior.")]
    res1 = retrieve_chunks("test document", src, top_k=1)
    res2 = retrieve_chunks("test document", src, top_k=1)
    assert len(res1) == 1
    assert res1[0].text == res2[0].text
