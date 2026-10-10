import React, { useState, useEffect } from 'react';
import { Claim, ClaimCorrection, CorrectionsResponse } from '../types/contract';
import { generateCorrections } from '../api/apiClient';
import { VerdictBadge } from './VerdictBadge';
import {
  Wand2,
  CheckCircle2,
  ArrowRight,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Scissors,
  BookOpen,
  X,
  ShieldAlert,
} from 'lucide-react';

interface CorrectionsViewProps {
  auditId: string;
  claims: Claim[];
  answer?: string;
}

export const CorrectionsView: React.FC<CorrectionsViewProps> = ({ auditId, claims }) => {
  const [data, setData] = useState<CorrectionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showAppliedModal, setShowAppliedModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const problemClaims = claims.filter(
    (c) => c.verdict === 'CONTRADICTED' || c.verdict === 'UNSUPPORTED'
  );

  const fetchCorrections = async () => {
    if (problemClaims.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateCorrections(auditId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate corrections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, [auditId]);

  if (problemClaims.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-emerald-500/20 text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-100">All Claims Verified & Supported</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          No contradicted or unsupported claims were detected in this audit. No grounded rewrites required.
        </p>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-white/10 space-y-5 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Wand2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                Grounded Auto-Fixes & Rewrites
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Suggested Fixes ({problemClaims.length} Issue{problemClaims.length > 1 ? 's' : ''})
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchCorrections}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors border border-white/10 text-xs flex items-center gap-1.5"
            title="Re-generate Grounded Fixes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {data && (
            <button
              type="button"
              onClick={() => setShowAppliedModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
              <span>Apply all to produce corrected answer</span>
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-300 font-medium">
            Generating grounded rewrites and re-verifying against source documentation...
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List of Corrections Diff Views */}
      {data && data.corrections && (
        <div className="space-y-4">
          {data.corrections.map((corr, idx) => (
            <div
              key={corr.claimId || `corr-${idx}`}
              className="p-5 rounded-xl bg-slate-950/80 border border-white/10 space-y-3 shadow-inner"
            >
              {/* Claim Header & Verdict */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    Finding #{idx + 1}
                  </span>
                  <VerdictBadge verdict={corr.verdict} size="sm" />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Re-verified {corr.verifiedVerdict} ({Math.round(corr.verifiedScore * 100)}%)
                  </span>
                </div>
              </div>

              {/* Diff View Box: Original strikethrough -> Corrected */}
              <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Suggested Fix Diff View:</span>
                  <span className="font-bold text-cyan-400">Action: {corr.action.toUpperCase()}</span>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-3 pt-1">
                  {/* Original text with strikethrough */}
                  <div className="flex-1 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1 w-full">
                    <span className="text-[10px] uppercase font-mono text-rose-400 font-bold block">
                      Original Text:
                    </span>
                    <p className="line-through italic font-medium">"{corr.originalText}"</p>
                  </div>

                  <ArrowRight className="w-5 h-5 text-slate-500 shrink-0 hidden md:block" />

                  {/* Corrected rewrite or removal badge */}
                  {corr.action === 'rewrite' ? (
                    <div className="flex-1 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-1 w-full">
                      <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold block">
                        Grounded Rewrite:
                      </span>
                      <p className="font-semibold text-emerald-100">"{corr.suggestedText}"</p>
                    </div>
                  ) : (
                    <div className="flex-1 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1 w-full">
                      <span className="text-[10px] uppercase font-mono text-amber-400 font-bold flex items-center gap-1">
                        <Scissors className="w-3 h-3 text-amber-400" /> Action: Recommended Removal
                      </span>
                      <p className="text-amber-200/90 italic">
                        No supporting passage evidence exists in documentation. Removing claim resolves unverified assertion.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Grounded Citation Chip & Passage Quote */}
              {corr.supportingPassageText && (
                <div className="p-3 rounded-xl bg-slate-900/60 border border-cyan-500/20 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-300 font-bold">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Citation Chip: Source [{corr.supportingSourceId || 'src-1'}]</span>
                  </div>
                  <p className="text-slate-300 italic text-[11px] bg-slate-950/60 p-2 rounded border border-white/5">
                    "{corr.supportingPassageText}"
                  </p>
                </div>
              )}

              <p className="text-xs text-slate-400 italic">
                <strong>Rationale:</strong> {corr.explanation}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Applied Corrected Answer Modal */}
      {showAppliedModal && data && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-fadeIn" onClick={() => setShowAppliedModal(false)} />

          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/15 rounded-2xl shadow-2xl z-10 p-6 space-y-5 animate-scaleUp text-slate-100">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Fully Corrected & Grounded Answer
                </h3>
              </div>
              <button
                onClick={() => setShowAppliedModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              All grounded fixes and removals have been integrated. Every sentence in this rewritten answer is strictly verified against source documentation.
            </p>

            {/* Complete Corrected Answer Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2 relative shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" /> Verified Corrected Text
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(data.correctedAnswer)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" /> Copy Corrected Answer
                    </>
                  )}
                </button>
              </div>

              <div className="text-sm font-sans text-slate-100 leading-relaxed font-medium pt-2 border-t border-white/5">
                {data.correctedAnswer}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAppliedModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-white/10"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
