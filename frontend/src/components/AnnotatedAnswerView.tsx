import React, { useState } from 'react';
import { Claim, Verdict, ErrorCategory } from '../types/contract';
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
} from 'lucide-react';

export interface AnnotatedAnswerViewProps {
  answer: string;
  claims: Claim[];
  selectedClaim: Claim | null;
  onSelectClaim: (claim: Claim) => void;
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
  selectedClaim,
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
  });

  // Highlight Style Mapper by Verdict
  const getHighlightStyle = (
    verdict: Verdict,
    isErrorSpan: boolean,
    isSelected: boolean
  ): { containerStyle: string; underlineStyle: string } => {
    let containerStyle = '';
    let underlineStyle = '';

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

          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            {/* Contradicted Legend */}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
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
          <span>Hover or Tab through highlights, press Enter to open claim detail</span>
        </div>

        <div className="pt-2 text-slate-200 leading-loose">
          {segments.map((segment) => {
            if (!segment.isHighlighted || !segment.claim) {
              return <span key={segment.id}>{segment.text}</span>;
            }

            const isSelected = selectedClaim?.id === segment.claim.id;
            const isHovered = hoveredSegmentId === segment.id;

            const { containerStyle, underlineStyle } = getHighlightStyle(
              segment.verdict || 'SUPPORTED',
              !!segment.isErrorSpan,
              isSelected
            );

            return (
              <span key={segment.id} className="relative inline">
                <mark
                  tabIndex={0}
                  role="button"
                  aria-label={`Claim: ${segment.claim.text}. Verdict: ${segment.verdict}`}
                  onClick={() => onSelectClaim(segment.claim!)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectClaim(segment.claim!);
                    }
                  }}
                  onMouseEnter={() => setHoveredSegmentId(segment.id)}
                  onMouseLeave={() => setHoveredSegmentId(null)}
                  onFocus={() => setHoveredSegmentId(segment.id)}
                  onBlur={() => setHoveredSegmentId(null)}
                  className={`px-1.5 py-0.5 mx-0.5 rounded-md font-medium cursor-pointer transition-all duration-150 inline-flex items-center gap-1 border ${containerStyle} ${underlineStyle} focus:outline-none focus:ring-2 focus:ring-cyan-400`}
                >
                  <span>{segment.text}</span>
                  {segment.verdict === 'CONTRADICTED' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 inline ml-0.5" />
                  )}
                  {segment.verdict === 'UNSUPPORTED' && (
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 inline ml-0.5" />
                  )}
                  {segment.verdict === 'SUPPORTED' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 inline ml-0.5" />
                  )}
                </mark>

                {/* Hover Tooltip Popover */}
                {(isHovered || isSelected) && (
                  <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-xl bg-slate-900 border border-white/20 text-slate-100 shadow-2xl text-xs space-y-2 animate-fadeIn pointer-events-none">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <VerdictBadge verdict={segment.verdict || 'SUPPORTED'} size="sm" />
                      {segment.category && (
                        <span className="font-mono text-[10px] uppercase font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                          {CATEGORY_LABELS[segment.category] || segment.category}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 font-sans leading-normal">
                      {segment.claim.explanation || 'No rationale explanation provided.'}
                    </p>
                    <div className="text-[10px] text-cyan-400 font-mono pt-1 flex items-center justify-between border-t border-white/5">
                      <span>Click to view evidence & drawer</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
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
