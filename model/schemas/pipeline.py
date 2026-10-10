"""
Request / response schemas for:
  POST /v1/chunk
  POST /v1/extract-claims
  POST /v1/verify

These mirror the CONTRACT.md section 6 shapes exactly.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from model.schemas.primitives import Span, Source
from model.schemas.result import Claim


# ---------------------------------------------------------------------------
# /v1/chunk
# ---------------------------------------------------------------------------

class ChunkRequest(BaseModel):
    sourceId: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1, max_length=200000)
    chunkSize: int = Field(default=4, ge=1, le=20,
                           description="Target number of sentences per chunk")
    overlap: int = Field(default=1, ge=0,
                         description="Number of sentences overlap between adjacent chunks")


class ChunkItem(BaseModel):
    index: int
    text: str
    span: Span


class ChunkResponse(BaseModel):
    sourceId: str
    chunks: List[ChunkItem]


# ---------------------------------------------------------------------------
# /v1/extract-claims
# ---------------------------------------------------------------------------

class ExtractClaimsRequest(BaseModel):
    answer: str = Field(..., min_length=1, max_length=50000)
    question: Optional[str] = Field(default=None, max_length=2000)


class ExtractedClaimOut(BaseModel):
    id: str
    text: str
    answerSpan: Span
    claimType: str
    is_opinion: bool = False


class ExtractClaimsResponse(BaseModel):
    claims: List[ExtractedClaimOut]


# ---------------------------------------------------------------------------
# /v1/verify
# ---------------------------------------------------------------------------

class VerifyRequest(BaseModel):
    claim: ExtractedClaimOut
    sources: List[Source] = Field(..., min_length=0, max_length=20)
