import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { auditApi } from '../utils/auditApi';
import {
  Settings as SettingsIcon,
  Database,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Users,
  Globe,
  AlertTriangle,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { leads, clearAllData, resetToSampleData } = useCRM();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage('Done.');
    } catch (e: any) {
      setMessage(e?.message || 'Operation failed.');
    } finally {
      setBusy(null);
    }
  };

  const clearLeads = async () => {
    if (!confirm(`Delete all ${leads.length} leads? This cannot be undone.`)) return;
    await run('leads', async () => {
      await clearAllData();
    });
  };

  const resetLeads = async () => {
    if (!confirm('Replace all leads with the sample data?')) return;
    await run('reset', async () => {
      await resetToSampleData();
    });
  };

  const clearAudits = async () => {
    if (!confirm('Delete all website audit runs (keep websites)?')) return;
    await run('audits', async () => {
      await auditApi.clearAudits();
    });
  };

  const clearAllAuditData = async () => {
    if (
      !confirm(
        'Delete ALL website audit data?\n\nThis removes every website AND its audits (runs, pages, issues, broken links, progress logs) from the Website Audit Engine. This cannot be undone.'
      )
    ) {
      return;
    }
    await run('audit-all', async () => {
      await auditApi.clearAllWebsites();
    });
  };

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-slate-600" />
          <span>Settings & Data Management</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage CRM leads and website audit test data.
        </p>
      </div>

      {/* CRM Leads */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">CRM Leads</h3>
            <p className="text-[11px] text-slate-500">
              {leads.length} lead{leads.length === 1 ? '' : 's'} stored in this browser
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={clearLeads}
            disabled={busy !== null || leads.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            {busy === 'leads' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete All Leads
          </button>
          <button
            onClick={resetLeads}
            disabled={busy !== null}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {busy === 'reset' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Reset Sample Leads
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Leads are stored in this browser (localStorage). Clearing them is permanent for this device.
        </p>
      </div>

      {/* Website Audits */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Website Audits</h3>
            <p className="text-[11px] text-slate-500">Audit history is stored on the server (SQLite)</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={clearAudits}
            disabled={busy !== null}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {busy === 'audits' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            Clear Audit Runs (keep websites)
          </button>
          <button
            onClick={clearAllAuditData}
            disabled={busy !== null}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {busy === 'audit-all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Delete All Website Audit Data
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Clear Audit Runs removes results but keeps the websites. Delete All Website Audit Data wipes the
          entire audit engine (websites + all runs) — full reset.
        </p>
      </div>

      {message && (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {message}
        </div>
      )}
    </div>
  );
};
