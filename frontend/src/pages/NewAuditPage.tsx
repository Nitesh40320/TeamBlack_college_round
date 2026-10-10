import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../components/Card';
import { VerdictBadge } from '../components/VerdictBadge';
import { Verdict, Source } from '../types/contract';
import { createAudit } from '../api/apiClient';
import { parseUploadedFile } from '../utils/fileParser';
import {
  Send,
  FileText,
  HelpCircle,
  Sparkles,
  BookOpen,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  Loader2,
  FileCode,
  RotateCcw,
  CheckCircle2,
  Edit3,
} from 'lucide-react';

const ANSWER_MAX_CHARS = 50000;
const SOURCE_MAX_CHARS = 200000;
const MAX_SOURCES_COUNT = 20;

const SAMPLE_QUESTION = 'What is the standard adult dose of aspirin for fever?';
const SAMPLE_ANSWER =
  'Aspirin is commonly used to reduce fever in adults. The standard dose is 1000 mg every 4 hours, not exceeding 4 g per day. It also prevents heart attacks in all adults over 40. Aspirin was first synthesized by ancient Egyptian physicians in 2000 BC. Taking antipyretics usually helps quickly.';
const SAMPLE_SOURCE_TITLE = 'BNF - Aspirin Monograph (2024 ed.)';
const SAMPLE_SOURCE_TEXT =
  'Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever. The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily. Aspirin is not recommended as routine prophylaxis for cardiovascular events in low-risk adults due to bleeding risk.';

