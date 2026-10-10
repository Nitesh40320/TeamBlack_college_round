import React, { useState, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/Card';
import { VerdictBadge } from '../components/VerdictBadge';
import { PipelineStepper } from '../components/PipelineStepper';
import { ClaimsFilterSort, SortOption } from '../components/ClaimsFilterSort';
import { ClaimDetailDrawer } from '../components/ClaimDetailDrawer';
import { SourceViewerPanel } from '../components/SourceViewerPanel';
import { AnnotatedAnswerView } from '../components/AnnotatedAnswerView';
import { SafetyBanner } from '../components/SafetyBanner';
import { OverallAssessmentCard } from '../components/OverallAssessmentCard';
import { CorrectionsView } from '../components/CorrectionsView';
import { ConfidenceMeter } from '../components/ConfidenceMeter';
import { FeedbackButtons } from '../components/FeedbackButtons';
import { rerunAudit } from '../api/apiClient';
import { useAuditStream } from '../hooks/useAuditStream';
import { useToast } from '../context/ToastContext';
import { Verdict, ClaimType, Claim, SourceSpan, Source, Span } from '../types/contract';
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  MessageSquareQuote,
  Hash,
  ExternalLink,
  BookOpen,
  Split,
  Download,
  Copy,
  FileText,
  FileCode,
  FileSpreadsheet,
  Radio,
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Lazy-load graph view for bundle optimization
const ReasoningGraphView = React.lazy(() =>
  import('../components/ReasoningGraphView').then((m) => ({ default: m.ReasoningGraphView }))
);

export const AuditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // SSE Stream & Polling fallback hook
  const { audit, loading: isLoading, isStreaming, error, refetch } = useAuditStream(id);

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

  // Mutation for Rerun Pipeline
  const rerunMutation = useMutation({
    mutationFn: () => rerunAudit(id!),
    onSuccess: () => {
      showToast('Rerun pipeline initiated', 'info');
      refetch();
    },
  });

  const handleExport = (format: 'json' | 'md' | 'pdf') => {
    if (!id) return;
    const exportUrl = `${BASE_URL}/api/audits/${id}/export?format=${format}`;
    window.open(exportUrl, '_blank');
    showToast(`Downloading report in ${format.toUpperCase()} format`, 'success');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Audit link copied to clipboard!', 'success');
  };

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
  if (error || !audit) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-xl">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Failed to Load Audit Report</h2>
          <p className="text-sm text-slate-400 mt-2">
            {error || `Audit record with ID '${id}' could not be fetched.`}
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
      title: 'Ground Truth Source Document',
      text: audit.answer || 'No source content attached.',
    },
  ];

  const totalClaims = audit.claims ? audit.claims.length : 0;
  const reasoningCount = audit.reasoningIssues ? audit.reasoningIssues.length : 0;
  const safetyCount = audit.safetyFlags ? audit.safetyFlags.length : 0;
  const verifiedClaims = audit.claims ? audit.claims.filter((c) => c.verdict).length : 0;

  const claimTypeBadgeStyles: Record<ClaimType, string> = {
    factual: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    numeric: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    causal: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    recommendation: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    opinion: 'bg-slate-800 text-slate-300 border-white/10',
  };

  // Filter & Sort claims
  const filteredClaims = (audit.claims || []).filter((claim) => {
    if (selectedVerdict !== 'ALL' && claim.verdict !== selectedVerdict) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        claim.text.toLowerCase().includes(q) ||
        claim.explanation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedClaims = [...filteredClaims].sort((a, b) => {
    const verdictRank: Record<Verdict, number> = {
      CONTRADICTED: 1,
      UNSUPPORTED: 2,
      AMBIGUOUS: 3,
      UNVERIFIABLE: 4,
      SUPPORTED: 5,
    };
    if (sortOption === 'severity-desc') {
      return verdictRank[a.verdict] - verdictRank[b.verdict];
    }
    if (sortOption === 'severity-asc') {
      return verdictRank[b.verdict] - verdictRank[a.verdict];
    }
    if (sortOption === 'confidence-desc') {
      return (b.confidence?.score || 0) - (a.confidence?.score || 0);
    }
    return a.answerSpan.start - b.answerSpan.start;
  });

  const demonstrablyWrongClaims = sortedClaims.filter(
    (c) =>
      c.verdict === 'CONTRADICTED' ||
      c.errorCategory === 'HALLUCINATED_FACT' ||
      c.errorCategory === 'NUMERIC_MISMATCH' ||
      c.errorCategory === 'ENTITY_MISMATCH'
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

        <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
          <span className="font-semibold text-cyan-400 uppercase tracking-wider text-[10px]">
            Audit Rationale:
          </span>
          <p className="text-slate-200">{claim.explanation}</p>
        </div>

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
      {/* Top Bar with Export & Link Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/new"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to New Audit
        </Link>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isStreaming && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-mono animate-pulse">
              <Radio className="w-3.5 h-3.5 animate-spin text-cyan-400" /> SSE Live
            </span>
          )}

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-xs font-medium transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" /> Copy Link
          </button>

          {/* Export Options */}
          <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl p-1 text-xs">
            <span className="px-2 text-slate-400 font-semibold flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-cyan-400" /> Export:
            </span>
            <button
              onClick={() => handleExport('md')}
              className="px-2 py-0.5 rounded hover:bg-white/10 text-slate-200 font-medium flex items-center gap-1"
            >
              <FileText className="w-3 h-3 text-cyan-400" /> MD
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-2 py-0.5 rounded hover:bg-white/10 text-slate-200 font-medium flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-400" /> PDF
            </button>
            <button
              onClick={() => handleExport('json')}
              className="px-2 py-0.5 rounded hover:bg-white/10 text-slate-200 font-medium flex items-center gap-1"
            >
              <FileCode className="w-3 h-3 text-purple-400" /> JSON
            </button>
          </div>
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

      {/* Safety Banner */}
      <SafetyBanner
        safetyFlags={audit.safetyFlags}
        onSelectSafetySpan={(span) => setSelectedSpan(span)}
      />

      {/* Overall Assessment Card */}
      {audit.overall && (
        <OverallAssessmentCard
          overall={audit.overall}
          claims={audit.claims || []}
          reasoningIssues={audit.reasoningIssues || []}
          safetyFlags={audit.safetyFlags || []}
          onSelectFinding={handleSelectFindingById}
        />
      )}

      {/* Grounded Auto-Fixes & Corrections View */}
      {audit.id && (
        <CorrectionsView
          auditId={audit.id}
          claims={audit.claims || []}
          answer={audit.answer}
        />
      )}

      {/* Annotated AI Answer & Source Verification Split View */}
      {audit.answer && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Split className="w-5 h-5 text-cyan-400" /> Annotated Answer & Source Text Split View
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
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
        <div className="flex border-b border-white/10 gap-2" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'claims'}
            aria-controls="claims-tab-panel"
            onClick={() => setActiveTab('claims')}
            className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition-all border-b-2 ${
              activeTab === 'claims'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Claims ({totalClaims})
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'reasoning'}
            aria-controls="reasoning-tab-panel"
            onClick={() => setActiveTab('reasoning')}
            className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition-all border-b-2 ${
              activeTab === 'reasoning'
                ? 'border-purple-400 text-purple-400 bg-purple-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Reasoning ({reasoningCount})
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'safety'}
            aria-controls="safety-tab-panel"
            onClick={() => setActiveTab('safety')}
            className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition-all border-b-2 ${
              activeTab === 'safety'
                ? 'border-rose-400 text-rose-400 bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Safety ({safetyCount})
          </button>
        </div>

        {/* Tab 1: Claims List */}
        {activeTab === 'claims' && (
          <div id="claims-tab-panel" role="tabpanel" className="space-y-6">
            <ClaimsFilterSort
              verdictCounts={{
                ALL: totalClaims,
                SUPPORTED: audit.overall?.counts?.SUPPORTED || 0,
                CONTRADICTED: audit.overall?.counts?.CONTRADICTED || 0,
                UNSUPPORTED: audit.overall?.counts?.UNSUPPORTED || 0,
                UNVERIFIABLE: audit.overall?.counts?.UNVERIFIABLE || 0,
                AMBIGUOUS: audit.overall?.counts?.AMBIGUOUS || 0,
              }}
              selectedVerdict={selectedVerdict}
              onSelectVerdict={setSelectedVerdict}
              sortOption={sortOption}
              onChangeSortOption={setSortOption}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />

            {demonstrablyWrongClaims.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Demonstrably Wrong / Contradicted Findings ({demonstrablyWrongClaims.length})
                </h3>
                <div className="space-y-4">
                  {demonstrablyWrongClaims.map((claim, idx) => renderClaimCard(claim, idx))}
                </div>
              </div>
            )}

            {unverifiedClaims.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Unverified, Unsupported & Ambiguous Claims ({unverifiedClaims.length})
                </h3>
                <div className="space-y-4">
                  {unverifiedClaims.map((claim, idx) => renderClaimCard(claim, idx))}
                </div>
              </div>
            )}

            {supportedClaims.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Supported Claims ({supportedClaims.length})
                </h3>
                <div className="space-y-4">
                  {supportedClaims.map((claim, idx) => renderClaimCard(claim, idx))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Reasoning Graph */}
        {activeTab === 'reasoning' && (
          <div id="reasoning-tab-panel" role="tabpanel" className="space-y-4">
            <Suspense fallback={<div className="h-64 flex items-center justify-center text-slate-400 text-xs">Loading Reasoning Graph...</div>}>
              <ReasoningGraphView
                reasoningIssues={audit.reasoningIssues || []}
                claims={audit.claims || []}
                auditId={audit.id}
              />
            </Suspense>
          </div>
        )}

        {/* Tab 3: Safety Flags */}
        {activeTab === 'safety' && (
          <div id="safety-tab-panel" role="tabpanel" className="space-y-4">
            {(audit.safetyFlags || []).map((flag) => (
              <Card key={flag.id} id={`finding-${flag.id}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                      [{flag.severity.toUpperCase()}] Safety Issue ({flag.domain})
                    </span>
                    <ConfidenceMeter confidence={{ score: 0.95, level: 'high', uncertaintyReasons: [] }} />
                  </div>
                  <p className="text-sm text-slate-200">{flag.explanation}</p>
                  {flag.recommendation && (
                    <div className="text-xs text-emerald-300 bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/20">
                      <strong>Recommended Safer Alternative:</strong> {flag.recommendation}
                    </div>
                  )}
                  <FeedbackButtons auditId={audit.id} findingId={flag.id} findingType="safety" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Claim Detail Drawer */}
      <ClaimDetailDrawer
        claim={selectedClaim}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onViewInSource={handleViewInSource}
      />
    </div>
  );
};
