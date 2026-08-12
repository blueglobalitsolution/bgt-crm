import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Printer,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Globe,
  History,
  AlertTriangle,
} from 'lucide-react';
import { Website, WebsiteAudit, AuditPage, AuditIssue, BrokenLink, AuditSeverity } from '../types';
import { auditApi } from '../utils/auditApi';
import { useAuditPolling } from '../hooks/useWebsiteAudit';
import { WebsiteHealthBadge } from './WebsiteHealthBadge';
import {
  SEVERITY_META,
  formatDuration,
  formatSqliteDate,
  formatResponseTime,
} from '../utils/auditFormat';
import { printAuditReport } from '../utils/auditReport';

interface WebsiteAuditDetailProps {
  website: Website;
  auditId: string | null;
  onClose: () => void;
  onRunAudit: (website: Website) => void;
  onChanged: () => void;
}

type Tab = 'overview' | 'issues' | 'links' | 'pages';

const CATEGORIES: Array<{
  key: keyof Pick<WebsiteAudit, 'scoreAvailability' | 'scoreTechnical' | 'scoreLinks' | 'scoreOnpage' | 'scorePerformance' | 'scoreSecurity'>;
  label: string;
  max: number;
}> = [
  { key: 'scoreAvailability', label: 'Website Availability', max: 15 },
  { key: 'scoreTechnical', label: 'Technical SEO', max: 20 },
  { key: 'scoreLinks', label: 'Broken Links', max: 20 },
  { key: 'scoreOnpage', label: 'On-Page SEO', max: 20 },
  { key: 'scorePerformance', label: 'Performance', max: 15 },
  { key: 'scoreSecurity', label: 'Security / SSL', max: 10 },
];

