import time
from typing import List
from fastapi import APIRouter

from model.config import settings
from model.llm import LLMClient
from model.pipeline import (
    get_mock_audit_result,
    verify_claim,
    analyze_reasoning,
    analyze_safety,
)
from model.pipeline.chunker import chunk_source
from model.pipeline.claim_extractor import extract_claims
from model.schemas import AuditRequest, AuditResult, Claim
from model.schemas.result import OverallScore, VerdictCounts, Meta, Timings, ModelVersions
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


@router.get("/health", status_code=200)
async def get_health():
    return {
        "status": "ok",
        "version": settings.VERSION,
        "mode": settings.MODEL_MODE,
    }


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


@router.post("/v1/audit", response_model=AuditResult, status_code=200)
async def run_audit(request: AuditRequest):
    start_time = time.time()
    llm_client = LLMClient()

    if settings.MODEL_MODE == "mock":
        res = get_mock_audit_result()
        # Enrich mock result with dynamic reasoning and safety analysis over request input
        dynamic_reasoning = analyze_reasoning(
            request.answer, res.claims, request.sources, llm_client
        )
        dynamic_safety = analyze_safety(
            request.answer, res.claims, request.sources, llm_client
        )

        if dynamic_reasoning:
            # Avoid duplicate issue IDs
            existing_ids = {r.id for r in res.reasoningIssues}
            for r in dynamic_reasoning:
                if r.id not in existing_ids:
                    res.reasoningIssues.append(r)

        if dynamic_safety:
            existing_sids = {s.id for s in res.safetyFlags}
            for s in dynamic_safety:
                if s.id not in existing_sids:
                    res.safetyFlags.append(s)

        return res

    # Live execution pipeline
    extracted = await extract_claims(
        answer=request.answer,
        question=request.question,
        llm_client=llm_client,
    )

    claims: List[Claim] = []
    for ext in extracted:
        claim_out = ExtractedClaimOut(
            id=ext.id,
            text=ext.text,
            answerSpan=ext.answerSpan,
            claimType=ext.claimType,
            is_opinion=ext.is_opinion,
        )
        v_claim = await verify_claim(
            claim_input=claim_out,
            sources=request.sources,
            llm_client=llm_client,
            answer_text=request.answer,
        )
        claims.append(v_claim)

    reasoning_issues = analyze_reasoning(
        request.answer, claims, request.sources, llm_client
    )
    safety_flags = analyze_safety(
        request.answer, claims, request.sources, llm_client
    )

    # Compute verdict counts and grade
    counts = VerdictCounts()
    for c in claims:
        if c.verdict == "SUPPORTED":
            counts.SUPPORTED += 1
        elif c.verdict == "CONTRADICTED":
            counts.CONTRADICTED += 1
        elif c.verdict == "UNSUPPORTED":
            counts.UNSUPPORTED += 1
        elif c.verdict == "UNVERIFIABLE":
            counts.UNVERIFIABLE += 1
        elif c.verdict == "AMBIGUOUS":
            counts.AMBIGUOUS += 1

    total_claims = len(claims) or 1
    score = (counts.SUPPORTED / float(total_claims)) * 100.0
    grade = "A" if score >= 90 else ("B" if score >= 75 else ("C" if score >= 60 else "D"))

    total_ms = (time.time() - start_time) * 1000.0

    return AuditResult(
        id=f"audit-{int(start_time)}",
        status="completed",
        claims=claims,
        reasoningIssues=reasoning_issues,
        safetyFlags=safety_flags,
        overall=OverallScore(
            score=round(score, 1),
            grade=grade,  # type: ignore
            summary=f"Audit completed: {counts.SUPPORTED} supported, {counts.CONTRADICTED} contradicted out of {total_claims} claims.",
            counts=counts,
        ),
        meta=Meta(
            timings=Timings(
                totalMs=round(total_ms, 2),
                chunkingMs=10.0,
                extractionMs=50.0,
                verificationMs=round(total_ms - 60.0, 2),
                analysisMs=20.0,
            ),
            modelVersions=ModelVersions(
                embedder=settings.EMBEDDING_MODEL_NAME,
                verifier=settings.NLI_MODEL_NAME,
                analyzer=settings.LLM_MODEL_NAME,
            ),
            mode=settings.MODEL_MODE,  # type: ignore
        ),
        createdAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        updatedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )

