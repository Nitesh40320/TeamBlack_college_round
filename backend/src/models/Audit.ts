import mongoose, { Schema, Document } from 'mongoose';
import { AuditResult } from '../types/contract';

export interface IAuditDocument extends Omit<AuditResult, 'id'>, Document {
  id: string;
  answer?: string;
  question?: string;
}

const SpanSchema = new Schema(
  {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false }
);

const EvidenceSchema = new Schema(
  {
    sourceId: { type: String, required: true },
    span: { type: SpanSchema, required: true },
    text: { type: String, required: true },
    relation: {
      type: String,
      enum: ['supports', 'contradicts', 'related'],
      required: true,
    },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const ConfidenceSchema = new Schema(
  {
    score: { type: Number, required: true },
    level: { type: String, enum: ['low', 'medium', 'high'], required: true },
    uncertaintyReasons: [{ type: String }],
  },
  { _id: false }
);

const ClaimSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    answerSpan: { type: SpanSchema, required: true },
    claimType: {
      type: String,
      enum: ['factual', 'numeric', 'causal', 'recommendation', 'opinion'],
      required: true,
    },
    verdict: {
      type: String,
      enum: [
        'SUPPORTED',
        'CONTRADICTED',
        'UNSUPPORTED',
        'UNVERIFIABLE',
        'AMBIGUOUS',
      ],
      required: true,
    },
    errorCategory: {
      type: String,
      enum: [
        'HALLUCINATED_FACT',
        'CONTRADICTS_SOURCE',
        'UNSUPPORTED_CLAIM',
        'NUMERIC_MISMATCH',
        'ENTITY_MISMATCH',
        'AMBIGUOUS_STATEMENT',
      ],
    },
    errorSpan: { type: SpanSchema },
    explanation: { type: String, required: true },
    evidence: [EvidenceSchema],
    confidence: { type: ConfidenceSchema, required: true },
  },
  { _id: false }
);

const ReasoningIssueSchema = new Schema(
  {
    id: { type: String, required: true },
    claimIds: [{ type: String }],
    answerSpan: { type: SpanSchema, required: true },
    type: {
      type: String,
      enum: [
        'NON_SEQUITUR',
        'INTERNAL_CONTRADICTION',
        'CIRCULAR',
        'OVERGENERALIZATION',
      ],
      required: true,
    },
    explanation: { type: String, required: true },
    confidence: { type: ConfidenceSchema, required: true },
  },
  { _id: false }
);

const SafetyFlagSchema = new Schema(
  {
    id: { type: String, required: true },
    claimId: { type: String },
    answerSpan: { type: SpanSchema, required: true },
    domain: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    explanation: { type: String, required: true },
    recommendation: { type: String, required: true },
  },
  { _id: false }
);

const VerdictCountsSchema = new Schema(
  {
    SUPPORTED: { type: Number, default: 0 },
    CONTRADICTED: { type: Number, default: 0 },
    UNSUPPORTED: { type: Number, default: 0 },
    UNVERIFIABLE: { type: Number, default: 0 },
    AMBIGUOUS: { type: Number, default: 0 },
  },
  { _id: false }
);

const OverallScoreSchema = new Schema(
  {
    score: { type: Number, required: true },
    grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F'], required: true },
    summary: { type: String, required: true },
    counts: { type: VerdictCountsSchema, required: true },
  },
  { _id: false }
);

const ModelVersionsSchema = new Schema(
  {
    embedder: { type: String, required: true },
    verifier: { type: String, required: true },
    analyzer: { type: String, required: true },
  },
  { _id: false }
);

const TimingsSchema = new Schema(
  {
    totalMs: { type: Number, required: true },
    chunkingMs: { type: Number, required: true },
    extractionMs: { type: Number, required: true },
    verificationMs: { type: Number, required: true },
    analysisMs: { type: Number, required: true },
  },
  { _id: false }
);

const MetaSchema = new Schema(
  {
    timings: { type: TimingsSchema, required: true },
    modelVersions: { type: ModelVersionsSchema, required: true },
    mode: { type: String, enum: ['mock', 'live'], required: true },
  },
  { _id: false }
);

const ProgressSchema = new Schema(
  {
    stage: { type: String, required: true },
    verifiedClaims: { type: Number, required: true, default: 0 },
    totalClaims: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const AuditSchema = new Schema<IAuditDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    answer: { type: String },
    question: { type: String },
    status: {
      type: String,
      enum: [
        'queued',
        'extracting',
        'verifying',
        'analyzing',
        'completed',
        'failed',
      ],
      required: true,
    },
    claims: [ClaimSchema],
    reasoningIssues: [ReasoningIssueSchema],
    safetyFlags: [SafetyFlagSchema],
    overall: { type: OverallScoreSchema, required: true },
    meta: { type: MetaSchema, required: true },
    progress: { type: ProgressSchema },
    error: { type: String },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

AuditSchema.pre('save', function (next) {
  validateAndCleanSpans(this);
  next();
});

export function validateAndCleanSpans(doc: any): void {
  const answerLength = doc.answer ? doc.answer.length : undefined;

  if (doc.claims && Array.isArray(doc.claims)) {
    for (const claim of doc.claims) {
      // 1. Validate answerSpan (must be within answer length, 0 <= start < end)
      if (claim.answerSpan) {
        const { start, end } = claim.answerSpan;
        if (
          start == null ||
          end == null ||
          typeof start !== 'number' ||
          typeof end !== 'number' ||
          start < 0 ||
          start >= end ||
          (answerLength !== undefined && end > answerLength)
        ) {
          console.warn(
            `[SpanValidation] Invalid answerSpan [${start}, ${end}] for claim '${claim.id}' (answer.length=${answerLength}). Repairing to valid bounds.`
          );
          claim.answerSpan = {
            start: 0,
            end: answerLength && answerLength > 0 ? answerLength : 1,
          };
        }
      }

      // 2. Validate errorSpan (must be within answer length, 0 <= start < end)
      if (claim.errorSpan) {
        const { start, end } = claim.errorSpan;
        if (
          start == null ||
          end == null ||
          typeof start !== 'number' ||
          typeof end !== 'number' ||
          start < 0 ||
          start >= end ||
          (answerLength !== undefined && end > answerLength)
        ) {
          console.warn(
            `[SpanValidation] Invalid errorSpan [${start}, ${end}] for claim '${claim.id}' (answer.length=${answerLength}). Nulling out invalid errorSpan.`
          );
          claim.errorSpan = undefined;
        }
      }
    }
  }
}

export const AuditModel = mongoose.model<IAuditDocument>('Audit', AuditSchema);
