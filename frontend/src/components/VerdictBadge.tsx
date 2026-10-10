import React from 'react';
import { clsx } from 'clsx';
import { Verdict } from '../types/contract';
import { VERDICT_TOKENS } from '../constants/verdictTokens';

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  verdict,
  size = 'md',
  showIcon = true,
  className,
}) => {
  const token = VERDICT_TOKENS[verdict] || VERDICT_TOKENS.AMBIGUOUS;
  const Icon = token.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border transition-colors shadow-sm',
        token.badgeClass,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon size={iconSizes[size]} className="shrink-0" />}
      <span>{token.label}</span>
    </span>
  );
};