export const NewAuditPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);

  // Inline paste modal / form state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');

  // Drag state & Validation Errors
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<{
    answer?: string;
    sources?: string;
    general?: string;
  }>({});

  // TanStack Query Mutation
  const auditMutation = useMutation({
    mutationFn: createAudit,
    onSuccess: (data) => {
      navigate(`/audit/${data.id}`);
    },
    onError: (err: Error) => {
      setErrors((prev) => ({
        ...prev,
        general: err.message || 'Failed to process audit job. Please try again.',
      }));
    },
  });

  // Handler to load sample data with deliberate errors
  const handleLoadSample = () => {
    setQuestion(SAMPLE_QUESTION);
    setAnswer(SAMPLE_ANSWER);
    setSources([
      {
        id: `src-sample-1`,
        title: SAMPLE_SOURCE_TITLE,
        text: SAMPLE_SOURCE_TEXT,
      },
    ]);
    setErrors({});
  };

  // Source card management
  const handleRemoveSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    setErrors((prev) => ({ ...prev, sources: undefined }));
  };

  const handleUpdateSourceTitle = (id: string, newTitle: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
  };

  const handleUpdateSourceText = (id: string, newText: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText } : s))
    );
  };

  // File upload processing
  const processFiles = async (files: FileList | File[]) => {
    if (sources.length >= MAX_SOURCES_COUNT) {
      setErrors((prev) => ({
        ...prev,
        sources: `Maximum limit of ${MAX_SOURCES_COUNT} sources reached.`,
      }));
      return;
    }

    const availableSlots = MAX_SOURCES_COUNT - sources.length;
    const filesToProcess = Array.from(files).slice(0, availableSlots);

    const parsedSources: Source[] = [];
    for (const file of filesToProcess) {
      const parsed = await parseUploadedFile(file);
      parsedSources.push(parsed);
    }

    setSources((prev) => [...prev, ...parsedSources]);
    setErrors((prev) => ({ ...prev, sources: undefined }));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.target) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Add pasted text source
  const handleAddPastedSource = () => {
    if (!pasteText.trim()) return;

    if (sources.length >= MAX_SOURCES_COUNT) {
      setErrors((prev) => ({
        ...prev,
        sources: `Maximum limit of ${MAX_SOURCES_COUNT} sources reached.`,
      }));
      return;
    }

    const newSource: Source = {
      id: `src-paste-${Date.now()}`,
      title: pasteTitle.trim() || `Pasted Source #${sources.length + 1}`,
      text: pasteText.trim(),
    };

    setSources((prev) => [...prev, newSource]);
    setPasteTitle('');
    setPasteText('');
    setShowPasteModal(false);
    setErrors((prev) => ({ ...prev, sources: undefined }));
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: { answer?: string; sources?: string; general?: string } = {};

    if (!answer.trim()) {
      newErrors.answer = 'AI generated answer text is required.';
    } else if (answer.length > ANSWER_MAX_CHARS) {
      newErrors.answer = `Answer exceeds maximum limit of ${ANSWER_MAX_CHARS.toLocaleString()} characters.`;
    }

    if (sources.length === 0) {
      newErrors.sources = 'At least one source document is required to audit claims.';
    } else if (sources.length > MAX_SOURCES_COUNT) {
      newErrors.sources = `Maximum limit of ${MAX_SOURCES_COUNT} source documents allowed.`;
    } else {
      const invalidSource = sources.find(
        (s) => !s.text.trim() || s.text.length > SOURCE_MAX_CHARS
      );
      if (invalidSource) {
        if (!invalidSource.text.trim()) {
          newErrors.sources = `Source document "${invalidSource.title}" cannot be empty.`;
        } else if (invalidSource.text.length > SOURCE_MAX_CHARS) {
          newErrors.sources = `Source document "${invalidSource.title}" exceeds ${SOURCE_MAX_CHARS.toLocaleString()} characters.`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    auditMutation.mutate({
      question: question.trim() || undefined,
      answer: answer.trim(),
      sources: sources.map((s) => ({
        id: s.id,
        title: s.title.trim() || 'Untitled Source',
        text: s.text.trim(),
      })),
    });
  };

  const verdictsList: Verdict[] = [
    'SUPPORTED',
    'CONTRADICTED',
    'UNSUPPORTED',
    'UNVERIFIABLE',
    'AMBIGUOUS',
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            Audit AI Answer <Sparkles className="w-5 h-5 text-cyan-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Extract discrete claims and cross-verify facts against ground-truth source documentation.
          </p>
        </div>

        {/* Load Sample Button */}
        <button
          type="button"
          onClick={handleLoadSample}
          disabled={auditMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/50 transition-all shadow-md shadow-cyan-950/40 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          Load Sample Data
        </button>
      </div>

      {/* Verdict Tokens Preview Banner */}
      <Card title="Audit Verdict System" subtitle="Color + Icon dual-signal standard">
        <div className="flex flex-wrap items-center gap-3">
          {verdictsList.map((verdict) => (
            <VerdictBadge key={verdict} verdict={verdict} size="md" />
          ))}
        </div>
      </Card>

      {/* General Error Banner */}
      {errors.general && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong>Error:</strong> {errors.general}
          </div>
        </div>
      )}

      {/* Audit Input Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: AI Prompt & Answer */}
        <Card title="1. AI Prompt & Generated Answer">
          <div className="space-y-5">
            {/* Optional Question */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" /> User Question / Prompt (Optional)
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={auditMutation.isPending}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-60"
                placeholder="e.g. What is the standard adult dose of aspirin for fever?"
              />
            </div>

            {/* Answer Textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" /> AI Generated Answer to Audit *
                </label>
                <span
                  className={`text-xs font-mono ${
                    answer.length > ANSWER_MAX_CHARS
                      ? 'text-rose-400 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {answer.length.toLocaleString()} / {ANSWER_MAX_CHARS.toLocaleString()} chars
                </span>
              </div>
              <textarea
                rows={6}
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  if (errors.answer) setErrors((prev) => ({ ...prev, answer: undefined }));
                }}
                disabled={auditMutation.isPending}
                className={`w-full bg-slate-950/80 border rounded-xl p-4 text-sm text-slate-100 focus:outline-none transition-all font-sans leading-relaxed disabled:opacity-60 ${
                  errors.answer
                    ? 'border-rose-500/70 ring-1 ring-rose-500/50'
                    : 'border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50'
                }`}
                placeholder="Paste the AI-generated answer here for claim extraction and verification..."
              />
              {errors.answer && (
                <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.answer}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Section 2: Multi-Source Panel */}
        <Card
          title="2. Source Documentation Panel"
          subtitle="Add ground-truth documents by dragging files or pasting text"
        >
          <div className="space-y-6">
            {/* Action Bar: Drag & Drop Zone + Add Buttons */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-white/15 bg-slate-950/40 hover:border-cyan-500/40 hover:bg-slate-950/60'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                multiple
                accept=".txt,.md,.pdf,.docx,.doc"
                className="hidden"
                disabled={auditMutation.isPending}
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Drag & drop source files here, or <span className="text-cyan-400 underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports <span className="font-mono text-slate-300">.txt</span>, <span className="font-mono text-slate-300">.md</span>, <span className="font-mono text-slate-300">.pdf</span>, <span className="font-mono text-slate-300">.docx</span> (Up to {MAX_SOURCES_COUNT} documents)
                  </p>
                </div>
              </div>
            </div>

            {/* Alternative Add Source Buttons */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Attached Sources ({sources.length} / {MAX_SOURCES_COUNT})
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPasteModal(true);
                }}
                disabled={auditMutation.isPending || sources.length >= MAX_SOURCES_COUNT}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-cyan-500/20 transition-all disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Paste Source Text
              </button>
            </div>

            {/* Error message for sources */}
            {errors.sources && (
              <p className="text-xs text-rose-400 flex items-center gap-1 font-medium bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" /> {errors.sources}
              </p>
            )}

            {/* Removable Source Cards List */}
            {sources.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-slate-950/20 text-slate-500 text-xs">
                No source documents added yet. Drag & drop files or click "Paste Source Text" to add context.
              </div>
            ) : (
              <div className="space-y-4">
                {sources.map((source, index) => (
                  <div
                    key={source.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-3 transition-all hover:border-white/20"
                  >
                    {/* Source Card Header */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={source.title}
                              onChange={(e) =>
                                handleUpdateSourceTitle(source.id, e.target.value)
                              }
                              disabled={auditMutation.isPending}
                              className="bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-xs font-semibold text-slate-100 focus:outline-none focus:border-cyan-500/50 w-full max-w-md"
                              placeholder="Source title..."
                            />
                            <Edit3 className="w-3 h-3 text-slate-500 shrink-0" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-slate-400">
                          {source.text.length.toLocaleString()} chars
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(source.id)}
                          disabled={auditMutation.isPending}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Source Text Area */}
                    <textarea
                      rows={3}
                      value={source.text}
                      onChange={(e) =>
                        handleUpdateSourceText(source.id, e.target.value)
                      }
                      disabled={auditMutation.isPending}
                      className="w-full bg-slate-900/60 border border-white/5 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/40"
                      placeholder="Source text content..."
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Submit Action Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <p className="text-xs text-slate-400">
            Clicking submit runs claim extraction & multi-source fact verification.
          </p>

          <button
            type="submit"
            disabled={auditMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:from-cyan-400 hover:to-teal-300 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {auditMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                Auditing Claims...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Run Audit Pipeline
              </>
            )}
          </button>
        </div>
      </form>

      {/* Paste Source Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" /> Paste Source Document
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="e.g. Clinical Study Reference #4"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Source Text Content *
                </label>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste the raw text of the document here..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPastedSource}
                disabled={!pasteText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Add Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
