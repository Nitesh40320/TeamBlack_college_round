import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { VerdictBadge } from '../components/VerdictBadge';
import { EmptyState } from '../components/EmptyState';
import { listAudits } from '../api/apiClient';
import { AuditResult, Verdict } from '../types/contract';
import {
  History,
  ArrowRight,
  Calendar,
  ShieldCheck,
  Search,
  Filter,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const HistoryPage: React.FC = () => {
  const [audits, setAudits] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedVerdict, setSelectedVerdict] = useState<string>('ALL');
  const [safetyFilter, setSafetyFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'score'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const { showToast } = useToast();

  const loadAudits = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAudits({
        page,
        limit: 10,
        q: searchQuery || undefined,
        grade: selectedGrade !== 'ALL' ? selectedGrade : undefined,
        verdict: selectedVerdict !== 'ALL' ? selectedVerdict : undefined,
        safetyFlagged:
          safetyFilter === 'FLAGGED'
            ? 'true'
            : safetyFilter === 'UNFLAGGED'
            ? 'false'
            : undefined,
        sortBy,
        sortOrder,
      });

      setAudits(result.data);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalCount(result.pagination?.total || result.data.length);
    } catch (err: any) {
      showToast('Failed to load audit history', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedGrade, selectedVerdict, safetyFilter, sortBy, sortOrder, showToast]);

  useEffect(() => {
    loadAudits();
  }, [loadAudits]);

  const handleDeleteAudit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAudits((prev) => prev.filter((a) => a.id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    showToast(`Audit '${id.slice(0, 8)}' deleted`, 'info');
  };

  const getGradeBadge = (grade: string) => {
    const colors: Record<string, string> = {
      A: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      B: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      C: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      D: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      F: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return colors[grade] || 'bg-slate-800 text-slate-300 border-white/10';
  };

  const allVerdicts: Verdict[] = [
    'SUPPORTED',
    'CONTRADICTED',
    'UNSUPPORTED',
    'UNVERIFIABLE',
    'AMBIGUOUS',
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" /> Audit History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, and inspect past AI answer verification reports ({totalCount} total).
          </p>
        </div>

        <Link
          to="/new"
          className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/10"
        >
          <span>+ New Audit</span>
        </Link>
      </div>

      {/* Controls Bar: Search, Filters, Sort */}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search answer text or question..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Grade Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Grades</option>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
              <option value="D">Grade D</option>
              <option value="F">Grade F</option>
            </select>
          </div>

          {/* Verdict Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedVerdict}
              onChange={(e) => {
                setSelectedVerdict(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Verdicts</option>
              <option value="SUPPORTED">Supported</option>
              <option value="CONTRADICTED">Contradicted</option>
              <option value="UNSUPPORTED">Unsupported</option>
              <option value="UNVERIFIABLE">Unverifiable</option>
              <option value="AMBIGUOUS">Ambiguous</option>
            </select>
          </div>

          {/* Safety Filter */}
          <div className="md:col-span-3">
            <select
              value={safetyFilter}
              onChange={(e) => {
                setSafetyFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Safety: All</option>
              <option value="FLAGGED">Safety: Flagged Only</option>
              <option value="UNFLAGGED">Safety: Clean Only</option>
            </select>
          </div>
        </div>

        {/* Secondary Row: Sorting */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sort By:</span>
            <button
              onClick={() => {
                setSortBy('createdAt');
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              }}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                sortBy === 'createdAt'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              Date ({sortOrder})
            </button>
            <button
              onClick={() => {
                setSortBy('score');
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              }}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                sortBy === 'score'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              Score ({sortOrder})
            </button>
          </div>

          <div>Showing {audits.length} items</div>
        </div>
      </Card>

      {/* Audit List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-400">Loading audit history...</span>
        </div>
      ) : audits.length === 0 ? (
        <EmptyState
          title="No Audits Match Criteria"
          description="Try clearing search keywords or resetting status filters."
          action={
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGrade('ALL');
                setSelectedVerdict('ALL');
                setSafetyFilter('ALL');
                setPage(1);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
            >
              Reset All Filters
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {audits.map((item) => {
            const hasSafetyFlags = (item.safetyFlags || []).length > 0;
            return (
              <Card key={item.id} className="hover:border-cyan-500/30 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/5">
                        ID: {item.id.slice(0, 8)}
                      </span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      {hasSafetyFlags && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold text-[11px]">
                          <AlertTriangle className="w-3 h-3" /> Safety Hazard
                        </span>
                      )}
                    </div>

                    {item.question && (
                      <h3 className="text-xs font-semibold text-slate-300 line-clamp-1">
                        Q: {item.question}
                      </h3>
                    )}

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.overall?.summary || item.answer}
                    </p>

                    {/* Verdict Counts Chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {allVerdicts.map((v) => {
                        const cnt = item.overall?.counts?.[v] || 0;
                        if (cnt === 0) return null;
                        return (
                          <span key={v} className="flex items-center gap-1 text-[11px]">
                            <VerdictBadge verdict={v} size="sm" />
                            <span className="font-mono text-slate-400">({cnt})</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions & Grade */}
                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                    <div className="text-center px-3">
                      <div className={`text-xl font-extrabold px-3 py-1 rounded-xl border ${getGradeBadge(item.overall?.grade || 'N/A')}`}>
                        {item.overall?.grade || 'N/A'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">
                        Score {item.overall?.score ?? 0}/100
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/audit/${item.id}`}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={(e) => handleDeleteAudit(item.id, e)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                        title="Delete audit record"
                        aria-label="Delete audit record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 disabled:opacity-40 hover:bg-white/10 text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <span className="text-xs text-slate-400 font-mono">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 disabled:opacity-40 hover:bg-white/10 text-slate-300"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
