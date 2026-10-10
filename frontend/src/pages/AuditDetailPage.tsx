import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/Card';
import { VerdictBadge } from '../components/VerdictBadge';
import { PipelineStepper } from '../components/PipelineStepper';
import { ClaimsFilterSort, SortOption } from '../components/ClaimsFilterSort';
import { ClaimDetailDrawer } from '../components/ClaimDetailDrawer';
import { SourceViewerPanel } from '../components/SourceViewerPanel';
import { AnnotatedAnswerView } from '../components/AnnotatedAnswerView';
import { getAuditById, rerunAudit } from '../api/apiClient';
import { Verdict, ClaimType, Claim, SourceSpan, Source } from '../types/contract';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Cpu,
  Layers,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  MessageSquareQuote,
  Hash,
  ExternalLink,
  BookOpen,
  Split,
  FileText,
} from 'lucide-react';

export const AuditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Filter, Sort, & Drawer States
  const [selectedVerdict, setSelectedVerdict] = useState<Verdict | 'ALL'>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('severity-desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Claim & Drawer State
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Source Viewer Active State & Span Highlight State
  const [activeSourceId, setActiveSourceId] = useState<string>('');
  const [highlightSpan, setHighlightSpan] = useState<{
    start: number;
    end: number;
    label?: string;
  } | null>(null);

  // Query Audit with polling refetchInterval until status is 'completed' or 'failed'
  const {
    data: audit,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit', id],
    queryFn: () => getAuditById(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 1500;
    },
  });

  // Mutation for Rerun Pipeline
  const rerunMutation = useMutation({
    mutationFn: () => rerunAudit(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(['audit', id], data);
      refetch();
    },
  });

  // Open Claim Detail Drawer & Sync Evidence Span Highlight in Source Viewer
  const handleOpenClaimDetail = (claim: Claim) => {
    setSelectedClaim(claim);
    setIsDrawerOpen(true);

    if (claim.evidence && claim.evidence.length > 0) {
      const topEv = claim.evidence[0];
      setActiveSourceId(topEv.sourceId);
      setHighlightSpan({
        start: topEv.span.start,
        end: topEv.span.end,
        label: claim.text,
      });
    }
  };

  // Close Claim Detail Drawer
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Handle "View in Source" click from Drawer or Card
  const handleViewInSource = (
    sourceId: string,
    span: SourceSpan,
    label?: string
  ) => {
    setActiveSourceId(sourceId);
    setHighlightSpan({ start: span.start, end: span.end, label });

    // Scroll to Source Viewer section on page
    const el = document.getElementById('source-viewer-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-pulse pb-12">
        <div className="h-32 bg-slate-900/60 rounded-2xl border border-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-48 bg-slate-900/60 rounded-2xl border border-white/10" />
          <div className="h-48 bg-slate-900/60 rounded-2xl border border-white/10" />
        </div>
        <div className="h-64 bg-slate-900/60 rounded-2xl border border-white/10" />
      </div>
    );
  }

  // Failed / Error State
  if (isError || !audit) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-xl">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Failed to Load Audit Report</h2>
          <p className="text-sm text-slate-400 mt-2">
            {(error as Error)?.message || `Audit record with ID '${id}' could not be fetched.`}
          </p>
        </div>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            to="/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-white/10 hover:bg-slate-800 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> New Audit
          </Link>
          <button
            onClick={() => rerunMutation.mutate()}
            disabled={rerunMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${rerunMutation.isPending ? 'animate-spin' : ''}`} />
            Retry & Rerun Audit
          </button>
        </div>
      </div>
    );
  }

  // Derive sources from audit or fallback mock sources
  const auditSources: Source[] = audit.sources || [
    {
      id: 'src-1',
      title: 'BNF - Aspirin Monograph (2024 ed.)',
      text: 'Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever. The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily. Aspirin is not recommended as routine prophylaxis for cardiovascular events in low-risk adults due to bleeding risk.',
    },
  ];

  // Calculate verified claims count x out of total claims y
  const totalClaims = audit.claims ? audit.claims.length : 0;
  const verifiedClaims = audit.claims
    ? audit.claims.filter((c) => c.verdict).length
    : 0;

  // Grade color map
  const gradeColors: Record<string, string> = {
    A: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    B: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    C: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    D: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    F: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  };

  const claimTypeBadgeStyles: Record<ClaimType, string> = {
    factual: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    numeric: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    causal: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    recommendation: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    opinion: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold',
  };

  // Severity Weight Mapping for Sorting
  const severityRank: Record<Verdict, number> = {
    CONTRADICTED: 1,
    UNSUPPORTED: 2,
    AMBIGUOUS: 3,
    UNVERIFIABLE: 4,
    SUPPORTED: 5,
  };

  // Verdict Counts for Filter Chips
  const verdictCounts: Record<Verdict | 'ALL', number> = {
    ALL: totalClaims,
    SUPPORTED: audit.overall?.counts?.SUPPORTED || 0,
    CONTRADICTED: audit.overall?.counts?.CONTRADICTED || 0,
    UNSUPPORTED: audit.overall?.counts?.UNSUPPORTED || 0,
    UNVERIFIABLE: audit.overall?.counts?.UNVERIFIABLE || 0,
    AMBIGUOUS: audit.overall?.counts?.AMBIGUOUS || 0,
  };

  // Filter & Sort Claims List
  const filteredClaims = (audit.claims || []).filter((claim) => {
    // Verdict Filter
    if (selectedVerdict !== 'ALL' && claim.verdict !== selectedVerdict) {
      return false;
    }
    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = claim.text.toLowerCase().includes(q);
      const matchExplanation = claim.explanation.toLowerCase().includes(q);
      return matchText || matchExplanation;
    }
    return true;
  });

  // Sort Claims
  const sortedClaims = [...filteredClaims].sort((a, b) => {
    if (sortOption === 'severity-desc') {
      return (severityRank[a.verdict] || 99) - (severityRank[b.verdict] || 99);
    }
    if (sortOption === 'severity-asc') {
      return (severityRank[b.verdict] || 99) - (severityRank[a.verdict] || 99);
    }
    if (sortOption === 'confidence-desc') {
      return (b.confidence?.score || 0) - (a.confidence?.score || 0);
    }
    return 0; // original order
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 animate-fadeIn">
      {/* Top Navigation & Mode Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/new"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to New Audit
        </Link>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Mode:
            <span className="uppercase font-bold text-slate-200">
              {audit.meta?.mode || 'live'}
            </span>
          </span>
        </div>
      </div>

      {/* REQUIREMENT 1: Pipeline Status Stepper */}
      <PipelineStepper
        status={audit.status}
        totalClaims={totalClaims}
        verifiedClaims={verifiedClaims}
        error={audit.error}
        onRerun={() => rerunMutation.mutate()}
        isRerunning={rerunMutation.isPending}
      />

      {/* Top Header Summary Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                Audit Report #{audit.id.slice(0, 8)}
              </span>
              <h1 className="text-2xl font-bold text-slate-100 mt-1">
                Fact Verification Analysis
              </h1>
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                {audit.overall?.summary || 'Audit evaluation summary.'}
              </p>
            </div>
            {audit.overall?.grade && (
              <div
                className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center shrink-0 shadow-lg ${
                  gradeColors[audit.overall.grade] || gradeColors.F
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Grade
                </span>
                <span className="text-2xl font-extrabold">
                  {audit.overall.grade}
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Total: {audit.meta?.timings?.totalMs || 0}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>{audit.meta?.modelVersions?.verifier || 'Verifier Model'}</span>
            </div>
          </div>
        </Card>

        {/* Verdict Breakdown Card */}
        <Card title="Verdict Breakdown">
          <div className="space-y-2">
            {(['SUPPORTED', 'CONTRADICTED', 'UNSUPPORTED', 'UNVERIFIABLE', 'AMBIGUOUS'] as Verdict[]).map(
              (v) => {
                const count = audit.overall?.counts?.[v] || 0;
                return (
                  <div
                    key={v}
                    onClick={() => setSelectedVerdict(v)}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer"
                  >
                    <VerdictBadge verdict={v} size="sm" />
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {count}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </Card>
      </div>

      {/* Annotated AI Answer & Source Verification Split View */}
      {audit.answer && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Split className="w-5 h-5 text-cyan-400" /> Annotated Answer & Source Text Split View
            </h2>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Select any highlighted claim to view linked source evidence
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Annotated Answer View */}
            <div className="space-y-4">
              <AnnotatedAnswerView
                answer={audit.answer}
                claims={audit.claims || []}
                selectedClaim={selectedClaim}
                onSelectClaim={(claim) => handleOpenClaimDetail(claim)}
              />
            </div>

            {/* Right Column: Source Viewer Panel */}
            <div id="source-viewer-section" className="space-y-4">
              <SourceViewerPanel
                sources={auditSources}
                activeSourceId={activeSourceId}
                onSelectSource={(srcId) => setActiveSourceId(srcId)}
                highlightSpan={highlightSpan}
              />
            </div>
          </div>
        </div>
      )}

      {/* Safety Flags Section */}
      {audit.safetyFlags && audit.safetyFlags.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" /> Safety Concerns (
            {audit.safetyFlags.length})
          </h2>
          {audit.safetyFlags.map((flag) => (
            <div
              key={flag.id}
              className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Domain: {flag.domain} | Severity: {flag.severity}
                </span>
              </div>
              <p className="text-sm font-medium">{flag.explanation}</p>
              <div className="text-xs text-rose-300/90 bg-slate-950/50 p-3 rounded-xl border border-rose-500/20">
                <strong>Recommendation:</strong> {flag.recommendation}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REQUIREMENT 2: Filter Chips & Severity Sort Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" /> Extracted Claims (
            {totalClaims})
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Showing {sortedClaims.length} of {totalClaims} claims
          </span>
        </div>

        <ClaimsFilterSort
          verdictCounts={verdictCounts}
          selectedVerdict={selectedVerdict}
          onSelectVerdict={setSelectedVerdict}
          sortOption={sortOption}
          onChangeSortOption={setSortOption}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        {/* Claims Table / Card List */}
        {sortedClaims.length === 0 ? (
          <Card>
            <div className="text-center py-10 space-y-2 text-slate-400">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold">No claims match the selected filters.</p>
              <button
                onClick={() => {
                  setSelectedVerdict('ALL');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-cyan-400 underline hover:text-cyan-300"
              >
                Reset Filters
              </button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedClaims.map((claim, idx) => (
              <Card
                key={claim.id}
                className="hover:border-cyan-500/40 transition-all cursor-pointer group"
              >
                <div
                  className="space-y-4"
                  onClick={() => handleOpenClaimDetail(claim)}
                >
                  {/* Top Claim Card Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="w-7 h-7 rounded-full bg-slate-800 text-cyan-400 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                        {idx + 1}
                      </span>
                      <div className="space-y-2 flex-1">
                        <p className="text-base font-semibold text-slate-100 leading-snug group-hover:text-cyan-200 transition-colors">
                          "{claim.text}"
                        </p>

                        {/* Metadata Row: Claim Type Badge + Evidence Count + Span */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {/* Claim Type Badge */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full border text-xs font-mono uppercase tracking-wider ${
                              claimTypeBadgeStyles[claim.claimType] ||
                              'bg-slate-800 text-slate-300 border-white/10'
                            }`}
                          >
                            Type: {claim.claimType}
                          </span>

                          {/* Opinion Indicator */}
                          {claim.claimType === 'opinion' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1 shadow-sm">
                              <MessageSquareQuote className="w-3.5 h-3.5 text-purple-400" />
                              Opinion / Subjective
                            </span>
                          )}

                          {/* Evidence Count Badge */}
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-cyan-500/20 text-xs font-mono text-cyan-300 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-cyan-400" />
                            {claim.evidence?.length || 0} Evidence Passages
                          </span>

                          {/* Answer Span Badge */}
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-xs font-mono text-slate-400 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-slate-500" />
                            Span: [{claim.answerSpan.start}, {claim.answerSpan.end}]
                          </span>

                          {/* Error Category Badge */}
                          {claim.errorCategory && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs font-mono font-bold text-rose-300">
                              Error: {claim.errorCategory}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verdict Badge (Color + Icon + Text) */}
                    <div className="shrink-0">
                      <VerdictBadge verdict={claim.verdict} size="lg" />
                    </div>
                  </div>

                  {/* Audit Rationale Snippet */}
                  <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                    <span className="font-semibold text-cyan-400 uppercase tracking-wider text-[10px]">
                      Audit Rationale:
                    </span>
                    <p className="text-slate-200 line-clamp-2">{claim.explanation}</p>
                  </div>

                  {/* Quick Action Footer */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-slate-400 group-hover:text-cyan-300">
                    <span className="font-mono">
                      Confidence: {Math.round((claim.confidence?.score || 0) * 100)}%
                    </span>
                    <span className="font-semibold flex items-center gap-1">
                      Inspect Claim & Evidence <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* REQUIREMENT 3: Claim Detail Drawer */}
      <ClaimDetailDrawer
        claim={selectedClaim}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        sources={auditSources}
        onViewInSource={(sourceId, span, label) => {
          handleCloseDrawer();
          handleViewInSource(sourceId, span, label);
        }}
      />
    </div>
  );
};
