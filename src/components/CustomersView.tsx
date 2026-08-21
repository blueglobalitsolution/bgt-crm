import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { Lead, Client } from '../types';
import { auditApi } from '../utils/auditApi';
import { onboardingProgress } from '../utils/onboardingFields';
import { ClientFormModal } from './ClientFormModal';
import { CustomerDetailView } from './CustomerDetailView';
import {
  Building2,
  Phone,
  MessageSquare,
  Eye,
  Briefcase,
  Play,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  UserPlus,
} from 'lucide-react';

interface CustomersViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenComm: (lead: Lead, mode: 'Call' | 'WhatsApp') => void;
  onOpenWebsiteAudit?: (websiteUrl: string) => void;
}

type StatusFilter = 'all' | 'Active' | 'Paused' | 'Churned';

export const CustomersView: React.FC<CustomersViewProps> = ({ onSelectLead, onOpenComm, onOpenWebsiteAudit }) => {
  const { leads } = useCRM();
  const { can } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<Client | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.listClients();
      setClients(res.clients);
    } catch (e) {
      console.error('Failed to load clients', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const leadById = useMemo(() => {
    const map: Record<string, Lead> = {};
    leads.forEach((l) => (map[l.id] = l));
    return map;
  }, [leads]);

  const filtered = useMemo(
    () => (filter === 'all' ? clients : clients.filter((c) => c.agreementStatus === filter)),
    [clients, filter]
  );

  const active = clients.filter((c) => c.agreementStatus === 'Active');
  const totalContractValue = active.reduce((s, c) => s + (c.contractValue || 0), 0);

  // Subscriptions summary (MRR + expiring soon)
  const recurringTypes = ['Monthly', 'AMC / Yearly', 'Hosting', 'Retainer'];
  const allActiveSubs = clients.flatMap((c) => (c.subscriptions || []).filter((s) => s.status === 'Active'));
  const totalMrr = allActiveSubs
    .filter((s) => recurringTypes.includes(s.billingType))
    .reduce((s, x) => s + (x.amount || 0), 0);
  const expiringCount = allActiveSubs.filter((s) => {
    if (!s.endDate) return false;
    const days = (new Date(`${s.endDate}T00:00:00`).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;

  // Remaining days helpers (local dates)
  const daysLeft = (endDate?: string): number | null => {
    if (!endDate) return null;
    const end = new Date(`${endDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((end.getTime() - today.getTime()) / 86400000);
  };

  const daysLeftMeta = (endDate?: string): { label: string; cls: string } | null => {
    const d = daysLeft(endDate);
    if (d === null) return null;
    if (d > 0) {
      return d > 30
        ? { label: `${d} days left`, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }
        : { label: `${d} days left`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
    }
    if (d === 0) return { label: 'Expires today', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
    return { label: `${Math.abs(d)} days overdue`, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' };
  };

  const customerRemainingMeta = (subs: Client['subscriptions'] | undefined): { label: string; cls: string } | null => {
    const activeSubs = (subs || []).filter((s) => s.status === 'Active' && s.endDate);
    if (activeSubs.length === 0) return null;
    let nearest: string | null = null;
    for (const s of activeSubs) {
      if (s.endDate && (nearest === null || s.endDate < nearest)) nearest = s.endDate;
    }
    return nearest ? daysLeftMeta(nearest) : null;
  };

  const formatINR = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)} K`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const clientMrr = (c: Client) =>
    (c.subscriptions || []).filter((s) => s.status === 'Active' && recurringTypes.includes(s.billingType)).reduce((s, x) => s + (x.amount || 0), 0);

  const clientActiveSubsCount = (c: Client) => (c.subscriptions || []).filter((s) => s.status === 'Active').length;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Delete client "${client.companyName}"? The linked lead is kept.`)) return;
    try {
      await auditApi.deleteClient(client.id);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete client');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      Paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      Churned: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
    return map[status] || map.Active;
  };

  const onboardingBadge = (o?: Client['onboarding']) => {
    const { pct } = onboardingProgress(o);
    if (pct === 100) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    if (pct > 0) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  };

  const onboardingLabel = (o?: Client['onboarding']) => {
    const { done, total, pct } = onboardingProgress(o);
    if (total === 0) return 'Pending';
    if (pct === 100) return '✓ Complete';
    return `${done}/${total}`;
  };

  const primaryContact = (c: Client) => {
    const contacts = c.contacts || [];
    if (contacts.length === 0) return undefined;
    return contacts.find((x) => x.isPrimary) || contacts[0];
  };

  const billingTypeBadge = (t: string) => {
    const map: Record<string, string> = {
      Monthly: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      'AMC / Yearly': 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
      Hosting: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
      Retainer: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
      Mailing: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
      'One-Time': 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
    return map[t] || map['One-Time'];
  };

  const subStatusBadge = (status: string) =>
    status === 'Active'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
      : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            Converted Clients
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Customer / Client Accounts</h2>
          <p className="text-xs text-emerald-200 mt-1">
            Converted leads plus directly onboarded customers, with contracts, retainers & onboarding details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/20 text-right">
            <div className="text-[10px] uppercase font-semibold text-emerald-300">Active Clients</div>
            <div className="text-xl font-extrabold text-white">{active.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/20 text-right">
            <div className="text-[10px] uppercase font-semibold text-emerald-300">Contract Value</div>
            <div className="text-xl font-extrabold text-white">{formatINR(totalContractValue)}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/20 text-right">
            <div className="text-[10px] uppercase font-semibold text-emerald-300">Monthly Retainer</div>
            <div className="text-xl font-extrabold text-white">{formatINR(totalMrr)}/mo</div>
          </div>
          <div className={`backdrop-blur-xs p-3 rounded-xl border border-white/20 text-right ${expiringCount > 0 ? 'bg-amber-500/20' : 'bg-white/10'}`}>
            <div className="text-[10px] uppercase font-semibold text-amber-300">Expiring Soon</div>
            <div className="text-xl font-extrabold text-white">{expiringCount}</div>
          </div>
          {can('customers.manage') && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-emerald-800 hover:bg-emerald-50 shadow-md transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              New Customer
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs + refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
          {(['all', 'Active', 'Paused', 'Churned'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filter === f ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f === 'all' ? 'All' : f} ({f === 'all' ? clients.length : clients.filter((c) => c.agreementStatus === f).length})
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {clients.length === 0 && !loading ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800 dark:text-slate-200">No converted clients yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When a lead is Won, use the "Convert to Client" button (in the lead drawer or Won pipeline
            stage) to create its client record with contract details.
          </p>
        </div>
      ) : (
        /* Master-detail table */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800 whitespace-nowrap">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Account Mgr</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Onboarding</th>
                  <th className="px-3 py-3">Remaining</th>
                  <th className="px-3 py-3 text-right">MRR</th>
                  <th className="px-3 py-3 text-center">Active Subs</th>
                  <th className="px-3 py-3 text-right">Contract Value</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center 
text-slate-400">
                      No clients match the current filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((client) => {
                    const linkedLead = client.leadId ? leadById[client.leadId] : undefined;
                    const isOpen = expanded.has(client.id);
                    const subs = client.subscriptions || [];
                    const remaining = customerRemainingMeta(client.subscriptions);
                    const mrr = clientMrr(client);
                    return (
                      <React.Fragment key={client.id}>
                        <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors whitespace-nowrap">
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => toggleExpand(client.id)}
                              title={isOpen ? 'Collapse subscriptions' : 'Expand subscriptions'}
                              className="p-1 -m-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                              </span>
                              <div className="min-w-0">
                                <div
                                  onClick={() => linkedLead && onSelectLead(linkedLead)}
                                  className={`font-bold text-slate-900 dark:text-slate-100 ${linkedLead ? 'hover:text-blue-600 cursor-pointer' : ''}`}
                                >
                                  {client.companyName}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
                                  {(primaryContact(client)?.name || client.contactPerson || '—')}
                                  {(primaryContact(client)?.mobile || client.mobile) ? ` • ${primaryContact(client)?.mobile || client.mobile}` : ''}
                                  {client.contacts && client.contacts.length > 1 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      +{client.contacts.length - 1} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">{client.accountManager || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(client.agreementStatus)}`}>
                              {client.agreementStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${onboardingBadge(client.onboarding)}`}>
                              {onboardingLabel(client.onboarding)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {remaining ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${remaining.cls}`}>
                                {remaining.label}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {mrr > 0 ? `${formatINR(mrr)}/mo` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                              {clientActiveSubsCount(client)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatINR(client.contractValue)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                onClick={() => setViewing(client)}
                                title="View all customer details"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {client.website && onOpenWebsiteAudit && (
                                <button onClick={() => onOpenWebsiteAudit(client.website!)} title="Website audit" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors">
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {linkedLead && (
                                <button onClick={() => onOpenComm(linkedLead, 'Call')} title="Call" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors">
                                  <Phone className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {linkedLead && (
                                <button onClick={() => onOpenComm(linkedLead, 'WhatsApp')} title="WhatsApp" className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50 transition-colors">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {linkedLead && (
                                <button onClick={() => onSelectLead(linkedLead)} title="View lead" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {can('customers.manage') && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditing(client);
                                      setModalOpen(true);
                                    }}
                                    title="Edit client"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(client)}
                                    title="Delete client"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                            <td colSpan={10} className="px-3 py-3 pl-12 pr-4 space-y-4">
                              {client.contacts && client.contacts.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Contact Persons ({client.contacts.length})
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {client.contacts.map((pc) => (
                                      <div
                                        key={pc.id}
                                        className={`bg-white dark:bg-slate-900 border rounded-xl p-2.5 text-[11px] ${
                                          pc.isPrimary ? 'border-blue-300 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-900/50' : 'border-slate-200 dark:border-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                                          {pc.name || '—'}
                                          {pc.isPrimary && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                              Primary
                                            </span>
                                          )}
                                        </div>
                                        {pc.role && <div className="text-[10px] text-slate-400">{pc.role}</div>}
                                        <div className="mt-1 space-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                                          {pc.mobile && <div>📞 {pc.mobile}</div>}
                                          {pc.whatsapp && <div>💬 {pc.whatsapp}</div>}
                                          {pc.email && <div className="truncate">✉️ {pc.email}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {subs.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">No service subscriptions added for this customer yet.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200/80 dark:border-slate-700">
                                        <th className="px-2 py-1.5">Service</th>
                                        <th className="px-2 py-1.5">Billing Type</th>
                                        <th className="px-2 py-1.5 text-right">Amount</th>
                                        <th className="px-2 py-1.5">Start</th>
                                        <th className="px-2 py-1.5">End</th>
                                        <th className="px-2 py-1.5">Remaining</th>
                                        <th className="px-2 py-1.5">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                      {subs.map((sub) => {
                                        const subRemaining = daysLeftMeta(sub.endDate);
                                        return (
                                          <tr key={sub.id}>
                                            <td className="px-2 py-1.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{sub.service}</td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${billingTypeBadge(sub.billingType)}`}>
                                                {sub.billingType}
                                              </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">{formatINR(sub.amount)}</td>
                                            <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{sub.startDate || '—'}</td>
                                            <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{sub.endDate || '—'}</td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                              {subRemaining ? (
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${subRemaining.cls}`}>{subRemaining.label}</span>
                                              ) : (
                                                <span className="text-slate-300">—</span>
                                              )}
                                            </td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${subStatusBadge(sub.status)}`}>{sub.status}</span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && filtered.length === 0 && (
        <div className="py-10 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      )}

      <ClientFormModal
        isOpen={modalOpen}
        client={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setModalOpen(false);
          setEditing(null);
          refresh();
        }}
      />

      <CustomerDetailView
        client={viewing}
        canViewCredentials={can('customers.manage')}
        onClientUpdated={(updated) => setViewing(updated)}
        onClose={() => setViewing(null)}
        onEdit={(client) => {
          setViewing(null);
          setEditing(client);
          setModalOpen(true);
        }}
      />
    </div>
  );
};
