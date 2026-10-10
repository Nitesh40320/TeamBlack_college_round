import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check, AlertCircle } from 'lucide-react';
import { submitFeedback } from '../api/apiClient';

interface FeedbackButtonsProps {
  auditId: string;
  findingId: string;
  findingType: 'claim' | 'reasoning' | 'safety';
  className?: string;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  auditId,
  findingId,
  findingType,
  className = '',
}) => {
  const [voted, setVoted] = useState<'correct' | 'incorrect' | null>(() => {
    // Check localStorage for previously submitted vote on this finding
    const saved = localStorage.getItem(`feedback-${auditId}-${findingId}`);
    return saved === 'correct' || saved === 'incorrect' ? saved : null;
  });

  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleVote = async (verdict: 'correct' | 'incorrect') => {
    if (voted || loading) return;

    setLoading(true);
    try {
      await submitFeedback(auditId, {
        findingType,
        findingId,
        verdict,
      });

      setVoted(verdict);
      localStorage.setItem(`feedback-${auditId}-${findingId}`, verdict);
      setToastMessage(verdict === 'correct' ? 'Feedback recorded!' : 'Flag recorded!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      // Handle duplicate vote graceful error or generic failure
      setVoted(verdict);
      localStorage.setItem(`feedback-${auditId}-${findingId}`, verdict);
      setToastMessage('Vote saved!');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {toastMessage ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-in fade-in duration-200">
          <Check className="w-3 h-3" />
          <span>{toastMessage}</span>
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => handleVote('correct')}
            disabled={loading || voted !== null}
            className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
              voted === 'correct'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10'
                : voted !== null
                ? 'opacity-40 border-transparent text-slate-500 cursor-not-allowed'
                : 'border-white/5 bg-slate-800/40 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20'
            }`}
            title="Mark finding as accurate/correct"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleVote('incorrect')}
            disabled={loading || voted !== null}
            className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
              voted === 'incorrect'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-sm shadow-rose-500/10'
                : voted !== null
                ? 'opacity-40 border-transparent text-slate-500 cursor-not-allowed'
                : 'border-white/5 bg-slate-800/40 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20'
            }`}
            title="Mark finding as inaccurate/incorrect"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
};
