import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { VerdictBadge } from '../components/VerdictBadge';
import { EmptyState } from '../components/EmptyState';
import { listAudits } from '../api/apiClient';
import { AuditResult, Verdict } from '../types/contract';
import { History, ArrowRight, Calendar, ShieldCheck } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [audits, setAudits] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await listAudits();
      setAudits(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading audit history...
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <EmptyState
        title="No Past Audits Found"
        description="You have not submitted any AI answers for auditing yet."
        action={
          <Link
            to="/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20"
          >
            Create Your First Audit
          </Link>
        }
      />
    );
  }

  const allVerdicts: Verdict[] = [
    'SUPPORTED',
    'CONTRADICTED',
    'UNSUPPORTED',
    'UNVERIFIABLE',
    'AMBIGUOUS',
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" /> Audit History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review past auditing reports, claims breakdowns, and safety evaluations.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {audits.map((item) => (
          <Card key={item.id} className="hover:border-cyan-500/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    ID: {item.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-sm text-slate-200 line-clamp-2">
                  {item.overall.summary}
                </p>

                {/* Verdict Tokens Pill Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {allVerdicts.map((v) => {
                    const cnt = item.overall.counts[v] || 0;
                    if (cnt === 0) return null;
                    return (
                      <span key={v} className="flex items-center gap-1 text-xs">
                        <VerdictBadge verdict={v} size="sm" />
                        <span className="font-mono text-slate-400">({cnt})</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                <div className="text-center px-4">
                  <div className="text-2xl font-extrabold text-cyan-400">
                    {item.overall.grade}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Score {item.overall.score}/100
                  </div>
                </div>

                <Link
                  to={`/audit/${item.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
