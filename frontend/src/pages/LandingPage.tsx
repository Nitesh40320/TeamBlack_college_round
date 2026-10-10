import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  GitGraph,
  Gauge,
  FileSearch,
  Play,
  Zap,
} from 'lucide-react';
import { Card } from '../components/Card';
import { useToast } from '../context/ToastContext';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleTryDemo = (demoId: string = 'demo-audit-001') => {
    showToast('Loading demo audit...', 'info');
    navigate(`/audit/${demoId}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-16 py-6">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Answer Auditing & Verification
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight">
          Audit LLM Answers Against Trusted Ground Truth
        </h1>

        <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Second Opinion verifies facts, highlights hallunicated claims with character offsets, detects broken logical inferences, and flags high-risk safety hazards.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <button
            onClick={() => handleTryDemo('demo-audit-001')}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:from-cyan-400 hover:to-teal-300 shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Try Demo Audit</span>
          </button>

          <Link
            to="/new"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
          >
            <span>Start Custom Audit</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Demo Presets Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" /> One-Click Demo Audit Examples
          </h2>
          <span className="text-xs text-slate-400">Pre-seeded with source documentation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            onClick={() => handleTryDemo('demo-audit-001')}
            className="cursor-pointer hover:border-cyan-500/40 transition-all hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                  Financial Discrepancy
                </span>
                <span className="text-xs font-mono font-bold text-rose-400">Grade F</span>
              </div>
              <h3 className="font-bold text-sm text-slate-200">Acme Corp Q3 Financial Report</h3>
              <p className="text-xs text-slate-400 line-clamp-2">
                Demonstrates numeric mismatch ($450M vs $350M) and contradicted YoY growth rate.
              </p>
              <div className="text-xs text-cyan-400 font-semibold flex items-center gap-1 pt-2">
                <span>View Full Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>

          <Card
            onClick={() => handleTryDemo('demo-audit-002')}
            className="cursor-pointer hover:border-amber-500/40 transition-all hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Medical Safety Hazard
                </span>
                <span className="text-xs font-mono font-bold text-rose-400">Grade F</span>
              </div>
              <h3 className="font-bold text-sm text-slate-200">Pediatric Dosage Advice</h3>
              <p className="text-xs text-slate-400 line-clamp-2">
                Demonstrates high severity medical safety flag (toxic dosage recommendation).
              </p>
              <div className="text-xs text-cyan-400 font-semibold flex items-center gap-1 pt-2">
                <span>View Full Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>

          <Card
            onClick={() => handleTryDemo('demo-audit-005')}
            className="cursor-pointer hover:border-emerald-500/40 transition-all hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Physics Benchmark
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">Grade A</span>
              </div>
              <h3 className="font-bold text-sm text-slate-200">Speed of Light Reference</h3>
              <p className="text-xs text-slate-400 line-clamp-2">
                Demonstrates pristine 100% supported claims against NIST physical constants.
              </p>
              <div className="text-xs text-cyan-400 font-semibold flex items-center gap-1 pt-2">
                <span>View Full Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Feature Capabilities */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
              <FileSearch className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-200">Span-Level Fact Alignment</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Highlights precise 0-based character spans in answer text and quotes verbatim evidence excerpts from uploaded PDF/Word/Text source documents.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
              <GitGraph className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-200">Reasoning Graph & Inference Audit</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Renders argument flow as an interactive graph connecting premise to conclusion while marking non-sequiturs, circular logic, and internal contradictions.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-200">Safety Guardrails Banner</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Detects medical overdose recommendations, legal misrepresentations, and financial hazards, providing prominent warnings and safer alternatives.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
              <Gauge className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-200">Calibrated Confidence Score</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Computes finding-level confidence from NLI probability margins, retrieval scores, multi-judge agreement, and claim ambiguity with clear popovers.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
