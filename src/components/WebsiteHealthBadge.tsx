import React from 'react';
import { healthMeta } from '../utils/auditFormat';

interface WebsiteHealthBadgeProps {
  score: number | null;
  size?: 'sm' | 'lg';
}

export const WebsiteHealthBadge: React.FC<WebsiteHealthBadgeProps> = ({ score, size = 'sm' }) => {
  const meta = healthMeta(score);
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        No Audit
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl font-bold ${meta.color} ${
        size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-[10px]'
      }`}
      title={meta.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`} />
      {score}/100
    </span>
  );
};
