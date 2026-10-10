import { z } from 'zod';

export const SourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  text: z.string().min(1).max(200000),
});

export const AuditRequestSchema = z.object({
  question: z.string().max(2000).optional(),
  answer: z.string().min(1).max(50000),
  sources: z.array(SourceSchema).min(1).max(20),
});

export type AuditRequestInput = z.infer<typeof AuditRequestSchema>;

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

export interface Span {
  start: number;
  end: number;
}

export interface Evidence {
  sourceId: string;
  span: Span;
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

export interface AuditProgress {
  stage: AuditStatus;
  verifiedClaims: number;
  totalClaims: number;
}

export interface Meta {
  timings: Timings;
  modelVersions: ModelVersions;
  mode: RunMode;
}

export interface AuditResult {
  id: string;
  question?: string;
  answer?: string;
  status: AuditStatus;
  claims: Claim[];
  reasoningIssues: ReasoningIssue[];
  safetyFlags: SafetyFlag[];
  overall: OverallScore;
  meta: Meta;
  progress?: AuditProgress;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const FeedbackInputSchema = z.object({
  findingType: z.enum(['claim', 'reasoning', 'safety']),
  findingId: z.string().min(1),
  verdict: z.enum(['correct', 'incorrect']),
  comment: z.string().max(2000).optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

export interface ClaimCorrection {
  claimId: string;
  originalText: string;
  originalSpan: Span;
  verdict: Verdict;
  action: 'rewrite' | 'remove';
  suggestedText?: string;
  supportingSourceId?: string;
  supportingPassageText?: string;
  explanation: string;
  verifiedVerdict: Verdict;
  verifiedScore: number;
}

export interface CorrectionsResponse {
  auditId: string;
  corrections: ClaimCorrection[];
  correctedAnswer: string;
}

