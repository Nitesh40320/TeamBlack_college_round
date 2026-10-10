import React, { useState } from 'react';
import { Claim, Verdict, ErrorCategory, ReasoningIssue, SafetyFlag, Span } from '../types/contract';
import { segmentAnswerSpans, TextSegment } from '../utils/spanSegmenter';
import { VerdictBadge } from './VerdictBadge';
import {
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Filter,
  ShieldAlert,
  Info,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  GitCommit,
  Sparkles,
} from 'lucide-react';

export interface AnnotatedAnswerViewProps {
  answer: string;
  claims: Claim[];
  reasoningIssues?: ReasoningIssue[];
  safetyFlags?: SafetyFlag[];
  selectedClaim?: Claim | null;
  selectedSpan?: Span | null;
  onSelectClaim?: (claim: Claim) => void;
}

const CATEGORY_LABELS: Record<ErrorCategory | 'NONE', string> = {
  HALLUCINATED_FACT: 'Hallucinated Fact',
  CONTRADICTS_SOURCE: 'Contradicts Source',
  UNSUPPORTED_CLAIM: 'Unsupported Claim',
  NUMERIC_MISMATCH: 'Numeric Mismatch',
  ENTITY_MISMATCH: 'Entity Mismatch',
  AMBIGUOUS_STATEMENT: 'Ambiguous Statement',
  NONE: 'No Category',
};

