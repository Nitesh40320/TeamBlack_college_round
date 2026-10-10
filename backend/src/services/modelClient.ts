import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { AuditRequestInput, AuditResult, Claim, ReasoningIssue, SafetyFlag } from '../types/contract';

// ─── Claim extraction types (mirrors model /v1/extract-claims) ─────────────
export interface ExtractedClaimSpan {
  start: number;
  end: number;
}

export interface ExtractedClaim {
  id: string;
  text: string;
  answerSpan: ExtractedClaimSpan;
  claimType: string;
  is_opinion: boolean;
}

export interface ExtractClaimsResponse {
  claims: ExtractedClaim[];
}

// ─── Local mock fallback ────────────────────────────────────────────────────
export function getLocalMockAuditResult(): AuditResult {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    status: 'completed',
    claims: [
      {
        id: uuidv4(),
        text: 'Aspirin is commonly used to reduce fever in adults.',
        answerSpan: { start: 0, end: 50 },
        claimType: 'factual',
        verdict: 'SUPPORTED',
        explanation: 'The source confirms aspirin is indicated for mild-to-moderate fever.',
        evidence: [
          {
            sourceId: 'src-1',
            span: { start: 0, end: 80 },
            text: 'Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever.',
            relation: 'supports',
            score: 0.97,
          },
        ],
        confidence: { score: 0.96, level: 'high', uncertaintyReasons: [] },
      },
      {
        id: uuidv4(),
        text: 'The standard dose is 1000 mg every 4 hours, not exceeding 4 g per day.',
        answerSpan: { start: 51, end: 121 },
        claimType: 'numeric',
        verdict: 'CONTRADICTED',
        errorCategory: 'NUMERIC_MISMATCH',
        errorSpan: { start: 72, end: 79 },
        explanation: 'The source states 300-900 mg per dose; 1000 mg exceeds documented single dose limits.',
        evidence: [
          {
            sourceId: 'src-1',
            span: { start: 81, end: 170 },
            text: 'The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily.',
            relation: 'contradicts',
            score: 0.99,
          },
        ],
        confidence: { score: 0.94, level: 'high', uncertaintyReasons: [] },
      },
    ],
    reasoningIssues: [
      {
        id: uuidv4(),
        claimIds: [],
        answerSpan: { start: 51, end: 121 },
        type: 'NON_SEQUITUR',
        explanation: 'High single dose exceeds safe parameters.',
        confidence: { score: 0.85, level: 'medium', uncertaintyReasons: [] },
      },
    ],
    safetyFlags: [
      {
        id: uuidv4(),
        answerSpan: { start: 51, end: 121 },
        domain: 'medical',
        severity: 'high',
        explanation: 'High dosage recommendation exceeds standard guidelines.',
        recommendation: 'Consult healthcare professional.',
      },
    ],
    overall: {
      score: 50,
      grade: 'D',
      summary: 'The answer contains 1 supported claim and 1 contradicted dosage claim.',
      counts: { SUPPORTED: 1, CONTRADICTED: 1, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
    },
    meta: {
      timings: { totalMs: 1200, chunkingMs: 20, extractionMs: 300, verificationMs: 600, analysisMs: 280 },
      modelVersions: {
        embedder: 'text-embedding-3-small@2024-02',
        verifier: 'gpt-4o-mini@2024-07-18',
        analyzer: 'gpt-4o@2024-08-06',
      },
      mode: 'mock',
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function getLocalMockExtractClaims(answer: string): ExtractClaimsResponse {
  return {
    claims: [
      {
        id: uuidv4(),
        text: answer.slice(0, Math.min(60, answer.length)).trim(),
        answerSpan: { start: 0, end: Math.min(60, answer.length) },
        claimType: 'factual',
        is_opinion: false,
      },
    ],
  };
}

export function getLocalMockVerifyClaim(
  claim: { id: string; text: string; answerSpan: { start: number; end: number }; claimType: string; is_opinion?: boolean },
  sources: { id: string; title: string; text: string }[]
): Claim {
  const isOpinion = claim.is_opinion || claim.claimType === 'opinion';
  return {
    id: claim.id,
    text: claim.text,
    answerSpan: claim.answerSpan,
    claimType: (claim.claimType || 'factual') as any,
    verdict: isOpinion ? 'UNVERIFIABLE' : 'SUPPORTED',
    explanation: isOpinion
      ? 'Statement is an opinion or recommendation.'
      : 'Passage supports the claim.',
    evidence: sources.length > 0
      ? [
          {
            sourceId: sources[0].id,
            span: { start: 0, end: Math.min(60, sources[0].text.length) },
            text: sources[0].text.slice(0, 60),
            relation: isOpinion ? 'related' : 'supports',
            score: 0.95,
          },
        ]
      : [],
    confidence: {
      score: 0.95,
      level: 'high',
      uncertaintyReasons: [],
    },
  };
}

// ─── ModelClient ────────────────────────────────────────────────────────────
export class ModelClient {
  private client: AxiosInstance;

  constructor(baseURL: string = env.MODEL_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    label: string
  ): Promise<T | null> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        console.warn(`[ModelClient] ${label} attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
        }
      }
    }
    return null;
  }

  public async audit(requestData: AuditRequestInput, maxRetries = 3): Promise<AuditResult> {
    const result = await this.withRetry(
      () => this.client.post<AuditResult>('/v1/audit', requestData).then((r) => r.data),
      maxRetries,
      'audit'
    );

    if (result) return result;

    if (env.NODE_ENV === 'development') {
      console.warn('[ModelClient] /v1/audit unreachable — using local mock fallback.');
      return getLocalMockAuditResult();
    }
    throw new Error('Model /v1/audit failed after retries');
  }

  public async extractClaims(
    answer: string,
    question?: string,
    maxRetries = 3
  ): Promise<ExtractClaimsResponse> {
    const payload = { answer, ...(question ? { question } : {}) };
    const result = await this.withRetry(
      () => this.client.post<ExtractClaimsResponse>('/v1/extract-claims', payload).then((r) => r.data),
      maxRetries,
      'extract-claims'
    );

    if (result) return result;

    if (env.NODE_ENV === 'development') {
      console.warn('[ModelClient] /v1/extract-claims unreachable — using local mock fallback.');
      return getLocalMockExtractClaims(answer);
    }
    throw new Error('Model /v1/extract-claims failed after retries');
  }

  public async verifyClaim(
    claim: { id: string; text: string; answerSpan: { start: number; end: number }; claimType: string; is_opinion?: boolean },
    sources: { id: string; title: string; text: string }[],
    maxRetries = 3
  ): Promise<Claim> {
    const payload = { claim, sources };
    const result = await this.withRetry(
      () => this.client.post<Claim>('/v1/verify', payload).then((r) => r.data),
      maxRetries,
      'verify'
    );

    if (result) return result;

    if (env.NODE_ENV === 'development') {
      console.warn('[ModelClient] /v1/verify unreachable — using local mock fallback.');
      return getLocalMockVerifyClaim(claim, sources);
    }
    throw new Error('Model /v1/verify failed after retries');
  }

  public async analyzeReasoningAndSafety(
    answer: string,
    question?: string,
    sources: { id: string; title: string; text: string }[] = [],
    maxRetries = 3
  ): Promise<{ reasoningIssues: ReasoningIssue[]; safetyFlags: SafetyFlag[] }> {
    const payload = { answer, question, sources };
    const result = await this.withRetry(
      () => this.client.post<AuditResult>('/v1/audit', payload).then((r) => r.data),
      maxRetries,
      'analyze-reasoning-safety'
    );

    if (result) {
      return {
        reasoningIssues: result.reasoningIssues || [],
        safetyFlags: result.safetyFlags || [],
      };
    }

    if (env.NODE_ENV === 'development') {
      console.warn('[ModelClient] /v1/audit unreachable — using local mock fallback for reasoning/safety.');
      const mock = getLocalMockAuditResult();
      return {
        reasoningIssues: mock.reasoningIssues || [],
        safetyFlags: mock.safetyFlags || [],
      };
    }

    return { reasoningIssues: [], safetyFlags: [] };
  }

  private evalCache: { data: any; timestamp: number } | null = null;
  private evalCacheTtlMs = 60000;

  public async getLatestEval(maxRetries = 2): Promise<any> {
    const now = Date.now();
    if (this.evalCache && now - this.evalCache.timestamp < this.evalCacheTtlMs) {
      return this.evalCache.data;
    }

    const result = await this.withRetry(
      () => this.client.get('/v1/eval/latest').then((r) => r.data),
      maxRetries,
      'get-latest-eval'
    );

    if (result) {
      this.evalCache = { data: result, timestamp: now };
      return result;
    }

    return {
      status: 'unavailable',
      message: 'No evaluation results available yet.',
      dataset_split: 'test',
      total_test_cases: 0,
      total_claims_evaluated: 0,
      macro_f1: 0.0,
      contradiction_precision: 0.0,
      span_overlap_f1: 0.0,
      brier_score: 0.0,
      ece: 0.0,
      per_verdict_metrics: {},
      reliability_diagram: [],
    };
  }
}

export const modelClient = new ModelClient();

