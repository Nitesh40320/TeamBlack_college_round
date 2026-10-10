import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { AuditModel } from '../src/models/Audit';
import { SourceModel } from '../src/models/Source';
import { auditEvents } from '../src/services/auditOrchestrator';

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

describe('Full Backend Integration Test Suite', () => {
  const sampleAuditId = 'integration-audit-101';
  const now = new Date().toISOString();

  beforeEach(async () => {
    await new AuditModel({
      id: sampleAuditId,
      question: 'What is the capital of France?',
      answer: 'The capital of France is Paris. It has a population of 50 million.',
      status: 'completed',
      claims: [
        {
          id: 'c-1',
          text: 'The capital of France is Paris.',
          answerSpan: { start: 0, end: 30 },
          claimType: 'factual',
          verdict: 'SUPPORTED',
          explanation: 'Paris is indeed the capital of France.',
          evidence: [],
          confidence: { score: 0.98, level: 'high', uncertaintyReasons: [] },
        },
        {
          id: 'c-2',
          text: 'It has a population of 50 million.',
          answerSpan: { start: 31, end: 67 },
          claimType: 'numeric',
          verdict: 'CONTRADICTED',
          errorCategory: 'NUMERIC_MISMATCH',
          explanation: 'Paris population is approx 2.1 million.',
          evidence: [],
          confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
        },
      ],
      reasoningIssues: [
        {
          id: 'r-1',
          claimIds: ['c-2'],
          answerSpan: { start: 31, end: 67 },
          type: 'NON_SEQUITUR',
          explanation: 'Population figure is grossly exaggerated.',
          confidence: { score: 0.9, level: 'high', uncertaintyReasons: [] },
        },
      ],
      safetyFlags: [
        {
          id: 's-1',
          claimId: 'c-2',
          answerSpan: { start: 31, end: 67 },
          domain: 'demographics',
          severity: 'medium',
          explanation: 'Misleading demographic statistic.',
          recommendation: 'Verify against official census figures.',
        },
      ],
      overall: {
        score: 50,
        grade: 'F',
        summary: 'Verified 2 claim(s): 1 supported, 1 contradicted.',
        counts: { SUPPORTED: 1, CONTRADICTED: 1, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
      },
      meta: {
        timings: { totalMs: 50, chunkingMs: 5, extractionMs: 15, verificationMs: 20, analysisMs: 10 },
        modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
        mode: 'mock',
      },
      createdAt: now,
      updatedAt: now,
    }).save();
  });

  describe('1. Health & Readiness Probes', () => {
    it('GET /health should return 200 OK with status and uptime', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /readiness should return 200 ready when DB is connected', async () => {
      const res = await request(app).get('/readiness');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database).toBe('connected');
    });
  });

  describe('2. Hardening & Tracing Middleware', () => {
    it('should inject x-request-id header into responses', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should include Helmet security headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    });

    it('should serve Swagger UI OpenAPI docs at /api-docs', async () => {
      const res = await request(app).get('/api-docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Swagger UI');
    });
  });

  describe('3. SSE Event Streaming (GET /api/audits/:id/stream)', () => {
    it('should return 404 for non-existent audit stream', async () => {
      const res = await request(app).get('/api/audits/non-existent-id/stream');
      expect(res.status).toBe(404);
    });

    it('should stream initial state and event data for existing audit', async () => {
      const res = await request(app)
        .get(`/api/audits/${sampleAuditId}/stream`)
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain(`"auditId":"${sampleAuditId}"`);
      expect(res.text).toContain('"status":"completed"');
    });
  });

  describe('4. Audit History (Pagination, Search, Filtering & Sorting)', () => {
    beforeEach(async () => {
      // Add a second clean audit (Grade A, no safety flags)
      await new AuditModel({
        id: 'integration-audit-102',
        question: 'What is water made of?',
        answer: 'Water is composed of hydrogen and oxygen (H2O).',
        status: 'completed',
        claims: [
          {
            id: 'c-201',
            text: 'Water is composed of hydrogen and oxygen.',
            answerSpan: { start: 0, end: 42 },
            claimType: 'factual',
            verdict: 'SUPPORTED',
            explanation: 'Chemical formula H2O is confirmed.',
            evidence: [],
            confidence: { score: 0.99, level: 'high', uncertaintyReasons: [] },
          },
        ],
        reasoningIssues: [],
        safetyFlags: [],
        overall: {
          score: 100,
          grade: 'A',
          summary: 'All claims supported.',
          counts: { SUPPORTED: 1, CONTRADICTED: 0, UNSUPPORTED: 0, UNVERIFIABLE: 0, AMBIGUOUS: 0 },
        },
        meta: {
          timings: { totalMs: 30, chunkingMs: 2, extractionMs: 8, verificationMs: 12, analysisMs: 8 },
          modelVersions: { embedder: 'e', verifier: 'v', analyzer: 'a' },
          mode: 'mock',
        },
        createdAt: new Date(Date.now() - 10000).toISOString(),
        updatedAt: new Date(Date.now() - 10000).toISOString(),
      }).save();
    });

    it('should list audits with pagination', async () => {
      const res = await request(app).get('/api/audits?page=1&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('should search answer text using q parameter', async () => {
      const res = await request(app).get('/api/audits?q=Paris');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(sampleAuditId);
    });

    it('should filter audits by grade', async () => {
      const res = await request(app).get('/api/audits?grade=A');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('integration-audit-102');
    });

    it('should filter audits by verdict presence', async () => {
      const res = await request(app).get('/api/audits?verdict=CONTRADICTED');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(sampleAuditId);
    });

    it('should filter audits by safetyFlagged boolean', async () => {
      const flaggedRes = await request(app).get('/api/audits?safetyFlagged=true');
      expect(flaggedRes.status).toBe(200);
      expect(flaggedRes.body.data).toHaveLength(1);
      expect(flaggedRes.body.data[0].id).toBe(sampleAuditId);

      const unflaggedRes = await request(app).get('/api/audits?safetyFlagged=false');
      expect(unflaggedRes.status).toBe(200);
      expect(unflaggedRes.body.data).toHaveLength(1);
      expect(unflaggedRes.body.data[0].id).toBe('integration-audit-102');
    });

    it('should sort audits by score asc/desc', async () => {
      const ascRes = await request(app).get('/api/audits?sortBy=score&sortOrder=asc');
      expect(ascRes.status).toBe(200);
      expect(ascRes.body.data[0].id).toBe(sampleAuditId);
      expect(ascRes.body.data[0].overall.score).toBe(50);
    });
  });

  describe('5. Audit Report Exports (JSON, Markdown & PDF)', () => {
    it('GET /api/audits/:id/export?format=json should return full JSON audit document', async () => {
      const res = await request(app).get(`/api/audits/${sampleAuditId}/export?format=json`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sampleAuditId);
      expect(res.body.claims).toBeDefined();
    });

    it('GET /api/audits/:id/export?format=md should return Markdown attachment', async () => {
      const res = await request(app).get(`/api/audits/${sampleAuditId}/export?format=md`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('.md');
      expect(res.text).toContain('# Second Opinion Audit Report');
      expect(res.text).toContain('The capital of France is Paris.');
    });

    it('GET /api/audits/:id/export?format=pdf should return PDF binary stream', async () => {
      const res = await request(app)
        .get(`/api/audits/${sampleAuditId}/export?format=pdf`)
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('.pdf');
      // PDF binary header check %PDF-
      expect(res.body.toString('utf-8', 0, 4)).toBe('%PDF');
    });
  });
});
