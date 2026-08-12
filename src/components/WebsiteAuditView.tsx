import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Website } from '../types';
import { useWebsiteAudit, useAuditPolling } from '../hooks/useWebsiteAudit';
import { auditApi, StartAuditOptions } from '../utils/auditApi';
import { WebsiteHealthBadge } from './WebsiteHealthBadge';
import { WebsiteFormModal } from './WebsiteFormModal';
import { AuditRunModal } from './AuditRunModal';
import { WebsiteAuditDetail } from './WebsiteAuditDetail';
import {
  Globe,
  Plus,
  Play,
  Eye,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  Activity,
  Link2,
  FileSearch,
  ShieldCheck,
  Building2,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  FilterX,
} from 'lucide-react';
import { formatResponseTime, formatSqliteDate } from '../utils/auditFormat';

type StatusFilter = 'all' | 'online' | 'offline' | 'unresponsive' | 'running' | 'no-audit';
type HealthFilter = 'all' | 'excellent' | 'good' | 'fair' | 'poor' | 'none';
type IssuesFilter = 'all' | 'broken' | 'seo' | 'attention';
type SortKey = 'health' | 'broken' | 'seo' | 'tech' | 'pages' | 'resp' | 'audited' | 'status' | 'domain' | 'company';

export const WebsiteAuditView: React.FC<{ autoOpenDomain?: string | null; onConsumedAutoOpen?: () => void }> = ({
  autoOpenDomain,
  onConsumedAutoOpen,
}) => {
  const { leads } = useCRM();
  const { websites, stats, loading, error, refresh, syncLeadsWebsites, startAudit } = useWebsiteAudit();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [issuesFilter, setIssuesFilter] = useState<IssuesFilter>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>('audited');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [formOpen, setFormOpen] = useState(false);
  const [websiteToEdit, setWebsiteToEdit] = useState<Website | null>(null);
  const [runWebsite, setRunWebsite] = useState<Website | null>(null);
  const [detail, setDetail] = useState<{ website: Website; auditId: string | null } | null>(null);
  const [runningAudits, setRunningAudits] = useState<Set<string>>(new Set());

  useEffect(() => {
    syncLeadsWebsites(leads);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normDomain = (url: string) =>
    url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();

  // Open a website's audit detail when navigated to from elsewhere in the CRM.
  // If the website has no completed audit yet, also open the Run-Audit config modal
  // so the user can configure & start it (instead of a dead "loading" state).
  useEffect(() => {
    if (!autoOpenDomain) return;
    const target = normDomain(autoOpenDomain);
    const match = websites.find((w) => normDomain(w.url) === target || normDomain(w.domain) === target);
    if (match) {
      setDetail({ website: match, auditId: match.latestAudit?.id || null });
      const latest = match.latestAudit;
      if (!latest || latest.status !== 'completed') {
        setRunWebsite(match);
      }
      onConsumedAutoOpen?.();
    }
  }, [autoOpenDomain, websites, onConsumedAutoOpen]);

  // Poll any running audits so the list updates live
  useAuditPolling(detail?.auditId ?? null, () => refresh());

  const leadName = (leadId?: string) => {
    if (!leadId) return null;
    const lead = leads.find((l) => l.id === leadId);
    return lead ? lead.companyName : null;
  };

  const websiteStatus = (w: Website): 'running' | 'no-audit' | 'failed' | 'online' | 'unresponsive' | 'offline' => {
    const a = w.latestAudit;
    if (!a) return 'no-audit';
    if (a.status === 'running' || a.status === 'pending') return 'running';
    if (a.status === 'failed') return 'failed';
    if (a.websiteOnline === 1) return 'online';
    if (a.unresponsive === 1) return 'unresponsive';
    return 'offline';
  };

  const customerList = useMemo(() => {
    const names = new Set<string>();
    websites.forEach((w) => {
      const name = leadName(w.leadId);
      if (name) names.add(name);
    });
    return Array.from(names).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websites, leads]);

  const sortValue = (w: Website, key: SortKey): number | string => {
    const a = w.latestAudit;
    switch (key) {
      case 'health':
        return a?.status === 'completed' ? (a.healthScore ?? -1) : -1;
      case 'broken':
        return a?.brokenLinks ?? 0;
      case 'seo':
        return a?.seoIssues ?? 0;
      case 'tech':
        return a?.technicalIssues ?? 0;
      case 'pages':
        return a?.pagesCrawled ?? 0;
      case 'resp':
        return a?.responseTimeMs ?? Number.MAX_SAFE_INTEGER;
      case 'audited':
        return a?.completedAt || a?.startedAt || a?.createdAt || '';
      case 'status':
        return websiteStatus(w);
      case 'domain':
        return w.domain;
      case 'company':
        return leadName(w.leadId) || '';
      default:
        return 0;
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return websites
      .filter((w) => {
        const a = w.latestAudit;
        const company = leadName(w.leadId) || '';
        const status = websiteStatus(w);

        // search
        if (
          q &&
          !w.domain.toLowerCase().includes(q) &&
          !w.url.toLowerCase().includes(q) &&
          !(w.name || '').toLowerCase().includes(q) &&
          !company.toLowerCase().includes(q)
        ) {
          return false;
        }

        // status
        if (statusFilter !== 'all' && status !== statusFilter) return false;

        // health
        if (healthFilter !== 'all') {
          const h = a?.status === 'completed' ? a.healthScore : null;
          if (healthFilter === 'none') {
            if (h !== null) return false;
          } else {
            if (h === null) return false;
            if (healthFilter === 'excellent' && !(h >= 90)) return false;
            if (healthFilter === 'good' && !(h >= 75 && h < 90)) return false;
            if (healthFilter === 'fair' && !(h >= 50 && h < 75)) return false;
            if (healthFilter === 'poor' && !(h < 50)) return false;
          }
        }

        // issues
        if (issuesFilter === 'broken' && !((a?.brokenLinks ?? 0) > 0)) return false;
        if (issuesFilter === 'seo' && !((a?.seoIssues ?? 0) > 0)) return false;
        if (issuesFilter === 'attention' && !(((a?.brokenLinks ?? 0) + (a?.seoIssues ?? 0) + (a?.technicalIssues ?? 0)) > 0)) return false;

        // customer
        if (customerFilter !== 'all' && company !== customerFilter) return false;

        return true;
      })
      .sort((x, y) => {
        if (!sortKey) return 0;
        const av = sortValue(x, sortKey);
        const bv = sortValue(y, sortKey);
        let cmp = 0;
        if (av < bv) cmp = -1;
        else if (av > bv) cmp = 1;
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [websites, searchTerm, statusFilter, healthFilter, issuesFilter, customerFilter, sortKey, sortDir, leads]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'audited' ? 'desc' : 'asc');
    }
  };

  const hasActiveFilters =
    searchTerm || statusFilter !== 'all' || healthFilter !== 'all' || issuesFilter !== 'all' || customerFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setHealthFilter('all');
    setIssuesFilter('all');
    setCustomerFilter('all');
  };

  const handleStartAudit = async (website: Website, options: StartAuditOptions) => {
    const audit = await startAudit(website.id, options);
    setRunningAudits((prev) => new Set(prev).add(website.id));
    setDetail({ website, auditId: audit.id });
  };

  const handleDelete = async (website: Website) => {
    if (!confirm(`Delete website "${website.domain}" and all its audits?`)) return;
    await auditApi.deleteWebsite(website.id);
    await refresh();
  };

  const statCards = [
    { label: 'Average Health', value: stats ? stats.averageHealthScore : 0, suffix: '/100', icon: Activity, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
    { label: 'Broken Links', value: stats ? stats.totalBrokenLinks : 0, icon: Link2, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50' },
    { label: 'SEO Issues', value: stats ? stats.totalSeoIssues : 0, icon: FileSearch, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50' },
    { label: 'Sites Online', value: stats ? stats.websitesOnline : 0, icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <span>Website Audit Engine</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Crawl customer websites, detect broken links & SEO issues, and generate sales-ready health reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setWebsiteToEdit(null);
              setFormOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Website</span>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {card.value}
                {card.suffix && <span className="text-sm text-slate-400 font-bold">{card.suffix}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search domain, customer, URL…"
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="all">Status: All</option>
            <option value="online">🟢 Online</option>
            <option value="offline">🔴 Offline</option>
            <option value="unresponsive">🟠 Unresponsive</option>
            <option value="running">⏳ Running</option>
            <option value="no-audit">No Audit</option>
          </select>

          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value as HealthFilter)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="all">Health: All</option>
            <option value="excellent">🟢 90+ Excellent</option>
            <option value="good">🟢 75–89 Good</option>
            <option value="fair">🟡 50–74 Fair</option>
            <option value="poor">🔴 Below 50</option>
            <option value="none">No Audit</option>
          </select>

          <select
            value={issuesFilter}
            onChange={(e) => setIssuesFilter(e.target.value as IssuesFilter)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="all">Issues: All</option>
            <option value="broken">Has broken links</option>
            <option value="seo">Has SEO issues</option>
            <option value="attention">Needs attention</option>
          </select>

          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="all">Customer: All</option>
            {customerList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-2">
            Showing <strong className="text-slate-800 dark:text-slate-200">{filtered.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{websites.length}</strong> websites
            {loading && websites.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Refreshing…
              </span>
            )}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <FilterX className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Table */}
      {websites.length === 0 && !loading ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
          <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800 dark:text-slate-200">No websites yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add a customer website to run its first health audit. Websites linked to leads appear here automatically.
          </p>
          <button
            onClick={() => {
              setWebsiteToEdit(null);
              setFormOpen(true);
            }}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 mx-auto"
          >
            <Plus className="w-4 h-4" /> Add Website
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                  <SortableTh label="Customer" sortable onClick={() => handleSort('company')} active={sortKey === 'company'} dir={sortDir} />
                  <SortableTh label="Website" sortable onClick={() => handleSort('domain')} active={sortKey === 'domain'} dir={sortDir} />
                  <SortableTh label="Health" sortable onClick={() => handleSort('health')} active={sortKey === 'health'} dir={sortDir} className="text-center" />
                  <SortableTh label="Status" sortable onClick={() => handleSort('status')} active={sortKey === 'status'} dir={sortDir} />
                  <th className="p-2">SSL</th>
                  <th className="p-2">HTTP</th>
                  <SortableTh label="Resp" sortable onClick={() => handleSort('resp')} active={sortKey === 'resp'} dir={sortDir} />
                  <SortableTh label="Pages" sortable onClick={() => handleSort('pages')} active={sortKey === 'pages'} dir={sortDir} className="text-right" />
                  <SortableTh label="Broken" sortable onClick={() => handleSort('broken')} active={sortKey === 'broken'} dir={sortDir} className="text-right" />
                  <SortableTh label="Img" sortable onClick={() => handleSort('broken')} active={false} dir={sortDir} className="text-right" />
                  <SortableTh label="SEO" sortable onClick={() => handleSort('seo')} active={sortKey === 'seo'} dir={sortDir} className="text-right" />
                  <SortableTh label="Tech" sortable onClick={() => handleSort('tech')} active={sortKey === 'tech'} dir={sortDir} className="text-right" />
                  <SortableTh label="Audited" sortable onClick={() => handleSort('audited')} active={sortKey === 'audited'} dir={sortDir} />
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.length === 0 ? (
                  websites.length === 0 && loading ? (
                    <tr>
                      <td colSpan={14} className="p-10 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={14} className="p-10 text-center text-slate-500">
                        No websites match the current filters.
                      </td>
                    </tr>
                  )
                ) : (
                  filtered.map((website) => {
                    const audit = website.latestAudit;
                    const company = leadName(website.leadId);
                    const status = websiteStatus(website);
                    const isRunning = status === 'running';
                    const completed = audit?.status === 'completed';
                    return (
                      <tr key={website.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors whitespace-nowrap">
                        {/* Customer */}
                        <td className="p-2 pl-4">
                          {company ? (
                            <span className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 font-medium">
                              <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate max-w-[120px]">{company}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        {/* Website */}
                        <td className="p-2">
                          <button
                            onClick={() => setDetail({ website, auditId: audit?.id || null })}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[150px]"
                            title={website.domain}
                          >
                            {website.domain}
                          </button>
                          <a
                            href={website.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[10px] text-slate-400 hover:text-blue-600 truncate max-w-[150px]"
                          >
                            {website.url}
                          </a>
                        </td>
                        {/* Health */}
                        <td className="p-2 text-center">
                          {completed ? (
                            <WebsiteHealthBadge score={audit.healthScore} />
                          ) : isRunning ? (
                            <span className="text-slate-400 font-mono">…</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="p-2">
                          <StatusChip status={status} />
                        </td>
                        {/* SSL */}
                        <td className="p-2">
                          {completed ? (
                            audit.sslValid === 1 ? (
                              <span className="text-emerald-600 font-semibold">✓ Valid</span>
                            ) : (
                              <span className="text-rose-600 font-semibold">✗ Issue</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        {/* HTTP */}
                        <td className="p-2 font-mono">
                          {completed ? (audit.httpStatus ? audit.httpStatus : <span className="text-rose-600">—</span>) : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Resp */}
                        <td className="p-2 text-slate-600 dark:text-slate-400">
                          {completed ? formatResponseTime(audit.responseTimeMs) : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Pages */}
                        <td className="p-2 text-right font-mono">{completed ? audit.pagesCrawled : <span className="text-slate-300">—</span>}</td>
                        {/* Broken */}
                        <td className={`p-2 text-right font-mono ${(audit?.brokenLinks ?? 0) > 0 ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {completed ? audit.brokenLinks : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Img */}
                        <td className={`p-2 text-right font-mono ${(audit?.brokenImages ?? 0) > 0 ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {completed ? audit.brokenImages : <span className="text-slate-300">—</span>}
                        </td>
                        {/* SEO */}
                        <td className={`p-2 text-right font-mono ${(audit?.seoIssues ?? 0) > 0 ? 'text-amber-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {completed ? audit.seoIssues : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Tech */}
                        <td className={`p-2 text-right font-mono ${(audit?.technicalIssues ?? 0) > 0 ? 'text-amber-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {completed ? audit.technicalIssues : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Audited */}
                        <td className="p-2 text-slate-500 dark:text-slate-400">
                          {audit
                            ? audit.status === 'completed'
                              ? formatSqliteDate(audit.completedAt || audit.createdAt)
                              : audit.status === 'failed'
                                ? 'Failed'
                                : 'Running…'
                            : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Actions */}
                        <td className="p-2 pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setRunWebsite(website)}
                              disabled={isRunning}
                              title="Run audit"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-40 transition-colors"
                            >
                              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setDetail({ website, auditId: audit?.id || null })}
                              title="View details"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setWebsiteToEdit(website);
                                setFormOpen(true);
                              }}
                              title="Edit website"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(website)}
                              title="Delete website"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals & Drawer */}
      <WebsiteFormModal
        isOpen={formOpen}
        website={websiteToEdit}
        leads={leads}
        onClose={() => {
          setFormOpen(false);
          setWebsiteToEdit(null);
        }}
        onSaved={refresh}
      />

      <AuditRunModal
        website={runWebsite}
        onClose={() => setRunWebsite(null)}
        onConfirm={async (options) => {
          if (runWebsite) await handleStartAudit(runWebsite, options);
        }}
      />

      {detail && (
        <WebsiteAuditDetail
          website={detail.website}
          auditId={detail.auditId}
          onClose={() => setDetail(null)}
          onRunAudit={(website) => setRunWebsite(website)}
          onChanged={refresh}
        />
      )}
    </div>
  );
};

// ─── Table helpers ──────────────────────────────────────────────────────────

const SortableTh: React.FC<{
  label: string;
  sortable?: boolean;
  onClick?: () => void;
  active?: boolean;
  dir?: 'asc' | 'desc';
  className?: string;
}> = ({ label, sortable, onClick, active, dir, className }) => (
  <th
    onClick={onClick}
    className={`p-2 select-none ${sortable ? 'cursor-pointer hover:text-slate-800 dark:hover:text-slate-100' : ''} ${className || ''}`}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sortable &&
        (active ? (
          dir === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-blue-600" />
          ) : (
            <ArrowDown className="w-3 h-3 text-blue-600" />
          )
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-40" />
        ))}
    </span>
  </th>
);

const STATUS_META: Record<string, { label: string; cls: string }> = {
  online: { label: 'Online', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  offline: { label: 'Offline', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  unresponsive: { label: 'Unresponsive', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  running: { label: 'Running', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  failed: { label: 'Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  'no-audit': { label: 'No Audit', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META['no-audit'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.cls}`}>
      {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
      {meta.label}
    </span>
  );
};
