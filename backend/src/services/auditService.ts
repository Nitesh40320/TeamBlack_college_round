import { v4 as uuidv4 } from 'uuid';
import { AuditModel } from '../models/Audit';
import { SourceModel } from '../models/Source';
import { auditOrchestrator } from './auditOrchestrator';
import { AuditRequestInput, AuditResult, Claim, Verdict, ErrorCategory } from '../types/contract';
import { AppError } from '../middleware/errorHandler';

export class AuditService {
  public async createAudit(input: AuditRequestInput): Promise<{ id: string; status: string; createdAt: string }> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const doc = new AuditModel({
      id,
      answer: input.answer,
      question: input.question,
      status: 'queued',
      claims: [],
      reasoningIssues: [],
      safetyFlags: [],
      overall: {
        score: 0,
        grade: 'A',
        summary: 'Audit queued for processing.',
        counts: {
          SUPPORTED: 0,
          CONTRADICTED: 0,
          UNSUPPORTED: 0,
          UNVERIFIABLE: 0,
          AMBIGUOUS: 0,
        },
      },
      meta: {
        timings: {
          totalMs: 0,
          chunkingMs: 0,
          extractionMs: 0,
          verificationMs: 0,
          analysisMs: 0,
        },
        modelVersions: {
          embedder: 'text-embedding-3-small@2024-02',
          verifier: 'gpt-4o-mini@2024-07-18',
          analyzer: 'gpt-4o@2024-08-06',
        },
        mode: 'live',
      },
      progress: {
        stage: 'queued',
        verifiedClaims: 0,
        totalClaims: 0,
      },
      createdAt: now,
      updatedAt: now,
    });

    await doc.save();

    // Save sources to Source collection
    if (input.sources && input.sources.length > 0) {
      await Promise.all(
        input.sources.map((src) =>
          new SourceModel({
            id: src.id,
            auditId: id,
            title: src.title,
            originalName: 'pasted-text',
            mimeType: 'text/plain',
            text: src.text,
            charCount: src.text.length,
            createdAt: now,
          }).save()
        )
      );
    }

    // Trigger async processing in job runner
    auditOrchestrator.enqueue(id);

