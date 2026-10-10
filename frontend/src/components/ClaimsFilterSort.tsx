import React from 'react';
import { Verdict } from '../types/contract';
import { VERDICT_TOKENS } from '../constants/verdictTokens';
import { SlidersHorizontal, Search, ArrowUpDown } from 'lucide-react';

export type SortOption = 'severity-desc' | 'severity-asc' | 'original' | 'confidence-desc';

interface ClaimsFilterSortProps {
  verdictCounts: Record<Verdict | 'ALL', number>;
  selectedVerdict: Verdict | 'ALL';
  onSelectVerdict: (verdict: Verdict | 'ALL') => void;
  sortOption: SortOption;
  onChangeSortOption: (sort: SortOption) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

const ALL_VERDICTS: Verdict[] = [
  'CONTRADICTED',
  'UNSUPPORTED',
  'AMBIGUOUS',
  'UNVERIFIABLE',
  'SUPPORTED',
];

export const ClaimsFilterSort: React.FC<ClaimsFilterSortProps> = ({
  verdictCounts,
  selectedVerdict,
  onSelectVerdict,
  sortOption,
  onChangeSortOption,
  searchQuery,
  onSearchQueryChange,
}) => {
  return (
    <div className="space-y-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
      {/* Top Controls Row: Search + Sort Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search claim text or rationale..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-sans text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-400 flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" /> Sort by:
          </label>
          <select
            value={sortOption}
            onChange={(e) => onChangeSortOption(e.target.value as SortOption)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
          >
            <option value="severity-desc">Highest Severity First</option>
            <option value="severity-asc">Lowest Severity First</option>
            <option value="confidence-desc">Highest Confidence</option>
            <option value="original">Original Pipeline Order</option>
          </select>
        </div>
      </div>

      {/* Filter Chips per Verdict */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
          <SlidersHorizontal className="w-3 h-3 text-cyan-400" /> Filter:
        </span>

        {/* ALL Chip */}
        <button
          onClick={() => onSelectVerdict('ALL')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
            selectedVerdict === 'ALL'
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
              : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>All</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-900/80 text-slate-200">
            {verdictCounts.ALL || 0}
          </span>
        </button>

        {/* Verdict Specific Chips */}
        {ALL_VERDICTS.map((v) => {
          const token = VERDICT_TOKENS[v];
          const Icon = token.icon;
          const count = verdictCounts[v] || 0;
          const isSelected = selectedVerdict === v;

          return (
            <button
              key={v}
              onClick={() => onSelectVerdict(v)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                isSelected
                  ? `${token.badgeClass} ring-2 ring-cyan-400/30 shadow-md font-bold scale-105`
                  : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{token.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/80 border border-white/5 text-slate-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
