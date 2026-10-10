import React, { useState, useRef, useEffect } from 'react';
import { Confidence } from '../types/contract';
import { Info, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface ConfidenceMeterProps {
  confidence?: Confidence | null;
  compact?: boolean;
  className?: string;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  confidence,
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!confidence) {
    return null;
  }

  const { score = 0, level = 'medium', uncertaintyReasons = [] } = confidence;
  const pct = Math.round((score <= 1.0 ? score : score / 100.0) * 100);

  const getLevelConfig = () => {
    switch (level) {
      case 'high':
        return {
          badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          barBg: 'bg-emerald-500',
          glow: 'shadow-emerald-500/20',
          label: 'High Confidence',
        };
      case 'medium':
        return {
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          barBg: 'bg-amber-500',
          glow: 'shadow-amber-500/20',
          label: 'Medium Confidence',
        };
      case 'low':
      default:
        return {
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          barBg: 'bg-rose-500',
          glow: 'shadow-rose-500/20',
          label: 'Low Confidence',
        };
    }
  };

  const config = getLevelConfig();

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg transition-all border ${
          config.badgeBg
        } ${
          compact
            ? 'px-2 py-0.5 text-xs'
            : 'px-2.5 py-1 text-xs font-medium hover:scale-[1.02]'
        }`}
        title="Click to view confidence analysis & uncertainty reasons"
      >
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 opacity-80" />
          <span className="font-semibold">{pct}%</span>
          <span className="opacity-70 capitalize text-[10px] hidden sm:inline">
            ({level})
          </span>
        </span>

        {/* Mini progress bar */}
        <div className="w-8 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full ${config.barBg} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <Info className="w-3.5 h-3.5 opacity-60 hover:opacity-100 shrink-0 ml-0.5" />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-4 rounded-xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${config.barBg} ${config.glow}`}
              />
              <span className="font-semibold text-xs text-slate-200">
                Finding Confidence: {pct}% ({config.label})
              </span>
            </div>
          </div>

          {/* CRITICAL DISCLAIMER */}
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 leading-relaxed mb-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
            <div>
              <span className="font-semibold">Important Disclaimer:</span> Confidence
              describes how sure the system is about this finding and is{' '}
              <strong className="text-white underline decoration-cyan-400">
                never a correctness guarantee
              </strong>
              .
            </div>
          </div>

          {/* Uncertainty Reasons */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>
                {uncertaintyReasons.length > 0
                  ? 'Uncertainty Reasons & Signals'
                  : 'Confidence Signals'}
              </span>
            </div>

            {uncertaintyReasons.length > 0 ? (
              <ul className="space-y-1">
                {uncertaintyReasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-white/5 flex items-start gap-2"
                  >
                    <span className="text-amber-400 font-bold text-xs">·</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-emerald-400/90 bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                ✓ Strong source grounding and high NLI entailment agreement across
                all verification checks.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