    return {
      id,
      status: 'queued',
      createdAt: now,
    };
  }

  public async getAuditById(id: string): Promise<AuditResult> {
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${id}' not found`);
    }
    return audit.toJSON() as AuditResult;
  }

  public async rerunAudit(
    id: string,
    fromStage?: string
  ): Promise<{ id: string; status: string; updatedAt: string }> {
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${id}' not found`);
    }

    const now = new Date().toISOString();
    const isAnalyzingRetry = fromStage === 'analyzing';

    audit.status = isAnalyzingRetry ? 'analyzing' : 'queued';
    audit.error = undefined;
    if (!isAnalyzingRetry) {
      audit.claims = [] as any;
    }
    audit.progress = {
      stage: isAnalyzingRetry ? 'analyzing' : 'queued',
      verifiedClaims: isAnalyzingRetry ? audit.claims.length : 0,
      totalClaims: audit.claims.length,
    };
    audit.updatedAt = now;
    await audit.save();

    auditOrchestrator.enqueue(id, fromStage);

    return {
      id: audit.id,
      status: audit.status,
      updatedAt: now,
    };
  }

  public async getAuditSummary(id: string) {
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${id}' not found`);
    }

    const claims: Claim[] = (audit.claims || []).map((c: any) =>
      typeof c.toObject === 'function' ? c.toObject() : c
    );
    const reasoningIssues = (audit.reasoningIssues || []).map((r: any) =>
      typeof r.toObject === 'function' ? r.toObject() : r
    );
    const safetyFlags = (audit.safetyFlags || []).map((s: any) =>
      typeof s.toObject === 'function' ? s.toObject() : s
    );

    const topFindings: Array<{
      id: string;
      findingType: 'claim' | 'reasoning' | 'safety';
      verdictOrSeverity: string;
      text: string;
      explanation: string;
      confidence?: any;
    }> = [];

    for (const flag of safetyFlags) {
      topFindings.push({
        id: flag.id,
        findingType: 'safety',
        verdictOrSeverity: flag.severity,
        text: `Safety Concern (${flag.domain}): ${flag.recommendation || flag.explanation}`,
        explanation: flag.explanation,
      });
    }

    for (const issue of reasoningIssues) {
      topFindings.push({
        id: issue.id,
        findingType: 'reasoning',
        verdictOrSeverity: issue.type,
        text: `Flawed Inference (${issue.type}): ${issue.explanation}`,
        explanation: issue.explanation,
        confidence: issue.confidence,
      });
    }

    for (const claim of claims) {
      if (claim.verdict !== 'SUPPORTED') {
        topFindings.push({
          id: claim.id,
          findingType: 'claim',
          verdictOrSeverity: claim.verdict,
          text: claim.text,
          explanation: claim.explanation,
          confidence: claim.confidence,
        });
      }
    }

    const calibrationNote =
      'Confidence describes how sure the system is about the FINDING and is never a correctness guarantee.';

    return {
      auditId: audit.id,
      grade: audit.overall?.grade || 'A',
      score: audit.overall?.score || 0,
      summary: audit.overall?.summary || '',
      counts: audit.overall?.counts || {
        SUPPORTED: 0,
        CONTRADICTED: 0,
        UNSUPPORTED: 0,
        UNVERIFIABLE: 0,
        AMBIGUOUS: 0,
      },
      topFindings: topFindings.slice(0, 10),
      calibrationNote,
    };
  }


  public async getReasoningIssues(id: string) {
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${id}' not found`);
    }

    const issues = (audit.reasoningIssues || []).map((r: any) =>
      typeof r.toObject === 'function' ? r.toObject() : r
    );

    return {
      reasoningIssues: issues,
      total: issues.length,
    };
  }

  public async getSafetyFlags(id: string) {
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${id}' not found`);
    }

    const flags = (audit.safetyFlags || []).map((s: any) =>
      typeof s.toObject === 'function' ? s.toObject() : s
    );

    let maxSeverity: string | null = null;
    if (flags.length > 0) {
      if (flags.some((f: any) => f.severity === 'high')) {
        maxSeverity = 'high';
      } else if (flags.some((f: any) => f.severity === 'medium')) {
        maxSeverity = 'medium';
      } else {
        maxSeverity = 'low';
      }
    }

    return {
      safetyFlags: flags,
      maxSeverity,
      total: flags.length,
    };
  }

  public async listAudits(
    page: number = 1,
    limit: number = 20,
    status?: string
  ) {
    const query: Record<string, any> = {};
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      AuditModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      AuditModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: data.map((doc) => doc.toJSON() as AuditResult),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
  public async getFindings(
    id: string,
    filters: { verdict?: string; category?: string; claimType?: string }
  ) {
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${id}' not found`);
    }

    const allClaims: Claim[] = (audit.claims || []).map((c: any) =>
      typeof c.toObject === 'function' ? c.toObject() : c
    );

    // Filter claims
    const findings = allClaims.filter((claim) => {
      if (
        filters.verdict &&
        claim.verdict.toUpperCase() !== filters.verdict.toUpperCase()
      ) {
        return false;
      }
      if (filters.category) {
        const cat = claim.errorCategory || 'NONE';
        if (cat.toUpperCase() !== filters.category.toUpperCase()) {
          return false;
        }
      }
      if (
        filters.claimType &&
        claim.claimType.toLowerCase() !== filters.claimType.toLowerCase()
      ) {
        return false;
      }
      return true;
    });

    // Aggregated Summary
    const countsByVerdict: Record<string, number> = {
      SUPPORTED: 0,
      CONTRADICTED: 0,
      UNSUPPORTED: 0,
      UNVERIFIABLE: 0,
      AMBIGUOUS: 0,
    };

    const countsByCategory: Record<string, number> = {
      HALLUCINATED_FACT: 0,
      CONTRADICTS_SOURCE: 0,
      UNSUPPORTED_CLAIM: 0,
      NUMERIC_MISMATCH: 0,
      ENTITY_MISMATCH: 0,
      AMBIGUOUS_STATEMENT: 0,
      NONE: 0,
    };

    for (const claim of allClaims) {
      if (countsByVerdict[claim.verdict] !== undefined) {
        countsByVerdict[claim.verdict]++;
      }
      const cat = claim.errorCategory || 'NONE';
      if (countsByCategory[cat] !== undefined) {
        countsByCategory[cat]++;
      } else {
        countsByCategory[cat] = 1;
      }
    }

    return {
      findings,
      summary: {
        total: allClaims.length,
        countsByVerdict,
        countsByCategory,
      },
    };
  }

  public async getAnnotations(id: string) {
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${id}' not found`);
    }

    const allClaims: Claim[] = (audit.claims || []).map((c: any) =>
      typeof c.toObject === 'function' ? c.toObject() : c
    );

    return resolveAnnotationOverlaps(allClaims);
  }
}

