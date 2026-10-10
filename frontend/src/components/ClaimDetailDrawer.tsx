import React from 'react';
import { Claim, Source, SourceSpan, EvidenceRelation } from '../types/contract';
import { VerdictBadge } from './VerdictBadge';
import {
  X,
  CheckCircle2,
  XCircle,
  BookOpen,
  ExternalLink,
  ShieldAlert,
  Hash,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';

import { ConfidenceMeter } from './ConfidenceMeter';
import { FeedbackButtons } from './FeedbackButtons';
import { JudgesPopover } from './JudgesPopover';

interface ClaimDetailDrawerProps {
  claim: Claim | null;
  isOpen: boolean;
  onClose: () => void;
  sources?: Source[];
  onViewInSource: (sourceId: string, span: SourceSpan, label?: string) => void;
  auditId?: string;
}

export const ClaimDetailDrawer: React.FC<ClaimDetailDrawerProps> = ({
  claim,
  isOpen,
  onClose,
  sources = [],
  onViewInSource,
  auditId = 'audit-active',
}) => {
  if (!isOpen || !claim) return null;

  // Lookup source title by ID
  const getSourceTitle = (sourceId: string) => {
    const found = sources.find((s) => s.id === sourceId);
    return found ? found.title : `Source (${sourceId})`;
  };

  // Group evidence by relation
  const supportsEvidence = claim.evidence?.filter((e) => e.relation === 'supports') || [];
  const contradictsEvidence = claim.evidence?.filter((e) => e.relation === 'contradicts') || [];
  const relatedEvidence = claim.evidence?.filter((e) => e.relation === 'related') || [];

  // Highlight matched span or target terms within evidence passage text
  const renderHighlightedPassage = (text: string, span: SourceSpan) => {
    return (
      <p className="text-xs text-slate-200 font-sans leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-white/5 relative">
        <span className="bg-cyan-500/20 text-cyan-200 border-b border-cyan-400/60 font-medium px-1 py-0.5 rounded">
          {text}
        </span>
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Semi-transparent Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer Container Panel */}
      <div className="relative w-full max-w-2xl bg-slate-900 border-l border-white/10 shadow-2xl overflow-y-auto z-10 flex flex-col justify-between transform transition-transform duration-300 animate-slideLeft">
        {/* Drawer Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 p-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-slate-800 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              ID
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Claim Breakdown & Rationale
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                <Layers className="w-4 h-4 text-cyan-400" /> Detail Inspector
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <VerdictBadge verdict={claim.verdict} size="md" />
            <JudgesPopover judgeVotes={claim.judgeVotes} contested={claim.contested} />
            <FeedbackButtons
              auditId={auditId}
              findingId={claim.id}
              findingType="claim"
            />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors border border-white/10"
              aria-label="Close Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Main Extracted Claim Card */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Extracted Claim Text
              </span>
              <ConfidenceMeter confidence={claim.confidence} />
            </div>
            <blockquote className="text-base font-semibold text-slate-100 italic border-l-2 border-cyan-500 pl-4 py-1 leading-snug">
              "{claim.text}"
            </blockquote>

            {/* Metadata Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono">
                Type: {claim.claimType}
              </span>
              {claim.errorCategory && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold">
                  Error: {claim.errorCategory}
                </span>
              )}
              {claim.contested && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold animate-pulse">
                  ⚡ Contested
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/5 text-xs font-mono text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-500" /> Span: [{claim.answerSpan.start}, {claim.answerSpan.end}]
              </span>
            </div>
          </div>

          {/* Verification Rationale Section */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-cyan-400" /> Verification Rationale
            </span>
            <p className="text-sm text-slate-200 leading-relaxed">
              {claim.explanation}
            </p>

            {claim.confidence.uncertaintyReasons && claim.confidence.uncertaintyReasons.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
                <strong className="font-semibold text-amber-300">Uncertainty Notes:</strong>
                <ul className="list-disc list-inside space-y-0.5 text-amber-200/90">
                  {claim.confidence.uncertaintyReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Grouped Evidence Passages Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" /> Evidence Passages ({claim.evidence?.length || 0})
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                Grouped by Relationship
              </span>
            </div>

            {claim.evidence?.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 text-center text-slate-400 text-xs space-y-1">
                <ShieldAlert className="w-6 h-6 text-amber-400/80 mx-auto mb-2" />
                <p className="font-semibold text-slate-300">No Direct Source Evidence Found</p>
                <p>This claim could not be cross-referenced with any passage in the provided documentation.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. SUPPORTS SECTION */}
                {supportsEvidence.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Supports ({supportsEvidence.length})</span>
                    </div>

                    {supportsEvidence.map((ev, i) => (
                      <div
                        key={`sup-${i}`}
                        className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/20 space-y-3 shadow-md"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 font-mono flex items-center gap-1.5">
                            📄 {getSourceTitle(ev.sourceId)}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Relevance: {Math.round(ev.score * 100)}%
                          </span>
                        </div>

                        {renderHighlightedPassage(ev.text, ev.span)}

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                          <span className="font-mono text-slate-400">
                            Span: [{ev.span.start}, {ev.span.end}]
                          </span>
                          <button
                            onClick={() => onViewInSource(ev.sourceId, ev.span, 'Supports')}
                            className="inline-flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            View in Source text <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. CONTRADICTS SECTION */}
                {contradictsEvidence.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>Contradicts ({contradictsEvidence.length})</span>
                    </div>

                    {contradictsEvidence.map((ev, i) => (
                      <div
                        key={`con-${i}`}
                        className="p-4 rounded-xl bg-slate-950/90 border border-rose-500/20 space-y-3 shadow-md"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 font-mono flex items-center gap-1.5">
                            📄 {getSourceTitle(ev.sourceId)}
                          </span>
                          <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            Relevance: {Math.round(ev.score * 100)}%
                          </span>
                        </div>

                        {renderHighlightedPassage(ev.text, ev.span)}

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                          <span className="font-mono text-slate-400">
                            Span: [{ev.span.start}, {ev.span.end}]
                          </span>
                          <button
                            onClick={() => onViewInSource(ev.sourceId, ev.span, 'Contradicts')}
                            className="inline-flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            View in Source text <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. RELATED SECTION */}
                {relatedEvidence.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-white/10">
                      <BookOpen className="w-4 h-4 text-slate-400" />
                      <span>Related Context ({relatedEvidence.length})</span>
                    </div>

                    {relatedEvidence.map((ev, i) => (
                      <div
                        key={`rel-${i}`}
                        className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-3 shadow-md"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 font-mono flex items-center gap-1.5">
                            📄 {getSourceTitle(ev.sourceId)}
                          </span>
                          <span className="font-mono text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-white/10">
                            Relevance: {Math.round(ev.score * 100)}%
                          </span>
                        </div>

                        {renderHighlightedPassage(ev.text, ev.span)}

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                          <span className="font-mono text-slate-400">
                            Span: [{ev.span.start}, {ev.span.end}]
                          </span>
                          <button
                            onClick={() => onViewInSource(ev.sourceId, ev.span, 'Related')}
                            className="inline-flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            View in Source text <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-white/10 p-4 flex items-center justify-end z-20">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-white/10"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
