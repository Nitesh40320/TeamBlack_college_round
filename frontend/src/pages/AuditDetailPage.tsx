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
import { SafetyBanner } from '../components/SafetyBanner';
import { ReasoningGraphView } from '../components/ReasoningGraphView';
import { OverallAssessmentCard } from '../components/OverallAssessmentCard';
import { ConfidenceMeter } from '../components/ConfidenceMeter';
import { FeedbackButtons } from '../components/FeedbackButtons';
import { getAuditById, rerunAudit } from '../api/apiClient';
import { Verdict, ClaimType, Claim, SourceSpan, Source, Span } from '../types/contract';
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
  GitCommit,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
} from 'lucide-react';

export const AuditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<'claims' | 'reasoning' | 'safety'>('claims');

  // Filter, Sort, & Drawer States
  const [selectedVerdict, setSelectedVerdict] = useState<Verdict | 'ALL'>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('severity-desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Claim & Drawer State
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
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

  const handleSelectFindingById = (findingId: string) => {
    if (!audit || !audit.claims) return;
    const found = audit.claims.find((c) => c.id === findingId);
    if (found) {
      handleOpenClaimDetail(found);
    } else {
      // If reasoning or safety issue, scroll down to target section
      const el = document.getElementById(`finding-${findingId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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

  const auditSources: Source[] = audit.sources || [
    {
      id: 'src-1',
      title: 'BNF - Aspirin Monograph (2024 ed.)',
      text: 'Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever. The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily. Aspirin is not recommended as routine prophylaxis for cardiovascular events in low-risk adults due to bleeding risk.',
    },
  ];

  const totalClaims = audit.claims ? audit.claims.length : 0;
  const reasoningCount = audit.reasoningIssues ? audit.reasoningIssues.length : 0;
  const safetyCount = audit.safetyFlags ? audit.safetyFlags.length : 0;
  const verifiedClaims = audit.claims ? audit.claims.filter((c) => c.verdict).length : 0;

  const claimTypeBadgeStyles: Record<ClaimType, string> = {
    factual: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    numeric: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    causal: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    recommendation: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    opinion: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold',
  };

  const severityRank: Record<Verdict, number> = {
    CONTRADICTED: 1,
    UNSUPPORTED: 2,
    AMBIGUOUS: 3,
    UNVERIFIABLE: 4,
    SUPPORTED: 5,
  };

  const verdictCounts: Record<Verdict | 'ALL', number> = {
    ALL: totalClaims,
    SUPPORTED: audit.overall?.counts?.SUPPORTED || 0,
    CONTRADICTED: audit.overall?.counts?.CONTRADICTED || 0,
    UNSUPPORTED: audit.overall?.counts?.UNSUPPORTED || 0,
    UNVERIFIABLE: audit.overall?.counts?.UNVERIFIABLE || 0,
    AMBIGUOUS: audit.overall?.counts?.AMBIGUOUS || 0,
  };

  const filteredClaims = (audit.claims || []).filter((claim) => {
    if (selectedVerdict !== 'ALL' && claim.verdict !== selectedVerdict) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = claim.text.toLowerCase().includes(q);
      const matchExplanation = claim.explanation.toLowerCase().includes(q);
      return matchText || matchExplanation;
    }
    return true;
  });

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
    return 0;
  });

  // Categorize sorted claims into two distinct groups:
  // 1. Demonstrably Wrong (CONTRADICTED / HALLUCINATED)
  // 2. Unverified & Ambiguous (UNSUPPORTED / UNVERIFIABLE / AMBIGUOUS)
  // 3. Supported (SUPPORTED)
  const demonstrablyWrongClaims = sortedClaims.filter(
    (c) => c.verdict === 'CONTRADICTED' || c.errorCategory === 'HALLUCINATED_FACT' || c.errorCategory === 'NUMERIC_MISMATCH' || c.errorCategory === 'ENTITY_MISMATCH'
  );

  const unverifiedClaims = sortedClaims.filter(
    (c) =>
      c.verdict !== 'CONTRADICTED' &&
      c.verdict !== 'SUPPORTED' &&
      c.errorCategory !== 'HALLUCINATED_FACT' &&
      c.errorCategory !== 'NUMERIC_MISMATCH' &&
      c.errorCategory !== 'ENTITY_MISMATCH'
  );

  const supportedClaims = sortedClaims.filter((c) => c.verdict === 'SUPPORTED');

  const renderClaimCard = (claim: Claim, idx: number) => (
    <Card
      key={claim.id}
      id={`finding-${claim.id}`}
      className="hover:border-cyan-500/40 transition-all cursor-pointer group"
    >
      <div className="space-y-4">
        {/* Top Claim Card Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <span className="w-7 h-7 rounded-full bg-slate-800 text-cyan-400 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              {idx + 1}
            </span>
            <div className="space-y-2 flex-1">
              <p
                onClick={() => handleOpenClaimDetail(claim)}
                className="text-base font-semibold text-slate-100 leading-snug group-hover:text-cyan-200 transition-colors"
              >
                "{claim.text}"
              </p>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full border text-xs font-mono uppercase tracking-wider ${
                    claimTypeBadgeStyles[claim.claimType] ||
                    'bg-slate-800 text-slate-300 border-white/10'
                  }`}
                >
                  Type: {claim.claimType}
                </span>

                {claim.claimType === 'opinion' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-purple-400" />
                    Opinion / Subjective
                  </span>
                )}

                <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-cyan-500/20 text-xs font-mono text-cyan-300 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-cyan-400" />
                  {claim.evidence?.length || 0} Evidence Passages
                </span>

                <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-500" />
                  Span: [{claim.answerSpan.start}, {claim.answerSpan.end}]
                </span>

                {claim.errorCategory && (
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs font-mono font-bold text-rose-300">
                    Error: {claim.errorCategory}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <VerdictBadge verdict={claim.verdict} size="lg" />
            <ConfidenceMeter confidence={claim.confidence} />
          </div>
        </div>

        {/* Audit Rationale Snippet */}
        <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
          <span className="font-semibold text-cyan-400 uppercase tracking-wider text-[10px]">
            Audit Rationale:
          </span>
          <p className="text-slate-200">{claim.explanation}</p>
        </div>

        {/* Quick Action & Feedback Footer */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-slate-400">
          <FeedbackButtons
            auditId={audit.id}
            findingId={claim.id}
            findingType="claim"
          />

          <button
            type="button"
            onClick={() => handleOpenClaimDetail(claim)}
            className="font-semibold flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Inspect Claim & Evidence <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );

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

      {/* Stepper Pipeline Status */}
      <PipelineStepper
        status={audit.status}
        totalClaims={totalClaims}
        verifiedClaims={verifiedClaims}
        error={audit.error}
        onRerun={() => rerunMutation.mutate()}
        isRerunning={rerunMutation.isPending}
      />

      {/* Prominent Safety Banner */}
      <SafetyBanner
        safetyFlags={audit.safetyFlags}
        onSelectSafetySpan={(span) => setSelectedSpan(span)}
      />

      {/* REQUIREMENT 2: Overall Assessment Card */}
      {audit.overall && (
        <OverallAssessmentCard
          overall={audit.overall}
          claims={audit.claims || []}
          reasoningIssues={audit.reasoningIssues || []}
          safetyFlags={audit.safetyFlags || []}
          onSelectFinding={handleSelectFindingById}
        />
      )}

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
                reasoningIssues={audit.reasoningIssues || []}
                safetyFlags={audit.safetyFlags || []}
                selectedClaim={selectedClaim}
                selectedSpan={selectedSpan}
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

      {/* NAVIGATION TABS: Claims | Reasoning | Safety */}
      <div className="space-y-6 pt-4">
        <div className="flex border-b border-white/10 gap-2">
          {/* Claims Tab */}
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all border-t border-x ${
              activeTab === 'claims'
                ? 'bg-slate-900 text-cyan-400 border-white/10 border-b-slate-900 -mb-px'
                : 'text-slate-400 hover:text-slate-200 border-transparent bg-slate-950/40'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            Claims
            <span
              className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                activeTab === 'claims'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {totalClaims}
            </span>
          </button>

          {/* Reasoning Tab */}
          <button
            onClick={() => setActiveTab('reasoning')}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all border-t border-x ${
              activeTab === 'reasoning'
                ? 'bg-slate-900 text-violet-400 border-white/10 border-b-slate-900 -mb-px'
                : 'text-slate-400 hover:text-slate-200 border-transparent bg-slate-950/40'
            }`}
          >
            <GitCommit className="w-4 h-4 text-violet-400" />
            Reasoning Flow
            <span
              className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                activeTab === 'reasoning'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {reasoningCount}
            </span>
          </button>

          {/* Safety Tab */}
          <button
            onClick={() => setActiveTab('safety')}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all border-t border-x ${
              activeTab === 'safety'
                ? 'bg-slate-900 text-rose-400 border-white/10 border-b-slate-900 -mb-px'
                : 'text-slate-400 hover:text-slate-200 border-transparent bg-slate-950/40'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Safety & Risks
            <span
              className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                activeTab === 'safety'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {safetyCount}
            </span>
          </button>
        </div>

        {/* TAB CONTENTS */}

        {/* 1. Claims Tab */}
        {activeTab === 'claims' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" /> Extracted Claims ({totalClaims})
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

            {/* REQUIREMENT 3: Grouped Sections ("Demonstrably Wrong" vs "Can't Verify" vs "Supported") */}
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
              <div className="space-y-8">
                {/* Section 1: Demonstrably Wrong */}
                {demonstrablyWrongClaims.length > 0 && (
                  <div className="space-y-4 p-5 rounded-2xl bg-rose-950/20 border border-rose-500/20">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="w-5 h-5 text-rose-400" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-rose-300">
                          Demonstrably Wrong / Contradicted ({demonstrablyWrongClaims.length})
                        </h3>
                      </div>
                      <span className="text-xs text-rose-400/80 font-mono">
                        Factual Contradictions & Mismatches
                      </span>
                    </div>
                    <div className="space-y-4">
                      {demonstrablyWrongClaims.map((claim, idx) =>
                        renderClaimCard(claim, idx)
                      )}
                    </div>
                  </div>
                )}

                {/* Section 2: Can't Verify / Ambiguous */}
                {unverifiedClaims.length > 0 && (
                  <div className="space-y-4 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-amber-400" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                          Unverified & Ambiguous Statements ({unverifiedClaims.length})
                        </h3>
                      </div>
                      <span className="text-xs text-amber-400/80 font-mono">
                        Unsupported or Vague Claims
                      </span>
                    </div>
                    <div className="space-y-4">
                      {unverifiedClaims.map((claim, idx) =>
                        renderClaimCard(claim, idx)
                      )}
                    </div>
                  </div>
                )}

                {/* Section 3: Supported Claims */}
                {supportedClaims.length > 0 && (
                  <div className="space-y-4 p-5 rounded-2xl bg-emerald-950/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                          Grounded & Supported Claims ({supportedClaims.length})
                        </h3>
                      </div>
                      <span className="text-xs text-emerald-400/80 font-mono">
                        Fully Backed by Source Documentation
                      </span>
                    </div>
                    <div className="space-y-4">
                      {supportedClaims.map((claim, idx) =>
                        renderClaimCard(claim, idx)
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Reasoning Tab */}
        {activeTab === 'reasoning' && (
          <div className="animate-fadeIn">
            <ReasoningGraphView
              claims={audit.claims || []}
              reasoningIssues={audit.reasoningIssues || []}
              onSelectClaim={handleOpenClaimDetail}
            />
          </div>
        )}

        {/* 3. Safety Tab */}
        {activeTab === 'safety' && (
          <div className="animate-fadeIn space-y-4">
            <SafetyBanner
              safetyFlags={audit.safetyFlags || []}
              onSelectSafetySpan={(span) => setSelectedSpan(span)}
            />
          </div>
        )}
      </div>

      {/* Claim Detail Drawer */}
      <ClaimDetailDrawer
        claim={selectedClaim}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        sources={auditSources}
        auditId={audit.id}
        onViewInSource={(sourceId, span, label) => {
          handleCloseDrawer();
          handleViewInSource(sourceId, span, label);
        }}
      />
    </div>
  );
};
