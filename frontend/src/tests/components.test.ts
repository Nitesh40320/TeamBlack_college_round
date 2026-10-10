import { describe, it, expect } from 'vitest';
import { MOCK_AUDIT_RESULT } from '../api/mockData';
import { Verdict } from '../types/contract';

describe('Audit Detail Components Logic & Filtering', () => {
  it('correctly calculates verified claims ratio', () => {
    const total = MOCK_AUDIT_RESULT.claims.length;
    const verified = MOCK_AUDIT_RESULT.claims.filter((c) => c.verdict).length;
    expect(total).toBeGreaterThan(0);
    expect(verified).toBe(total);
  });

  it('filters claims by verdict', () => {
    const verdictToFilter: Verdict = 'CONTRADICTED';
    const filtered = MOCK_AUDIT_RESULT.claims.filter((c) => c.verdict === verdictToFilter);
    expect(filtered.every((c) => c.verdict === 'CONTRADICTED')).toBe(true);
    expect(filtered.length).toBe(2);
  });

  it('sorts claims by severity correctly', () => {
    const severityRank: Record<Verdict, number> = {
      CONTRADICTED: 1,
      UNSUPPORTED: 2,
      AMBIGUOUS: 3,
      UNVERIFIABLE: 4,
      SUPPORTED: 5,
    };

    const sorted = [...MOCK_AUDIT_RESULT.claims].sort(
      (a, b) => severityRank[a.verdict] - severityRank[b.verdict]
    );

    expect(sorted[0].verdict).toBe('CONTRADICTED');
    expect(sorted[sorted.length - 1].verdict).toBe('SUPPORTED');
  });

  it('groups evidence by relation (supports, contradicts, related)', () => {
    const claim = MOCK_AUDIT_RESULT.claims[1]; // CONTRADICTED claim
    const supports = claim.evidence.filter((e) => e.relation === 'supports');
    const contradicts = claim.evidence.filter((e) => e.relation === 'contradicts');
    const related = claim.evidence.filter((e) => e.relation === 'related');

    expect(supports.length).toBe(0);
    expect(contradicts.length).toBe(1);
    expect(related.length).toBe(0);
  });
});
