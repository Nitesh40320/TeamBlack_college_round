import { describe, it, expect } from 'vitest';
import { createAudit, getAuditById, listAudits } from '../api/apiClient';

describe('apiClient module', () => {
  it('creates an audit and caches result for fallback', async () => {
    const payload = {
      question: 'Test prompt?',
      answer: 'Test answer text for audit.',
      sources: [
        {
          id: 'src-1',
          title: 'Source Title 1',
          text: 'Source text content',
        },
      ],
    };

    const result = await createAudit(payload);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.claims.length).toBeGreaterThan(0);

    // Fetch created audit by ID
    const fetched = await getAuditById(result.id);
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(result.id);
  });

  it('lists audits with fallback data', async () => {
    const list = await listAudits();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});
