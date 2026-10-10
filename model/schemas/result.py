from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from model.schemas.primitives import Span

AuditStatus = Literal[
    "queued",
    "extracting",
    "verifying",
    "analyzing",
    "completed",
    "failed",
]

ClaimType = Literal[
    "factual",
    "numeric",
    "causal",
    "recommendation",
    "opinion",
]

Verdict = Literal[
    "SUPPORTED",
    "CONTRADICTED",
    "UNSUPPORTED",
    "UNVERIFIABLE",
    "AMBIGUOUS",
]

ErrorCategory = Literal[
    "HALLUCINATED_FACT",
    "CONTRADICTS_SOURCE",
    "UNSUPPORTED_CLAIM",
    "NUMERIC_MISMATCH",
    "ENTITY_MISMATCH",
    "AMBIGUOUS_STATEMENT",
]

EvidenceRelation = Literal["supports", "contradicts", "related"]

ConfidenceLevel = Literal["low", "medium", "high"]

ReasoningIssueType = Literal[
    "NON_SEQUITUR",
    "INTERNAL_CONTRADICTION",
    "CIRCULAR",
    "OVERGENERALIZATION",
]

SafetySeverity = Literal["low", "medium", "high"]

Grade = Literal["A", "B", "C", "D", "F"]

RunMode = Literal["mock", "live"]


class Evidence(BaseModel):
    sourceId: str
    span: Span
    text: str
    relation: EvidenceRelation
    score: float = Field(..., ge=0.0, le=1.0)


class Confidence(BaseModel):
    score: float = Field(..., ge=0.0, le=1.0)
    level: ConfidenceLevel
    uncertaintyReasons: List[str]


class JudgeVote(BaseModel):
    judgeId: str
    name: str
    promptStyle: str
    verdict: Verdict
    explanation: str
    confidenceScore: float = Field(default=0.85, ge=0.0, le=1.0)


class Claim(BaseModel):
    id: str
    text: str
    answerSpan: Span
    claimType: ClaimType
    verdict: Verdict
    errorCategory: Optional[ErrorCategory] = None
    errorSpan: Optional[Span] = None
    explanation: str
    evidence: List[Evidence]
    confidence: Confidence
    judgeVotes: List[JudgeVote] = Field(default_factory=list)
    contested: bool = False


class ReasoningIssue(BaseModel):
    id: str
    claimIds: List[str]
    answerSpan: Span
    type: ReasoningIssueType
    explanation: str
    confidence: Confidence


class SafetyFlag(BaseModel):
    id: str
    claimId: Optional[str] = None
    answerSpan: Span
    domain: str
    severity: SafetySeverity
    explanation: str
    recommendation: str


class VerdictCounts(BaseModel):
    SUPPORTED: int = 0
    CONTRADICTED: int = 0
    UNSUPPORTED: int = 0
    UNVERIFIABLE: int = 0
    AMBIGUOUS: int = 0


class OverallScore(BaseModel):
    score: float = Field(..., ge=0.0, le=100.0)
    grade: Grade
    summary: str
    counts: VerdictCounts


class ModelVersions(BaseModel):
    embedder: str
    verifier: str
    analyzer: str


class Timings(BaseModel):
    totalMs: float
    chunkingMs: float
    extractionMs: float
    verificationMs: float
    analysisMs: float


class Meta(BaseModel):
    timings: Timings
    modelVersions: ModelVersions
    mode: RunMode
    degradedFlags: List[str] = Field(default_factory=list)


class AuditResult(BaseModel):
    id: str
    status: AuditStatus
    claims: List[Claim]
    reasoningIssues: List[ReasoningIssue]
    safetyFlags: List[SafetyFlag]
    overall: OverallScore
    meta: Meta
    error: Optional[str] = None
    createdAt: str
    updatedAt: str
