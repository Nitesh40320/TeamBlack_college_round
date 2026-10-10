import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { AuditModel } from '../src/models/Audit';
import { FeedbackModel } from '../src/models/Feedback';
import { modelClient } from '../src/services/modelClient';

jest.setTimeout(60000);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 60000);

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

describe('1. Audit Summary Endpoint (GET /api/audits/:id/summary)', () => {
  it('should return 404 for non-existent audit ID', async () => {
    const res = await request(app).get('/api/audits/non-existent-id/summary');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return grade, score, counts, topFindings, and calibrationNote for an existing audit', async () => {
    const auditId = 'test-summary-audit-1';
    const now = new Date().toISOString();

    await new AuditModel({
      id: auditId,
      answer: 'Aspirin reduces fever. Take 5000mg per dose.',
      question: 'Dosage query',
      status: 'completed',
      claims: [
        {
          id: 'claim-1',
          text: 'Aspirin reduces fever.',
          claimType: 'factual',
          answerSpan: { start: 0, end: 22 },
          verdict: 'SUPPORTED',
          explanation: 'Supported by source.',
          evidence: [],
          confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
        },
        {
          id: 'claim-2',
          text: 'Take 5000mg per dose.',
          claimType: 'numeric',
          answerSpan: { start: 23, end: 44 },
          verdict: 'CONTRADICTED',
          errorCategory: 'NUMERIC_MISMATCH',
          explanation: 'Exceeds maximum dosage.',
          evidence: [],
          confidence: { score: 0.92, level: 'high', uncertaintyReasons: [] },
        },
      ],
      reasoningIssues: [
        {
          id: 'reasoning-1',
          claimIds: ['claim-2'],
          answerSpan: { start: 23, end: 44 },
          type: 'NON_SEQUITUR',
          explanation: 'Dose does not follow safe limits.',
          confidence: { score: 0.88, level: 'high', uncertaintyReasons: [] },
        },
      ],
      safetyFlags: [
        {
          id: 'safety-1',
          claimId: 'claim-2',
          answerSpan: { start: 23, end: 44 },
          domain: 'medical',
          severity: 'high',
          explanation: 'Toxic dosage level.',
          recommendation: 'Seek immediate medical attention.',
        },
      ],
      overall: {
        score: 50,
        grade: 'D',
        summary: 'Audit completed with high severity safety warning.',
        counts: {
          SUPPORTED: 1,
          CONTRADICTED: 1,
          UNSUPPORTED: 0,
          UNVERIFIABLE: 0,
          AMBIGUOUS: 0,
        },
      },
      meta: {
        timings: { totalMs: 100, chunkingMs: 10, extractionMs: 20, verificationMs: 50, analysisMs: 20 },
        modelVersions: { embedder: 'embed', verifier: 'ver', analyzer: 'ana' },
        mode: 'mock',
      },
      createdAt: now,
      updatedAt: now,
    }).save();

    const res = await request(app).get(`/api/audits/${auditId}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.auditId).toBe(auditId);
    expect(res.body.grade).toBe('D');
    expect(res.body.score).toBe(50);
    expect(res.body.counts).toEqual({
      SUPPORTED: 1,
      CONTRADICTED: 1,
      UNSUPPORTED: 0,
      UNVERIFIABLE: 0,
      AMBIGUOUS: 0,
    });
    expect(Array.isArray(res.body.topFindings)).toBe(true);
    expect(res.body.topFindings.length).toBeGreaterThan(0);
    expect(res.body.calibrationNote).toContain(
      'Confidence describes how sure the system is about the FINDING'
    );
  });
});

describe('2. Model Evaluation Results Proxy (GET /api/eval/latest)', () => {
  it('should return model eval metrics when modelClient succeeds', async () => {
    const mockMetrics = {
      dataset_split: 'model/eval/data/test.jsonl',
      total_test_cases: 15,
      total_claims_evaluated: 31,
      macro_f1: 0.825,
      contradiction_precision: 0.95,
      span_overlap_f1: 0.91,
      brier_score: 0.045,
      ece: 0.082,
      per_verdict_metrics: {},
      reliability_diagram: [],
    };

    jest.spyOn(modelClient, 'getLatestEval').mockResolvedValueOnce(mockMetrics);

    const res = await request(app).get('/api/eval/latest');
    expect(res.status).toBe(200);
    expect(res.body.macro_f1).toBe(0.825);
    expect(res.body.contradiction_precision).toBe(0.95);
  });

  it('should return graceful fallback empty state when model is unreachable', async () => {
    // ModelClient already falls back gracefully when model endpoint is unreachable
    const res = await request(app).get('/api/eval/latest');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unavailable');
    expect(res.body.macro_f1).toBe(0);
  });
});

describe('3. Feedback System (POST /api/audits/:id/feedback & GET /api/feedback/stats)', () => {
  const auditId = 'test-feedback-audit-1';
  const findingId = 'finding-claim-101';

  beforeEach(async () => {
    const now = new Date().toISOString();
    await new AuditModel({
      id: auditId,
      answer: 'Sample text',
      status: 'completed',
      claims: [],
      reasoningIssues: [],
      safetyFlags: [],
      overall: {
        score: 100,
        grade: 'A',
        summary: 'All good',
        counts: { SUPPORTED: 1, CONTRADICTED: 0, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
      },
      meta: {
        timings: { totalMs: 10, chunkingMs: 1, extractionMs: 2, verificationMs: 5, analysisMs: 2 },
        modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
        mode: 'mock',
      },
      createdAt: now,
      updatedAt: now,
    }).save();
  });

  it('should reject invalid payload with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post(`/api/audits/${auditId}/feedback`)
      .send({ findingType: 'invalid_type', verdict: 'maybe' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 if audit does not exist', async () => {
    const res = await request(app)
      .post('/api/audits/non-existent-audit/feedback')
      .send({
        findingType: 'claim',
        findingId,
        verdict: 'correct',
      });

    expect(res.status).toBe(404);
  });

  it('should accept valid feedback and prevent duplicate votes per client session', async () => {
    const clientHeader = { 'x-client-id': 'client-session-abc' };

    // First vote succeeds (201)
    const res1 = await request(app)
      .post(`/api/audits/${auditId}/feedback`)
      .set(clientHeader)
      .send({
        findingType: 'claim',
        findingId,
        verdict: 'correct',
        comment: 'Accurate verdict',
      });

    expect(res1.status).toBe(201);
    expect(res1.body.findingId).toBe(findingId);
    expect(res1.body.verdict).toBe('correct');

    // Second vote with same client session ID fails with 409 Conflict
    const res2 = await request(app)
      .post(`/api/audits/${auditId}/feedback`)
      .set(clientHeader)
      .send({
        findingType: 'claim',
        findingId,
        verdict: 'incorrect',
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('DUPLICATE_FEEDBACK');

    // Vote for same finding from a DIFFERENT client session succeeds
    const res3 = await request(app)
      .post(`/api/audits/${auditId}/feedback`)
      .set({ 'x-client-id': 'client-session-xyz' })
      .send({
        findingType: 'claim',
        findingId,
        verdict: 'incorrect',
      });

    expect(res3.status).toBe(201);
  });

  it('should aggregate feedback statistics correctly via GET /api/feedback/stats', async () => {
    await request(app)
      .post(`/api/audits/${auditId}/feedback`)
      .set({ 'x-client-id': 'c1' })
      .send({ findingType: 'claim', findingId: 'f1', verdict: 'correct' });

    await request(app)
      .post(`/api/audits/${auditId}/feedback`)
      .set({ 'x-client-id': 'c2' })
      .send({ findingType: 'claim', findingId: 'f1', verdict: 'correct' });

    await request(app)
      .post(`/api/audits/${auditId}/feedback`)
      .set({ 'x-client-id': 'c3' })
      .send({ findingType: 'safety', findingId: 'f2', verdict: 'incorrect' });

    const res = await request(app).get('/api/feedback/stats');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.correct).toBe(2);
    expect(res.body.incorrect).toBe(1);
    expect(res.body.accuracy).toBe(66.67);
    expect(res.body.byFindingType.claim.total).toBe(2);
    expect(res.body.byFindingType.claim.correct).toBe(2);
    expect(res.body.byFindingType.safety.incorrect).toBe(1);
  });

  it('should export feedback JSONL via GET /api/feedback/export', async () => {
    const res = await request(app).get('/api/feedback/export');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/x-jsonlines');
  });

  it('should trigger recalibration via POST /api/feedback/recalibrate', async () => {
    const res = await request(app)
      .post('/api/feedback/recalibrate')
      .set({ 'x-admin-key': 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.ece_before).toBeDefined();
    expect(res.body.ece_after).toBeDefined();
    expect(res.body.calibration_drift).toBeDefined();
  });
});
