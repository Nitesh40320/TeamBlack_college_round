import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AuditModel } from '../models/Audit';
import { SourceModel } from '../models/Source';
import { modelClient } from './modelClient';
import {
  Claim,
  ClaimType,
  Verdict,
  VerdictCounts,
  OverallScore,
  SafetySeverity,
} from '../types/contract';

export const auditEvents = new EventEmitter();
auditEvents.setMaxListeners(200);

export class AuditOrchestrator {
  private queue: Array<{ auditId: string; fromStage?: string }> = [];
  private running: Set<string> = new Set();
  private concurrency: number;

  constructor(concurrency: number = 2) {
    this.concurrency = concurrency;
  }

  public enqueue(auditId: string, fromStage?: string): void {
    if (this.running.has(auditId)) {
      return;
    }
    const idx = this.queue.findIndex((item) => item.auditId === auditId);
    if (idx >= 0) {
      this.queue[idx].fromStage = fromStage;
    } else {
      this.queue.push({ auditId, fromStage });
    }
    this.processNext();
  }

  public isRunning(auditId: string): boolean {
    return this.running.has(auditId) || this.queue.some((i) => i.auditId === auditId);
  }

  private processNext(): void {
    while (this.running.size < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.running.add(item.auditId);
      this.runAuditPipeline(item.auditId, item.fromStage)
        .catch((err) => {
          console.error(`[Orchestrator] Error processing audit ${item.auditId}:`, err);
        })
        .finally(() => {
          this.running.delete(item.auditId);
          this.processNext();
        });
    }
  }

  private notifyProgress(audit: any): void {
    auditEvents.emit(`audit:${audit.id}`, {
      auditId: audit.id,
      status: audit.status,
      progress: audit.progress,
      error: audit.error,
    });
  }

