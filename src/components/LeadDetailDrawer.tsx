import React, { useState, useEffect } from 'react';
import { Lead, ActivityLog, TECH_STATUS_FIELDS } from '../types';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { useWebsiteForUrl } from '../hooks/useWebsiteForUrl';
import { WebsiteHealthBadge } from './WebsiteHealthBadge';
import { getLocalToday, getLocalNowTime } from '../utils/auditFormat';
import { ClientFormModal } from './ClientFormModal';
import {
  X,
  Phone,
  MessageSquare,
  Sparkles,
  Globe,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Plus,
  Edit,
  CheckCircle2,
  Trash2,
  Building,
  Briefcase,
  TrendingUp,
  Play,
  Loader2,
  Archive,
} from 'lucide-react';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onOpenComm: (lead: Lead, mode: 'Call' | 'WhatsApp') => void;
  onEditLead: (lead: Lead) => void;
  onOpenWebsiteAudit?: (websiteUrl: string) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onOpenComm,
  onEditLead,
  onOpenWebsiteAudit,
}) => {
  if (!lead) return null;

  const { updateLead, addActivity, completeFollowup, scheduleFollowup, deleteLead, refreshLeads, leads } = useCRM();
  const { can } = useAuth();

  // Read the freshest lead from context so live mutations (notes, follow-ups,
  // status changes) show up immediately instead of after a refresh.
  const liveLead = leads.find((l) => l.id === lead.id) ?? lead;

  const [loadingAi, setLoadingAi] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);

  const { website: linkedWebsite } = useWebsiteForUrl(liveLead.website);

  const todayStr = getLocalToday();
  const [reschedDate, setReschedDate] = useState(todayStr);
  const [reschedTime, setReschedTime] = useState(getLocalNowTime());
  const [reschedType, setReschedType] = useState<'Call' | 'WhatsApp' | 'Email' | 'Meeting'>('WhatsApp');
  const [reschedNote, setReschedNote] = useState('');

  // Auto-fill the reschedule form with the current local date & time each time it opens.
  useEffect(() => {
    if (showReschedule) {
      setReschedDate(getLocalToday());
      setReschedTime(getLocalNowTime());
    }
  }, [showReschedule]);

  const handleGenerateAiSummary = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/lead-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead }),
      });
      const data = await res.json();
      if (data.summary) {
        updateLead(liveLead.id, {
          aiSummary: data.summary,
          aiSummaryGeneratedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Error getting AI summary', e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAddCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    addActivity(liveLead.id, {
      type: 'Note',
      summary: 'Added Sales Note',
      details: newNoteText.trim(),
      author: liveLead.assignedTo || 'User',
    });

    setNewNoteText('');
  };

  const handleSaveReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleFollowup(liveLead.id, reschedDate, reschedTime, reschedType, reschedNote || 'Scheduled follow-up');
    setShowReschedule(false);
  };

  // Activity Icon Helper
  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'Call':
        return <Phone className="w-3.5 h-3.5 text-emerald-600" />;
      case 'WhatsApp':
        return <MessageSquare className="w-3.5 h-3.5 text-green-600" />;
      case 'Proposal':
        return <Briefcase className="w-3.5 h-3.5 text-violet-600" />;
      case 'Status Change':
        return <TrendingUp className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <Calendar className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {liveLead.status}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {liveLead.priority === 'Hot' ? '🔥 Hot Priority' : liveLead.priority === 'Warm' ? '🟡 Warm' : 'Cold'}
              </span>
              <span className="text-xs text-slate-400 font-medium">Source: {liveLead.leadSource}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {liveLead.companyName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Contact: <strong>{liveLead.contactPerson}</strong></span>
              <span>•</span>
              <span>Assigned: <strong>{liveLead.assignedTo || 'Unassigned'}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onEditLead(lead)}
              title="Edit Lead"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          {can('comm.call') && (
            <button
              onClick={() => onOpenComm(lead, 'Call')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </button>
          )}

          {can('comm.whatsapp') && (
            <button
              onClick={() => onOpenComm(lead, 'WhatsApp')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-500 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          )}

          <button
            onClick={handleGenerateAiSummary}
            disabled={loadingAi}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loadingAi ? 'animate-spin' : ''}`} />
            <span>{loadingAi ? 'Summarizing...' : '✨ AI Summary'}</span>
          </button>

          <button
            onClick={() => setShowReschedule(!showReschedule)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>Follow-up</span>
          </button>

          {can('customers.manage') && (
            <button
              onClick={() => setClientModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>{liveLead.status === 'Won' ? 'View / Edit Client' : 'Convert to Client'}</span>
            </button>
          )}

          {can('leads.archive') && (
            <button
              onClick={async () => {
                if (confirm(`Move "${liveLead.companyName}" to the Datacenter? It can be restored later.`)) {
                  await deleteLead(liveLead.id);
                  onClose();
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Datacenter</span>
            </button>
          )}
        </div>

        {/* Drawer Body Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Summary Box if present */}
          {liveLead.aiSummary && (
            <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/10 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 text-xs text-slate-800 dark:text-slate-200 relative">
              <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400 mb-1.5">
                <Sparkles className="w-4 h-4" />
                <span>AI Executive Summary</span>
              </div>
              <p className="leading-relaxed font-normal">{liveLead.aiSummary}</p>
            </div>
          )}

          {/* Contact & Business Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 font-medium block">Phone</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{liveLead.mobile}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Email</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {liveLead.email || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">City / State</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {liveLead.city ? `${liveLead.city}, ${liveLead.state || ''}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Website</span>
              <a
                href={liveLead.website ? `https://${liveLead.website.replace(/^https?:\/\//, '')}` : '#'}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate block"
              >
                {liveLead.website || 'N/A'}
              </a>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Budget</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {liveLead.estimatedBudget || 'Not set'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Expected Value</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                ₹{liveLead.expectedValue?.toLocaleString('en-IN') || 0}
              </span>
            </div>
          </div>

          {/* Interested Services */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Interested Services
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {liveLead.interestedServices?.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60"
                >
                  ☑ {s}
                </span>
              ))}
            </div>
          </div>

          {/* Website Audit */}
          {liveLead.website && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Globe className="w-4 h-4" />
                  Website Audit
                </span>
                {linkedWebsite?.latestAudit?.status === 'completed' && (
                  <WebsiteHealthBadge score={linkedWebsite.latestAudit.healthScore} />
                )}
              </div>
              <p className="text-xs text-slate-300 truncate mb-1">{liveLead.website}</p>
              {linkedWebsite?.latestAudit?.status === 'completed' && (
                <p className="text-[11px] text-slate-400 mb-3">
                  {linkedWebsite.latestAudit.pagesCrawled} pages · {linkedWebsite.latestAudit.brokenLinks} broken
                  links · {linkedWebsite.latestAudit.seoIssues} SEO issues
                </p>
              )}
              {linkedWebsite?.latestAudit?.status === 'running' && (
                <p className="text-[11px] text-amber-300 mb-3 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Audit in progress…
                </p>
              )}
              <button
                onClick={() => onOpenWebsiteAudit && onOpenWebsiteAudit(liveLead.website!)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                {linkedWebsite?.latestAudit?.status === 'completed'
                  ? 'View / Re-run Audit'
                  : 'Run Website Audit'}
              </button>
            </div>
          )}

          {/* Business Profile */}
          {(liveLead.jobId || liveLead.rating != null || liveLead.reviewCount != null || liveLead.address || liveLead.websitePhone || liveLead.whatsappUrl || liveLead.instagramUrl || liveLead.facebookUrl || liveLead.linkedinUrl || liveLead.youtubeUrl) && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Business Profile
              </h4>
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                {(liveLead.jobId || liveLead.rating != null || liveLead.reviewCount != null) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {liveLead.jobId && <InfoChip label="Job ID" value={liveLead.jobId} />}
                    {liveLead.rating != null && <InfoChip label="Rating" value={`★ ${liveLead.rating}`} />}
                    {liveLead.reviewCount != null && <InfoChip label="Reviews" value={`${liveLead.reviewCount}`} />}
                  </div>
                )}
                {liveLead.address && (
                  <div>
                    <span className="text-slate-400 font-medium block">Address</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{liveLead.address}</span>
                  </div>
                )}
                {liveLead.websitePhone && (
                  <div>
                    <span className="text-slate-400 font-medium block">Website Phone</span>
                    <a href={`tel:${liveLead.websitePhone}`} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                      {liveLead.websitePhone}
                    </a>
                  </div>
                )}
                {(liveLead.whatsappUrl || liveLead.instagramUrl || liveLead.facebookUrl || liveLead.linkedinUrl || liveLead.youtubeUrl) && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {liveLead.whatsappUrl && <SocialLink href={liveLead.whatsappUrl} label="WhatsApp" />}
                    {liveLead.instagramUrl && <SocialLink href={liveLead.instagramUrl} label="Instagram" />}
                    {liveLead.facebookUrl && <SocialLink href={liveLead.facebookUrl} label="Facebook" />}
                    {liveLead.linkedinUrl && <SocialLink href={liveLead.linkedinUrl} label="LinkedIn" />}
                    {liveLead.youtubeUrl && <SocialLink href={liveLead.youtubeUrl} label="YouTube" />}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Website Tech & Tracking Status */}
          {(liveLead.cms || liveLead.ga4 || liveLead.gtm || liveLead.metaPixel || liveLead.whatsappWidget || liveLead.liveChat) && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Website Tech & Tracking
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TECH_STATUS_FIELDS.map(({ key, label }) => {
                  const value = liveLead[key as keyof Lead] as string | undefined;
                  const present = isPositive(value);
                  return (
                    <div
                      key={key}
                      className={`px-2.5 py-2 rounded-xl border text-xs flex items-center justify-between ${
                        present
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800'
                      }`}
                    >
                      <span className={`font-semibold ${present ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {label}
                      </span>
                      <span
                        className={`font-bold ${present ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}
                        title={value || 'Not set'}
                      >
                        {present ? '✓' : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Requirement Notes */}
          {liveLead.requirementNotes && (
            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-4 text-xs">
              <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-1">Customer Requirement Notes</h4>
              <p className="text-amber-950 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">
                {liveLead.requirementNotes}
              </p>
            </div>
          )}

          {/* NEXT FOLLOW-UP SECTION */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                NEXT FOLLOW-UP
              </span>
              {liveLead.nextFollowupDate && (
                <button
                  onClick={() => completeFollowup(liveLead.id)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Complete</span>
                </button>
              )}
            </div>

            {liveLead.nextFollowupDate ? (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm font-semibold flex-wrap">
                  <div>Date: <span className="text-slate-200">{liveLead.nextFollowupDate}</span></div>
                  <div>Time: <span className="text-slate-200">{liveLead.nextFollowupTime || '10:00 AM'}</span></div>
                  <div>Type: <span className="text-blue-400 font-bold">{liveLead.nextFollowupType || 'Call'}</span></div>
                </div>
                {liveLead.nextFollowupNote && (
                  <p className="text-xs text-slate-300 italic">Note: "{liveLead.nextFollowupNote}"</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No future follow-up scheduled yet.</p>
            )}

            {/* Quick Action Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
              <button
                onClick={() => onOpenComm(lead, 'Call')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                [Call]
              </button>
              <button
                onClick={() => onOpenComm(lead, 'WhatsApp')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors cursor-pointer"
              >
                [WhatsApp]
              </button>
              <button
                onClick={() => setShowReschedule(!showReschedule)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                [Schedule Next]
              </button>
            </div>

            {/* Reschedule Inline Form */}
            {showReschedule && (
              <form onSubmit={handleSaveReschedule} className="mt-4 p-4 bg-slate-800 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={reschedDate}
                      onChange={(e) => setReschedDate(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Time</label>
                    <input
                      type="text"
                      value={reschedTime}
                      onChange={(e) => setReschedTime(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Action Type</label>
                    <select
                      value={reschedType}
                      onChange={(e) => setReschedType(e.target.value as any)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Reminder Note</label>
                    <input
                      type="text"
                      value={reschedNote}
                      onChange={(e) => setReschedNote(e.target.value)}
                      placeholder="e.g. Send revised quote"
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Save Follow-up
                </button>
              </form>
            )}
          </div>

          {/* Quick Add Activity Note Form */}
          <form onSubmit={handleAddCustomNote} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Add New Note / Activity
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="e.g. Spoke on phone, client requested case studies..."
                className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                + Add
              </button>
            </div>
          </form>

          {/* ACTIVITY TIMELINE */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              ACTIVITY TIMELINE
            </h4>

            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-4">
              {liveLead.activities?.length === 0 ? (
                <div className="pl-4 text-xs text-slate-400 italic">No timeline activities recorded.</div>
              ) : (
                liveLead.activities?.map((act) => {
                  const dateFormatted = new Date(act.timestamp).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={act.id} className="relative pl-6 group">
                      <div className="absolute -left-[17px] top-0.5 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
                        {getActivityIcon(act.type)}
                      </div>

                      <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                          <span>{act.summary}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{dateFormatted}</span>
                        </div>
                        {act.details && (
                          <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 leading-relaxed">
                            {act.details}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">Logged by {act.author}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Client modal */}
      <ClientFormModal
        isOpen={clientModalOpen}
        lead={lead}
        onClose={() => setClientModalOpen(false)}
        onSaved={() => {
          setClientModalOpen(false);
          refreshLeads();
        }}
      />
    </div>
  );
};

const isPositive = (value?: string) =>
  !!value && !['no', 'n', '0', 'false', '-', '—', 'na', 'n/a'].includes(value.trim().toLowerCase());

const InfoChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
    <span className="text-slate-400 text-[10px] font-medium">{label}</span>
    <span className="font-bold text-slate-800 dark:text-slate-200">{value}</span>
  </span>
);

const SocialLink: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <a
    href={href.startsWith('http') ? href : `https://${href}`}
    target="_blank"
    rel="noreferrer"
    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60 hover:bg-blue-100 transition-colors"
  >
    {label}
  </a>
);
