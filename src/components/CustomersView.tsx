import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { Lead, Client } from '../types';
import { auditApi } from '../utils/auditApi';
import { ClientFormModal } from './ClientFormModal';
import { Building2, Phone, MessageSquare, Eye, Briefcase, Play, RefreshCw, Loader2, Trash2, Pencil } from 'lucide-react';

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
  const totalMrr = active.reduce((s, c) => s + (c.monthlyRetainer || 0), 0);

  const formatINR = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)} K`;
    return `₹${amount.toLocaleString('en-IN')}`;
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
            Leads converted to clients with signed contracts & monthly retainers.
          </p>
        </div>
        <div className="flex items-center gap-4">
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
        </div>
      </div>

      {/* Filter tabs + refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs font-semibold">
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

      {/* Client cards */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const linkedLead = client.leadId ? leadById[client.leadId] : undefined;
            return (
              <div
                key={client.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3
                      onClick={() => linkedLead && onSelectLead(linkedLead)}
                      className={`font-bold text-slate-900 dark:text-slate-100 text-base ${linkedLead ? 'hover:text-blue-600 cursor-pointer' : ''}`}
                    >
                      {client.companyName}
                    </h3>
                    <p className="text-xs text-slate-500">{client.contactPerson || '—'}{client.mobile ? ` • ${client.mobile}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusBadge(client.agreementStatus)}`}>
                    {client.agreementStatus}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 mt-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contract Value</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(client.contractValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Retainer</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatINR(client.monthlyRetainer)}/mo</span>
                  </div>
                  {client.startDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Start Date</span>
                      <span className="font-medium">{client.startDate}</span>
                    </div>
                  )}
                  {client.accountManager && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Manager</span>
                      <span className="font-medium">{client.accountManager}</span>
                    </div>
                  )}
                  {client.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {client.services.slice(0, 4).map((s) => (
                        <span key={s} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Client since {client.createdAt?.slice(0, 10) || '—'}</span>
                  <div className="flex items-center gap-1.5">
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
                </div>
              </div>
            );
          })}
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
    </div>
  );
};