  public async runAuditPipeline(auditId: string, fromStage?: string): Promise<void> {
    const audit = await AuditModel.findOne({ id: auditId });
    if (!audit) {
      console.warn(`[Orchestrator] Audit ${auditId} not found`);
      return;
    }

    if (audit.status === 'completed' && !fromStage) {
      return;
    }

    const sources = await SourceModel.find({ auditId });
    const formattedSources = sources.map((s) => ({
      id: s.id,
      title: s.title,
      text: s.text,
    }));

    try {
      const answer = audit.answer || '';
      const question = audit.question;

      const isAnalyzingRetry = fromStage === 'analyzing';

      // ── Stage 1: Claim Extraction ──────────────────────────────────────────
      if (!isAnalyzingRetry && (audit.claims.length === 0 || audit.status === 'queued' || audit.status === 'extracting')) {
        audit.status = 'extracting';
        audit.progress = {
          stage: 'extracting',
          verifiedClaims: 0,
          totalClaims: 0,
        };
        audit.updatedAt = new Date().toISOString();
        await audit.save();
        this.notifyProgress(audit);

        const extractStart = Date.now();
        const extractionResponse = await modelClient.extractClaims(answer, question);
        const extractionMs = Date.now() - extractStart;

        const claims: Claim[] = extractionResponse.claims.map((extClaim) => {
          const isOpinion = extClaim.is_opinion || extClaim.claimType === 'opinion';
          return {
            id: extClaim.id || uuidv4(),
            text: extClaim.text,
            answerSpan: extClaim.answerSpan,
            claimType: (extClaim.claimType || 'factual') as ClaimType,
            verdict: isOpinion ? 'UNVERIFIABLE' : 'UNSUPPORTED',
            explanation: isOpinion
              ? 'Opinion or subjective statement.'
              : 'Pending verification.',
            evidence: [],
            confidence: {
              score: 0.5,
              level: 'medium',
              uncertaintyReasons: [],
            },
          };
        });

        audit.claims = claims as any;
        audit.meta.timings.extractionMs = extractionMs;
        audit.status = 'verifying';
        audit.progress = {
          stage: 'verifying',
          verifiedClaims: 0,
          totalClaims: claims.length,
        };
        audit.updatedAt = new Date().toISOString();
        await audit.save();
        this.notifyProgress(audit);
      }

      // ── Stage 2: Claim Verification ────────────────────────────────────────
      const currentClaims = audit.claims as unknown as Claim[];
      const totalClaims = currentClaims.length;

      if (!isAnalyzingRetry && totalClaims > 0) {
        audit.status = 'verifying';
        audit.progress = {
          stage: 'verifying',
          verifiedClaims: audit.progress?.verifiedClaims || 0,
          totalClaims,
        };
        await audit.save();
        this.notifyProgress(audit);

        const verifyStart = Date.now();
        let verifiedCount = 0;

        for (let i = 0; i < totalClaims; i++) {
          const claim = currentClaims[i];

          // Skip if already verified in a previous execution attempt
          if (
            claim.verdict &&
            claim.explanation &&
            claim.explanation !== 'Pending verification.'
          ) {
            verifiedCount++;
            continue;
          }

          const verifiedClaim = await modelClient.verifyClaim(
            {
              id: claim.id,
              text: claim.text,
              answerSpan: claim.answerSpan,
              claimType: claim.claimType,
              is_opinion: claim.verdict === 'UNVERIFIABLE',
            },
            formattedSources
          );

          currentClaims[i] = verifiedClaim;
          verifiedCount++;

          audit.claims = currentClaims as any;
          audit.progress = {
            stage: 'verifying',
            verifiedClaims: verifiedCount,
            totalClaims,
          };
          audit.updatedAt = new Date().toISOString();
          await audit.save();
          this.notifyProgress(audit);
        }

        const verifyMs = Date.now() - verifyStart;
        audit.meta.timings.verificationMs = verifyMs;
      }

      // ── Stage 3: Reasoning & Safety Analysis ("analyzing" Stage) ────────────
      audit.status = 'analyzing';
      audit.progress = {
        stage: 'analyzing',
        verifiedClaims: totalClaims,
        totalClaims,
      };
      audit.updatedAt = new Date().toISOString();
      await audit.save();
      this.notifyProgress(audit);

      const analysisStart = Date.now();
      const analysisResult = await modelClient.analyzeReasoningAndSafety(
        answer,
        question,
        formattedSources
      );
      const analysisMs = Date.now() - analysisStart;
      audit.meta.timings.analysisMs = analysisMs;

      audit.reasoningIssues = (analysisResult.reasoningIssues || []) as any;
      audit.safetyFlags = (analysisResult.safetyFlags || []) as any;

      // ── Stage 4: Overall Score, Severity Aggregation & Completion ───────────
      const counts: VerdictCounts = {
        SUPPORTED: 0,
        CONTRADICTED: 0,
        UNSUPPORTED: 0,
        UNVERIFIABLE: 0,
        AMBIGUOUS: 0,
      };

      for (const claim of currentClaims) {
        if (counts[claim.verdict] !== undefined) {
          counts[claim.verdict]++;
        }
      }

      let score = 100;
      if (totalClaims > 0) {
        score = Math.round(
          ((counts.SUPPORTED * 100 +
            counts.AMBIGUOUS * 50 +
            counts.UNVERIFIABLE * 50) /
            totalClaims)
        );
      }

      let grade: OverallScore['grade'] = 'A';
      if (score < 60) grade = 'F';
      else if (score < 70) grade = 'D';
      else if (score < 80) grade = 'C';
      else if (score < 90) grade = 'B';

      // Calculate severity aggregation: max SafetySeverity & ReasoningIssue count
      const safetyFlags = (audit.safetyFlags || []) as any[];
      let maxSafetySeverity: SafetySeverity | 'none' | null = null;
      if (safetyFlags.length > 0) {
        if (safetyFlags.some((f) => f.severity === 'high')) {
          maxSafetySeverity = 'high';
        } else if (safetyFlags.some((f) => f.severity === 'medium')) {
          maxSafetySeverity = 'medium';
        } else {
          maxSafetySeverity = 'low';
        }
      }

      const reasoningIssueCount = (audit.reasoningIssues || []).length;

      const summary =
        totalClaims === 0
          ? 'No claims were extracted from the answer.'
          : `Verified ${totalClaims} claim(s): ${counts.SUPPORTED} supported, ${counts.CONTRADICTED} contradicted, ${counts.UNSUPPORTED} unsupported, ${counts.UNVERIFIABLE} unverifiable, ${counts.AMBIGUOUS} ambiguous. | Reasoning Issues: ${reasoningIssueCount} | Max Safety Severity: ${maxSafetySeverity || 'none'}`;

      audit.overall = {
        score,
        grade,
        summary,
        counts,
      };

      const timings = audit.meta.timings;
      timings.totalMs =
        timings.chunkingMs +
        timings.extractionMs +
        timings.verificationMs +
        timings.analysisMs;

      audit.status = 'completed';
      audit.progress = {
        stage: 'completed',
        verifiedClaims: totalClaims,
        totalClaims,
      };
      audit.updatedAt = new Date().toISOString();
      await audit.save();
      this.notifyProgress(audit);
    } catch (err: any) {
      console.error(`[Orchestrator] Pipeline failed for audit ${auditId}:`, err);
      audit.status = 'failed';
      audit.error = err.message || 'Verification pipeline failed';
      audit.progress = {
        stage: 'failed',
        verifiedClaims: audit.progress?.verifiedClaims || 0,
        totalClaims: audit.claims.length || 0,
      };
      audit.updatedAt = new Date().toISOString();
      await audit.save();
      this.notifyProgress(audit);
    }
  }
}

export const auditOrchestrator = new AuditOrchestrator();
