import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  MinusCircle,
  LucideIcon,
} from 'lucide-react';
import { Verdict } from '../types/contract';

export interface VerdictTokenConfig {
  verdict: Verdict;
  label: string;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  borderColor: string;
  badgeClass: string;
}

export const VERDICT_TOKENS: Record<Verdict, VerdictTokenConfig> = {
  SUPPORTED: {
    verdict: 'SUPPORTED',
    label: 'Supported',
    icon: CheckCircle2,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  CONTRADICTED: {
    verdict: 'CONTRADICTED',
    label: 'Contradicted',
    icon: XCircle,
    bgColor: 'bg-rose-500/10',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  UNSUPPORTED: {
    verdict: 'UNSUPPORTED',
    label: 'Unsupported',
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  UNVERIFIABLE: {
    verdict: 'UNVERIFIABLE',
    label: 'Unverifiable',
    icon: HelpCircle,
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  AMBIGUOUS: {
    verdict: 'AMBIGUOUS',
    label: 'Ambiguous',
    icon: MinusCircle,
    bgColor: 'bg-slate-500/10',
    textColor: 'text-slate-300',
    borderColor: 'border-slate-500/30',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
};
