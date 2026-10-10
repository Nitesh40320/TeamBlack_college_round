import asyncio
import json
import os
import time
from typing import List
from fastapi import APIRouter, HTTPException

from model.config import settings
from model.logging_config import logger
from model.llm import LLMClient
from model.pipeline import (
    get_mock_audit_result,
    verify_claim,
    analyze_reasoning,
    analyze_safety,
    compute_overall_assessment,
    audit_cache,
)
from model.pipeline.chunker import chunk_source
from model.pipeline.claim_extractor import extract_claims
from model.schemas import AuditRequest, AuditResult, Claim
from model.schemas.result import Meta, Timings, ModelVersions
from model.schemas.pipeline import (
    ChunkItem,
    ChunkRequest,
    ChunkResponse,
    ExtractClaimsRequest,
    ExtractClaimsResponse,
    ExtractedClaimOut,
    VerifyRequest,
)
from model.schemas.primitives import Span

router = APIRouter()
AUDIT_SEMAPHORE = asyncio.Semaphore(settings.MAX_CONCURRENT_AUDITS)


@router.get("/health", status_code=200)
async def get_health():
    return {
        "status": "ok",
        "version": settings.VERSION,
        "mode": settings.MODEL_MODE,
    }


@router.get("/v1/eval/latest", status_code=200)
async def get_latest_eval():
    """Return the latest evaluation metrics report."""
    results_path = os.path.join("model", "eval", "results", "latest.json")
    if not os.path.exists(results_path):
        results_path = os.path.join("eval", "results", "latest.json")
    
    if os.path.exists(results_path):
        with open(results_path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    from model.eval.run_eval import run_evaluation_on_split
    return run_evaluation_on_split()


@router.post("/v1/chunk", response_model=ChunkResponse, status_code=200)
async def chunk_endpoint(request: ChunkRequest):
    """Split a source document into sentence-aware overlapping chunks."""
    chunks = chunk_source(
        request.text,
        sentences_per_chunk=request.chunkSize,
        overlap_sentences=request.overlap,
    )
    return ChunkResponse(
        sourceId=request.sourceId,
        chunks=[
            ChunkItem(
                index=c.index,
                text=c.text,
                span=Span(start=c.start, end=c.end),
            )
            for c in chunks
        ],
    )


@router.post(
    "/v1/extract-claims", response_model=ExtractClaimsResponse, status_code=200
)
async def extract_claims_endpoint(request: ExtractClaimsRequest):
    """Extract atomic, decontextualized claims from an answer string."""
    llm_client = LLMClient()
    claims = await extract_claims(
        answer=request.answer,
        question=request.question,
        llm_client=llm_client,
    )
    return ExtractClaimsResponse(
        claims=[
            ExtractedClaimOut(
                id=c.id,
                text=c.text,
                answerSpan=c.answerSpan,
                claimType=c.claimType,
                is_opinion=c.is_opinion,
            )
            for c in claims
        ]
    )


@router.post("/v1/verify", response_model=Claim, status_code=200)
async def verify_endpoint(request: VerifyRequest):
    """Verify a single extracted claim against provided source documentation."""
    llm_client = LLMClient()
    verified_claim = await verify_claim(
        claim_input=request.claim,
        sources=request.sources,
        llm_client=llm_client,
    )
    return verified_claim


async def _execute_audit_pipeline(request: AuditRequest) -> AuditResult:
    # 1. Input size validation caps
    if len(request.answer) > settings.MAX_ANSWER_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Answer text length ({len(request.answer)}) exceeds maximum allowed limit of {settings.MAX_ANSWER_LENGTH} characters.",
        )

    if len(request.sources) > settings.MAX_SOURCES_COUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Number of sources ({len(request.sources)}) exceeds maximum allowed limit of {settings.MAX_SOURCES_COUNT}.",
        )

    total_source_len = sum(len(s.text) for s in request.sources)
    if total_source_len > settings.MAX_SOURCE_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Total source text length ({total_source_len}) exceeds maximum allowed limit of {settings.MAX_SOURCE_TEXT_LENGTH} characters.",
        )

    # 2. Cache lookup
    cached = audit_cache.get(request)
    if cached is not None:
        logger.info("Serving audit result from in-memory cache")
        return cached

    start_time = time.time()
    degraded_flags: List[str] = []
    llm_client = LLMClient()

    if settings.MODEL_MODE == "mock":
        res = get_mock_audit_result()
        dynamic_reasoning = analyze_reasoning(
            request.answer, res.claims, request.sources, llm_client
        )
        dynamic_safety = analyze_safety(
            request.answer, res.claims, request.sources, llm_client
        )

        if dynamic_reasoning:
            existing_ids = {r.id for r in res.reasoningIssues}
            for r in dynamic_reasoning:
                if r.id not in existing_ids:
                    res.reasoningIssues.append(r)

        if dynamic_safety:
            existing_sids = {s.id for s in res.safetyFlags}
            for s in dynamic_safety:
                if s.id not in existing_sids:
                    res.safetyFlags.append(s)

        res.overall = compute_overall_assessment(
            res.claims, res.reasoningIssues, res.safetyFlags
        )
        audit_cache.set(request, res)
        return res

    # 3. Live Pipeline Stage Timings
    # Stage A: Chunking
    chunk_start = time.time()
    for src in request.sources:
        _ = chunk_source(src.text)
    chunking_ms = (time.time() - chunk_start) * 1000.0

    # Stage B: Extraction
    extract_start = time.time()
    try:
        extracted = await extract_claims(
            answer=request.answer,
            question=request.question,
            llm_client=llm_client,
        )
    except Exception as exc:
        logger.warning("Claim extraction failed or LLM down: %s", exc)
        degraded_flags.append("LLM_DOWN_NLI_ONLY")
        extracted = []
    extraction_ms = (time.time() - extract_start) * 1000.0

    # Stage C: Verification
    verify_start = time.time()
    claims: List[Claim] = []
    for ext in extracted:
        claim_out = ExtractedClaimOut(
            id=ext.id,
            text=ext.text,
            answerSpan=ext.answerSpan,
            claimType=ext.claimType,
            is_opinion=ext.is_opinion,
        )
        try:
            v_claim = await verify_claim(
                claim_input=claim_out,
                sources=request.sources,
                llm_client=llm_client,
                answer_text=request.answer,
            )
        except Exception as exc:
            logger.error("Verification failed for claim %s: %s", ext.id, exc)
            continue
        claims.append(v_claim)
    verification_ms = (time.time() - verify_start) * 1000.0

    # Stage D: Analysis (Reasoning & Safety)
    analysis_start = time.time()
    reasoning_issues = analyze_reasoning(
        request.answer, claims, request.sources, llm_client
    )
    safety_flags = analyze_safety(
        request.answer, claims, request.sources, llm_client
    )
    analysis_ms = (time.time() - analysis_start) * 1000.0

    overall = compute_overall_assessment(claims, reasoning_issues, safety_flags)
    total_ms = (time.time() - start_time) * 1000.0

    audit_res = AuditResult(
        id=f"audit-{int(start_time * 1000)}",
        status="completed",
        claims=claims,
        reasoningIssues=reasoning_issues,
        safetyFlags=safety_flags,
        overall=overall,
        meta=Meta(
            timings=Timings(
                totalMs=round(total_ms, 2),
                chunkingMs=round(chunking_ms, 2),
                extractionMs=round(extraction_ms, 2),
                verificationMs=round(verification_ms, 2),
                analysisMs=round(analysis_ms, 2),
            ),
            modelVersions=ModelVersions(
                embedder=settings.EMBEDDING_MODEL_NAME,
                verifier=settings.NLI_MODEL_NAME,
                analyzer=settings.LLM_MODEL_NAME or settings.LLM_PROVIDER,
            ),
            mode=settings.MODEL_MODE,  # type: ignore
            degradedFlags=list(set(degraded_flags)),
        ),
        createdAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        updatedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )

    logger.info(
        "Audit completed in %.2fms [chunking=%.2fms, extraction=%.2fms, verification=%.2fms, analysis=%.2fms]",
        total_ms,
        chunking_ms,
        extraction_ms,
        verification_ms,
        analysis_ms,
    )

    audit_cache.set(request, audit_res)
    return audit_res


@router.post("/v1/audit", response_model=AuditResult, status_code=200)
async def run_audit(request: AuditRequest):
    try:
        async with AUDIT_SEMAPHORE:
            return await asyncio.wait_for(
                _execute_audit_pipeline(request),
                timeout=settings.AUDIT_TIMEOUT_SECONDS,
            )
    except asyncio.TimeoutError:
        logger.error(
            "Audit request timed out after %s seconds", settings.AUDIT_TIMEOUT_SECONDS
        )
        raise HTTPException(
            status_code=504,
            detail=f"Audit execution timed out after {settings.AUDIT_TIMEOUT_SECONDS} seconds.",
        )

