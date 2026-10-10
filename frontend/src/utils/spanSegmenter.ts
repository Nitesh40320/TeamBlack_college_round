import { Claim, Verdict, ErrorCategory } from '../types/contract';

export interface TextSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  isHighlighted: boolean;
  claim?: Claim;
  verdict?: Verdict;
  category?: ErrorCategory;
  isErrorSpan?: boolean;
}

export interface SegmentOptions {
  selectedVerdict?: Verdict | 'ALL';
  selectedCategory?: ErrorCategory | 'ALL';
  showOnlyProblems?: boolean;
}

const SEVERITY_RANK: Record<Verdict, number> = {
  CONTRADICTED: 1,
  UNSUPPORTED: 2,
  AMBIGUOUS: 3,
  UNVERIFIABLE: 4,
  SUPPORTED: 5,
};

/**
 * Segment answer text into sequential plain text and highlighted claim segments.
 * Overlapping spans are resolved deterministically using Verdict Severity Ranking:
 * CONTRADICTED > UNSUPPORTED > AMBIGUOUS > UNVERIFIABLE > SUPPORTED.
 *
 * Explicit errorSpans take precedence over fallback answerSpans.
 */
export function segmentAnswerSpans(
  answerText: string,
  claims: Claim[],
  options: SegmentOptions = {}
): TextSegment[] {
  if (!answerText) return [];

  const {
    selectedVerdict = 'ALL',
    selectedCategory = 'ALL',
    showOnlyProblems = false,
  } = options;

  // 1. Filter claims
  const eligibleClaims = (claims || []).filter((claim) => {
    if (!claim.verdict) return false;

    // Show only problems filter
    if (showOnlyProblems && claim.verdict === 'SUPPORTED') {
      return false;
    }

    // Verdict filter
    if (selectedVerdict !== 'ALL' && claim.verdict !== selectedVerdict) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      const claimCat = claim.errorCategory || 'NONE';
      if (claimCat !== selectedCategory) {
        return false;
      }
    }

    return true;
  });

  // 2. Build candidate highlights
  interface Candidate {
    claim: Claim;
    start: number;
    end: number;
    verdict: Verdict;
    category?: ErrorCategory;
    isErrorSpan: boolean;
    severity: number;
  }

  const candidates: Candidate[] = [];

  for (const claim of eligibleClaims) {
    let span = claim.errorSpan;
    let isErrorSpan = true;

    // Fall back to answerSpan if errorSpan is missing or invalid
    if (!span || span.start < 0 || span.end <= span.start || span.end > answerText.length) {
      span = claim.answerSpan;
      isErrorSpan = false;
    }

    if (!span || span.start < 0 || span.end <= span.start || span.end > answerText.length) {
      continue; // Skip invalid spans
    }

    candidates.push({
      claim,
      start: span.start,
      end: span.end,
      verdict: claim.verdict,
      category: claim.errorCategory,
      isErrorSpan,
      severity: SEVERITY_RANK[claim.verdict] ?? 5,
    });
  }

  // 3. Sort candidates by severity asc (Rank 1 highest), then isErrorSpan desc, length desc, start asc
  candidates.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity - b.severity;
    if (a.isErrorSpan !== b.isErrorSpan) return a.isErrorSpan ? -1 : 1;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.start - b.start;
  });

  // 4. Resolve overlapping intervals
  const covered: Array<{ start: number; end: number }> = [];
  const rawHighlights: Array<{
    claim: Claim;
    start: number;
    end: number;
    verdict: Verdict;
    category?: ErrorCategory;
    isErrorSpan: boolean;
  }> = [];

  for (const cand of candidates) {
    let currentStart = cand.start;
    const sortedCovered = [...covered].sort((x, y) => x.start - y.start);

    for (const cov of sortedCovered) {
      if (cov.end <= currentStart) continue;
      if (cov.start >= cand.end) break;

      if (currentStart < cov.start) {
        rawHighlights.push({
          claim: cand.claim,
          start: currentStart,
          end: Math.min(cov.start, cand.end),
          verdict: cand.verdict,
          category: cand.category,
          isErrorSpan: cand.isErrorSpan,
        });
      }
      currentStart = Math.max(currentStart, cov.end);
      if (currentStart >= cand.end) break;
    }

    if (currentStart < cand.end) {
      rawHighlights.push({
        claim: cand.claim,
        start: currentStart,
        end: cand.end,
        verdict: cand.verdict,
        category: cand.category,
        isErrorSpan: cand.isErrorSpan,
      });
    }

    covered.push({ start: cand.start, end: cand.end });
  }

  // 5. Sort raw highlights by start position ascending
  rawHighlights.sort((a, b) => a.start - b.start);

  // 6. Merge adjacent highlights belonging to the same claim if continuous
  const mergedHighlights: typeof rawHighlights = [];
  for (const hl of rawHighlights) {
    const prev = mergedHighlights[mergedHighlights.length - 1];
    if (prev && prev.claim.id === hl.claim.id && prev.end === hl.start) {
      prev.end = hl.end;
    } else {
      mergedHighlights.push({ ...hl });
    }
  }

  // 7. Interleave plain text segments and highlighted segments
  const segments: TextSegment[] = [];
  let cursor = 0;
  let segIndex = 0;

  for (const hl of mergedHighlights) {
    if (hl.start > cursor) {
      segments.push({
        id: `plain-${cursor}-${hl.start}`,
        text: answerText.slice(cursor, hl.start),
        start: cursor,
        end: hl.start,
        isHighlighted: false,
      });
    }

    segments.push({
      id: `hl-${hl.claim.id}-${hl.start}-${hl.end}-${segIndex++}`,
      text: answerText.slice(hl.start, hl.end),
      start: hl.start,
      end: hl.end,
      isHighlighted: true,
      claim: hl.claim,
      verdict: hl.verdict,
      category: hl.category,
      isErrorSpan: hl.isErrorSpan,
    });

    cursor = hl.end;
  }

  if (cursor < answerText.length) {
    segments.push({
      id: `plain-${cursor}-${answerText.length}`,
      text: answerText.slice(cursor),
      start: cursor,
      end: answerText.length,
      isHighlighted: false,
    });
  }

  return segments;
}
