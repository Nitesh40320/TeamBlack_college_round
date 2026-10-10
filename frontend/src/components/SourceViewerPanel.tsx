import React, { useState, useEffect, useRef } from 'react';
import { Source, SourceSpan } from '../types/contract';
import { FileText, Sparkles, Hash, Eye } from 'lucide-react';

interface SourceViewerPanelProps {
  sources: Source[];
  activeSourceId?: string;
  onSelectSource?: (sourceId: string) => void;
  highlightSpan?: { start: number; end: number; label?: string } | null;
}

export const SourceViewerPanel: React.FC<SourceViewerPanelProps> = ({
  sources,
  activeSourceId: externalActiveSourceId,
  onSelectSource,
  highlightSpan,
}) => {
  const [internalActiveSourceId, setInternalActiveSourceId] = useState<string>(
    sources[0]?.id || ''
  );

  const activeSourceId = externalActiveSourceId || internalActiveSourceId;

  // Sync internal state if external props change
  useEffect(() => {
    if (externalActiveSourceId) {
      setInternalActiveSourceId(externalActiveSourceId);
    } else if (sources.length > 0 && !internalActiveSourceId) {
      setInternalActiveSourceId(sources[0].id);
    }
  }, [externalActiveSourceId, sources]);

  const handleTabClick = (sourceId: string) => {
    setInternalActiveSourceId(sourceId);
    if (onSelectSource) {
      onSelectSource(sourceId);
    }
  };

  const activeSource = sources.find((s) => s.id === activeSourceId) || sources[0];

  const markRef = useRef<HTMLElement | null>(null);

  // Auto-scroll to highlighted span when highlightSpan changes
  useEffect(() => {
    if (highlightSpan && markRef.current) {
      markRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightSpan, activeSourceId]);

  // Render text with character span highlighting
  const renderSourceContent = (text: string, span?: { start: number; end: number; label?: string } | null) => {
    if (!span || span.start < 0 || span.end > text.length || span.start >= span.end) {
      return <span>{text}</span>;
    }

    const before = text.slice(0, span.start);
    const highlighted = text.slice(span.start, span.end);
    const after = text.slice(span.end);

    return (
      <>
        <span>{before}</span>
        <mark
          ref={markRef}
          id="source-span-highlight"
          className="bg-cyan-500/30 text-cyan-100 border-l-4 border-cyan-400 font-semibold px-1 py-0.5 rounded transition-all duration-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-pulse inline-block my-0.5"
        >
          {highlighted}
          {span.label && (
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider bg-cyan-400 text-slate-950 px-1.5 py-0.2 rounded-full align-middle">
              {span.label}
            </span>
          )}
        </mark>
        <span>{after}</span>
      </>
    );
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/60 border border-white/10 text-center text-slate-400 space-y-2">
        <FileText className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm font-semibold">No Source Documents Available</p>
        <p className="text-xs">No reference text was attached to this audit request.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-2xl space-y-0">
      {/* Header & Tabs Bar */}
      <div className="bg-slate-950/80 border-b border-white/10 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">
            Source Document Viewer
          </h3>
          <span className="text-xs font-mono text-slate-400">
            ({sources.length} {sources.length === 1 ? 'source' : 'sources'})
          </span>
        </div>

        {highlightSpan && (
          <div className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1.5 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Highlighting Span [{highlightSpan.start}, {highlightSpan.end}]
            </span>
          </div>
        )}
      </div>

      {/* Tabs list per source */}
      <div className="flex items-center gap-2 bg-slate-950/40 border-b border-white/5 px-4 pt-2 overflow-x-auto">
        {sources.map((src) => {
          const isActive = src.id === activeSourceId;
          return (
            <button
              key={src.id}
              onClick={() => handleTabClick(src.id)}
              className={`px-4 py-2 rounded-t-xl text-xs font-semibold border-t border-x transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-cyan-300 border-cyan-500/40 border-b-transparent font-bold shadow-md'
                  : 'bg-slate-950/80 text-slate-400 border-white/5 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Eye className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className="max-w-[200px] truncate">{src.title}</span>
              <span className="text-[10px] font-mono text-slate-500">#{src.id}</span>
            </button>
          );
        })}
      </div>

      {/* Main Document Display */}
      {activeSource && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-white/5 pb-2">
            <div>
              Source Title: <strong className="text-slate-200">{activeSource.title}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              <span>Length: {activeSource.text.length} chars</span>
            </div>
          </div>

          <div className="bg-slate-950/90 rounded-xl p-5 border border-white/10 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto shadow-inner relative">
            {renderSourceContent(activeSource.text, highlightSpan)}
          </div>
        </div>
      )}
    </div>
  );
};