export const WebsiteAuditDetail: React.FC<WebsiteAuditDetailProps> = ({
  website,
  auditId,
  onClose,
  onRunAudit,
  onChanged,
}) => {
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(auditId);
  const [audit, setAudit] = useState<WebsiteAudit | null>(null);
  const [history, setHistory] = useState<WebsiteAudit[]>([]);
  const [pages, setPages] = useState<AuditPage[]>([]);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [severityCounts, setSeverityCounts] = useState<Record<AuditSeverity, number>>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    notice: 0,
  });
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [brokenFilter, setBrokenFilter] = useState<'open' | 'fixed' | 'ignored' | 'all'>('open');
  const [issueFilter, setIssueFilter] = useState<AuditSeverity | 'all'>('all');
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setCurrentAuditId(auditId);
  }, [auditId]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      const [p, iss, bl] = await Promise.all([
        auditApi.getPages(id),
        auditApi.getIssues(id, { severity: 'all', category: 'all' }),
        auditApi.getBrokenLinks(id, 'all'),
      ]);
      setPages(p.pages);
      setIssues(iss.issues);
      setSeverityCounts(iss.severityCounts);
      setBrokenLinks(bl.brokenLinks);
    } catch (e) {
      console.error('Failed to load audit details', e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleAuditUpdate = useCallback(
    (a: WebsiteAudit) => {
      setAudit(a);
      if (a.status === 'completed' || a.status === 'failed') {
        loadDetail(a.id);
        onChanged();
      }
    },
    [loadDetail, onChanged]
  );

  // load audit + history whenever the selected audit changes
  useEffect(() => {
    if (!currentAuditId) return;
    setActiveTab('overview');
    setAudit(null);
    setPages([]);
    setIssues([]);
    setBrokenLinks([]);
    setIssueFilter('all');
    auditApi
      .getAudit(currentAuditId)
      .then((res) => {
        setAudit(res.audit);
        if (res.audit.status === 'completed') loadDetail(currentAuditId);
      })
      .catch(() => {});
    auditApi
      .getAuditsForWebsite(website.id)
      .then((res) => setHistory(res.audits))
      .catch(() => {});
  }, [currentAuditId, website.id, loadDetail]);

  useAuditPolling(currentAuditId, handleAuditUpdate);

  const refetchIssues = useCallback(
    async (filter: AuditSeverity | 'all') => {
      if (!currentAuditId) return;
      const res = await auditApi.getIssues(currentAuditId, { severity: filter, category: 'all' });
      setIssues(res.issues);
      setSeverityCounts(res.severityCounts);
    },
    [currentAuditId]
  );

  const refetchBroken = useCallback(
    async (filter: 'open' | 'fixed' | 'ignored' | 'all') => {
      if (!currentAuditId) return;
      const res = await auditApi.getBrokenLinks(currentAuditId, filter);
      setBrokenLinks(res.brokenLinks);
    },
    [currentAuditId]
  );

  const handleIssueFilter = (f: AuditSeverity | 'all') => {
    setIssueFilter(f);
    refetchIssues(f);
  };

  const handleBrokenFilter = (f: 'open' | 'fixed' | 'ignored' | 'all') => {
    setBrokenFilter(f);
    refetchBroken(f);
  };

  const isRunning = audit && (audit.status === 'running' || audit.status === 'pending');
  const issuesTotal = (audit?.seoIssues ?? 0) + (audit?.technicalIssues ?? 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-blue-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Website Audit
              </span>
              {isRunning && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
                </span>
              )}
              {audit?.status === 'failed' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  FAILED
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {website.domain}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {website.url} {website.name ? `• ${website.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onRunAudit(website)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Audit</span>
            </button>
            {audit?.status === 'completed' && (
              <button
                onClick={() => printAuditReport(audit.id)}
                title="Open printable report"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'issues', label: `Issues (${issuesTotal})` },
              { id: 'links', label: `Broken Links (${audit?.brokenLinks ?? 0})` },
              { id: 'pages', label: `Pages (${audit?.pagesCrawled ?? 0})` },
            ] as Array<{ id: Tab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {currentAuditId === null ? (
            <div className="py-16 text-center">
              <Globe className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                This website hasn't been audited yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Run a website audit to check availability, broken links, SEO and technical health.
              </p>
              <button
                onClick={() => onRunAudit(website)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                Run Audit
              </button>
            </div>
          ) : !audit ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading audit…</p>
            </div>
          ) : audit.status === 'running' || audit.status === 'pending' ? (
            <RunningState audit={audit} />
          ) : audit.status === 'failed' ? (
            <div className="p-8 text-center">
              <XCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Audit failed</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto whitespace-pre-wrap">
                {audit.error || 'Unknown error'}
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  audit={audit}
                  website={website}
                  pages={pages}
                  issues={issues}
                  brokenLinks={brokenLinks}
                  history={history}
                  onSelectHistory={(id) => setCurrentAuditId(id)}
                  onGoIssues={() => setActiveTab('issues')}
                  onGoLinks={() => setActiveTab('links')}
                />
              )}
              {activeTab === 'issues' && (
                <IssuesTab
                  issues={issues}
                  severityCounts={severityCounts}
                  issueFilter={issueFilter}
                  onFilter={handleIssueFilter}
                  loading={loadingDetail}
                />
              )}
              {activeTab === 'links' && (
                <BrokenLinksTab
                  brokenLinks={brokenLinks}
                  filter={brokenFilter}
                  onFilter={handleBrokenFilter}
                  onAction={async (id, action) => {
                    if (action === 'fix') await auditApi.fixBrokenLink(id);
                    else if (action === 'ignore') await auditApi.ignoreBrokenLink(id);
                    else await auditApi.reopenBrokenLink(id);
                    refetchBroken(brokenFilter);
                    onChanged();
                  }}
                  loading={loadingDetail}
                />
              )}
              {activeTab === 'pages' && <PagesTab pages={pages} loading={loadingDetail} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Running state ─────────────────────────────────────────────────────────

interface ProgressEntry {
  id: number;
  auditId: string;
  stage: string;
  message: string;
  createdAt: string;
}

const STAGE_STYLES: Record<string, { chip: string; text: string }> = {
  start: { chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', text: 'text-slate-500' },
  availability: { chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', text: 'text-blue-600' },
  config: { chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', text: 'text-slate-500' },
  crawl: { chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', text: 'text-sky-600' },
  'broken-links': { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', text: 'text-amber-600' },
  seo: { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', text: 'text-emerald-600' },
  score: { chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300', text: 'text-indigo-600' },
  done: { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', text: 'text-emerald-600' },
};

const RunningState: React.FC<{ audit: WebsiteAudit }> = ({ audit }) => {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (audit.status !== 'running' && audit.status !== 'pending') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await auditApi.getProgress(audit.id);
        if (!cancelled) {
          setEntries(res.entries);
          timer = setTimeout(tick, 2000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 3000);
      }
    };
    timer = setTimeout(tick, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audit.id, audit.status]);

  // auto-scroll to newest line
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

  const latest = entries[entries.length - 1];
  const latestStage = latest?.stage || (audit.status === 'pending' ? 'start' : 'crawl');
  const latestStyle = STAGE_STYLES[latestStage] || STAGE_STYLES.crawl;

  return (
    <div className="flex flex-col min-h-0">
      <div className="text-center pb-4">
        <div className="relative mx-auto w-14 h-14 mb-3">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
          <Loader2 className="absolute inset-0 m-auto w-5 h-5 text-blue-600" />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-slate-100">
          {audit.status === 'pending' ? 'Queued…' : 'Audit in progress'}
        </h3>
        {latest && (
          <p className={`text-xs font-semibold mt-1 ${latestStyle.text}`}>{latest.message}</p>
        )}
        <p className="text-[11px] text-slate-400 mt-1">
          Started {formatSqliteDate(audit.startedAt || audit.createdAt)}
        </p>
      </div>

      {/* Live log */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex-1 min-h-[260px] flex flex-col">
        <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Live Audit Log
          </span>
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1.5">
          {entries.length === 0 ? (
            <div className="text-slate-500 italic">Waiting for worker output…</div>
          ) : (
            entries.map((e) => {
              const style = STAGE_STYLES[e.stage] || STAGE_STYLES.crawl;
              return (
                <div key={e.id} className="flex items-start gap-2">
                  <span className="text-slate-600 shrink-0">
                    {e.createdAt ? formatSqliteDate(e.createdAt).split(', ')[1] : ''}
                  </span>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${style.chip}`}>
                    {e.stage}
                  </span>
                  <span className="text-slate-200 break-all">{e.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Overview tab ──────────────────────────────────────────────────────────

interface OverviewTabProps {
  audit: WebsiteAudit;
  website: Website;
  pages: AuditPage[];
  issues: AuditIssue[];
  brokenLinks: BrokenLink[];
  history: WebsiteAudit[];
  onSelectHistory: (id: string) => void;
  onGoIssues: () => void;
  onGoLinks: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  audit,
  website,
  pages,
  issues,
  brokenLinks,
  history,
  onSelectHistory,
  onGoIssues,
  onGoLinks,
}) => {
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;

  return (
    <div className="space-y-5">
      {/* Health score + category bars */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-5 text-white border border-slate-700">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="text-center">
            <div className="text-5xl font-black tracking-tight">
              {audit.healthScore ?? 0}
              <span className="text-lg text-slate-400 font-bold">/100</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
              Website Health Score
            </div>
          </div>
          <div className="flex-1 min-w-[220px] space-y-2">
            {CATEGORIES.map((cat) => {
              const score = audit[cat.key] ?? 0;
              const pct = Math.round((score / cat.max) * 100);
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="text-slate-300 font-medium">{cat.label}</span>
                    <span className="font-bold text-slate-100">
                      {score}/{cat.max}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700/70 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Website status */}
      <SectionCard title="Website Status">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <StatusItem label="Website Online" ok={audit.websiteOnline === 1} text={audit.websiteOnline === 1 ? 'Online' : 'Offline'} />
          <StatusItem label="DNS" ok={audit.domainResolves === 1} text={audit.domainResolves === 1 ? 'Resolves' : 'Fails'} />
          <StatusItem label="HTTPS" ok={audit.httpsEnabled === 1} text={audit.httpsEnabled === 1 ? 'Enabled' : 'Not enabled'} />
          <StatusItem
            label="SSL Certificate"
            ok={audit.sslValid === 1}
            text={audit.sslValid === 1 ? `Valid${audit.sslExpiryDate ? ` (exp ${audit.sslExpiryDate})` : ''}` : 'Invalid / missing'}
          />
          <StatusItem label="HTTP Status" ok={!!audit.httpStatus && audit.httpStatus < 400} text={audit.httpStatus ? `HTTP ${audit.httpStatus}` : 'No response'} />
          <StatusItem label="Response Time" ok={(audit.responseTimeMs ?? 99999) < 3000} text={formatResponseTime(audit.responseTimeMs)} />
        </div>
      </SectionCard>

      {/* Crawl summary */}
      <SectionCard title="Crawl Summary">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatMini label="Pages Crawled" value={audit.pagesCrawled} />
          <StatMini label="Internal Links" value={audit.internalLinks} />
          <StatMini label="External Links" value={audit.externalLinks} />
          <StatMini label="Redirects" value={audit.redirects} />
          <StatMini label="Broken Links" value={audit.brokenLinks} danger={audit.brokenLinks > 0} onClick={onGoLinks} />
          <StatMini label="Broken Images" value={audit.brokenImages} danger={audit.brokenImages > 0} />
          <StatMini label="SEO Issues" value={audit.seoIssues} danger={audit.seoIssues > 0} onClick={onGoIssues} />
          <StatMini label="Duration" value={formatDuration(audit.durationMs)} />
        </div>
      </SectionCard>

      {/* Top issues summary */}
      <SectionCard title="Issue Breakdown">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <SeverityMini label="Critical" count={criticalCount} color="bg-rose-500" />
          <SeverityMini label="High" count={highCount} color="bg-orange-500" />
          <SeverityMini label="Medium" count={mediumCount} color="bg-amber-500" />
          <SeverityMini label="Total" count={audit.seoIssues + audit.technicalIssues} color="bg-slate-500" />
        </div>
        {brokenLinks.length > 0 && (
          <button
            onClick={onGoLinks}
            className="mt-3 w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {brokenLinks.length} broken link(s) found — view & fix
            </span>
            <span>→</span>
          </button>
        )}
      </SectionCard>

      {/* Audit history */}
      {history.length > 0 && (
        <SectionCard title="Audit History">
          <div className="space-y-1.5">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => onSelectHistory(h.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                  h.id === audit.id
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {formatSqliteDate(h.completedAt || h.createdAt)}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">{h.status}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {h.status === 'completed' && <WebsiteHealthBadge score={h.healthScore} />}
                  <span className="text-xs text-slate-400">
                    {h.pagesCrawled} pages · {h.brokenLinks} broken
                  </span>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

// ─── Issues tab ────────────────────────────────────────────────────────────

interface IssuesTabProps {
  issues: AuditIssue[];
  severityCounts: Record<AuditSeverity, number>;
  issueFilter: AuditSeverity | 'all';
  onFilter: (f: AuditSeverity | 'all') => void;
  loading: boolean;
}

const IssuesTab: React.FC<IssuesTabProps> = ({ issues, severityCounts, issueFilter, onFilter, loading }) => {
  const filters: Array<{ id: AuditSeverity | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: `Critical (${severityCounts.critical})` },
    { id: 'high', label: `High (${severityCounts.high})` },
    { id: 'medium', label: `Medium (${severityCounts.medium})` },
    { id: 'low', label: `Low (${severityCounts.low})` },
    { id: 'notice', label: `Notice (${severityCounts.notice})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              issueFilter === f.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : issues.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">No issues found</p>
          <p className="text-xs text-slate-400 mt-1">This filter has no matching issues.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => {
            const meta = SEVERITY_META[issue.severity];
            return (
              <div
                key={issue.id}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800"
              >
                <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.chip}`}>{meta.label}</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{issue.category}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{issue.title}</p>
                  {issue.description && <p className="text-[11px] text-slate-500 mt-0.5">{issue.description}</p>}
                  {issue.recommendation && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">Fix: {issue.recommendation}</p>
                  )}
                  {issue.targetUrl && (
                    <a
                      href={issue.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-slate-500 hover:text-blue-600 break-all inline-flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {issue.targetUrl}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Broken links tab ──────────────────────────────────────────────────────

interface BrokenLinksTabProps {
  brokenLinks: BrokenLink[];
  filter: 'open' | 'fixed' | 'ignored' | 'all';
  onFilter: (f: 'open' | 'fixed' | 'ignored' | 'all') => void;
  onAction: (id: string, action: 'fix' | 'ignore' | 'reopen') => void;
  loading: boolean;
}

const BrokenLinksTab: React.FC<BrokenLinksTabProps> = ({ brokenLinks, filter, onFilter, onAction, loading }) => {
  const filters: Array<{ id: 'open' | 'fixed' | 'ignored' | 'all'; label: string }> = [
    { id: 'open', label: 'Open' },
    { id: 'fixed', label: 'Fixed' },
    { id: 'ignored', label: 'Ignored' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => onFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filter === f.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400">{brokenLinks.length} shown</span>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : brokenLinks.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">No broken links</p>
        </div>
      ) : (
        <div className="space-y-2">
          {brokenLinks.map((bl) => {
            const isFixed = bl.isFixed === 1;
            const isIgnored = bl.isIgnored === 1;
            return (
              <div
                key={bl.id}
                className={`p-3.5 rounded-xl border ${
                  isFixed
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                    : isIgnored
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isFixed
                            ? 'bg-emerald-100 text-emerald-700'
                            : isIgnored
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isFixed ? 'FIXED' : isIgnored ? 'IGNORED' : 'BROKEN'}
                      </span>
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
                        {bl.errorType}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-white/70 dark:bg-slate-700/70 px-1.5 py-0.5 rounded">
                        {bl.linkType}
                      </span>
                    </div>
                    <a
                      href={bl.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all inline-flex items-center gap-1 mt-1.5 hover:text-blue-600"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {bl.linkUrl}
                    </a>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {bl.linkText ? <span className="italic">"{bl.linkText}" </span> : ''}
                      Found on: <span className="break-all">{bl.sourcePageUrl}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!isFixed && !isIgnored && (
                      <>
                        <button
                          onClick={() => onAction(bl.id, 'fix')}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Mark Fixed
                        </button>
                        <button
                          onClick={() => onAction(bl.id, 'ignore')}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                        >
                          Ignore
                        </button>
                      </>
                    )}
                    {(isFixed || isIgnored) && (
                      <button
                        onClick={() => onAction(bl.id, 'reopen')}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Pages tab ─────────────────────────────────────────────────────────────

const PagesTab: React.FC<{ pages: AuditPage[]; loading: boolean }> = ({ pages, loading }) => {
  if (loading) {
    return (
      <div className="py-10 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
          <tr>
            <th className="p-3 pl-4">Page URL</th>
            <th className="p-3 text-center">Score</th>
            <th className="p-3 text-center">Title</th>
            <th className="p-3 text-center">Meta</th>
            <th className="p-3 text-center">H1</th>
            <th className="p-3 text-center">Words</th>
            <th className="p-3 pr-4 text-center">Broken</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
          {pages.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-400">
                No pages crawled.
              </td>
            </tr>
          ) : (
            pages.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td className="p-3 pl-4">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 break-all inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                    {p.url}
                  </a>
                </td>
                <td className="p-3 text-center">
                  <span
                    className={`inline-block min-w-[52px] px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                      (p.score ?? 0) >= 75
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : (p.score ?? 0) >= 50
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {p.score ?? 0}
                  </span>
                </td>
                <td className="p-3 text-center">{p.title ? <CheckIcon ok /> : <CheckIcon ok={false} />}</td>
                <td className="p-3 text-center">{p.metaDescription ? <CheckIcon ok /> : <CheckIcon ok={false} />}</td>
                <td className="p-3 text-center">
                  {(p.h1Count ?? 0) === 1 ? <CheckIcon ok /> : (p.h1Count ?? 0) > 1 ? '⚠' : <CheckIcon ok={false} />}
                </td>
                <td className="p-3 text-center font-medium">{p.wordCount ?? 0}</td>
                <td className="p-3 pr-4 text-center">
                  {(p.brokenLinks ?? 0) > 0 ? (
                    <span className="text-rose-600 font-bold">{p.brokenLinks}</span>
                  ) : (
                    <span className="text-slate-300">0</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const CheckIcon: React.FC<{ ok: boolean }> = ({ ok }) =>
  ok ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
  ) : (
    <XCircle className="w-4 h-4 text-rose-400 mx-auto" />
  );

// ─── small shared UI ───────────────────────────────────────────────────────

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4">
    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
      {title}
    </h4>
    {children}
  </div>
);

const StatusItem: React.FC<{ label: string; ok: boolean; text: string }> = ({ label, ok, text }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className={`font-semibold flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {text}
    </span>
  </div>
);

const StatMini: React.FC<{ label: string; value: string | number; danger?: boolean; onClick?: () => void }> = ({
  label,
  value,
  danger,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`px-3 py-2.5 rounded-xl border text-center ${
      onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''
    } ${danger ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800'}`}
  >
    <div className={`text-xl font-extrabold ${danger ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>
      {value}
    </div>
    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
  </div>
);

const SeverityMini: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center">
    <div className="flex items-center justify-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{count}</span>
    </div>
    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
  </div>
);
