import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { Lead } from '../types';
import { auditApi } from '../utils/auditApi';
import {
  Archive,
  Search,
  RefreshCw,
  Loader2,
  RotateCcw,
  Trash2,
  Building2,
  Globe,
  Database,
} from 'lucide-react';
import { formatSqliteDate } from '../utils/auditFormat';

interface ArchivedRow {
  id: number;
  leadId: string;
  deletedAt: string;
  deletedBy?: string;
  data: any;
}

export const DatacenterView: React.FC = () => {
  const { restoreArchivedLead } = useCRM();
  const { can } = useAuth();
  const [rows, setRows] = useState<ArchivedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.getArchivedLeads();
      setRows(res.archivedLeads);
    } catch (e) {
      console.error('Failed to load datacenter', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      const d = r.data || {};
      return (
        (d.companyName || '').toLowerCase().includes(q) ||
        (d.contactPerson || '').toLowerCase().includes(q) ||
        (d.mobile || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q) ||
        (d.website || '').toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm]);

  const handleRestore = async (row: ArchivedRow) => {
    try {
      const res = await auditApi.restoreArchivedLead(row.leadId);
      await restoreArchivedLead(res.lead as Lead);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to restore lead');
    }
  };

  const handlePurge = async (row: ArchivedRow) => {
    if (!confirm(`Permanently delete "${row.data?.companyName || 'this record'}"? This cannot be undone.`)) return;
    try {
      await auditApi.purgeArchivedLead(row.leadId);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete record');
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Permanently delete all ${rows.length} archived records? This cannot be undone.`)) return;
    try {
      await auditApi.clearArchivedLeads();
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to clear datacenter');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Archive className="w-5 h-5 text-violet-600" />
            <span>Datacenter</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Data bank of past / uninterested customers. Restore any record to re-approach them as a lead.
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
          {rows.length > 0 && can('datacenter.purge') && (
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search archived records…"
            className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          />
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} of {rows.length} archived records
        </span>
      </div>

      {/* Empty / Table */}
      {rows.length === 0 && !loading ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
          <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800 dark:text-slate-200">Datacenter is empty</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When you delete a lead, it is stored here instead of being lost — a data bank of past or
            uninterested customers you can re-approach later.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="p-3 pl-4">Company</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Phone / Email</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Tech</th>
                  <th className="p-3">Deleted</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No archived records match the search.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const d = row.data || {};
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 pl-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {d.companyName || 'Unknown'}
                          </span>
                          {d.website && (
                            <a
                              href={d.website.startsWith('http') ? d.website : `https://${d.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1"
                            >
                              <Globe className="w-2.5 h-2.5" />
                              {d.website}
                            </a>
                          )}
                        </td>
                        <td className="p-3">{d.contactPerson || '—'}</td>
                        <td className="p-3">
                          <div className="font-medium">{d.mobile || '—'}</div>
                          <div className="text-[10px] text-slate-400">{d.email || ''}</div>
                        </td>
                        <td className="p-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {d.status || '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <TechDots lead={d} />
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{formatSqliteDate(row.deletedAt)}</td>
                        <td className="p-3 pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {can('datacenter.restore') && (
                              <button
                                onClick={() => handleRestore(row)}
                                title="Restore to Leads"
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Restore
                              </button>
                            )}
                            {can('datacenter.purge') && (
                              <button
                                onClick={() => handlePurge(row)}
                                title="Delete permanently"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}
    </div>
  );
};

const TechDots: React.FC<{ lead: any }> = ({ lead }) => {
  const fields = [
    ['cms', 'CMS'],
    ['ga4', 'GA4'],
    ['gtm', 'GTM'],
    ['metaPixel', 'Meta Pixel'],
    ['whatsappWidget', 'WhatsApp Widget'],
    ['liveChat', 'Live Chat'],
  ] as const;
  const present = (v?: string) => !!v && !['no', 'n', '0', 'false', '-', '—', 'na', 'n/a'].includes(v.trim().toLowerCase());
  const anyPresent = fields.some(([k]) => present(lead?.[k]));
  if (!anyPresent) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex items-center gap-1">
      {fields.map(([k, label]) => {
        const value = lead?.[k];
        const ok = present(value);
        return (
          <span
            key={k}
            title={`${label}: ${value || 'Not set'}`}
            className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
          />
        );
      })}
    </div>
  );
};
