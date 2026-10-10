import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { modelClient } from '../src/services/modelClient';
import { Claim } from '../src/types/contract';

jest.setTimeout(120000);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function waitForStatus(
  auditId: string,
  targetStatuses: string[],
  timeoutMs = 5000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request(app).get(`/api/audits/${auditId}`);
    if (res.status === 200 && targetStatuses.includes(res.body.status)) {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  const finalRes = await request(app).get(`/api/audits/${auditId}`);
  return finalRes.body;
}

describe('Audits API (/api/audits)', () => {
  it('should reject POST /api/audits when request body is invalid', async () => {
    const res = await request(app).post('/api/audits').send({
      question: 'Missing answer and sources',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should process audit asynchronously (success path)', async () => {
    const mockExtractedClaims = {
      claims: [
        {
          id: 'c1111111-1111-1111-1111-111111111111',
          text: 'Aspirin reduces fever.',
          answerSpan: { start: 0, end: 22 },
          claimType: 'factual',
          is_opinion: false,
        },
        {
          id: 'c2222222-2222-2222-2222-222222222222',
          text: 'It is the best medicine available.',
          answerSpan: { start: 23, end: 56 },
          claimType: 'opinion',
          is_opinion: true,
        },
      ],
    };

    const mockVerifiedClaim1: Claim = {
      id: 'c1111111-1111-1111-1111-111111111111',
      text: 'Aspirin reduces fever.',
      answerSpan: { start: 0, end: 22 },
      claimType: 'factual',
      verdict: 'SUPPORTED',
      explanation: 'Source confirms aspirin is indicated for fever.',
      evidence: [
        {
          sourceId: 'src-1',
          span: { start: 0, end: 40 },
          text: 'Aspirin is indicated for fever reduction.',
          relation: 'supports',
          score: 0.95,
        },
      ],
      confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
    };

    const mockVerifiedClaim2: Claim = {
      id: 'c2222222-2222-2222-2222-222222222222',
      text: 'It is the best medicine available.',
      answerSpan: { start: 23, end: 56 },
      claimType: 'opinion',
      verdict: 'UNVERIFIABLE',
      explanation: 'Opinion or subjective claim cannot be verified against factual sources.',
      evidence: [],
      confidence: { score: 0.8, level: 'medium', uncertaintyReasons: [] },
    };

    jest.spyOn(modelClient, 'extractClaims').mockResolvedValue(mockExtractedClaims);
    jest
      .spyOn(modelClient, 'verifyClaim')
      .mockImplementation(async (claimInput) => {
        if (claimInput.id === 'c1111111-1111-1111-1111-111111111111') {
          return mockVerifiedClaim1;
        }
        return mockVerifiedClaim2;
      });

    const auditReq = {
      question: 'What does aspirin do?',
      answer: 'Aspirin reduces fever. It is the best medicine available.',
      sources: [
        {
          id: 'src-1',
          title: 'Medical Reference',
          text: 'Aspirin is indicated for fever reduction in adults.',
        },
      ],
    };

    // 1. POST /api/audits (returns 202 Accepted)
    const postRes = await request(app).post('/api/audits').send(auditReq);
    expect(postRes.status).toBe(202);
    expect(postRes.body.id).toBeDefined();
    expect(postRes.body.status).toBe('queued');

    const auditId = postRes.body.id;

    // 2. Poll GET /api/audits/:id until completed
    const result = await waitForStatus(auditId, ['completed', 'failed']);
    expect(result.status).toBe('completed');
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].verdict).toBe('SUPPORTED');
    expect(result.claims[1].verdict).toBe('UNVERIFIABLE');
    expect(result.overall.counts.SUPPORTED).toBe(1);
    expect(result.overall.counts.UNVERIFIABLE).toBe(1);
    expect(result.progress.stage).toBe('completed');
    expect(result.progress.verifiedClaims).toBe(2);
    expect(result.progress.totalClaims).toBe(2);
  });

  it('should handle model failure and mark audit status as failed with readable error', async () => {
    jest
      .spyOn(modelClient, 'extractClaims')
      .mockRejectedValue(new Error('Model service connection timeout after 30000ms'));

    const auditReq = {
      answer: 'Some answer text',
      sources: [
        {
          id: 'src-1',
          title: 'Source Title',
          text: 'Source content text',
        },
      ],
    };

    const postRes = await request(app).post('/api/audits').send(auditReq);
    expect(postRes.status).toBe(202);
    const auditId = postRes.body.id;

    const result = await waitForStatus(auditId, ['failed']);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Model service connection timeout');
    expect(result.progress.stage).toBe('failed');
  });

  it('should allow rerun of an audit via POST /api/audits/:id/rerun', async () => {
    // First setup a failed audit
    jest
      .spyOn(modelClient, 'extractClaims')
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({
        claims: [
          {
            id: 'c3333333-3333-3333-3333-333333333333',
            text: 'Aspirin treats pain.',
            answerSpan: { start: 0, end: 19 },
            claimType: 'factual',
            is_opinion: false,
          },
        ],
      });

    jest.spyOn(modelClient, 'verifyClaim').mockResolvedValueOnce({
      id: 'c3333333-3333-3333-3333-333333333333',
      text: 'Aspirin treats pain.',
      answerSpan: { start: 0, end: 19 },
      claimType: 'factual',
      verdict: 'SUPPORTED',
      explanation: 'Source supports aspirin for pain.',
      evidence: [],
      confidence: { score: 0.9, level: 'high', uncertaintyReasons: [] },
    });

    const postRes = await request(app).post('/api/audits').send({
      answer: 'Aspirin treats pain.',
      sources: [{ id: 'src-1', title: 'Source', text: 'Aspirin treats pain.' }],
    });
    const auditId = postRes.body.id;

    // Wait for initial failure
    const failedResult = await waitForStatus(auditId, ['failed']);
    expect(failedResult.status).toBe('failed');

    // Trigger rerun
    const rerunRes = await request(app).post(`/api/audits/${auditId}/rerun`);
    expect(rerunRes.status).toBe(202);
    expect(rerunRes.body.status).toBe('queued');

    // Wait for successful completion
    const successResult = await waitForStatus(auditId, ['completed']);
    expect(successResult.status).toBe('completed');
    expect(successResult.claims).toHaveLength(1);
    expect(successResult.claims[0].verdict).toBe('SUPPORTED');
  });

  it('should validate spans on write and null out or repair invalid spans with a logged warning', async () => {
    const { AuditModel } = require('../src/models/Audit');
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const invalidDoc = new AuditModel({
      id: 'audit-span-test-1',
      answer: 'Aspirin reduces fever.',
      status: 'completed',
      claims: [
        {
          id: 'claim-1',
          text: 'Aspirin reduces fever.',
          answerSpan: { start: 0, end: 22 },
          claimType: 'factual',
          verdict: 'CONTRADICTED',
          errorCategory: 'NUMERIC_MISMATCH',
          errorSpan: { start: 50, end: 10 }, // Invalid: start >= end
          explanation: 'Invalid error span start >= end',
          evidence: [],
          confidence: { score: 0.9, level: 'high', uncertaintyReasons: [] },
        },
        {
          id: 'claim-2',
          text: 'Test claim',
          answerSpan: { start: 0, end: 500 }, // Exceeds answer length 22
          claimType: 'factual',
          verdict: 'UNSUPPORTED',
          errorCategory: 'UNSUPPORTED_CLAIM',
          errorSpan: { start: 0, end: 999 }, // Exceeds answer length 22
          explanation: 'Exceeds answer length',
          evidence: [],
          confidence: { score: 0.9, level: 'high', uncertaintyReasons: [] },
        },
      ],
      overall: {
        score: 50,
        grade: 'F',
        summary: 'Test summary',
        counts: { SUPPORTED: 0, CONTRADICTED: 1, UNSUPPORTED: 1, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
      },
      meta: {
        timings: { totalMs: 10, chunkingMs: 2, extractionMs: 3, verificationMs: 3, analysisMs: 2 },
        modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
        mode: 'mock',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await invalidDoc.save();

    expect(consoleSpy).toHaveBeenCalled();

    const saved = await AuditModel.findOne({ id: 'audit-span-test-1' });
    expect(saved).toBeDefined();
    // Claim 1: invalid errorSpan (50 >= 10) should be nulled out
    expect(saved.claims[0].errorSpan).toBeUndefined();
    expect(saved.claims[0].errorCategory).toBe('NUMERIC_MISMATCH');
    expect(saved.claims[0].explanation).toBe('Invalid error span start >= end');

    // Claim 2: invalid answerSpan & errorSpan exceeding length 22 should be repaired/nulled
    expect(saved.claims[1].answerSpan.end).toBeLessThanOrEqual(22);
    expect(saved.claims[1].errorSpan).toBeUndefined();
  });

  it('should return findings with query filters and aggregated summary via GET /api/audits/:id/findings', async () => {
    const { AuditModel } = require('../src/models/Audit');

    const auditDoc = new AuditModel({
      id: 'audit-findings-test',
      answer: 'Aspirin reduces fever in adults. Take 1000 mg every 4 hours.',
      status: 'completed',
      claims: [
        {
          id: 'c-1',
          text: 'Aspirin reduces fever in adults.',
          answerSpan: { start: 0, end: 32 },
          claimType: 'factual',
          verdict: 'SUPPORTED',
          explanation: 'Source supports fever reduction.',
          evidence: [],
          confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
        },
        {
          id: 'c-2',
          text: 'Take 1000 mg every 4 hours.',
          answerSpan: { start: 33, end: 60 },
          claimType: 'numeric',
          verdict: 'CONTRADICTED',
          errorCategory: 'NUMERIC_MISMATCH',
          errorSpan: { start: 38, end: 45 },
          explanation: 'Source states maximum single dose is 900 mg.',
          evidence: [],
          confidence: { score: 0.92, level: 'high', uncertaintyReasons: [] },
        },
        {
          id: 'c-3',
          text: 'Synthesized in 2000 BC.',
          answerSpan: { start: 0, end: 22 },
          claimType: 'factual',
          verdict: 'UNSUPPORTED',
          errorCategory: 'HALLUCINATED_FACT',
          errorSpan: { start: 0, end: 22 },
          explanation: 'Detail is absent from source.',
          evidence: [],
          confidence: { score: 0.85, level: 'medium', uncertaintyReasons: [] },
        },
      ],
      overall: {
        score: 33,
        grade: 'F',
        summary: 'Audit completed.',
        counts: { SUPPORTED: 1, CONTRADICTED: 1, UNSUPPORTED: 1, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
      },
      meta: {
        timings: { totalMs: 10, chunkingMs: 2, extractionMs: 3, verificationMs: 3, analysisMs: 2 },
        modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
        mode: 'mock',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await auditDoc.save();

    // 1. Fetch all findings (no filters)
    const allRes = await request(app).get('/api/audits/audit-findings-test/findings');
    expect(allRes.status).toBe(200);
    expect(allRes.body.findings).toHaveLength(3);
    expect(allRes.body.summary.total).toBe(3);
    expect(allRes.body.summary.countsByVerdict.SUPPORTED).toBe(1);
    expect(allRes.body.summary.countsByVerdict.CONTRADICTED).toBe(1);
    expect(allRes.body.summary.countsByCategory.NUMERIC_MISMATCH).toBe(1);
    expect(allRes.body.summary.countsByCategory.HALLUCINATED_FACT).toBe(1);

    // 2. Filter by verdict=CONTRADICTED
    const verdictRes = await request(app).get('/api/audits/audit-findings-test/findings?verdict=CONTRADICTED');
    expect(verdictRes.status).toBe(200);
    expect(verdictRes.body.findings).toHaveLength(1);
    expect(verdictRes.body.findings[0].id).toBe('c-2');

    // 3. Filter by category=HALLUCINATED_FACT
    const catRes = await request(app).get('/api/audits/audit-findings-test/findings?category=HALLUCINATED_FACT');
    expect(catRes.status).toBe(200);
    expect(catRes.body.findings).toHaveLength(1);
    expect(catRes.body.findings[0].id).toBe('c-3');

    // 4. Filter by claimType=numeric
    const typeRes = await request(app).get('/api/audits/audit-findings-test/findings?claimType=numeric');
    expect(typeRes.status).toBe(200);
    expect(typeRes.body.findings).toHaveLength(1);
    expect(typeRes.body.findings[0].id).toBe('c-2');
  });

  it('should return sorted, non-overlapping annotations projection via GET /api/audits/:id/annotations with overlap resolution (higher severity wins)', async () => {
    const { AuditModel } = require('../src/models/Audit');

    // Setup an audit where a SUPPORTED claim [0, 30] overlaps with a CONTRADICTED claim [10, 20]
    const auditDoc = new AuditModel({
      id: 'audit-annotations-test',
      answer: 'Aspirin reduces fever in adults quickly.',
      status: 'completed',
      claims: [
        {
          id: 'claim-supported',
          text: 'Aspirin reduces fever in adults quickly.',
          answerSpan: { start: 0, end: 30 },
          claimType: 'factual',
          verdict: 'SUPPORTED',
          explanation: 'Supported claim.',
          evidence: [],
          confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
        },
        {
          id: 'claim-contradicted',
          text: 'reduces fever',
          answerSpan: { start: 8, end: 21 },
          claimType: 'numeric',
          verdict: 'CONTRADICTED',
          errorCategory: 'NUMERIC_MISMATCH',
          errorSpan: { start: 8, end: 21 },
          explanation: 'Contradicted claim.',
          evidence: [],
          confidence: { score: 0.9, level: 'high', uncertaintyReasons: [] },
        },
      ],
      overall: {
        score: 50,
        grade: 'F',
        summary: 'Test summary',
        counts: { SUPPORTED: 1, CONTRADICTED: 1, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
      },
      meta: {
        timings: { totalMs: 10, chunkingMs: 2, extractionMs: 3, verificationMs: 3, analysisMs: 2 },
        modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
        mode: 'mock',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await auditDoc.save();

    const res = await request(app).get('/api/audits/audit-annotations-test/annotations');
    expect(res.status).toBe(200);
    const annotations = res.body;

    // Verify non-overlapping projection structure
    expect(Array.isArray(annotations)).toBe(true);
    expect(annotations.length).toBeGreaterThan(0);

    // Verify that higher severity (CONTRADICTED) won in overlapping region [8, 21]
    const contradictedAnn = annotations.find((a: any) => a.verdict === 'CONTRADICTED');
    expect(contradictedAnn).toBeDefined();
    expect(contradictedAnn.start).toBe(8);
    expect(contradictedAnn.end).toBe(21);
    expect(contradictedAnn.category).toBe('NUMERIC_MISMATCH');

    // Verify zero overlaps exist between all output annotations
    for (let i = 0; i < annotations.length - 1; i++) {
      expect(annotations[i].end).toBeLessThanOrEqual(annotations[i + 1].start);
    }
  });

  it('should process analyzing stage and record reasoningIssues, safetyFlags, and severity aggregation', async () => {
    const { AuditModel } = require('../src/models/Audit');

    const auditDoc = new AuditModel({
      id: 'audit-analyzing-test',
      answer: 'Aspirin reduces fever. Take 3000 mg every 2 hours.',
      status: 'completed',
      claims: [
        {
          id: 'c-1',
          text: 'Aspirin reduces fever.',
          answerSpan: { start: 0, end: 22 },
          claimType: 'factual',
          verdict: 'SUPPORTED',
          explanation: 'Supported claim',
          evidence: [],
          confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
        },
      ],
      reasoningIssues: [
        {
          id: 'r-1',
          claimIds: ['c-1'],
          answerSpan: { start: 0, end: 22 },
          type: 'NON_SEQUITUR',
          explanation: 'Non sequitur reasoning flaw.',
          confidence: { score: 0.9, level: 'high', uncertaintyReasons: [] },
        },
      ],
      safetyFlags: [
        {
          id: 's-1',
          claimId: 'c-1',
          answerSpan: { start: 23, end: 49 },
          domain: 'medical',
          severity: 'high',
          explanation: 'High dosage recommendation exceeds limits.',
          recommendation: 'Consult doctor.',
        },
      ],
      overall: {
        score: 50,
        grade: 'F',
        summary: 'Verified 1 claim(s)... | Reasoning Issues: 1 | Max Safety Severity: high',
        counts: { SUPPORTED: 1, CONTRADICTED: 0, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
      },
      meta: {
        timings: { totalMs: 10, chunkingMs: 2, extractionMs: 3, verificationMs: 3, analysisMs: 2 },
        modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
        mode: 'mock',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await auditDoc.save();

    // 1. GET /api/audits/:id (verify reasoningIssues & safetyFlags exposed)
    const auditRes = await request(app).get('/api/audits/audit-analyzing-test');
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.reasoningIssues).toHaveLength(1);
    expect(auditRes.body.safetyFlags).toHaveLength(1);
    expect(auditRes.body.overall.summary).toContain('Max Safety Severity: high');

    // 2. GET /api/audits/:id/reasoning
    const reasoningRes = await request(app).get('/api/audits/audit-analyzing-test/reasoning');
    expect(reasoningRes.status).toBe(200);
    expect(reasoningRes.body.reasoningIssues).toHaveLength(1);
    expect(reasoningRes.body.total).toBe(1);
    expect(reasoningRes.body.reasoningIssues[0].type).toBe('NON_SEQUITUR');

    // 3. GET /api/audits/:id/safety
    const safetyRes = await request(app).get('/api/audits/audit-analyzing-test/safety');
    expect(safetyRes.status).toBe(200);
    expect(safetyRes.body.safetyFlags).toHaveLength(1);
    expect(safetyRes.body.maxSeverity).toBe('high');
    expect(safetyRes.body.total).toBe(1);
  });

  it('should support independent retry from analyzing stage without redoing verification', async () => {
    const { AuditModel } = require('../src/models/Audit');

    const auditDoc = new AuditModel({
      id: 'audit-retry-analyzing-test',
      answer: 'Aspirin reduces fever.',
      status: 'completed',
      claims: [
        {
          id: 'c-pre-verified',
          text: 'Aspirin reduces fever.',
          answerSpan: { start: 0, end: 22 },
          claimType: 'factual',
          verdict: 'SUPPORTED',
          explanation: 'Pre-verified claim.',
          evidence: [],
          confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
        },
      ],
      overall: {
        score: 100,
        grade: 'A',
        summary: 'Audit completed.',
        counts: { SUPPORTED: 1, CONTRADICTED: 0, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
      },
      meta: {
        timings: { totalMs: 10, chunkingMs: 2, extractionMs: 3, verificationMs: 3, analysisMs: 2 },
        modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
        mode: 'mock',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await auditDoc.save();

    // Spies to ensure extractClaims and verifyClaim are NOT called during analyzing retry
    const extractSpy = jest.spyOn(modelClient, 'extractClaims');
    const verifySpy = jest.spyOn(modelClient, 'verifyClaim');

    // Call POST /api/audits/:id/rerun?fromStage=analyzing
    const rerunRes = await request(app).post('/api/audits/audit-retry-analyzing-test/rerun?fromStage=analyzing');
    expect(rerunRes.status).toBe(202);
    expect(rerunRes.body.status).toBe('analyzing');

    // Wait for completion
    const result = await waitForStatus('audit-retry-analyzing-test', ['completed']);
    expect(result.status).toBe('completed');
    // Verify existing claim was preserved
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].id).toBe('c-pre-verified');

    // Confirm extraction and verification were skipped
    expect(extractSpy).not.toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();
  });
});
