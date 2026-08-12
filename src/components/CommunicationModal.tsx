import React, { useState } from 'react';
import { Lead } from '../types';
import { Phone, MessageSquare, X, Send, Copy, Sparkles, Check, ExternalLink } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { cleanPhone, openWhatsAppPopout } from '../utils/whatsapp';

interface CommunicationModalProps {
  lead: Lead | null;
  mode: 'Call' | 'WhatsApp' | null;
  onClose: () => void;
}

export const CommunicationModal: React.FC<CommunicationModalProps> = ({
  lead,
  mode,
  onClose,
}) => {
  if (!lead || !mode) return null;

  const { addActivity } = useCRM();
  const [copied, setCopied] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [messageText, setMessageText] = useState(() => {
    const servicesStr = lead.interestedServices?.join(', ') || 'Digital Marketing Services';
    return `Hi ${lead.contactPerson || 'there'}, greeting from BGT Digital Marketing! I am reaching out regarding your interest in ${servicesStr} for ${lead.companyName}. When is a good time to connect for a quick 5-minute call?`;
  });

  const formattedPhone = cleanPhone(lead.whatsapp || lead.mobile);

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(messageText);
    // Open WhatsApp Web in the same browser; if the business account is logged in,
    // it opens directly to this contact's chat with the prefilled message.
    // Uses a named popout window so the CRM stays open and no tab switch is needed.
    const url = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encoded}`;
    openWhatsAppPopout(url);

    // Log Activity
    addActivity(lead.id, {
      type: 'WhatsApp',
      summary: 'Sent WhatsApp Message',
      details: messageText,
      author: lead.assignedTo || 'User',
    });

    onClose();
  };

  const handleLogCall = () => {
    addActivity(lead.id, {
      type: 'Call',
      summary: 'Phone Call Completed',
      details: callNotes || 'Initiated phone call with client.',
      author: lead.assignedTo || 'User',
    });
    onClose();
  };

  const handleGenerateAiDraft = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/followup-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead, channel: mode }),
      });
      const data = await res.json();
      if (data.script) {
        setMessageText(data.script);
      }
    } catch (e) {
      console.error('Error generating AI script', e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsAppWeb = () => {
    const encoded = encodeURIComponent(messageText);
    const url = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encoded}`;
    openWhatsAppPopout(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                mode === 'Call' ? 'bg-emerald-600' : 'bg-green-600'
              }`}
            >
              {mode === 'Call' ? <Phone className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                {mode === 'Call' ? 'Initiate Phone Call' : 'Send WhatsApp Message'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lead.companyName} ({lead.contactPerson} • {lead.mobile})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {mode === 'Call' ? (
            <>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Phone Number
                  </div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mt-0.5">
                    {lead.mobile}
                  </div>
                </div>
                <a
                  href={`tel:${lead.mobile}`}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Now</span>
                </a>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Call Notes / Outcome
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Record summary of discussion (e.g. Spoke with Raj, requested proposal by tomorrow)..."
                  rows={3}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  WhatsApp Message Draft
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={loadingAi}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${loadingAi ? 'animate-spin' : ''}`} />
                  <span>{loadingAi ? 'Generating AI Script...' : '✨ AI Script Assistant'}</span>
                </button>
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 focus:ring-2 focus:ring-green-500 dark:text-slate-100 leading-relaxed"
              />

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-2">
                  Target: <strong className="text-slate-700 dark:text-slate-300">+{formattedPhone}</strong>
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppWeb}
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open WhatsApp Web
                  </button>
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Message'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
          >
            Cancel
          </button>
          {mode === 'Call' ? (
            <button
              onClick={handleLogCall}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
            >
              Log Call Activity
            </button>
          ) : (
            <button
              onClick={handleSendWhatsApp}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-500 text-white flex items-center gap-2 shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Open WhatsApp & Log</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
