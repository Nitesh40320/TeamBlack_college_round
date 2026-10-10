import React from 'react';
import { AuditStatus } from '../types/contract';
import {
  Clock,
  FileSearch,
  CheckSquare,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface PipelineStepperProps {
  status: AuditStatus;
  totalClaims: number;
  verifiedClaims: number;
  error?: string;
  onRerun?: () => void;
  isRerunning?: boolean;
}

interface StepConfig {
  key: AuditStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const STEPS: StepConfig[] = [
  {
    key: 'queued',
    label: 'Queued',
    icon: Clock,
    description: 'Job queued',
  },
  {
    key: 'extracting',
    label: 'Extracting',
    icon: FileSearch,
    description: 'Extracting claims',
  },
  {
    key: 'verifying',
    label: 'Verifying',
    icon: CheckSquare,
    description: 'Cross-referencing sources',
  },
  {
    key: 'analyzing',
    label: 'Analyzing',
    icon: BrainCircuit,
    description: 'Reasoning & safety analysis',
  },
  {
    key: 'completed',
    label: 'Done',
    icon: CheckCircle2,
    description: 'Audit report complete',
  },
];

const STEP_ORDER: Record<AuditStatus, number> = {
  queued: 0,
  extracting: 1,
  verifying: 2,
  analyzing: 3,
  completed: 4,
  failed: -1,
};

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  status,
  totalClaims,
  verifiedClaims,
  error,
  onRerun,
  isRerunning = false,
}) => {
  const currentStepIndex = STEP_ORDER[status] ?? 0;
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed';
  const isPolling = !isCompleted && !isFailed;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-6 shadow-2xl space-y-6">
      {/* Top Info Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
              isFailed
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : isCompleted
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            }`}
          >
            {isFailed ? (
              <XCircle className="w-5 h-5" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Pipeline Execution Status
              </h2>
              {isPolling && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 animate-pulse">
                  <Sparkles className="w-3 h-3 text-cyan-400" /> Polling Live
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isFailed
                ? 'Audit pipeline encountered an error during execution.'
                : isCompleted
                ? 'Audit completed successfully. All claims verified.'
                : `Pipeline stage: ${status.toUpperCase()}...`}
            </p>
          </div>
        </div>

        {/* Claims Verified Pill & Rerun Action */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-xs font-mono font-semibold text-cyan-300 flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              claims verified {verifiedClaims}/{totalClaims}
            </span>
          </div>

          {(isFailed || isCompleted) && onRerun && (
            <button
              onClick={onRerun}
              disabled={isRerunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
              {isRerunning ? 'Rerunning...' : 'Rerun Audit'}
            </button>
          )}
        </div>
      </div>

      {/* Stepper Bar */}
      <div className="grid grid-cols-5 gap-2 sm:gap-4 relative">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isStepCompleted = !isFailed && currentStepIndex > idx;
          const isStepCurrent = !isFailed && currentStepIndex === idx;
          const isStepPending = !isFailed && currentStepIndex < idx;

          let iconBoxStyle = 'bg-slate-950 border-white/10 text-slate-500';
          let labelStyle = 'text-slate-500';
          let lineStyle = 'bg-slate-800';

          if (isStepCompleted) {
            iconBoxStyle = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
            labelStyle = 'text-emerald-400 font-semibold';
            lineStyle = 'bg-emerald-500/50';
          } else if (isStepCurrent) {
            iconBoxStyle = 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse';
            labelStyle = 'text-cyan-300 font-bold';
            lineStyle = 'bg-cyan-500/30';
          } else if (isFailed && idx === currentStepIndex) {
            iconBoxStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/30';
            labelStyle = 'text-rose-400 font-bold';
            lineStyle = 'bg-rose-500/40';
          }

          return (
            <div key={step.key} className="flex flex-col items-center text-center group relative">
              {/* Connector Line to next step */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`absolute top-5 left-[60%] right-[-40%] h-0.5 ${lineStyle} transition-colors duration-300 z-0`}
                />
              )}

              {/* Step Icon Node */}
              <div
                className={`w-10 h-10 rounded-full border flex items-center justify-center z-10 transition-all duration-300 ${iconBoxStyle}`}
              >
                {isStepCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : isStepCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-300" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              {/* Step Label */}
              <span className={`text-xs mt-2 transition-colors ${labelStyle}`}>
                {step.label}
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5 max-w-[90px] truncate">
                {step.description}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error Details Banner if Failed */}
      {isFailed && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Pipeline Failed
              </h4>
              <p className="text-xs text-rose-200 leading-relaxed">
                {error || 'An unexpected error occurred during processing. Please try rerunning the audit.'}
              </p>
            </div>
          </div>

          {onRerun && (
            <button
              onClick={onRerun}
              disabled={isRerunning}
              className="shrink-0 px-4 py-2 rounded-xl bg-rose-500 text-slate-950 font-semibold text-xs hover:bg-rose-400 transition-all shadow-md flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
              Retry Rerun
            </button>
          )}
        </div>
      )}
    </div>
  );
};
