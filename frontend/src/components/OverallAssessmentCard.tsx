import React from 'react';
import { OverallScore, Claim, ReasoningIssue, SafetyFlag } from '../types/contract';
import { ShieldCheck, AlertTriangle, ChevronRight, Award, Gauge } from 'lucide-react';

interface OverallAssessmentCardProps {
  overall: OverallScore;
  claims: Claim[];
  reasoningIssues?: ReasoningIssue[];
  safetyFlags?: SafetyFlag[];
  onSelectFinding?: (findingId: string) => void;
  className?: string;
}

export const OverallAssessmentCard: React.FC<OverallAssessmentCardProps> = ({
  overall,
  claims = [],
  reasoningIssues = [],
  safetyFlags = [],
  onSelectFinding,
  className = '',
}) => {
  const { score = 0, grade = 'A', summary = '', counts } = overall;

  const totalClaims =
    (counts.SUPPORTED || 0) +
    (counts.CONTRADICTED || 0) +
    (counts.UNSUPPORTED || 0) +
    (counts.UNVERIFIABLE || 0) +
    (counts.AMBIGUOUS || 0) || 1;

  const getGradeStyle = (g: string) => {
    switch (g) {
      case 'A':
        return {
          bg: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
          glow: 'shadow-emerald-500/20',
          ring: 'stroke-emerald-400',
        };
      case 'B':
        return {
          bg: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30',
          glow: 'shadow-cyan-500/20',
          ring: 'stroke-cyan-400',
        };
      case 'C':
        return {
          bg: 'from-amber-500/20 to-yellow-500/10 text-amber-400 border-amber-500/30',
          glow: 'shadow-amber-500/20',
          ring: 'stroke-amber-400',
        };
      case 'D':
      case 'F':
      default:
        return {
          bg: 'from-rose-500/20 to-red-500/10 text-rose-400 border-rose-500/30',
          glow: 'shadow-rose-500/20',
          ring: 'stroke-rose-400',
        };
    }
  };

  const gradeStyle = getGradeStyle(grade);

  // Derive top 3 issues prioritized by severity
  const topIssues: Array<{
    id: string;
    title: string;
    type: 'safety' | 'reasoning' | 'claim';
    verdictBadge: string;
    badgeColor: string;
  }> = [];

  // 1. High safety flags
  for (const flag of safetyFlags) {
    if (topIssues.length < 3) {
      topIssues.push({
        id: flag.id,
        title: `Safety: ${flag.explanation || flag.recommendation}`,
        type: 'safety',
        verdictBadge: `SAFETY (${flag.severity.toUpperCase()})`,
        badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      });
    }
  }

  // 2. Reasoning issues
  for (const issue of reasoningIssues) {
    if (topIssues.length < 3) {
      topIssues.push({
        id: issue.id,
        title: `Reasoning: ${issue.explanation}`,
        type: 'reasoning',
        verdictBadge: issue.type,
        badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      });
    }
  }

  // 3. Contradicted claims
  for (const c of claims) {
    if (topIssues.length < 3 && c.verdict === 'CONTRADICTED') {
      topIssues.push({
        id: c.id,
        title: c.text,
        type: 'claim',
        verdictBadge: 'CONTRADICTED',
        badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      });
    }
  }

  // 4. Unsupported or Ambiguous claims
  for (const c of claims) {
    if (
      topIssues.length < 3 &&
      (c.verdict === 'UNSUPPORTED' || c.verdict === 'AMBIGUOUS')
    ) {
      topIssues.push({
        id: c.id,
        title: c.text,
        type: 'claim',
        verdictBadge: c.verdict,
        badgeColor:
          c.verdict === 'AMBIGUOUS'
            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
            : 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      });
    }
  }

  // SVG Gauge constants
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div
      className={`glass-card p-6 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl relative overflow-hidden ${className}`}
    >
      {/* Background Subtle Mesh Gradient */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
        {/* Left: Grade + Score Gauge */}
        <div className="flex items-center gap-6">
          {/* Circular Score Gauge */}
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                className={`${gradeStyle.ring} transition-all duration-1000 ease-out`}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black tracking-tight text-white">
                {Math.round(score)}
              </span>
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Score
              </span>
            </div>
          </div>

          {/* Letter Grade */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-xl border bg-gradient-to-r ${gradeStyle.bg} ${gradeStyle.glow} font-black text-2xl tracking-wide flex items-center gap-1.5 shadow-lg`}
              >
                <Award className="w-6 h-6 shrink-0" />
                <span>GRADE {grade}</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Factual Accuracy & Evidence Grounding</span>
            </div>
          </div>
        </div>

        {/* Right: Stacked Verdict Bar */}
        <div className="w-full lg:w-96 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
            <span>Verdict Breakdown</span>
            <span className="text-slate-400 font-mono">
              {totalClaims} Claims Extracted
            </span>
          </div>

          {/* Stacked Bar */}
          <div className="h-3.5 w-full bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-white/5">
            {counts.SUPPORTED > 0 && (
              <div
                className="h-full bg-emerald-500 rounded-sm transition-all"
                style={{ width: `${(counts.SUPPORTED / totalClaims) * 100}%` }}
                title={`SUPPORTED: ${counts.SUPPORTED}`}
              />
            )}
            {counts.CONTRADICTED > 0 && (
              <div
                className="h-full bg-rose-500 rounded-sm transition-all"
                style={{
                  width: `${(counts.CONTRADICTED / totalClaims) * 100}%`,
                }}
                title={`CONTRADICTED: ${counts.CONTRADICTED}`}
              />
            )}
            {counts.UNSUPPORTED > 0 && (
              <div
                className="h-full bg-amber-500 rounded-sm transition-all"
                style={{
                  width: `${(counts.UNSUPPORTED / totalClaims) * 100}%`,
                }}
                title={`UNSUPPORTED: ${counts.UNSUPPORTED}`}
              />
            )}
            {counts.AMBIGUOUS > 0 && (
              <div
                className="h-full bg-purple-500 rounded-sm transition-all"
                style={{ width: `${(counts.AMBIGUOUS / totalClaims) * 100}%` }}
                title={`AMBIGUOUS: ${counts.AMBIGUOUS}`}
              />
            )}
            {counts.UNVERIFIABLE > 0 && (
              <div
                className="h-full bg-slate-600 rounded-sm transition-all"
                style={{
                  width: `${(counts.UNVERIFIABLE / totalClaims) * 100}%`,
                }}
                title={`UNVERIFIABLE: ${counts.UNVERIFIABLE}`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between text-[11px] gap-2 pt-1 text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Supported ({counts.SUPPORTED || 0})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Contradicted ({counts.CONTRADICTED || 0})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Unsupported ({counts.UNSUPPORTED || 0})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Ambiguous ({counts.AMBIGUOUS || 0})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Executive Summary & Top 3 Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
        {/* Executive Summary */}
        <div className="lg:col-span-7 space-y-2">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Audit Executive Assessment</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-normal bg-slate-950/40 p-3.5 rounded-xl border border-white/5">
            {summary ||
              `Audit processed ${totalClaims} extracted statements against source documentation. Review highlighted spans below for grounded evidence and verification details.`}
          </p>
        </div>

        {/* Top 3 Issues Links */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Top Audit Findings ({topIssues.length})</span>
          </div>

          {topIssues.length > 0 ? (
            <div className="space-y-1.5">
              {topIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onSelectFinding && onSelectFinding(issue.id)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-white/5 hover:border-cyan-500/30 transition-all group flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded border uppercase ${issue.badgeColor}`}
                      >
                        {issue.verdictBadge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                      {issue.title}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-emerald-400 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
              ✓ No critical findings or contradictions detected in this audit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