export const AnnotatedAnswerView: React.FC<AnnotatedAnswerViewProps> = ({
  answer,
  claims,
  reasoningIssues = [],
  safetyFlags = [],
  selectedClaim,
  selectedSpan,
  onSelectClaim,
}) => {
  // Local Filter & Toggle State
  const [selectedVerdict, setSelectedVerdict] = useState<Verdict | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | 'ALL'>('ALL');
  const [showOnlyProblems, setShowOnlyProblems] = useState<boolean>(false);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

  // Compute segmented text
  const segments = segmentAnswerSpans(answer, claims, {
    selectedVerdict,
    selectedCategory,
    showOnlyProblems,
    reasoningIssues,
    safetyFlags,
  });

  // Check if a segment overlaps with safetyFlags or reasoningIssues
  const getOverlappingSafety = (segStart: number, segEnd: number): SafetyFlag | undefined => {
    return safetyFlags.find(
      (sf) => sf.answerSpan && !(sf.answerSpan.end <= segStart || sf.answerSpan.start >= segEnd)
    );
  };

  const getOverlappingReasoning = (segStart: number, segEnd: number): ReasoningIssue | undefined => {
    return reasoningIssues.find(
      (ri) => ri.answerSpan && !(ri.answerSpan.end <= segStart || ri.answerSpan.start >= segEnd)
    );
  };

  // Highlight Style Mapper by Verdict / Safety / Reasoning
  const getHighlightStyle = (
    verdict: Verdict | undefined,
    isErrorSpan: boolean,
    isSelected: boolean,
    safetyFlag?: SafetyFlag,
    reasoningIssue?: ReasoningIssue
  ): { containerStyle: string; underlineStyle: string } => {
    let containerStyle = '';
    let underlineStyle = '';

    if (safetyFlag) {
      containerStyle = 'bg-rose-500/25 text-rose-100 border-rose-500/50 shadow-sm shadow-rose-500/20 animate-pulse';
      underlineStyle = 'underline decoration-rose-500 decoration-wavy decoration-2 font-semibold';
    } else if (reasoningIssue) {
      containerStyle = 'bg-violet-500/20 text-violet-100 border-violet-500/40 shadow-sm shadow-violet-500/20';
      underlineStyle = 'underline decoration-violet-400 decoration-dashed decoration-2 font-semibold';
    } else {
      switch (verdict) {
        case 'CONTRADICTED':
          containerStyle = isErrorSpan
            ? 'bg-rose-500/20 text-rose-100 border-rose-500/40'
            : 'bg-rose-500/10 text-rose-200 border-rose-500/20';
          underlineStyle = 'underline decoration-rose-500 decoration-wavy decoration-2';
          break;
        case 'UNSUPPORTED':
          containerStyle = isErrorSpan
            ? 'bg-amber-500/20 text-amber-100 border-amber-500/40'
            : 'bg-amber-500/10 text-amber-200 border-amber-500/20';
          underlineStyle = 'underline decoration-amber-400 decoration-dashed decoration-2';
          break;
        case 'AMBIGUOUS':
          containerStyle = 'bg-purple-500/15 text-purple-200 border-purple-500/30';
          underlineStyle = 'underline decoration-purple-400 decoration-dotted decoration-2';
          break;
        case 'UNVERIFIABLE':
          containerStyle = 'bg-slate-800/60 text-slate-200 border-slate-700';
          underlineStyle = 'underline decoration-slate-400 decoration-dotted decoration-2';
          break;
        case 'SUPPORTED':
        default:
          containerStyle = 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20';
          underlineStyle = 'underline decoration-emerald-500/60 decoration-solid decoration-1';
          break;
      }
    }

    if (isSelected) {
      containerStyle += ' ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-cyan-500/20';
    }

    return { containerStyle, underlineStyle };
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Legend & Filter Toolbar */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4 shadow-lg">
        {/* Top Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Annotated Highlights Legend
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium">
            {/* Safety Legend */}
            {safetyFlags.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span className="underline decoration-rose-500 decoration-wavy">
                  Safety Warning ({safetyFlags.length})
                </span>
              </span>
            )}

            {/* Reasoning Legend */}
            {reasoningIssues.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold">
                <GitCommit className="w-3.5 h-3.5 text-violet-400" />
                <span className="underline decoration-violet-400 decoration-dashed">
                  Reasoning Flaw ({reasoningIssues.length})
                </span>
              </span>
            )}

            {/* Contradicted Legend */}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="underline decoration-rose-500 decoration-wavy font-semibold">
                Contradicted
              </span>
            </span>

            {/* Unsupported Legend */}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="underline decoration-amber-400 decoration-dashed font-semibold">
                Unsupported
              </span>
            </span>

            {/* Ambiguous Legend */}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="underline decoration-purple-400 decoration-dotted font-semibold">
                Ambiguous
              </span>
            </span>

            {/* Supported Legend */}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="underline decoration-emerald-400 decoration-solid font-semibold">
                Supported
              </span>
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Verdict Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-mono mr-1">Verdict:</span>
            {(['ALL', 'CONTRADICTED', 'UNSUPPORTED', 'AMBIGUOUS', 'UNVERIFIABLE', 'SUPPORTED'] as const).map(
              (v) => (
                <button
                  key={v}
                  onClick={() => setSelectedVerdict(v)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all ${
                    selectedVerdict === v
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {v}
                </button>
              )
            )}
          </div>

          {/* Show Only Problems Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-white/5 hover:border-cyan-500/30 transition-all select-none">
            <input
              type="checkbox"
              checked={showOnlyProblems}
              onChange={(e) => setShowOnlyProblems(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950"
            />
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Show Only Problems
            </span>
          </label>
        </div>
      </div>

      {/* 2. Interactive Annotated Answer Renderer */}
      <div className="relative p-6 md:p-8 rounded-2xl bg-slate-950/90 border border-white/10 text-slate-100 font-sans text-base leading-relaxed space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Info className="w-4 h-4" /> AI Answer Text Highlights
          </span>
          <span>Hover or Tab through highlights, press Enter to view details</span>
        </div>

        <div className="pt-2 text-slate-200 leading-loose">
          {segments.map((segment) => {
            const safetyFlag = getOverlappingSafety(segment.start, segment.end);
            const reasoningIssue = getOverlappingReasoning(segment.start, segment.end);

            if (!segment.isHighlighted && !safetyFlag && !reasoningIssue) {
              return <span key={segment.id}>{segment.text}</span>;
            }

            const isClaimSelected = segment.claim && selectedClaim?.id === segment.claim.id;
            const isSpanSelected =
              selectedSpan && selectedSpan.start === segment.start && selectedSpan.end === segment.end;
            const isSelected = !!(isClaimSelected || isSpanSelected);

            const isHovered = hoveredSegmentId === segment.id;

            const { containerStyle, underlineStyle } = getHighlightStyle(
              segment.verdict,
              !!segment.isErrorSpan,
              isSelected,
              safetyFlag,
              reasoningIssue
            );

            return (
              <span key={segment.id} className="relative inline">
                <mark
                  tabIndex={0}
                  role="button"
                  aria-label={`Highlight: ${segment.text}`}
                  onClick={() => {
                    if (segment.claim && onSelectClaim) {
                      onSelectClaim(segment.claim);
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && segment.claim && onSelectClaim) {
                      e.preventDefault();
                      onSelectClaim(segment.claim);
                    }
                  }}
                  onMouseEnter={() => setHoveredSegmentId(segment.id)}
                  onMouseLeave={() => setHoveredSegmentId(null)}
                  onFocus={() => setHoveredSegmentId(segment.id)}
                  onBlur={() => setHoveredSegmentId(null)}
                  className={`px-1.5 py-0.5 mx-0.5 rounded-md font-medium cursor-pointer transition-all duration-150 inline-flex items-center gap-1 border ${containerStyle} ${underlineStyle} focus:outline-none focus:ring-2 focus:ring-cyan-400`}
                >
                  <span>{segment.text}</span>
                  {safetyFlag && (
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-300 shrink-0 inline ml-0.5" />
                  )}
                  {!safetyFlag && reasoningIssue && (
                    <GitCommit className="w-3.5 h-3.5 text-violet-300 shrink-0 inline ml-0.5" />
                  )}
                  {!safetyFlag && !reasoningIssue && segment.verdict === 'CONTRADICTED' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 inline ml-0.5" />
                  )}
                  {!safetyFlag && !reasoningIssue && segment.verdict === 'UNSUPPORTED' && (
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 inline ml-0.5" />
                  )}
                  {!safetyFlag && !reasoningIssue && segment.verdict === 'SUPPORTED' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 inline ml-0.5" />
                  )}
                </mark>

                {/* Hover Tooltip Popover */}
                {(isHovered || isSelected) && (
                  <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3.5 rounded-xl bg-slate-900 border border-white/20 text-slate-100 shadow-2xl text-xs space-y-2 animate-fadeIn pointer-events-none">
                    {/* Safety Flag Popover */}
                    {safetyFlag ? (
                      <>
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="font-mono text-[10px] uppercase font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-rose-400" />
                            Safety Flag ({safetyFlag.severity})
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Domain: {safetyFlag.domain}
                          </span>
                        </div>
                        <p className="text-slate-200 font-sans leading-normal">
                          {safetyFlag.explanation}
                        </p>
                        <div className="p-2 rounded bg-slate-950 border border-emerald-500/20 text-emerald-300 text-[11px]">
                          <strong>Safer Option:</strong> {safetyFlag.recommendation}
                        </div>
                      </>
                    ) : reasoningIssue ? (
                      /* Reasoning Issue Popover */
                      <>
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="font-mono text-[10px] uppercase font-bold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded border border-violet-500/40 flex items-center gap-1">
                            <GitCommit className="w-3 h-3 text-violet-400" />
                            {reasoningIssue.type}
                          </span>
                        </div>
                        <p className="text-slate-200 font-sans leading-normal">
                          {reasoningIssue.explanation}
                        </p>
                      </>
                    ) : (
                      /* Claim Verdict Popover */
                      <>
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <VerdictBadge verdict={segment.verdict || 'SUPPORTED'} size="sm" />
                          {segment.category && (
                            <span className="font-mono text-[10px] uppercase font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                              {CATEGORY_LABELS[segment.category] || segment.category}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 font-sans leading-normal">
                          {segment.claim?.explanation || 'No rationale explanation provided.'}
                        </p>
                        <div className="text-[10px] text-cyan-400 font-mono pt-1 flex items-center justify-between border-t border-white/5">
                          <span>Click to inspect claim & evidence</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
