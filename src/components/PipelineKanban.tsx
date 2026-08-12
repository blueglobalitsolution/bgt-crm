import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { Lead, LeadStatus } from '../types';
import { Kanban, Phone, MessageSquare, Eye, ChevronRight, ChevronLeft, Plus, Briefcase } from 'lucide-react';
import { ClientFormModal } from './ClientFormModal';

interface PipelineKanbanProps {
  onSelectLead: (lead: Lead) => void;
  onOpenComm: (lead: Lead, mode: 'Call' | 'WhatsApp') => void;
  onOpenAddLead: () => void;
}

const STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'New', label: 'NEW', color: 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30' },
  { id: 'Contacted', label: 'CONTACTED', color: 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30' },
  { id: 'Interested', label: 'INTERESTED', color: 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30' },
  { id: 'Proposal Sent', label: 'PROPOSAL', color: 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/30' },
  { id: 'Meeting', label: 'MEETING', color: 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30' },
  { id: 'Negotiation', label: 'NEGOTIATION', color: 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30' },
  { id: 'Won', label: 'WON', color: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30' },
  { id: 'Lost', label: 'LOST', color: 'border-slate-400 bg-slate-50/50 dark:bg-slate-800/30' },
];

export const PipelineKanban: React.FC<PipelineKanbanProps> = ({
  onSelectLead,
  onOpenComm,
  onOpenAddLead,
}) => {
  const { leads, updateLead, refreshLeads } = useCRM();
  const { can } = useAuth();
  const canMove = can('pipeline.move');
  const [convertLead, setConvertLead] = useState<Lead | null>(null);

  const moveStage = (leadId: string, currentStatus: LeadStatus, direction: 'next' | 'prev') => {
    const currentIndex = STAGES.findIndex((s) => s.id === currentStatus);
    if (currentIndex === -1) return;

    let targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= 0 && targetIndex < STAGES.length) {
      updateLead(leadId, { status: STAGES[targetIndex].id });
    }
  };

  const formatINR = (val?: number) => {
    if (!val) return '₹0';
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-600" />
            <span>Sales Pipeline Kanban</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visualize digital marketing deal stages from lead inquiry to client sign-off.
          </p>
        </div>
        <button
          onClick={onOpenAddLead}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 snap-x min-h-[70vh]">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.status === stage.id);
          const stageTotalValue = stageLeads.reduce((acc, curr) => acc + (curr.expectedValue || 0), 0);

          return (
            <div
              key={stage.id}
              className={`w-72 shrink-0 rounded-2xl border-t-4 border-x border-b border-slate-200/80 dark:border-slate-800 ${stage.color} flex flex-col snap-start`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {stage.label}
                  </h3>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {formatINR(stageTotalValue)} • {stageLeads.length} deals
                  </div>
                </div>
                <span className="w-6 h-6 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  {stageLeads.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
                {stageLeads.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-700 rounded-xl my-2">
                    Empty Stage
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4
                          onClick={() => onSelectLead(lead)}
                          className="font-bold text-xs text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer line-clamp-1"
                        >
                          {lead.companyName}
                        </h4>
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                          {formatINR(lead.expectedValue)}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mb-2 truncate">
                        {lead.contactPerson} ({lead.mobile})
                      </div>

                      <div className="flex items-center gap-1 flex-wrap mb-2">
                        {lead.interestedServices?.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onOpenComm(lead, 'Call')}
                            className="p-2 rounded text-emerald-600 hover:bg-emerald-50"
                          >
                            <Phone className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onOpenComm(lead, 'WhatsApp')}
                            className="p-2 rounded text-green-600 hover:bg-green-50"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Stage Shift Buttons */}
                        <div className="flex items-center gap-1">
                          {lead.status === 'Won' && can('customers.manage') && (
                            <button
                              onClick={() => setConvertLead(lead)}
                              title="Convert to Client"
                              className="p-2 rounded text-emerald-600 hover:bg-emerald-50"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canMove && (
                            <button
                              onClick={() => moveStage(lead.id, lead.status, 'prev')}
                              title="Move to previous stage"
                              className="p-2 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canMove && (
                            <button
                              onClick={() => moveStage(lead.id, lead.status, 'next')}
                              title="Move to next stage"
                              className="p-2 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ClientFormModal
        isOpen={convertLead !== null}
        lead={convertLead}
        onClose={() => setConvertLead(null)}
        onSaved={() => {
          setConvertLead(null);
          refreshLeads();
        }}
      />
    </div>
  );
};
