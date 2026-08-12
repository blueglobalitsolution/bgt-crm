import React, { useEffect, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Lead, WebsiteAuditDashboardStats } from '../types';
import { auditApi } from '../utils/auditApi';
import {
  Users,
  UserPlus,
  Calendar,
  Flame,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Phone,
  MessageSquare,
  Eye,
  Clock,
  ArrowRight,
  Filter,
  Sparkles,
  Globe,
} from 'lucide-react';

interface DashboardProps {
  onSelectLead: (lead: Lead) => void;
  onOpenComm: (lead: Lead, mode: 'Call' | 'WhatsApp') => void;
  onOpenAddLead: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectLead,
  onOpenComm,
  onOpenAddLead,
}) => {
  const { leads, stats, setActiveTab, completeFollowup } = useCRM();
  const [filterTab, setFilterTab] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('today');
  const [auditStats, setAuditStats] = useState<WebsiteAuditDashboardStats | null>(null);

  useEffect(() => {
    auditApi
      .getStats()
      .then((res) => setAuditStats(res.stats))
      .catch(() => {});
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper currency formatter for INR Lakhs / Thousands
  const formatINR = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)} K`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Filter followups
  const overdueLeads = leads.filter(
    (l) => l.nextFollowupDate && l.nextFollowupDate < todayStr && l.status !== 'Won' && l.status !== 'Lost'
  );

  const todayLeads = leads.filter(
    (l) => l.nextFollowupDate === todayStr && l.status !== 'Won' && l.status !== 'Lost'
  );

  const upcomingLeads = leads.filter(
    (l) => l.nextFollowupDate && l.nextFollowupDate > todayStr && l.status !== 'Won' && l.status !== 'Lost'
  );

  let displayedFollowupLeads: Lead[] = [];
  if (filterTab === 'overdue') displayedFollowupLeads = overdueLeads;
  else if (filterTab === 'today') displayedFollowupLeads = todayLeads;
  else if (filterTab === 'upcoming') displayedFollowupLeads = upcomingLeads;
  else displayedFollowupLeads = [...overdueLeads, ...todayLeads, ...upcomingLeads];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <span>BGT CRM Overview</span>
            <span>•</span>
            <span className="text-emerald-400">Live Workspace</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Dashboard</h2>
          <p className="text-sm text-slate-300 mt-1">
            Track digital marketing leads, conversion rates, and pending client follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('import')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            📥 Import Excel
          </button>
          <button
            onClick={onOpenAddLead}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Primary Stat Cards Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div
          onClick={() => setActiveTab('leads')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.totalLeads}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active Database</span>
          </p>
        </div>

        {/* New Leads */}
        <div
          onClick={() => setActiveTab('leads')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              New Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.newLeads}
          </div>
          <p className="text-xs text-sky-600 dark:text-sky-400 mt-1 font-medium">Needs initial contact</p>
        </div>

        {/* Follow-ups */}
        <div
          onClick={() => setActiveTab('followups')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Follow-ups
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.followupsToday}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
            <span>{overdueLeads.length} overdue</span>
          </p>
        </div>

        {/* Hot Leads */}
        <div
          onClick={() => setActiveTab('leads')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Hot Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.hotLeads}
          </div>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">High priority prospects</p>
        </div>
      </div>

      {/* Secondary Financial Stat Cards Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Won Value */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Won Revenue
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
            {formatINR(stats.wonValue)}
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
            {stats.wonCount} Clients Converted
          </div>
        </div>

        {/* Lost Leads */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Lost Leads
            </span>
            <XCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-200">
            {stats.lostCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Archived inquiries</div>
        </div>

        {/* Pipeline Value */}
        <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              Pipeline Value
            </span>
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-950 dark:text-indigo-100">
            {formatINR(stats.pipelineValue)}
          </div>
          <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">Active Deal Opportunities</div>
        </div>

        {/* Website Health */}
        <div
          onClick={() => setActiveTab('website-audit')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Website Health
            </span>
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {auditStats?.averageHealthScore ?? '—'}
            <span className="text-sm text-slate-400 font-bold">/100</span>
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {auditStats?.auditedWebsites ?? 0} sites audited
            {(auditStats?.totalBrokenLinks ?? 0) > 0 && (
              <span className="text-rose-600 dark:text-rose-400">
                {' '}· {auditStats?.totalBrokenLinks} broken links
              </span>
            )}
          </div>
        </div>
      </div>

      {/* TODAY'S FOLLOW-UPS SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Header & Tabs */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>TODAY'S FOLLOW-UPS</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {todayLeads.length + overdueLeads.length} Action Needed
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Scheduled calls, WhatsApp messages, and client reminders.
            </p>
          </div>

          {/* Sub tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterTab('today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'today'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Due Today ({todayLeads.length})
            </button>
            <button
              onClick={() => setFilterTab('overdue')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'overdue'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              🔴 Overdue ({overdueLeads.length})
            </button>
            <button
              onClick={() => setFilterTab('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'upcoming'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              🔵 Upcoming ({upcomingLeads.length})
            </button>
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Followup Rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {displayedFollowupLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                No pending follow-ups in this view!
              </p>
              <p className="text-xs mt-1">All client communications are up to date.</p>
            </div>
          ) : (
            displayedFollowupLeads.map((lead) => {
              const isOverdue = lead.nextFollowupDate && lead.nextFollowupDate < todayStr;
              const isToday = lead.nextFollowupDate === todayStr;

              let dotColor = 'bg-blue-500';
              let badgeText = 'Upcoming';
              if (isOverdue) {
                dotColor = 'bg-rose-500';
                badgeText = 'Overdue';
              } else if (isToday) {
                dotColor = 'bg-amber-500';
                badgeText = 'Today';
              }

              const servicesList = lead.interestedServices?.join(' + ') || 'Digital Marketing';

              return (
                <div
                  key={lead.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Time / Status Indicator */}
                    <div className="flex flex-col items-center pt-0.5">
                      <span className={`w-3 h-3 rounded-full ${dotColor} ring-4 ring-slate-100 dark:ring-slate-800`} />
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                        {lead.nextFollowupTime || '10:00 AM'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          onClick={() => onSelectLead(lead)}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-base cursor-pointer"
                        >
                          {lead.companyName}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">({lead.contactPerson})</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {servicesList}
                        </span>
                        {lead.priority === 'Hot' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            🔥 Hot
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Action: {lead.nextFollowupType || 'Call'}
                        </span>
                        <span>•</span>
                        <span className="italic">"{lead.nextFollowupNote || 'General followup'}"</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: [Call] [WhatsApp] [View] */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onOpenComm(lead, 'Call')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Call</span>
                    </button>
                    <button
                      onClick={() => onOpenComm(lead, 'WhatsApp')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => onSelectLead(lead)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => completeFollowup(lead.id)}
                      title="Mark follow-up complete"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
