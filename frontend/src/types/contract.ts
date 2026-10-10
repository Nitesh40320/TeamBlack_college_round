export interface Span {
  start: number;
  end: number;
}

export type SourceSpan = Span;

export interface Source {
  id: string;
  title: string;
  text: string;
}

export interface AuditRequest {
  question?: string;
  answer: string;
  sources: Source[];
}

export type AuditStatus =
  | 'queued'
  | 'extracting'
  | 'verifying'
  | 'analyzing'
  | 'completed'
  | 'failed';

export type ClaimType =
  | 'factual'
  | 'numeric'
  | 'causal'
  | 'recommendation'
  | 'opinion';

export type Verdict =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'UNSUPPORTED'
  | 'UNVERIFIABLE'
  | 'AMBIGUOUS';

export type ErrorCategory =
  | 'HALLUCINATED_FACT'
  | 'CONTRADICTS_SOURCE'
  | 'UNSUPPORTED_CLAIM'
  | 'NUMERIC_MISMATCH'
  | 'ENTITY_MISMATCH'
  | 'AMBIGUOUS_STATEMENT';

export type EvidenceRelation = 'supports' | 'contradicts' | 'related';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface Evidence {
  sourceId: string;
  span: SourceSpan;
  text: string;
  relation: EvidenceRelation;
  score: number;
}

export interface Confidence {
  score: number;
  level: ConfidenceLevel;
  uncertaintyReasons: string[];
}

export interface JudgeVote {
  judgeId: string;
  name: string;
  promptStyle: string;
  verdict: Verdict;
  explanation: string;
  confidenceScore: number;
}

export interface Claim {
  id: string;
  text: string;
  answerSpan: Span;
  claimType: ClaimType;
  verdict: Verdict;
  errorCategory?: ErrorCategory;
  errorSpan?: Span;
  explanation: string;
  evidence: Evidence[];
  confidence: Confidence;
  judgeVotes?: JudgeVote[];
  contested?: boolean;
}

export type ReasoningIssueType =
  | 'NON_SEQUITUR'
  | 'INTERNAL_CONTRADICTION'
  | 'CIRCULAR'
  | 'OVERGENERALIZATION';

export interface ReasoningIssue {
  id: string;
  claimIds: string[];
  answerSpan: Span;
  type: ReasoningIssueType;
  explanation: string;
  confidence: Confidence;
}

export type SafetySeverity = 'low' | 'medium' | 'high';

export interface SafetyFlag {
  id: string;
  claimId?: string;
  answerSpan: Span;
  domain: string;
  severity: SafetySeverity;
  explanation: string;
  recommendation: string;
}

export interface VerdictCounts {
  SUPPORTED: number;
  CONTRADICTED: number;
  UNSUPPORTED: number;
  UNVERIFIABLE: number;
  AMBIGUOUS: number;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface OverallScore {
  score: number;
  grade: Grade;
  summary: string;
  counts: VerdictCounts;
}

export interface ModelVersions {
  embedder: string;
  verifier: string;
  analyzer: string;
}

export interface Timings {
  totalMs: number;
  chunkingMs: number;
  extractionMs: number;
  verificationMs: number;
  analysisMs: number;
}

export type RunMode = 'mock' | 'live';

export interface Meta {
  timings: Timings;
  modelVersions: ModelVersions;
  mode: RunMode;
}

export interface AuditResult {
  id: string;
  status: AuditStatus;
  claims: Claim[];
  reasoningIssues: ReasoningIssue[];
  safetyFlags: SafetyFlag[];
  overall: OverallScore;
  meta: Meta;
  error?: string;
  createdAt: string;
  updatedAt: string;
  sources?: Source[];
  answer?: string;
  question?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
