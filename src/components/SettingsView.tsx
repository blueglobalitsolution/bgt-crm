import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { auditApi } from '../utils/auditApi';
import { useEscapeClose } from '../hooks/useEscapeClose';
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
  Download,
  Upload,
  Lock,
  X,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { leads, clearAllData, resetToSampleData } = useCRM();
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dbPasswordModal, setDbPasswordModal] = useState<null | 'export' | 'import'>(null);
  const [dbPassword, setDbPassword] = useState('');
  const [dbPasswordError, setDbPasswordError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dbBusy, setDbBusy] = useState(false);

  useEscapeClose(() => setDbPasswordModal(null), dbPasswordModal !== null);

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

  const openDbModal = (mode: 'export' | 'import') => {
    setDbPassword('');
    setDbPasswordError(null);
    setImportFile(null);
    setDbPasswordModal(mode);
  };

  const handleDbExport = async () => {
    if (!dbPassword) {
      setDbPasswordError('Please enter your password.');
      return;
    }
    setDbBusy(true);
    setDbPasswordError(null);
    try {
      const { blob, filename } = await auditApi.exportDatabase(dbPassword);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setDbPasswordModal(null);
      setMessage('Database exported.');
    } catch (e: any) {
      setDbPasswordError(e?.message || 'Export failed.');
    } finally {
      setDbBusy(false);
    }
  };

  const handleDbImport = async () => {
    if (!dbPassword) {
      setDbPasswordError('Please enter your password.');
      return;
    }
    if (!importFile) {
      setDbPasswordError('Please choose a database file.');
      return;
    }
    if (!confirm('Importing a database file REPLACES ALL current CRM data. Continue?')) {
      return;
    }
    setDbBusy(true);
    setDbPasswordError(null);
    try {
      await auditApi.importDatabase(importFile, dbPassword);
      setDbPasswordModal(null);
      alert('Database imported successfully. Reloading…');
      window.location.reload();
    } catch (e: any) {
      setDbPasswordError(e?.message || 'Import failed.');
    } finally {
      setDbBusy(false);
    }
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

      {/* Database Backup & Restore (admin only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Database Backup & Restore</h3>
              <p className="text-[11px] text-slate-500">
                Export or import the entire SQLite database. Admin-only, protected by your login password.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openDbModal('export')}
              disabled={dbBusy}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              {dbBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Database
            </button>
            <button
              onClick={() => openDbModal('import')}
              disabled={dbBusy}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {dbBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import Database
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Export downloads a full backup of all data. Import replaces ALL current CRM data with the uploaded
            file (blocked while an audit is running). A safety backup is kept and restored if the import fails.
          </p>
        </div>
      )}

      {message && (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {message}
        </div>
      )}

      {/* Password prompt for database export/import */}
      {dbPasswordModal && (
        <div className="fixed inset-0 z-[70] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                    {dbPasswordModal === 'export' ? 'Export Database' : 'Import Database'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter your admin password to continue
                  </p>
                </div>
              </div>
              <button onClick={() => setDbPasswordModal(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {dbPasswordModal === 'import' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Database file (.db)
                  </label>
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3,application/x-sqlite3,application/octet-stream"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 dark:text-slate-100"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin password
                </label>
                <input
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (dbPasswordModal === 'export') handleDbExport();
                      else handleDbImport();
                    }
                  }}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              {dbPasswordError && <p className="text-xs text-rose-600 font-medium">{dbPasswordError}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setDbPasswordModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={dbPasswordModal === 'export' ? handleDbExport : handleDbImport}
                  disabled={dbBusy}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                >
                  {dbBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {dbPasswordModal === 'export' ? 'Export' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
