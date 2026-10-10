"""
Hybrid retrieval engine per claim over source document chunks.

Combines:
  1. BM25 sparse keyword retrieval (rank_bm25 or pure-python BM25 fallback)
  2. Dense vector embeddings (sentence-transformers or TF-IDF cosine fallback)
  3. Reciprocal Rank Fusion (RRF) to merge rankings

Features:
  - Configurable top-k
  - In-memory caching of chunk embeddings per source dataset hash
"""

import math
import re
import hashlib
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from model.config import settings
from model.schemas.primitives import Source, Span
from model.pipeline.chunker import Chunk, chunk_source

# Try importing rank_bm25
try:
    from rank_bm25 import BM25Okapi
    HAS_RANK_BM25 = True
except ImportError:
    HAS_RANK_BM25 = False

# Try importing sentence_transformers
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False


@dataclass
class RetrievedChunk:
    source_id: str
    text: str
    span: Span
    chunk_index: int
    score: float
    bm25_rank: int
    dense_rank: int
    rrf_score: float


# Cache for chunk embeddings: md5(source_texts_hash) -> {chunk_idx: vector}
_EMBEDDING_CACHE: Dict[str, Tuple[List[Chunk], List[List[float]]]] = {}
_MODEL_INSTANCE: Optional[object] = None


def _get_sentence_transformer():
    global _MODEL_INSTANCE
    if not HAS_SENTENCE_TRANSFORMERS:
        return None
    if _MODEL_INSTANCE is None:
        try:
            _MODEL_INSTANCE = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        except Exception:
            _MODEL_INSTANCE = None
    return _MODEL_INSTANCE


def _tokenize(text: str) -> List[str]:
    return [w.lower() for w in re.findall(r'\w+', text)]


