import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import {
  Lead,
  LeadStatus,
  LeadPriority,
  LEAD_STATUS_FLOW,
  LEAD_TERMINAL_STATUSES,
  LEAD_STATUS_META,
} from '../types';
import {
  Kanban,
  Phone,
  MessageSquare,
  Eye,
  ChevronRight,
  ChevronLeft,
  Plus,
  Briefcase,
  Search,
  Layers,
} from 'lucide-react';
import { ClientFormModal } from './ClientFormModal';

interface PipelineFunnelViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenComm: (lead: Lead, mode: 'Call' | 'WhatsApp') => void;
  onOpenAddLead: () => void;
  onToggleKanban: () => void;
  selectedStage: LeadStatus | null;
  onSelectStage: (status: LeadStatus | null) => void;
}

const STAGES: { id: LeadStatus; label: string; bar: string; chip: string }[] = [
  { id: 'New', label: 'New', bar: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { id: 'Contacted', label: 'Contacted', bar: 'bg-sky-500', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { id: 'Connected', label: 'Connected', bar: 'bg-teal-500', chip: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
  { id: 'Interested', label: 'Interested', bar: 'bg-indigo-500', chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  { id: 'Qualified', label: 'Qualified', bar: 'bg-cyan-500', chip: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' },
  { id: 'Meeting', label: 'Meeting', bar: 'bg-purple-500', chip: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  { id: 'Proposal Sent', label: 'Proposal Sent', bar: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { id: 'Negotiation', label: 'Negotiation', bar: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { id: 'Won', label: 'Won', bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
];

const PRIORITY_FILTERS: (LeadPriority | 'all')[] = ['all', 'Hot', 'Warm', 'Cold'];
const PAGE_SIZE = 10;

const formatINR = (val?: number) => {
  if (!val) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val}`;
};

export const PipelineFunnelView: React.FC<PipelineFunnelViewProps> = ({
  onSelectLead,
  onOpenComm,
  onOpenAddLead,
  onToggleKanban,
  selectedStage,
  onSelectStage,
}) => {
  const { leads, updateLead, refreshLeads } = useCRM();
  const { can } = useAuth();
  const canMove = can('pipeline.move');
  const [convertLead, setConvertLead] = useState<Lead | null>(null);

  // Drill-down state
  const [page, setPage] = useState(1);
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | 'all'>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const closedLeads = useMemo(() => leads.filter((l) => LEAD_TERMINAL_STATUSES.includes(l.status)), [leads]);

  const stageStats = useMemo(
    () =>
      STAGES.map((s) => {
        const list = leads.filter((l) => l.status === s.id);
        return {
          ...s,
          count: list.length,
          value: list.reduce((acc, l) => acc + (l.expectedValue || 0), 0),
          hot: list.filter((l) => l.priority === 'Hot').length,
        };
      }),
    [leads]
  );

  const maxCount = useMemo(() => Math.max(1, ...stageStats.map((s) => s.count), closedLeads.length), [stageStats, closedLeads.length]);

  const activeTotal = useMemo(
    () => leads.filter((l) => !LEAD_TERMINAL_STATUSES.includes(l.status)).length,
    [leads]
  );
  const pipelineValue = useMemo(
    () => leads.filter((l) => !LEAD_TERMINAL_STATUSES.includes(l.status)).reduce((a, l) => a + (l.expectedValue || 0), 0),
    [leads]
  );
  const hotCount = useMemo(() => leads.filter((l) => l.priority === 'Hot' && !LEAD_TERMINAL_STATUSES.includes(l.status)).length, [leads]);
  const wonValue = useMemo(() => leads.filter((l) => l.status === 'Won').reduce((a, l) => a + (l.expectedValue || 0), 0), [leads]);

  const assignedOptions = useMemo(() => {
    const set = new Set(leads.map((l) => l.assignedTo).filter(Boolean));
    return Array.from(set);
  }, [leads]);

  const drillLeads = useMemo(() => {
    if (!selectedStage) return [];
    let list = LEAD_TERMINAL_STATUSES.includes(selectedStage)
      ? closedLeads
      : leads.filter((l) => l.status === selectedStage);
    if (priorityFilter !== 'all') list = list.filter((l) => l.priority === priorityFilter);
    if (assignedFilter !== 'all') list = list.filter((l) => l.assignedTo === assignedFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.companyName?.toLowerCase().includes(q) ||
          l.contactPerson?.toLowerCase().includes(q) ||
          l.mobile?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedStage, leads, closedLeads, priorityFilter, assignedFilter, query]);

  const totalPages = Math.max(1, Math.ceil(drillLeads.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageLeads = drillLeads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetDrill = () => {
    setPage(1);
    setPriorityFilter('all');
    setAssignedFilter('all');
    setQuery('');
  };

  const selectStage = (status: LeadStatus) => {
    resetDrill();
    onSelectStage(status === selectedStage ? null : status);
  };

  const move = (lead: Lead, direction: 'next' | 'prev') => {
    const idx = STAGES.findIndex((s) => s.id === lead.status);
    if (idx === -1) return;
    const targetIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (targetIdx >= 0 && targetIdx < STAGES.length) updateLead(lead.id, { status: STAGES[targetIdx].id });
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>Sales Pipeline</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visual funnel across {activeTotal} active deals. Click a stage to drill into its leads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleKanban}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Kanban className="w-4 h-4" />
            <span>Kanban View</span>
          </button>
          <button
            onClick={onOpenAddLead}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Active Deals</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">{activeTotal}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Pipeline Value</div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatINR(pipelineValue)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
          <div className="text-[10px] uppercase font-semibold text-slate-400">🔥 Hot Leads</div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">{hotCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Won Value</div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">{formatINR(wonValue)}</div>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Funnel Overview
          </h3>
          <span className="text-[10px] text-slate-400">{maxCount} max in a single stage</span>
        </div>
        <div className="space-y-2">
          {stageStats.map((s) => {
            const pct = Math.round((s.count / maxCount) * 100);
            const selected = selectedStage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => selectStage(s.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer group ${
                  selected ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.chip}`}>{s.label}</span>
                    <span className="text-[10px] text-slate-400">
                      {s.hot > 0 && <span className="text-rose-500 font-semibold">🔥 {s.hot} hot · </span>}
                      {formatINR(s.value)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{s.count}</span>
                    {selected && <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">▼ OPEN</span>}
                  </div>
                </div>
                <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.bar} transition-all`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </button>
            );
          })}

          {/* Closed column */}
          <button
            onClick={() => selectStage('Lost')}
            className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
              selectedStage === 'Lost' ? 'border-slate-400 ring-2 ring-slate-200 dark:ring-slate-700 bg-slate-100/60 dark:bg-slate-800/40' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Closed / Not Active</span>
                <span className="text-[10px] text-slate-400">Lost · Not Interested · No Response</span>
              </div>
              <span className="text-sm font-extrabold text-slate-500 dark:text-slate-400">{closedLeads.length}</span>
            </div>
            <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-slate-400 transition-all" style={{ width: `${Math.max(2, Math.round((closedLeads.length / maxCount) * 100))}%` }} />
            </div>
          </button>
        </div>
      </div>

      {/* Drill-down */}
      {selectedStage && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          {/* Drill header + filters */}
          <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {LEAD_TERMINAL_STATUSES.includes(selectedStage) ? 'Closed / Not Active' : selectedStage}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {drillLeads.length} leads
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search company / contact…"
                  className="pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as LeadPriority | 'all');
                  setPage(1);
                }}
                className="py-1.5 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100"
              >
                {PRIORITY_FILTERS.map((p) => (
                  <option key={p} value={p}>
                    {p === 'all' ? 'All priorities' : p === 'Hot' ? '🔥 Hot' : p === 'Warm' ? '🟡 Warm' : '🔵 Cold'}
                  </option>
                ))}
              </select>
              <select
                value={assignedFilter}
                onChange={(e) => {
                  setAssignedFilter(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="all">All members</option>
                {assignedOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800 whitespace-nowrap">
                  <th className="px-3 py-2.5">Company</th>
                  <th className="px-3 py-2.5">Contact</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5 text-right">Value</th>
                  <th className="px-3 py-2.5">Assigned</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {pageLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                      No leads match the current filters.
                    </td>
                  </tr>
                ) : (
                  pageLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer line-clamp-1"
                        >
                          {lead.companyName}
                        </button>
                        <div className="text-[10px] text-slate-400 truncate">
                          {lead.interestedServices?.slice(0, 2).join(' · ')}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{lead.contactPerson}</div>
                        <div className="text-[10px] text-slate-400">{lead.mobile}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            lead.priority === 'Hot'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : lead.priority === 'Warm'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                          }`}
                        >
                          {lead.priority === 'Hot' ? '🔥' : lead.priority === 'Warm' ? '🟡' : '🔵'} {lead.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatINR(lead.expectedValue)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{lead.assignedTo || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => onOpenComm(lead, 'Call')} title="Call" className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                            <Phone className="w-3 h-3" />
                          </button>
                          <button onClick={() => onOpenComm(lead, 'WhatsApp')} title="WhatsApp" className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50">
                            <MessageSquare className="w-3 h-3" />
                          </button>
                          <button onClick={() => onSelectLead(lead)} title="View lead" className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700">
                            <Eye className="w-3 h-3" />
                          </button>
                          {lead.status === 'Won' && can('customers.manage') && (
                            <button onClick={() => setConvertLead(lead)} title="Convert to Client" className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                              <Briefcase className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canMove && !LEAD_TERMINAL_STATUSES.includes(lead.status) && (
                            <>
                              <button onClick={() => move(lead, 'prev')} title="Previous stage" className="p-1.5 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700">
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => move(lead, 'next')} title="Next stage" className="p-1.5 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700">
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, drillLeads.length)} of {drillLeads.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 px-2">
                Page {safePage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ClientFormModal
        isOpen={convertLead !== null}
        lead={convertLead}
        onClose={() => setConvertLead(null)}
        onSaved={() => {
          setConvertLead(null);
          refreshLeads();
        }}
      />
    </div>
  );
};
