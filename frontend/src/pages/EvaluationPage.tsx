import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLatestEval } from '../api/apiClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  Award,
  BarChart3,
  CheckCircle2,
  AlertOctagon,
  Target,
  RefreshCw,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

export const EvaluationPage: React.FC = () => {
  const { data: evalData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['latest-eval'],
    queryFn: getLatestEval,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Activity className="w-10 h-10 text-cyan-400 animate-spin" />
        <p className="text-sm font-medium text-slate-400">
          Loading benchmark evaluation report...
        </p>
      </div>
    );
  }

  const {
    dataset_split = 'model/eval/data/test.jsonl',
    total_test_cases = 0,
    total_claims_evaluated = 0,
    macro_f1 = 0,
    contradiction_precision = 0,
    span_overlap_f1 = 0,
    brier_score = 0,
    ece = 0,
    per_verdict_metrics = {},
    reliability_diagram = [],
    status,
    message,
  } = evalData || {};

  // Format per-verdict metrics for BarChart
  const verdictChartData = Object.entries(per_verdict_metrics).map(
    ([verdict, metrics]: [string, any]) => ({
      verdict,
      Precision: Math.round((metrics.precision || 0) * 100),
      Recall: Math.round((metrics.recall || 0) * 100),
      'F1 Score': Math.round((metrics.f1 || 0) * 100),
      support: metrics.support || 0,
    })
  );

  // Format reliability diagram for LineChart
  const calibrationChartData = reliability_diagram.map((bin: any) => ({
    bin: bin.bin,
    'Avg Confidence': Math.round((bin.avg_confidence || 0) * 100),
    'Avg Accuracy': Math.round((bin.avg_accuracy || 0) * 100),
    'Ideal Calibration': Math.round(((bin.bin_min + bin.bin_max) / 2) * 100),
    count: bin.count,
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-white/10 bg-slate-900/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Evaluation Benchmark Suite</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            Model Evaluation & Calibration Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Dataset Split:</span>
            <code className="bg-slate-950 px-2 py-0.5 rounded text-cyan-300 font-mono">
              {dataset_split}
            </code>
            <span>·</span>
            <span>{total_test_cases} Test Cases</span>
            <span>·</span>
            <span>{total_claims_evaluated} Claims Evaluated</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold transition-all shrink-0 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Refresh Benchmark</span>
        </button>
      </div>

      {status === 'unavailable' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-3">
          <AlertOctagon className="w-5 h-5 shrink-0 text-amber-400" />
          <div>
            <span className="font-semibold">Notice:</span> {message || 'No live model evaluation results cached yet. Showing standard benchmark fallback report.'}
          </div>
        </div>
      )}

      {/* 5 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Macro F1 */}
        <div className="glass-card p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Macro F1 Score</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {(macro_f1 * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-cyan-400/80">Overall classification power</div>
        </div>

        {/* Contradiction Precision */}
        <div className="glass-card p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Contradiction Prec.</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">
            {(contradiction_precision * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-emerald-400/80">False alarm protection</div>
        </div>

        {/* Span Overlap F1 */}
        <div className="glass-card p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Span Overlap IoU</span>
            <Target className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-extrabold text-teal-300">
            {(span_overlap_f1 * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-teal-400/80">Exact span localization IoU</div>
        </div>

        {/* Brier Score */}
        <div className="glass-card p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Brier Score</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-purple-300">
            {brier_score.toFixed(4)}
          </div>
          <div className="text-[10px] text-purple-400/80">Calibration loss (lower is better)</div>
        </div>

        {/* ECE */}
        <div className="glass-card p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Expected Calib Error</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-300">
            {(ece * 100).toFixed(2)}%
          </div>
          <div className="text-[10px] text-amber-400/80">Confidence gap error (ECE)</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Per-Verdict Performance Bar Chart */}
        <div className="glass-card p-6 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <span>Per-Verdict Classification Breakdown (%)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Precision, Recall, and F1 metrics across verdict categories
            </p>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={verdictChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="verdict" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                <Bar dataKey="Precision" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Recall" fill="#818cf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="F1 Score" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reliability Diagram (Calibration Curve) */}
        <div className="glass-card p-6 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              <span>Reliability Diagram (Confidence Calibration)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Avg Predicted Confidence vs Empirical Accuracy across 10 confidence bins
            </p>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={calibrationChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="bin" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="Ideal Calibration"
                  stroke="#475569"
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Avg Confidence"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Avg Accuracy"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
