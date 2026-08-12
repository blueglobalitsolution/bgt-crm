import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Lead } from '../types';
import {
  Calendar as CalendarIcon,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  Filter,
  Eye,
  AlertCircle,
} from 'lucide-react';

interface FollowupsViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenComm: (lead: Lead, mode: 'Call' | 'WhatsApp') => void;
}

export const FollowupsView: React.FC<FollowupsViewProps> = ({
  onSelectLead,
  onOpenComm,
}) => {
  const { leads, completeFollowup } = useCRM();
  const [activeCategory, setActiveCategory] = useState<'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'all'>('today');

  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];

  const tomorrowObj = new Date(Date.now() + 86400000);
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

  // Group leads
  const overdueLeads = leads.filter(
    (l) => l.nextFollowupDate && l.nextFollowupDate < todayStr && l.status !== 'Won' && l.status !== 'Lost'
  );

  const todayLeads = leads.filter(
    (l) => l.nextFollowupDate === todayStr && l.status !== 'Won' && l.status !== 'Lost'
  );

  const tomorrowLeads = leads.filter(
    (l) => l.nextFollowupDate === tomorrowStr && l.status !== 'Won' && l.status !== 'Lost'
  );

  const upcomingLeads = leads.filter(
    (l) => l.nextFollowupDate && l.nextFollowupDate > tomorrowStr && l.status !== 'Won' && l.status !== 'Lost'
  );

  let currentList: Lead[] = [];
  if (activeCategory === 'overdue') currentList = overdueLeads;
  else if (activeCategory === 'today') currentList = todayLeads;
  else if (activeCategory === 'tomorrow') currentList = tomorrowLeads;
  else if (activeCategory === 'upcoming') currentList = upcomingLeads;
  else currentList = [...overdueLeads, ...todayLeads, ...tomorrowLeads, ...upcomingLeads];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-amber-500" />
          <span>Follow-up Management</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Stay on top of every prospect touchpoint and never miss a client call.
        </p>
      </div>

      {/* Summary Cards matching Prompt Specs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Overdue */}
        <div
          onClick={() => setActiveCategory('overdue')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === 'overdue'
              ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/50 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                activeCategory === 'overdue' ? 'text-white' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              🔴 Overdue
            </span>
            <AlertCircle className={`w-4 h-4 ${activeCategory === 'overdue' ? 'text-white' : 'text-rose-500'}`} />
          </div>
          <div className="text-3xl font-extrabold mt-2">{overdueLeads.length}</div>
          <p className="text-[11px] mt-1 opacity-80">Requires immediate call</p>
        </div>

        {/* Due Today */}
        <div
          onClick={() => setActiveCategory('today')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === 'today'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                activeCategory === 'today' ? 'text-white' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              🟠 Due Today
            </span>
            <Clock className={`w-4 h-4 ${activeCategory === 'today' ? 'text-white' : 'text-amber-500'}`} />
          </div>
          <div className="text-3xl font-extrabold mt-2">{todayLeads.length}</div>
          <p className="text-[11px] mt-1 opacity-80">Scheduled for today</p>
        </div>

        {/* Tomorrow */}
        <div
          onClick={() => setActiveCategory('tomorrow')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === 'tomorrow'
              ? 'bg-yellow-500 text-white border-yellow-600 shadow-md shadow-yellow-500/20'
              : 'bg-white dark:bg-slate-900 border-yellow-200 dark:border-yellow-900/50 hover:border-yellow-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                activeCategory === 'tomorrow' ? 'text-white' : 'text-yellow-600 dark:text-yellow-400'
              }`}
            >
              🟡 Tomorrow
            </span>
            <CalendarIcon className={`w-4 h-4 ${activeCategory === 'tomorrow' ? 'text-white' : 'text-yellow-500'}`} />
          </div>
          <div className="text-3xl font-extrabold mt-2">{tomorrowLeads.length}</div>
          <p className="text-[11px] mt-1 opacity-80">Plan for tomorrow</p>
        </div>

        {/* Upcoming */}
        <div
          onClick={() => setActiveCategory('upcoming')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === 'upcoming'
              ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/20'
              : 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/50 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                activeCategory === 'upcoming' ? 'text-white' : 'text-blue-600 dark:text-blue-400'
              }`}
            >
              🔵 Upcoming
            </span>
            <CalendarIcon className={`w-4 h-4 ${activeCategory === 'upcoming' ? 'text-white' : 'text-blue-500'}`} />
          </div>
          <div className="text-3xl font-extrabold mt-2">{upcomingLeads.length}</div>
          <p className="text-[11px] mt-1 opacity-80">Future scheduled touchpoints</p>
        </div>
      </div>

      {/* Followup List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm capitalize">
            {activeCategory} Follow-ups ({currentList.length})
          </h3>
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-xs font-semibold px-3 py-1 rounded-lg ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Show All Pending
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {currentList.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                No follow-ups in this category!
              </p>
            </div>
          ) : (
            currentList.map((lead) => {
              const isOverdue = lead.nextFollowupDate && lead.nextFollowupDate < todayStr;
              const isToday = lead.nextFollowupDate === todayStr;
              const isTomorrow = lead.nextFollowupDate === tomorrowStr;

              let dotColor = 'bg-blue-500';
              let badgeText = 'Upcoming';
              if (isOverdue) {
                dotColor = 'bg-rose-500';
                badgeText = 'Overdue';
              } else if (isToday) {
                dotColor = 'bg-amber-500';
                badgeText = 'Today';
              } else if (isTomorrow) {
                dotColor = 'bg-yellow-500';
                badgeText = 'Tomorrow';
              }

              return (
                <div
                  key={lead.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <span className={`w-3 h-3 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          onClick={() => onSelectLead(lead)}
                          className="font-bold text-slate-900 dark:text-slate-100 text-base hover:text-blue-600 cursor-pointer"
                        >
                          {lead.companyName}
                        </span>
                        <span className="text-xs text-slate-500">({lead.contactPerson} • {lead.mobile})</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {lead.nextFollowupDate} @ {lead.nextFollowupTime || '11:00 AM'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Channel: {lead.nextFollowupType || 'WhatsApp'}
                        </span>
                        <span>•</span>
                        <span className="italic">Note: "{lead.nextFollowupNote || 'General check-in'}"</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onOpenComm(lead, 'Call')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </button>
                    <button
                      onClick={() => onOpenComm(lead, 'WhatsApp')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => completeFollowup(lead.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Complete</span>
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