export interface AnnotationProjection {
  claimId: string;
  start: number;
  end: number;
  verdict: Verdict;
  category: ErrorCategory | null;
}

const SEVERITY_RANK: Record<Verdict, number> = {
  CONTRADICTED: 1,
  UNSUPPORTED: 2,
  AMBIGUOUS: 3,
  UNVERIFIABLE: 4,
  SUPPORTED: 5,
};

/**
 * Overlap Resolution Rule:
 * 1. Candidates are sorted primarily by Verdict Severity (CONTRADICTED > UNSUPPORTED > AMBIGUOUS > UNVERIFIABLE > SUPPORTED),
 *    then by span length (longer spans first), then by start position ascending.
 * 2. Higher-severity candidate spans claim character positions first.
 * 3. Lower-severity overlapping candidate spans are trimmed or split into non-overlapping sub-intervals.
 * 4. The resulting projection list contains non-overlapping spans sorted by start position ascending.
 */
export function resolveAnnotationOverlaps(
  claims: Claim[]
): AnnotationProjection[] {
  if (!claims || claims.length === 0) return [];

  const candidates = claims.map((c) => {
    const span = c.errorSpan || c.answerSpan;
    return {
      claimId: c.id,
      start: span.start,
      end: span.end,
      verdict: c.verdict,
      category: c.errorCategory || null,
      severity: SEVERITY_RANK[c.verdict] ?? 5,
    };
  });

  // Sort candidates by severity asc (Rank 1 wins), then len desc, then start asc
  candidates.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity - b.severity;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.start - b.start;
  });

  const covered: Array<{ start: number; end: number }> = [];
  const result: AnnotationProjection[] = [];

  for (const cand of candidates) {
    if (cand.start >= cand.end) continue;

    let currentStart = cand.start;
    const sortedCovered = [...covered].sort((x, y) => x.start - y.start);

    for (const cov of sortedCovered) {
      if (cov.end <= currentStart) continue;
      if (cov.start >= cand.end) break;

      if (currentStart < cov.start) {
        result.push({
          claimId: cand.claimId,
          start: currentStart,
          end: Math.min(cov.start, cand.end),
          verdict: cand.verdict,
          category: cand.category,
        });
      }
      currentStart = Math.max(currentStart, cov.end);
      if (currentStart >= cand.end) break;
    }

    if (currentStart < cand.end) {
      result.push({
        claimId: cand.claimId,
        start: currentStart,
        end: cand.end,
        verdict: cand.verdict,
        category: cand.category,
      });
    }

    covered.push({ start: cand.start, end: cand.end });
  }

  result.sort((a, b) => a.start - b.start);
  return result;
}

export const auditService = new AuditService();
