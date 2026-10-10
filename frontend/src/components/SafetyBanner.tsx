import React, { useState } from 'react';
import { SafetyFlag, SafetySeverity, Span } from '../types/contract';
import {
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Info,
  CheckCircle2,
} from 'lucide-react';

import { FeedbackButtons } from './FeedbackButtons';

export interface SafetyBannerProps {
  safetyFlags?: SafetyFlag[];
  onSelectSafetySpan?: (span: Span) => void;
  auditId?: string;
}

const SEVERITY_COLORS: Record<
  SafetySeverity,
  {
    bg: string;
    border: string;
    text: string;
    badge: string;
    iconColor: string;
  }
> = {
  high: {
    bg: 'bg-rose-500/10 hover:bg-rose-500/15',
    border: 'border-rose-500/30',
    text: 'text-rose-200',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    iconColor: 'text-rose-400',
  },
  medium: {
    bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-200',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    iconColor: 'text-amber-400',
  },
  low: {
    bg: 'bg-cyan-500/10 hover:bg-cyan-500/15',
    border: 'border-cyan-500/30',
    text: 'text-cyan-200',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    iconColor: 'text-cyan-400',
  },
};

export const SafetyBanner: React.FC<SafetyBannerProps> = ({
  safetyFlags = [],
  onSelectSafetySpan,
  auditId,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(
    safetyFlags.length > 0 ? safetyFlags[0].id : null
  );

  // Compute maximum severity
  const maxSeverity: SafetySeverity | 'none' = React.useMemo(() => {
    if (!safetyFlags || safetyFlags.length === 0) return 'none';
    if (safetyFlags.some((f) => f.severity === 'high')) return 'high';
    if (safetyFlags.some((f) => f.severity === 'medium')) return 'medium';
    return 'low';
  }, [safetyFlags]);

  // Clean empty state when no issues detected
  if (!safetyFlags || safetyFlags.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 flex items-center justify-between gap-4 shadow-md transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-100 flex items-center gap-2">
              Automated Safety Analysis: Clear
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                0 Safety Flags
              </span>
            </h3>
            <p className="text-xs text-emerald-300/80 mt-0.5">
              No medical, legal, or physical safety flags detected by automated checks.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-400/70 hidden sm:inline-block">
          Note: Automated safety checks do not constitute medical or legal advice.
        </span>
      </div>
    );
  }

  const topStyles = maxSeverity !== 'none' ? SEVERITY_COLORS[maxSeverity] : SEVERITY_COLORS.low;

  return (
    <div
      className={`rounded-2xl border ${topStyles.border} ${topStyles.bg} p-5 space-y-4 shadow-xl transition-all animate-fadeIn`}
    >
      {/* Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-slate-950/80 border ${topStyles.border} flex items-center justify-center ${topStyles.iconColor} shrink-0 shadow-lg`}
          >
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                Safety Analysis Warning
              </h2>
              <span
                className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${topStyles.badge}`}
              >
                Max Severity: {maxSeverity.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Detected {safetyFlags.length} potential risk flag
              {safetyFlags.length > 1 ? 's' : ''} in the generated response.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/5">
          <Info className="w-3.5 h-3.5 text-rose-400" />
          Review recommended safer alternatives below
        </span>
      </div>

      {/* Safety Flags Cards */}
      <div className="space-y-3">
        {safetyFlags.map((flag) => {
          const isExpanded = expandedId === flag.id;
          const styles = SEVERITY_COLORS[flag.severity] || SEVERITY_COLORS.low;

          return (
            <div
              key={flag.id}
              className={`rounded-xl bg-slate-950/80 border ${styles.border} transition-all overflow-hidden shadow-md`}
            >
              {/* Flag Accordion Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : flag.id)}
                className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <AlertTriangle className={`w-5 h-5 ${styles.iconColor} shrink-0 mt-0.5`} />
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles.badge}`}
                      >
                        Domain: {flag.domain}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles.badge}`}
                      >
                        Severity: {flag.severity}
                      </span>
                      {flag.answerSpan && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                          Span: [{flag.answerSpan.start}, {flag.answerSpan.end}]
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-100 leading-snug">
                      {flag.explanation}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <FeedbackButtons
                    auditId={auditId || 'audit-active'}
                    findingId={flag.id}
                    findingType="safety"
                  />
                  {onSelectSafetySpan && flag.answerSpan && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSafetySpan(flag.answerSpan);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all flex items-center gap-1 shrink-0"
                    >
                      Inspect Span <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  <button className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Flag Expanded Detail: Recommended Safer Alternative */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-white/10 bg-slate-900/60 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-emerald-400 uppercase font-mono tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Recommended Safer Alternative & Guidelines:
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-200 leading-relaxed font-sans">
                    {flag.recommendation ||
                      'No specific alternative recommendation specified.'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