def _fallback_bm25_scores(corpus_tokens: List[List[str]], query_tokens: List[str]) -> List[float]:
    """Pure Python BM25 implementation when rank_bm25 is not available."""
    N = len(corpus_tokens)
    if N == 0:
        return []
    
    avgdl = sum(len(doc) for doc in corpus_tokens) / max(N, 1)
    k1 = 1.5
    b = 0.75

    # Document frequency
    df: Dict[str, int] = {}
    for doc in corpus_tokens:
        seen = set(doc)
        for token in seen:
            df[token] = df.get(token, 0) + 1

    scores = []
    for doc in corpus_tokens:
        doc_len = len(doc)
        doc_counts: Dict[str, int] = {}
        for token in doc:
            doc_counts[token] = doc_counts.get(token, 0) + 1

        score = 0.0
        for q in query_tokens:
            if q in doc_counts:
                freq = doc_counts[q]
                doc_freq = df.get(q, 0)
                # Standard IDF
                idf = math.log((N - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0)
                numerator = freq * (k1 + 1.0)
                denominator = freq + k1 * (1.0 - b + b * (doc_len / max(avgdl, 1.0)))
                score += idf * (numerator / max(denominator, 1e-6))
        scores.append(score)

    return scores


def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _tfidf_embedding(text: str, vocab: Dict[str, int]) -> List[float]:
    tokens = _tokenize(text)
    vec = [0.0] * len(vocab)
    for t in tokens:
        if t in vocab:
            vec[vocab[t]] += 1.0
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def _get_source_cache_key(sources: List[Source]) -> str:
    content = "|".join(f"{s.id}:{s.text}" for s in sources)
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def _get_all_chunks(sources: List[Source]) -> List[Tuple[str, Chunk]]:
    all_chunks: List[Tuple[str, Chunk]] = []
    for src in sources:
        chunks = chunk_source(src.text)
        for c in chunks:
            all_chunks.append((src.id, c))
    return all_chunks


def retrieve_chunks(
    claim_text: str,
    sources: List[Source],
    top_k: Optional[int] = None,
) -> List[RetrievedChunk]:
    """
    Performs hybrid BM25 + Dense vector retrieval over source chunks,
    fused with Reciprocal Rank Fusion (RRF).

    Returns top_k RetrievedChunk objects sorted by fusion score.
    """
    if top_k is None:
        top_k = settings.RETRIEVER_TOP_K

    all_chunks = _get_all_chunks(sources)
    if not all_chunks:
        return []

    query_tokens = _tokenize(claim_text)
    corpus_tokens = [_tokenize(c.text) for _, c in all_chunks]

    # 1. BM25 Retrieval
    if HAS_RANK_BM25:
        bm25 = BM25Okapi(corpus_tokens)
        bm25_scores = bm25.get_scores(query_tokens)
    else:
        bm25_scores = _fallback_bm25_scores(corpus_tokens, query_tokens)

    # Rank indices by BM25 score descending
    bm25_ranked_indices = sorted(range(len(all_chunks)), key=lambda i: float(bm25_scores[i]), reverse=True)
    bm25_ranks = {idx: rank + 1 for rank, idx in enumerate(bm25_ranked_indices)}

    # 2. Dense Embedding Retrieval (with per-audit caching)
    cache_key = _get_source_cache_key(sources)
    model = _get_sentence_transformer()

    if model is not None:
        if cache_key in _EMBEDDING_CACHE:
            _, chunk_embeddings = _EMBEDDING_CACHE[cache_key]
        else:
            chunk_texts = [c.text for _, c in all_chunks]
            raw_embs = model.encode(chunk_texts, convert_to_numpy=True)
            chunk_embeddings = [emb.tolist() for emb in raw_embs]
            _EMBEDDING_CACHE[cache_key] = ([c for _, c in all_chunks], chunk_embeddings)

        query_embedding = model.encode(claim_text, convert_to_numpy=True).tolist()
        dense_scores = [float(_cosine_similarity(query_embedding, emb)) for emb in chunk_embeddings]
    else:
        # Fallback TF-IDF cosine similarity
        vocab: Dict[str, int] = {}
        for doc in corpus_tokens:
            for token in doc:
                if token not in vocab:
                    vocab[token] = len(vocab)

        chunk_embeddings = [_tfidf_embedding(c.text, vocab) for _, c in all_chunks]
        query_embedding = _tfidf_embedding(claim_text, vocab)
        dense_scores = [float(_cosine_similarity(query_embedding, emb)) for emb in chunk_embeddings]

    dense_ranked_indices = sorted(range(len(all_chunks)), key=lambda i: float(dense_scores[i]), reverse=True)
    dense_ranks = {idx: rank + 1 for rank, idx in enumerate(dense_ranked_indices)}

    # 3. Reciprocal Rank Fusion (RRF)
    # RRF_score = 1 / (60 + r_bm25) + 1 / (60 + r_dense)
    RRF_K = 60
    rrf_scores = {}
    for idx in range(len(all_chunks)):
        r_bm25 = bm25_ranks[idx]
        r_dense = dense_ranks[idx]
        rrf_scores[idx] = float((1.0 / (RRF_K + r_bm25)) + (1.0 / (RRF_K + r_dense)))

    # Sort by RRF score descending
    final_ranked_indices = sorted(range(len(all_chunks)), key=lambda i: float(rrf_scores[i]), reverse=True)
    top_indices = final_ranked_indices[:top_k]

    # Normalize final scores to [0, 1]
    max_rrf = float(max(rrf_scores.values())) if rrf_scores else 1.0
    if max_rrf <= 0:
        max_rrf = 1.0

    retrieved: List[RetrievedChunk] = []
    for idx in top_indices:
        src_id, chunk = all_chunks[idx]
        norm_score = float(min(1.0, max(0.0, float(rrf_scores[idx]) / max_rrf)))
        retrieved.append(
            RetrievedChunk(
                source_id=str(src_id),
                text=chunk.text,
                span=Span(start=chunk.start, end=chunk.end),
                chunk_index=int(chunk.index),
                score=round(float(norm_score), 4),
                bm25_rank=int(bm25_ranks[idx]),
                dense_rank=int(dense_ranks[idx]),
                rrf_score=round(float(rrf_scores[idx]), 6),
            )
        )

    return retrieved
