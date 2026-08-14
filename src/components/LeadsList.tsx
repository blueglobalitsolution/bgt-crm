import React, { useState, useMemo, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { Lead, LeadStatus, LeadPriority, DIGITAL_MARKETING_SERVICES, LEAD_SOURCES, TECH_STATUS_FIELDS, LEAD_STATUS_FLOW, LEAD_TERMINAL_STATUSES, LEAD_STATUS_META } from '../types';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { getLocalToday } from '../utils/auditFormat';
import { auditApi } from '../utils/auditApi';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Phone,
  MessageSquare,
  Eye,
  Filter,
  Archive,
  Sparkles,
  ArrowUpDown,
  MoreVertical,
  CalendarRange,
  X,
} from 'lucide-react';

interface LeadsListProps {
  onSelectLead: (lead: Lead) => void;
  onOpenComm: (lead: Lead, mode: 'Call' | 'WhatsApp') => void;
  onOpenAddLead: () => void;
}

export const LeadsList: React.FC<LeadsListProps> = ({
  onSelectLead,
  onOpenComm,
  onOpenAddLead,
}) => {
  const { leads, deleteLead, setActiveTab } = useCRM();
  const { users, can, isAdmin } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [dateField, setDateField] = useState<'created' | 'followup'>('created');
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>(() => {
    try {
      const saved = localStorage.getItem('bgt_crm_leads_date_filter_v1');
      if (saved) {
        const p = JSON.parse(saved);
        return { from: p?.from || '', to: p?.to || '' };
      }
    } catch {
      /* ignore */
    }
    return { from: '', to: '' };
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [listView, setListView] = useState<'active' | 'won'>('active');
  const [convertedLeadIds, setConvertedLeadIds] = useState<Set<string>>(new Set());

  // A Won lead is "pending conversion" until a Client record exists for it.
  // Refresh the client set on mount and each time the Won tab is opened.
  useEffect(() => {
    let cancelled = false;
    auditApi
      .listClients()
      .then((res) => {
        if (!cancelled) {
          setConvertedLeadIds(new Set(res.clients.map((c) => c.leadId).filter(Boolean) as string[]));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listView]);

  const switchView = (view: 'active' | 'won') => {
    setListView(view);
    setSelectedStatus('all');
    setPage(1);
  };

  // Persist the date filter so it survives a page refresh.
  useEffect(() => {
    try {
      localStorage.setItem('bgt_crm_leads_date_filter_v1', JSON.stringify(dateFilter));
    } catch {
      /* ignore */
    }
  }, [dateFilter]);

  const dateStr = (d?: Date) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  const fmtShort = (s: string) =>
    s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '…';
  const range = {
    from: dateFilter.from ? new Date(`${dateFilter.from}T00:00:00`) : undefined,
    to: dateFilter.to ? new Date(`${dateFilter.to}T00:00:00`) : undefined,
  };

  const handleRangeSelect = (r?: { from?: Date; to?: Date }) => {
    setDateFilter({ from: dateStr(r?.from), to: dateStr(r?.to) });
    if (r?.from && r?.to) setDatePickerOpen(false);
  };

  const applyDatePreset = (days: number | 'month') => {
    const now = new Date();
    let from: Date;
    if (days === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now);
      from.setDate(now.getDate() - (days - 1));
    }
    setDateFilter({ from: dateStr(from), to: dateStr(now) });
    setDatePickerOpen(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // View bases: Active (everything except Won) vs Won (pending conversion only)
  const activeLeads = useMemo(() => leads.filter((l) => l.status !== 'Won'), [leads]);
  const pendingWon = useMemo(
    () => leads.filter((l) => l.status === 'Won' && !convertedLeadIds.has(l.id)),
    [leads, convertedLeadIds]
  );
  const viewTotal = listView === 'won' ? pendingWon.length : activeLeads.length;

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    const base = listView === 'won' ? pendingWon : activeLeads;
    return base.filter((lead) => {
      // Search text match
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        !query ||
        lead.companyName?.toLowerCase().includes(query) ||
        lead.contactPerson?.toLowerCase().includes(query) ||
        lead.mobile?.includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.city?.toLowerCase().includes(query) ||
        lead.requirementNotes?.toLowerCase().includes(query);

      // Filters
      const matchesStatus =
        listView === 'won' || selectedStatus === 'all' || lead.status === selectedStatus;
      const matchesService =
        selectedService === 'all' || lead.interestedServices?.includes(selectedService);
      const matchesSource = selectedSource === 'all' || lead.leadSource === selectedSource;
      const matchesPriority = selectedPriority === 'all' || lead.priority === selectedPriority;
      const matchesSalesperson =
        selectedSalesperson === 'all' || lead.assignedTo === selectedSalesperson;

      // Date range filter (created or follow-up date)
      let matchesDate = true;
      if (dateFilter.from || dateFilter.to) {
        const d = dateField === 'followup' ? lead.nextFollowupDate || '' : (lead.createdAt || '').slice(0, 10);
        if (!d) matchesDate = false;
        else {
          if (dateFilter.from && d < dateFilter.from) matchesDate = false;
          if (matchesDate && dateFilter.to && d > dateFilter.to) matchesDate = false;
        }
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesService &&
        matchesSource &&
        matchesPriority &&
        matchesSalesperson &&
        matchesDate
      );
    });
  }, [
    listView,
    activeLeads,
    pendingWon,
    searchTerm,
    selectedStatus,
    selectedService,
    selectedSource,
    selectedPriority,
    selectedSalesperson,
    dateField,
    dateFilter,
  ]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedStatus, selectedService, selectedSource, selectedPriority, selectedSalesperson, dateField, dateFilter, listView]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedLeads = filteredLeads.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Status Badge Color helper
  const getStatusBadge = (status: LeadStatus) => LEAD_STATUS_META[status]?.color || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';

  const getPriorityBadge = (priority: LeadPriority) => {
    switch (priority) {
      case 'Hot':
        return 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200';
      case 'Warm':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200';
      case 'Cold':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200';
    }
  };

  const formatFollowupDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    if (dateStr < todayStr) return <span className="text-rose-600 font-semibold">Overdue</span>;
    if (dateStr === todayStr) return <span className="text-amber-600 font-semibold">Today</span>;
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Leads Database</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {listView === 'won'
              ? `Showing ${filteredLeads.length} of ${viewTotal} won lead(s) pending conversion`
              : `Showing ${filteredLeads.length} of ${viewTotal} active prospects`}
            {!isAdmin && ' — only leads assigned to you'}
            {(dateFilter.from || dateFilter.to) && (
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {' '}· filtered by date: {fmtShort(dateFilter.from)} – {fmtShort(dateFilter.to)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can('import.excel') && (
            <button
              onClick={() => setActiveTab('import')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Excel</span>
            </button>
          )}
          {can('leads.add') && (
            <button
              onClick={onOpenAddLead}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Active / Won tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs font-semibold w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => switchView('active')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            listView === 'active' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Active Leads ({activeLeads.length})
        </button>
        <button
          onClick={() => switchView('won')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            listView === 'won' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Won — Pending Conversion ({pendingWon.length})
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        {/* Date-wise filter row (persists across refresh) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setDatePickerOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
                dateFilter.from || dateFilter.to
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              {dateFilter.from || dateFilter.to
                ? `${fmtShort(dateFilter.from)} – ${fmtShort(dateFilter.to)}`
                : 'Date Range'}
            </button>

            {datePickerOpen && (
              <div className="absolute left-0 top-11 z-30 max-w-[92vw] max-h-[70vh] overflow-y-auto overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3">
                <DayPicker
                  mode="range"
                  selected={range}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                  defaultMonth={range.from}
                />
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {dateFilter.from ? fmtShort(dateFilter.from) : 'Start'} – {dateFilter.to ? fmtShort(dateFilter.to) : 'End'}
                  </span>
                  <button
                    onClick={() => {
                      setDateFilter({ from: '', to: '' });
                      setDatePickerOpen(false);
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {(dateFilter.from || dateFilter.to) && (
            <button
              onClick={() => {
                setDateFilter({ from: '', to: '' });
                setDatePickerOpen(false);
              }}
              title="Clear date filter"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { label: 'Today', run: () => applyDatePreset(1) },
                { label: 'Last 7 Days', run: () => applyDatePreset(7) },
                { label: 'This Month', run: () => applyDatePreset('month') },
                { label: 'All', run: () => { setDateFilter({ from: '', to: '' }); setDatePickerOpen(false); } },
              ] as Array<{ label: string; run: () => void }>
            ).map((preset) => (
              <button
                key={preset.label}
                onClick={preset.run}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <select
            value={dateField}
            onChange={(e) => setDateField(e.target.value as 'created' | 'followup')}
            className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="created">Created Date</option>
            <option value="followup">Follow-up Date</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Company, Contact, Phone..."
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
          </div>

          {/* Status Filter (active view only — Won has its own tab) */}
          {listView === 'active' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            >
              <option value="all">Status: All</option>
              {LEAD_STATUS_FLOW.filter((s) => s !== 'Won').map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {LEAD_TERMINAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Service Filter */}
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="all">Service: All</option>
            {DIGITAL_MARKETING_SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="all">Priority: All</option>
            <option value="Hot">🔥 Hot Priority</option>
            <option value="Warm">🟡 Warm Priority</option>
            <option value="Cold">🔵 Cold Priority</option>
          </select>

          {/* Salesperson Filter */}
          <select
            value={selectedSalesperson}
            onChange={(e) => setSelectedSalesperson(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          >
            <option value="all">Salesperson: All</option>
            {users
              .filter((u) => u.active === 1)
              .map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="p-3.5 pl-5 w-12 max-md:sticky max-md:left-0 max-md:z-20 max-md:bg-slate-50 max-md:dark:bg-[#162234]">#</th>
                <th className="p-3.5 max-md:sticky max-md:left-12 max-md:z-20 max-md:bg-slate-50 max-md:dark:bg-[#162234]">Company Name</th>
                <th className="p-3.5">Contact Person</th>
                <th className="p-3.5">Interested Services</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Follow-up</th>
                <th className="p-3.5">Assigned To</th>
                <th className="p-3.5">Tech</th>
                <th className="p-3.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    {listView === 'won'
                      ? 'No won leads pending conversion. Converted customers live under Customers.'
                      : 'No leads found matching criteria.'}
                  </td>
                </tr>
              ) : (
                pagedLeads.map((lead, idx) => {
                  const numStr = ((safePage - 1) * pageSize + idx + 1).toString().padStart(2, '0');
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="p-3.5 pl-5 font-mono text-slate-400 font-medium max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-white max-md:dark:bg-slate-900 max-md:group-hover:bg-slate-50 max-md:group-hover:dark:bg-slate-800">{numStr}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 max-md:sticky max-md:left-12 max-md:z-10 max-md:bg-white max-md:dark:bg-slate-900 max-md:group-hover:bg-slate-50 max-md:group-hover:dark:bg-slate-800">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                        >
                          {lead.companyName}
                        </button>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {lead.city ? `${lead.city}, ${lead.state || ''}` : lead.industry || ''}
                        </div>
                        {listView === 'won' && (
                          <div className="mt-0.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              Pending Conversion
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {lead.contactPerson}
                        </div>
                        <div className="text-[10px] text-slate-500">{lead.mobile}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {lead.interestedServices?.slice(0, 2).map((srv) => (
                            <span
                              key={srv}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
                            >
                              {srv}
                            </span>
                          ))}
                          {lead.interestedServices?.length > 2 && (
                            <span className="text-[10px] font-medium text-slate-400 self-center">
                              +{lead.interestedServices.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight inline-block ${getStatusBadge(
                            lead.status
                          )}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPriorityBadge(
                            lead.priority
                          )}`}
                        >
                          {lead.priority === 'Hot' ? '🔥 Hot' : lead.priority === 'Warm' ? '🟡 Warm' : '🔵 Cold'}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium">{formatFollowupDate(lead.nextFollowupDate)}</td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 font-medium">
                        {lead.assignedTo || 'Unassigned'}
                      </td>
                      <td className="p-3.5">
                        <TechDots lead={lead} />
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenComm(lead, 'Call')}
                            title="Call Lead"
                            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenComm(lead, 'WhatsApp')}
                            title="WhatsApp Lead"
                            className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectLead(lead)}
                            title="View Details"
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {can('leads.archive') && (
                            <button
                              onClick={async () => {
                                if (confirm(`Archive "${lead.companyName}" to the Datacenter? It can be restored later.`)) {
                                  await deleteLead(lead.id);
                                }
                              }}
                              title="Archive to Datacenter"
                              className="p-2 rounded-lg text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredLeads.length > pageSize && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500">
              Showing{' '}
              <strong>
                {filteredLeads.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredLeads.length)}
              </strong>{' '}
              of <strong>{filteredLeads.length}</strong>
            </span>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 dark:text-slate-100"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={250}>250 / page</option>
              </select>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-[11px] text-slate-500 font-mono">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TechDots: React.FC<{ lead: Lead }> = ({ lead }) => {
  const present = (v?: string) =>
    !!v && !['no', 'n', '0', 'false', '-', '—', 'na', 'n/a'].includes(v.trim().toLowerCase());
  const anyPresent = TECH_STATUS_FIELDS.some(({ key }) => present(lead[key as keyof Lead] as string | undefined));
  if (!anyPresent) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <div className="flex items-center gap-1" title={TECH_STATUS_FIELDS.map(({ key, label }) => `${label}: ${lead[key as keyof Lead] || '—'}`).join(' · ')}>
      {TECH_STATUS_FIELDS.map(({ key, label }) => {
        const value = lead[key as keyof Lead] as string | undefined;
        const ok = present(value);
        return (
          <span
            key={key}
            title={`${label}: ${value || 'Not set'}`}
            className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
          />
        );
      })}
    </div>
  );
};
