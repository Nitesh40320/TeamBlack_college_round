import React, { useState } from 'react';
import { Claim, ReasoningIssue, ReasoningIssueType } from '../types/contract';
import { Card } from './Card';
import { VerdictBadge } from './VerdictBadge';
import {
  GitCommit,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Link as LinkIcon,
  Zap,
  ArrowRight,
  Info,
} from 'lucide-react';

export interface ReasoningGraphViewProps {
  claims: Claim[];
  reasoningIssues?: ReasoningIssue[];
  onSelectClaim?: (claim: Claim) => void;
}

const ISSUE_BADGE_STYLES: Record<
  ReasoningIssueType,
  { bg: string; border: string; text: string; label: string }
> = {
  NON_SEQUITUR: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/40',
    text: 'text-rose-300',
    label: 'Non-Sequitur (Invalid Inference)',
  },
  INTERNAL_CONTRADICTION: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    label: 'Internal Contradiction',
  },
  CIRCULAR: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/40',
    text: 'text-purple-300',
    label: 'Circular Reasoning',
  },
  OVERGENERALIZATION: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/40',
    text: 'text-orange-300',
    label: 'Overgeneralization',
  },
};

export const ReasoningGraphView: React.FC<ReasoningGraphViewProps> = ({
  claims = [],
  reasoningIssues = [],
  onSelectClaim,
}) => {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    reasoningIssues.length > 0 ? reasoningIssues[0].id : null
  );

  // Group reasoning issues by type
  const issueCounts = React.useMemo(() => {
    const counts: Record<ReasoningIssueType, number> = {
      NON_SEQUITUR: 0,
      INTERNAL_CONTRADICTION: 0,
      CIRCULAR: 0,
      OVERGENERALIZATION: 0,
    };
    reasoningIssues.forEach((issue) => {
      if (counts[issue.type] !== undefined) {
        counts[issue.type]++;
      }
    });
    return counts;
  }, [reasoningIssues]);

  // Clean empty state when no reasoning issues exist
  if (!reasoningIssues || reasoningIssues.length === 0) {
    return (
      <div className="space-y-6">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Automated Reasoning & Logical Consistency: Clear
                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  0 Issues
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                No premise-conclusion contradictions, circular logic, or non-sequitur inferences detected.
              </p>
            </div>
          </div>
        </div>

        {/* Claims Flow Graph Overview */}
        <Card title="Argument Dependency Flow">
          <div className="space-y-4">
            <p className="text-xs text-slate-400 font-mono">
              Evaluated {claims.length} claims for premise-conclusion entailment and logical consistency.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {claims.map((claim, idx) => (
                <div
                  key={claim.id}
                  onClick={() => onSelectClaim && onSelectClaim(claim)}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                      C{idx + 1}
                    </span>
                    <VerdictBadge verdict={claim.verdict} size="sm" />
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-2 font-sans group-hover:text-cyan-300">
                    "{claim.text}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Summary Stats Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Reasoning & Argument Flow Analysis
                <span className="text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {reasoningIssues.length} Issue{reasoningIssues.length > 1 ? 's' : ''}
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Evaluates premise-to-conclusion inferences, circular logic, and pairwise claim contradictions.
              </p>
            </div>
          </div>
        </div>

        {/* Issue Type Counts Chips */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {(
            [
              'NON_SEQUITUR',
              'INTERNAL_CONTRADICTION',
              'CIRCULAR',
              'OVERGENERALIZATION',
            ] as ReasoningIssueType[]
          ).map((type) => {
            const count = issueCounts[type] || 0;
            const style = ISSUE_BADGE_STYLES[type];

            return (
              <div
                key={type}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${style.bg} ${style.border} ${style.text}`}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                <span className="font-bold">{type}</span>
                <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-slate-950/60">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Argument Flow Graph Visualization */}
      <Card title="Argument Flow & Inference Graph">
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Visual representation of claim premises, inferences, and logical conflicts</span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Click an issue card to inspect
            </span>
          </div>

          {/* Graph Nodes & Edges Render */}
          <div className="p-6 rounded-2xl bg-slate-950 border border-white/10 space-y-8 relative overflow-hidden shadow-inner">
            {/* Background Grid Accent */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

            {/* Claims Nodes Grid */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {claims.map((claim, idx) => {
                // Find if this claim is involved in any reasoning issue
                const associatedIssues = reasoningIssues.filter((iss) =>
                  iss.claimIds.includes(claim.id)
                );
                const hasIssue = associatedIssues.length > 0;

                return (
                  <div
                    key={claim.id}
                    onClick={() => onSelectClaim && onSelectClaim(claim)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 relative ${
                      hasIssue
                        ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60 shadow-lg'
                        : 'bg-slate-900/80 border-white/10 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold border border-cyan-500/30">
                        C{idx + 1}
                      </span>
                      <VerdictBadge verdict={claim.verdict} size="sm" />
                    </div>

                    <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-relaxed">
                      "{claim.text}"
                    </p>

                    {hasIssue && (
                      <div className="pt-2 border-t border-rose-500/20 flex flex-wrap gap-1">
                        {associatedIssues.map((iss) => (
                          <span
                            key={iss.id}
                            className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                              ISSUE_BADGE_STYLES[iss.type].bg
                            } ${ISSUE_BADGE_STYLES[iss.type].text}`}
                          >
                            {iss.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reasoning Issue Connectors List */}
            <div className="relative z-10 pt-4 border-t border-white/10 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 font-mono">
                <LinkIcon className="w-4 h-4 text-cyan-400" />
                Detected Reasoning Flaws & Conflicts ({reasoningIssues.length})
              </h4>

              <div className="space-y-3">
                {reasoningIssues.map((issue) => {
                  const style = ISSUE_BADGE_STYLES[issue.type];
                  const isSelected = selectedIssueId === issue.id;

                  // Find involved claims
                  const involvedClaims = claims.filter((c) =>
                    issue.claimIds.includes(c.id)
                  );

                  return (
                    <div
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? `bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/50 shadow-xl`
                          : `bg-slate-900/60 ${style.border} hover:bg-slate-900`
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <span
                          className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${style.bg} ${style.border} ${style.text}`}
                        >
                          {style.label}
                        </span>
                        <span className="text-slate-400">
                          Involved Claims: [
                          {issue.claimIds
                            .map(
                              (cid) =>
                                `C${claims.findIndex((c) => c.id === cid) + 1}`
                            )
                            .join(', ')}
                          ]
                        </span>
                      </div>

                      {/* Premise -> Conclusion / Conflict Connector Flow */}
                      {involvedClaims.length >= 2 ? (
                        <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5 flex flex-col sm:flex-row items-center gap-3 text-xs">
                          <div className="flex-1 p-2 rounded bg-slate-900 border border-white/5">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                              Premise Claim:
                            </span>
                            <p className="text-slate-200 line-clamp-1 font-medium">
                              "{involvedClaims[0].text}"
                            </p>
                          </div>

                          <div className="flex flex-col items-center shrink-0">
                            {issue.type === 'INTERNAL_CONTRADICTION' ? (
                              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                                ⚡ Conflicts With ⚡
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                                Does Not Entail <ArrowRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>

                          <div className="flex-1 p-2 rounded bg-slate-900 border border-white/5">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                              Conclusion Claim:
                            </span>
                            <p className="text-slate-200 line-clamp-1 font-medium">
                              "{involvedClaims[1].text}"
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5 text-xs text-slate-300">
                          <span className="font-mono text-[10px] text-slate-400 uppercase font-bold">
                            Claim text:
                          </span>
                          <p className="line-clamp-1">
                            "{involvedClaims[0]?.text || 'Target Claim'}"
                          </p>
                        </div>
                      )}

                      {/* Explanation Rationale */}
                      <p className="text-xs text-slate-200 leading-relaxed font-sans pt-1">
                        <strong>Rationale:</strong> {issue.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
