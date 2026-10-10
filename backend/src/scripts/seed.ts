import mongoose from 'mongoose';
import { AuditModel } from '../models/Audit';
import { SourceModel } from '../models/Source';
import { env } from '../config/env';

const demoAudits = [
  // 1. Financial Report Audit (CONTRADICTS_SOURCE & NUMERIC_MISMATCH)
  {
    id: 'demo-audit-001',
    question: 'What were the Q3 2024 revenue figures for Acme Corp?',
    answer:
      'Acme Corp reported Q3 2024 total revenue of $450 million, achieving a 25% year-over-year revenue growth. Operating income reached $120 million with profit margin expanding significantly.',
    status: 'completed',
    claims: [
      {
        id: 'claim-f1',
        text: 'Acme Corp reported Q3 2024 total revenue of $450 million.',
        answerSpan: { start: 0, end: 57 },
        claimType: 'numeric',
        verdict: 'CONTRADICTED',
        errorCategory: 'NUMERIC_MISMATCH',
        errorSpan: { start: 41, end: 53 },
        explanation: 'Source document states Q3 2024 revenue was $350 million, not $450 million.',
        evidence: [
          {
            sourceId: 'src-fin-1',
            span: { start: 10, end: 55 },
            text: 'Acme Corp Q3 2024 total revenue reached $350 million.',
            relation: 'refutes',
            score: 0.96,
          },
        ],
        confidence: { score: 0.94, level: 'high', uncertaintyReasons: [] },
      },
      {
        id: 'claim-f2',
        text: 'Achieving a 25% year-over-year revenue growth.',
        answerSpan: { start: 59, end: 104 },
        claimType: 'numeric',
        verdict: 'CONTRADICTED',
        errorCategory: 'CONTRADICTS_SOURCE',
        errorSpan: { start: 71, end: 103 },
        explanation: 'Actual YoY revenue growth was 12%, not 25%.',
        evidence: [
          {
            sourceId: 'src-fin-1',
            span: { start: 60, end: 105 },
            text: 'Year-over-year revenue growth for the quarter stood at 12%.',
            relation: 'refutes',
            score: 0.92,
          },
        ],
        confidence: { score: 0.91, level: 'high', uncertaintyReasons: [] },
      },
    ],
    reasoningIssues: [
      {
        id: 'reasoning-f1',
        claimIds: ['claim-f1', 'claim-f2'],
        answerSpan: { start: 59, end: 104 },
        type: 'INTERNAL_CONTRADICTION',
        explanation: 'Growth calculation relies on inflated revenue figure of $450 million.',
        confidence: { score: 0.88, level: 'high', uncertaintyReasons: [] },
      },
    ],
    safetyFlags: [],
    overall: {
      score: 0,
      grade: 'F',
      summary: 'Verified 2 claim(s): 0 supported, 2 contradicted. Major numeric discrepancies found in revenue figures.',
      counts: { SUPPORTED: 0, CONTRADICTED: 2, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
    },
    meta: {
      timings: { totalMs: 120, chunkingMs: 15, extractionMs: 30, verificationMs: 50, analysisMs: 25 },
      modelVersions: { embedder: 'text-embedding-3-small', verifier: 'gpt-4o-mini', analyzer: 'gpt-4o' },
      mode: 'live',
    },
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },

  // 2. Medical Advice Audit (SAFETY_FLAG & UNSUPPORTED_CLAIM)
  {
    id: 'demo-audit-002',
    question: 'What is the recommended dosage for pediatric ibuprofen?',
    answer:
      'For children under 6 years old, administer 400 mg every 2 hours as needed. Ibuprofen completely cures viral throat infections.',
    status: 'completed',
    claims: [
      {
        id: 'claim-m1',
        text: 'Administer 400 mg every 2 hours as needed for children under 6.',
        answerSpan: { start: 0, end: 62 },
        claimType: 'numeric',
        verdict: 'CONTRADICTED',
        errorCategory: 'NUMERIC_MISMATCH',
        errorSpan: { start: 27, end: 46 },
        explanation: 'Recommended dosage for children under 6 is 10 mg/kg every 6-8 hours. 400 mg every 2 hours is a toxic overdose.',
        evidence: [
          {
            sourceId: 'src-med-1',
            span: { start: 0, end: 80 },
            text: 'Pediatric dosing: 10 mg/kg per dose every 6 to 8 hours. Maximum single dose 200 mg.',
            relation: 'refutes',
            score: 0.98,
          },
        ],
        confidence: { score: 0.98, level: 'high', uncertaintyReasons: [] },
      },
      {
        id: 'claim-m2',
        text: 'Ibuprofen completely cures viral throat infections.',
        answerSpan: { start: 63, end: 114 },
        claimType: 'factual',
        verdict: 'UNSUPPORTED',
        errorCategory: 'UNSUPPORTED_CLAIM',
        errorSpan: { start: 63, end: 114 },
        explanation: 'Ibuprofen treats pain and fever symptoms but does not cure viral infections.',
        evidence: [],
        confidence: { score: 0.89, level: 'high', uncertaintyReasons: [] },
      },
    ],
    reasoningIssues: [],
    safetyFlags: [
      {
        id: 'safety-m1',
        claimId: 'claim-m1',
        answerSpan: { start: 27, end: 46 },
        domain: 'medical',
        severity: 'high',
        explanation: 'Toxic dosage recommendation poses serious pediatric risk of acute kidney injury and stomach ulceration.',
        recommendation: 'Consult a licensed pediatrician or healthcare professional before administering medication to children.',
      },
    ],
    overall: {
      score: 0,
      grade: 'F',
      summary: 'Verified 2 claim(s): 0 supported, 1 contradicted, 1 unsupported. High severity safety hazard detected.',
      counts: { SUPPORTED: 0, CONTRADICTED: 1, UNSUPPORTED: 1, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
    },
    meta: {
      timings: { totalMs: 140, chunkingMs: 10, extractionMs: 40, verificationMs: 60, analysisMs: 30 },
      modelVersions: { embedder: 'text-embedding-3-small', verifier: 'gpt-4o-mini', analyzer: 'gpt-4o' },
      mode: 'live',
    },
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },

  // 3. Tech History Audit (HALLUCINATED_FACT & ENTITY_MISMATCH)
  {
    id: 'demo-audit-003',
    question: 'Who co-founded Apple in 1976?',
    answer:
      'Apple Computer was co-founded in April 1976 by Steve Jobs and Bill Gates in Cupertino, California. They unveiled the Macintosh at the 1976 World Fair.',
    status: 'completed',
    claims: [
      {
        id: 'claim-t1',
        text: 'Apple Computer was co-founded in April 1976 by Steve Jobs and Bill Gates.',
        answerSpan: { start: 0, end: 77 },
        claimType: 'entity',
        verdict: 'CONTRADICTED',
        errorCategory: 'ENTITY_MISMATCH',
        errorSpan: { start: 61, end: 76 },
        explanation: 'Apple was co-founded by Steve Jobs, Steve Wozniak, and Ronald Wayne. Bill Gates co-founded Microsoft.',
        evidence: [
          {
            sourceId: 'src-tech-1',
            span: { start: 0, end: 70 },
            text: 'Apple Inc. was founded on April 1, 1976, by Steve Jobs, Steve Wozniak, and Ronald Wayne.',
            relation: 'refutes',
            score: 0.97,
          },
        ],
        confidence: { score: 0.97, level: 'high', uncertaintyReasons: [] },
      },
      {
        id: 'claim-t2',
        text: 'They unveiled the Macintosh at the 1976 World Fair.',
        answerSpan: { start: 102, end: 153 },
        claimType: 'factual',
        verdict: 'UNSUPPORTED',
        errorCategory: 'HALLUCINATED_FACT',
        errorSpan: { start: 102, end: 153 },
        explanation: 'The Macintosh was introduced in January 1984, not at a 1976 World Fair.',
        evidence: [],
        confidence: { score: 0.93, level: 'high', uncertaintyReasons: [] },
      },
    ],
    reasoningIssues: [
      {
        id: 'reasoning-t1',
        claimIds: ['claim-t1', 'claim-t2'],
        answerSpan: { start: 102, end: 153 },
        type: 'NON_SEQUITUR',
        explanation: 'Chronological non sequitur linking 1984 product launch to 1976 founding event.',
        confidence: { score: 0.85, level: 'medium', uncertaintyReasons: [] },
      },
    ],
    safetyFlags: [],
    overall: {
      score: 0,
      grade: 'F',
      summary: 'Verified 2 claim(s): 0 supported, 1 contradicted, 1 unsupported. Entity swap and historical hallucination.',
      counts: { SUPPORTED: 0, CONTRADICTED: 1, UNSUPPORTED: 1, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
    },
    meta: {
      timings: { totalMs: 110, chunkingMs: 12, extractionMs: 28, verificationMs: 45, analysisMs: 25 },
      modelVersions: { embedder: 'text-embedding-3-small', verifier: 'gpt-4o-mini', analyzer: 'gpt-4o' },
      mode: 'live',
    },
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },

  // 4. Environmental Policy Audit (AMBIGUOUS_STATEMENT & UNVERIFIABLE)
  {
    id: 'demo-audit-004',
    question: 'What are the global emissions targets for 2030?',
    answer:
      'Global carbon emissions should be significantly reduced by around 2030. Many experts believe this will be the best environmental policy ever created.',
    status: 'completed',
    claims: [
      {
        id: 'claim-e1',
        text: 'Global carbon emissions should be significantly reduced by around 2030.',
        answerSpan: { start: 0, end: 73 },
        claimType: 'factual',
        verdict: 'AMBIGUOUS',
        errorCategory: 'AMBIGUOUS_STATEMENT',
        errorSpan: { start: 35, end: 57 },
        explanation: 'Statement lacks specific baseline year and target percentage reduction.',
        evidence: [
          {
            sourceId: 'src-env-1',
            span: { start: 0, end: 60 },
            text: 'IPCC targets require a 45% reduction in CO2 emissions from 2010 levels by 2030.',
            relation: 'partially_supports',
            score: 0.75,
          },
        ],
        confidence: { score: 0.72, level: 'medium', uncertaintyReasons: ['Vague phrasing in answer'] },
      },
      {
        id: 'claim-e2',
        text: 'Many experts believe this will be the best environmental policy ever created.',
        answerSpan: { start: 74, end: 151 },
        claimType: 'opinion',
        verdict: 'UNVERIFIABLE',
        explanation: 'Subjective value judgment cannot be objectively verified.',
        evidence: [],
        confidence: { score: 0.8, level: 'medium', uncertaintyReasons: ['Subjective opinion'] },
      },
    ],
    reasoningIssues: [],
    safetyFlags: [],
    overall: {
      score: 50,
      grade: 'D',
      summary: 'Verified 2 claim(s): 0 supported, 1 ambiguous, 1 unverifiable.',
      counts: { SUPPORTED: 0, CONTRADICTED: 0, UNSUPPORTED: 0, UNVERIFIABLE: 1, AMBIGUOUS: 1 },
    },
    meta: {
      timings: { totalMs: 95, chunkingMs: 10, extractionMs: 25, verificationMs: 40, analysisMs: 20 },
      modelVersions: { embedder: 'text-embedding-3-small', verifier: 'gpt-4o-mini', analyzer: 'gpt-4o' },
      mode: 'live',
    },
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },

  // 5. Pristine Scientific Audit (ALL SUPPORTED, Grade A)
  {
    id: 'demo-audit-005',
    question: 'What is the speed of light in vacuum?',
    answer:
      'The speed of light in a vacuum is exactly 299,792,458 meters per second. It is a fundamental physical constant denoted by the symbol c.',
    status: 'completed',
    claims: [
      {
        id: 'claim-s1',
        text: 'The speed of light in a vacuum is exactly 299,792,458 meters per second.',
        answerSpan: { start: 0, end: 72 },
        claimType: 'numeric',
        verdict: 'SUPPORTED',
        explanation: 'Fully supported by SI base unit definitions.',
        evidence: [
          {
            sourceId: 'src-physics-1',
            span: { start: 0, end: 65 },
            text: 'The speed of light in vacuum c is defined as 299,792,458 m/s.',
            relation: 'supports',
            score: 0.99,
          },
        ],
        confidence: { score: 0.99, level: 'high', uncertaintyReasons: [] },
      },
      {
        id: 'claim-s2',
        text: 'It is a fundamental physical constant denoted by the symbol c.',
        answerSpan: { start: 73, end: 135 },
        claimType: 'factual',
        verdict: 'SUPPORTED',
        explanation: 'Confirmed by physics reference documentation.',
        evidence: [
          {
            sourceId: 'src-physics-1',
            span: { start: 66, end: 120 },
            text: 'c represents the universal physical constant speed of light in vacuum.',
            relation: 'supports',
            score: 0.98,
          },
        ],
        confidence: { score: 0.98, level: 'high', uncertaintyReasons: [] },
      },
    ],
    reasoningIssues: [],
    safetyFlags: [],
    overall: {
      score: 100,
      grade: 'A',
      summary: 'Verified 2 claim(s): 2 supported, 0 contradicted, 0 unsupported. Perfect factual alignment.',
      counts: { SUPPORTED: 2, CONTRADICTED: 0, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
    },
    meta: {
      timings: { totalMs: 85, chunkingMs: 8, extractionMs: 22, verificationMs: 38, analysisMs: 17 },
      modelVersions: { embedder: 'text-embedding-3-small', verifier: 'gpt-4o-mini', analyzer: 'gpt-4o' },
      mode: 'live',
    },
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

const demoSources = [
  {
    id: 'src-fin-1',
    auditId: 'demo-audit-001',
    title: 'Acme Corp Q3 2024 Financial Report',
    text: 'Acme Corp Q3 2024 total revenue reached $350 million. Year-over-year revenue growth for the quarter stood at 12%. Operating income was $90 million.',
  },
  {
    id: 'src-med-1',
    auditId: 'demo-audit-002',
    title: 'Clinical Pharmacology Guide for Pediatric Care',
    text: 'Pediatric dosing for ibuprofen: 10 mg/kg per dose every 6 to 8 hours. Maximum single dose 200 mg. Ibuprofen is an antipyretic and analgesic; it does not treat viral pathogens directly.',
  },
  {
    id: 'src-tech-1',
    auditId: 'demo-audit-003',
    title: 'Encyclopedia of Computer History',
    text: 'Apple Inc. was founded on April 1, 1976, by Steve Jobs, Steve Wozniak, and Ronald Wayne. The Macintosh personal computer was announced on January 24, 1984.',
  },
  {
    id: 'src-env-1',
    auditId: 'demo-audit-004',
    title: 'IPCC Climate Change Assessment Report',
    text: 'IPCC targets require a 45% reduction in CO2 emissions from 2010 levels by 2030 to limit global warming to 1.5 degrees Celsius.',
  },
  {
    id: 'src-physics-1',
    auditId: 'demo-audit-005',
    title: 'NIST Physical Constants Reference',
    text: 'The speed of light in vacuum c is defined as 299,792,458 m/s. c represents the universal physical constant speed of light in vacuum.',
  },
];

async function seed() {
  try {
    const mongoUri = env.MONGO_URI || 'mongodb://localhost:27017/second_opinion';
    console.log(`[Seed] Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log('[Seed] Clearing existing demo audit records...');
    const demoIds = demoAudits.map((a) => a.id);
    await AuditModel.deleteMany({ id: { $in: demoIds } });
    await SourceModel.deleteMany({ auditId: { $in: demoIds } });

    console.log(`[Seed] Inserting ${demoAudits.length} demo audits...`);
    await AuditModel.insertMany(demoAudits);

    console.log(`[Seed] Inserting ${demoSources.length} demo sources...`);
    await SourceModel.insertMany(demoSources);

    console.log('[Seed] Database seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Seeding failed:', error);
    process.exit(1);
  }
}

seed();
