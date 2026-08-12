import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { Lead } from '../types';
import { MessageSquare, X, Sparkles, Copy, Check, Send, Search, Loader2, Building2 } from 'lucide-react';
import { buildWhatsAppUrl, openWhatsAppPopout, cleanPhone } from '../utils/whatsapp';

export const WhatsAppWidget: React.FC = () => {
  const { leads, selectedLead, addActivity } = useCRM();
  const { can } = useAuth();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [targetLead, setTargetLead] = useState<Lead | null>(null);
  const [messageText, setMessageText] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  // Follow the currently selected lead when the widget is open.
  useEffect(() => {
    if (open && selectedLead) setTargetLead(selectedLead);
  }, [selectedLead, open]);

  // Pre-fill the draft when the target lead changes.
  useEffect(() => {
    if (targetLead) {
      const servicesStr = targetLead.interestedServices?.join(', ') || 'Digital Marketing Services';
      setMessageText(
        `Hi ${targetLead.contactPerson || 'there'}, greeting from BGT Digital Marketing! I am reaching out regarding your interest in ${servicesStr} for ${targetLead.companyName}. When is a good time to connect for a quick 5-minute call?`
      );
    } else {
      setMessageText('');
    }
  }, [targetLead]);

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      if (!q) return true;
      return (
        (l.companyName || '').toLowerCase().includes(q) ||
        (l.contactPerson || '').toLowerCase().includes(q) ||
        (l.mobile || '').includes(q)
      );
    });
  }, [leads, search]);

  if (!can('comm.whatsapp')) return null;

  const formattedPhone = targetLead ? cleanPhone(targetLead.whatsapp || targetLead.mobile) : '';

  const handleSend = () => {
    if (!targetLead || !formattedPhone) return;
    openWhatsAppPopout(buildWhatsAppUrl(targetLead.whatsapp || targetLead.mobile, messageText));
    addActivity(targetLead.id, {
      type: 'WhatsApp',
      summary: 'Sent WhatsApp Message',
      details: messageText,
      author: targetLead.assignedTo || 'User',
    });
  };

  const handleAiDraft = async () => {
    if (!targetLead) return;
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/followup-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: targetLead, channel: 'WhatsApp' }),
      });
      const data = await res.json();
      if (data.script) setMessageText(data.script);
    } catch (e) {
      console.error('Error generating AI draft', e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="WhatsApp composer"
        className={`fixed bottom-5 right-5 z-40 w-13 h-13 p-3.5 rounded-2xl shadow-lg flex items-center justify-center transition-all cursor-pointer ${
          open ? 'bg-slate-800 hover:bg-slate-700' : 'bg-green-600 hover:bg-green-500'
        } text-white`}
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Right slide-out panel */}
      {open && (
        <div className="fixed top-14 bottom-0 right-0 w-[360px] max-w-[92vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-green-600 text-white">
            <div className="flex items-center gap-2 font-bold text-sm">
              <MessageSquare className="w-4 h-4" />
              WhatsApp Composer
            </div>
            <p className="text-[10px] text-green-100">Pick a contact, draft & send via WhatsApp Web</p>
          </div>

          {/* Contact picker */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contact…"
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 focus:ring-2 focus:ring-green-500 dark:text-slate-100"
              />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {filteredLeads.slice(0, 50).map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setTargetLead(l);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    targetLead?.id === l.id
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{l.companyName}</span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {l.contactPerson} • {l.mobile}
                    </span>
                  </span>
                </button>
              ))}
              {filteredLeads.length === 0 && (
                <p className="text-[11px] text-slate-400 px-2 py-2">No contacts match.</p>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!targetLead ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-60" />
                Select a contact above to compose a message.
              </div>
            ) : (
              <>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 rounded-xl p-3 text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{targetLead.companyName}</div>
                  <div className="text-slate-500">
                    {targetLead.contactPerson} • <strong>+{formattedPhone}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Message</label>
                  <button
                    onClick={handleAiDraft}
                    disabled={loadingAi}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${loadingAi ? 'animate-spin' : ''}`} />
                    {loadingAi ? 'Generating…' : 'AI Script'}
                  </button>
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 focus:ring-2 focus:ring-green-500 dark:text-slate-100 leading-relaxed"
                />

                <button
                  onClick={handleCopy}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Message'}
                </button>

                <button
                  onClick={handleSend}
                  disabled={!formattedPhone}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send via WhatsApp Web
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Opens WhatsApp Web beside the CRM — no tab switching.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
