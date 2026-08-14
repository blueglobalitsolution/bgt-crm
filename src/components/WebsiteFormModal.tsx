import React, { useEffect, useState } from 'react';
import { X, Globe, Loader2 } from 'lucide-react';
import { Website, Lead } from '../types';
import { auditApi } from '../utils/auditApi';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface WebsiteFormModalProps {
  isOpen: boolean;
  website?: Website | null;
  defaultLeadId?: string;
  leads: Lead[];
  onClose: () => void;
  onSaved: () => void;
}

export const WebsiteFormModal: React.FC<WebsiteFormModalProps> = ({
  isOpen,
  website,
  defaultLeadId,
  leads,
  onClose,
  onSaved,
}) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [leadId, setLeadId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setUrl(website?.url || '');
    setName(website?.name || '');
    setLeadId(website?.leadId || defaultLeadId || '');
  }, [isOpen, website, defaultLeadId]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Website URL is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (website) {
        await auditApi.updateWebsite(website.id, {
          url: trimmed,
          name: name.trim() || undefined,
          leadId: leadId || undefined,
        });
      } else {
        await auditApi.addWebsite({
          url: trimmed,
          name: name.trim() || undefined,
          leadId: leadId || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save website');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                {website ? 'Edit Website' : 'Add Website to Audit'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Link a customer site to the audit engine
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Website URL *
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com"
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ABC Engineering Website"
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Link to Customer / Lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            >
              <option value="">-- Not linked --</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.companyName} {l.website ? `(${l.website})` : ''}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {website ? 'Save Changes' : 'Add Website'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
