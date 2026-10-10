import { describe, it, expect } from 'vitest';
import { segmentAnswerSpans } from '../utils/spanSegmenter';
import { Claim } from '../types/contract';

describe('spanSegmenter - Answer Text Segmentation & Overlap Resolution', () => {
  const sampleAnswer =
    'Aspirin is recommended for mild pain at 300-900 mg every 4 hours. High dose aspirin causes stomach ulceration.';

  const claimSupported: Claim = {
    id: 'c1',
    text: 'Aspirin is recommended for mild pain',
    answerSpan: { start: 0, end: 36 },
    claimType: 'factual',
    verdict: 'SUPPORTED',
    explanation: 'Found in source monograph.',
    evidence: [],
    confidence: { score: 0.95, level: 'high', uncertaintyReasons: [] },
  };

  const claimContradicted: Claim = {
    id: 'c2',
    text: 'Aspirin at 300-900 mg every 4 hours',
    answerSpan: { start: 27, end: 65 },
    errorSpan: { start: 40, end: 50 }, // "300-900 mg" error
    claimType: 'numeric',
    verdict: 'CONTRADICTED',
    errorCategory: 'NUMERIC_MISMATCH',
    explanation: 'Correct dose is 500mg according to guidelines.',
    evidence: [],
    confidence: { score: 0.9, level: 'high', uncertaintyReasons: [] },
  };

  const claimUnsupported: Claim = {
    id: 'c3',
    text: 'High dose aspirin causes stomach ulceration',
    answerSpan: { start: 67, end: 110 },
    claimType: 'causal',
    verdict: 'UNSUPPORTED',
    errorCategory: 'UNSUPPORTED_CLAIM',
    explanation: 'No evidence provided in sources regarding ulceration.',
    evidence: [],
    confidence: { score: 0.6, level: 'medium', uncertaintyReasons: [] },
  };

  it('returns a single plain text segment when claims list is empty', () => {
    const segments = segmentAnswerSpans(sampleAnswer, []);
    expect(segments).toHaveLength(1);
    expect(segments[0].isHighlighted).toBe(false);
    expect(segments[0].text).toBe(sampleAnswer);
  });

  it('segments text correctly for non-overlapping claims', () => {
    const segments = segmentAnswerSpans(sampleAnswer, [claimSupported, claimUnsupported]);
    
    // Should have:
    // 1. claimSupported (0..36)
    // 2. Plain text (36..67)
    // 3. claimUnsupported (67..110)
    expect(segments.length).toBeGreaterThanOrEqual(3);
    
    const hlSegments = segments.filter((s) => s.isHighlighted);
    expect(hlSegments).toHaveLength(2);
    expect(hlSegments[0].claim?.id).toBe('c1');
    expect(hlSegments[0].verdict).toBe('SUPPORTED');
    expect(hlSegments[1].claim?.id).toBe('c3');
    expect(hlSegments[1].verdict).toBe('UNSUPPORTED');
  });

  it('prioritizes explicit errorSpan over fallback answerSpan', () => {
    const segments = segmentAnswerSpans(sampleAnswer, [claimContradicted]);
    const hlSegment = segments.find((s) => s.isHighlighted);
    
    expect(hlSegment).toBeDefined();
    expect(hlSegment?.start).toBe(40);
    expect(hlSegment?.end).toBe(50);
    expect(hlSegment?.text).toBe('300-900 mg');
    expect(hlSegment?.isErrorSpan).toBe(true);
  });

  it('resolves overlapping spans by severity rank (CONTRADICTED wins over SUPPORTED)', () => {
    // claimSupported spans [0, 36]
    // claimContradicted errorSpan spans [40, 50], but if we make claimContradicted overlap [30, 45]:
    const overlappingContradicted: Claim = {
      ...claimContradicted,
      errorSpan: { start: 30, end: 45 },
    };

    const segments = segmentAnswerSpans(sampleAnswer, [claimSupported, overlappingContradicted]);

    // claimSupported [0..30]
    // overlappingContradicted [30..45] (CONTRADICTED wins priority over SUPPORTED)
    // plain text [45..end]
    const hlSegments = segments.filter((s) => s.isHighlighted);
    expect(hlSegments).toHaveLength(2);

    expect(hlSegments[0].claim?.id).toBe('c1');
    expect(hlSegments[0].start).toBe(0);
    expect(hlSegments[0].end).toBe(30);

    expect(hlSegments[1].claim?.id).toBe('c2');
    expect(hlSegments[1].start).toBe(30);
    expect(hlSegments[1].end).toBe(45);
    expect(hlSegments[1].verdict).toBe('CONTRADICTED');
  });

  it('filters out SUPPORTED claims when showOnlyProblems is true', () => {
    const segments = segmentAnswerSpans(sampleAnswer, [claimSupported, claimUnsupported], {
      showOnlyProblems: true,
    });

    const hlSegments = segments.filter((s) => s.isHighlighted);
    expect(hlSegments).toHaveLength(1);
    expect(hlSegments[0].claim?.id).toBe('c3');
  });

  it('filters by selectedVerdict and selectedCategory', () => {
    const segmentsVerdict = segmentAnswerSpans(
      sampleAnswer,
      [claimSupported, claimContradicted, claimUnsupported],
      { selectedVerdict: 'CONTRADICTED' }
    );
    const hlVerdict = segmentsVerdict.filter((s) => s.isHighlighted);
    expect(hlVerdict).toHaveLength(1);
    expect(hlVerdict[0].claim?.id).toBe('c2');

    const segmentsCat = segmentAnswerSpans(
      sampleAnswer,
      [claimSupported, claimContradicted, claimUnsupported],
      { selectedCategory: 'UNSUPPORTED_CLAIM' }
    );
    const hlCat = segmentsCat.filter((s) => s.isHighlighted);
    expect(hlCat).toHaveLength(1);
    expect(hlCat[0].claim?.id).toBe('c3');
  });

  it('safely handles out-of-bounds or invalid spans without crashing', () => {
    const invalidClaim: Claim = {
      ...claimSupported,
      id: 'c-invalid',
      answerSpan: { start: 50, end: 10 }, // end < start
      errorSpan: { start: -5, end: 2000 }, // out of bounds
    };

    const segments = segmentAnswerSpans(sampleAnswer, [invalidClaim]);
    expect(segments).toHaveLength(1);
    expect(segments[0].isHighlighted).toBe(false);
  });
});
