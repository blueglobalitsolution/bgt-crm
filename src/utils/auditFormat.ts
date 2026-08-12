import { AuditSeverity } from '../types';

export function healthMeta(score: number | null): { label: string; color: string; text: string } {
  if (score === null) return { label: 'Not Audited', color: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' };
  if (score >= 90) return { label: 'Excellent', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300', text: 'text-emerald-600' };
  if (score >= 75) return { label: 'Good', color: 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300', text: 'text-green-600' };
  if (score >= 50) return { label: 'Medium', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300', text: 'text-amber-600' };
  return { label: 'Poor', color: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300', text: 'text-rose-600' };
}

export const SEVERITY_META: Record<AuditSeverity, { label: string; chip: string; dot: string }> = {
  critical: { label: 'Critical', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', dot: 'bg-rose-500' },
  high: { label: 'High', chip: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', dot: 'bg-orange-500' },
  medium: { label: 'Medium', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', dot: 'bg-amber-500' },
  low: { label: 'Low', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', dot: 'bg-sky-500' },
  notice: { label: 'Notice', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
};

export function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function formatSqliteDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return raw;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatResponseTime(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} sec`;
}

export function statusLabel(status: number | null): string {
  if (status === null) return 'No response';
  if (status === 0) return 'No response';
  return `HTTP ${status}`;
}

/** Today's LOCAL date as YYYY-MM-DD (not UTC, to avoid off-by-one-day issues). */
export function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Current LOCAL time in 12-hour format, e.g. "2:35 PM". */
export function getLocalNowTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
