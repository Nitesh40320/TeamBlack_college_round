import React, { useState } from 'react';
import { JudgeVote } from '../types/contract';
import { VerdictBadge } from './VerdictBadge';
import { ShieldAlert, Scale, ChevronDown, CheckCircle, Info, Sparkles } from 'lucide-react';

interface JudgesPopoverProps {
  judgeVotes?: JudgeVote[];
  contested?: boolean;
}

export const JudgesPopover: React.FC<JudgesPopoverProps> = ({ judgeVotes = [], contested = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!judgeVotes || judgeVotes.length === 0) {
    if (!contested) return null;
  }

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <div className="flex items-center gap-1.5">
        {contested && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse shadow-sm shadow-amber-500/10">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            Contested
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-white/10 shadow-sm"
          aria-label="Toggle Judges Breakdown"
        >
          <Scale className="w-3.5 h-3.5 text-cyan-400" />
          <span>Judges ({judgeVotes.length || 3})</span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Popover Modal / Card */}
      {isOpen && (
        <>
          {/* Backdrop overlay to close when clicking outside */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl z-50 p-4 space-y-3 text-slate-100 animate-fadeIn">
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Multi-LLM Judge Votes
                </h4>
              </div>

              {contested ? (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" /> Contested
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Unanimous
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              Multiple LLM judge personas independently evaluated this claim against source passages. Disagreements trigger uncertainty flags.
            </p>

            {/* Judges Vote List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {judgeVotes.map((vote, idx) => (
                <div
                  key={vote.judgeId || `judge-${idx}`}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                    contested
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-200">{vote.name}</span>
                      <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-slate-800 text-slate-400 border border-white/5">
                        {vote.promptStyle}
                      </span>
                    </div>
                    <VerdictBadge verdict={vote.verdict} size="sm" />
                  </div>

                  <p className="text-[11px] text-slate-300 italic leading-relaxed">
                    "{vote.explanation}"
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-white/5">
                    <span>Judge Confidence: {Math.round((vote.confidenceScore || 0.85) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Popover Footer Note */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-cyan-400" /> Majority vote determines final verdict
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
