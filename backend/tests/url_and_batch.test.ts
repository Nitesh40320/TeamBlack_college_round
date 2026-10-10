import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import {
  validateUrlForSsrf,
  extractReadabilityContent,
} from '../src/services/urlIngestionService';
import { parseCsvBatch, parseJsonlBatch } from '../src/services/batchAuditService';

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

describe('URL Ingestion & SSRF Protection', () => {
  it('should block local/private IP addresses from SSRF', async () => {
    await expect(validateUrlForSsrf('http://localhost:8000')).rejects.toThrow();
    await expect(validateUrlForSsrf('http://127.0.0.1/admin')).rejects.toThrow();
    await expect(validateUrlForSsrf('http://169.254.169.254/latest/meta-data')).rejects.toThrow();
    await expect(validateUrlForSsrf('file:///etc/passwd')).rejects.toThrow();
  });

  it('should extract title and clean main text from HTML', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medical Guidelines 2024</title>
          <style>body { color: red; }</style>
        </head>
        <body>
          <nav>Navigation links</nav>
          <h1>Aspirin Dosage</h1>
          <p>The standard adult dose for antipyresis is 300 to 900 mg every 4 hours.</p>
          <script>console.log("ignore me");</script>
          <footer>Footer copyright</footer>
        </body>
      </html>
    `;

    const result = extractReadabilityContent(rawHtml, 'fallback.com');
    expect(result.title).toBe('Medical Guidelines 2024');
    expect(result.text).toContain('Aspirin Dosage');
    expect(result.text).toContain('The standard adult dose for antipyresis is 300 to 900 mg every 4 hours.');
    expect(result.text).not.toContain('Navigation links');
    expect(result.text).not.toContain('console.log');
  });

  it('POST /api/ingest/url should reject private URLs with 400 SSRF error', async () => {
    const res = await request(app)
      .post('/api/ingest/url')
      .send({ url: 'http://127.0.0.1/secret' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SSRF_PREVENTED');
  });
});

describe('Batch Audits Parsing & Controller', () => {
  it('should correctly parse CSV batch uploads', () => {
    const csvData = `question,answer,sourceTitle,sourceText
"What is aspirin dosage?","Aspirin standard dose is 300-900mg every 4 hours.","BNF 2024","The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours."
"Does aspirin cause fever?","Aspirin causes severe fever.","BNF 2024","Aspirin is indicated to reduce fever."`;

    const parsed = parseCsvBatch(csvData);
    expect(parsed.length).toBe(2);
    expect(parsed[0].answer).toBe('Aspirin standard dose is 300-900mg every 4 hours.');
    expect(parsed[0].sourceTitle).toBe('BNF 2024');
  });

  it('should correctly parse JSONL batch uploads', () => {
    const jsonlData = `{"question":"Dosage?","answer":"Dose is 300mg.","sourceText":"Recommended dose is 300mg."}
{"question":"Contraindications?","answer":"Avoid in children.","sourceText":"Aspirin is contraindicated under 16."}`;

    const parsed = parseJsonlBatch(jsonlData);
    expect(parsed.length).toBe(2);
    expect(parsed[1].answer).toBe('Avoid in children.');
  });

  it('POST /api/audits/batch should process a batch request payload', async () => {
    const payload = {
      items: [
        {
          question: 'What is aspirin dosage?',
          answer: 'Aspirin standard dose is 300-900 mg.',
          sources: [
            {
              id: 'src-1',
              title: 'BNF Monograph',
              text: 'The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours.',
            },
          ],
        },
      ],
    };

    const res = await request(app)
      .post('/api/audits/batch')
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.batchId).toBeDefined();
    expect(res.body.total).toBe(1);
    expect(res.body.audits.length).toBe(1);
  }, 30000);
});
