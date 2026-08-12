import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Lead,
  Followup,
  LeadStatus,
  LeadPriority,
  CRMStats,
  ActivityLog,
} from '../types';
import { INITIAL_LEADS } from '../data/initialLeads';
import { auditApi } from '../utils/auditApi';

interface CRMContextType {
  leads: Lead[];
  selectedLead: Lead | null;
  setSelectedLead: (lead: Lead | null) => void;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'activities'>) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  restoreArchivedLead: (lead: Lead) => Promise<void>;
  addActivity: (leadId: string, activity: Omit<ActivityLog, 'id' | 'leadId' | 'timestamp'>) => void;
  completeFollowup: (leadId: string, newFollowupNote?: string) => void;
  scheduleFollowup: (
    leadId: string,
    date: string,
    time: string,
    type: 'Call' | 'WhatsApp' | 'Email' | 'Meeting',
    note: string
  ) => void;
  importLeads: (newLeads: Array<Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'activities'>>) => Promise<number>;
  resetToSampleData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  refreshLeads: () => Promise<void>;
  stats: CRMStats;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'bgt_crm_leads_v1';

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initial state = localStorage cache (fast paint); the server is the source of truth.
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading leads from storage', e);
    }
    return [];
  });

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Load from the server (source of truth) + one-time migration of browser data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await auditApi.getLeads();
        if (cancelled) return;
        if (res.leads.length > 0) {
          setLeads(res.leads);
          return;
        }
        // Server empty: migrate browser cache, otherwise seed sample data.
        let local: Lead[] = [];
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) local = parsed;
          }
        } catch {
          /* ignore */
        }
        const base = local.length > 0 ? local : INITIAL_LEADS;
        await auditApi.importLeadsServer(base as Lead[]);
        if (!cancelled) setLeads(base);
      } catch (e) {
        // Offline / server down: keep the localStorage cache.
        console.error('Failed to load leads from server', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror to localStorage (offline cache)
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(leads));
    } catch (e) {
      console.error('Error saving leads to storage', e);
    }
  }, [leads]);

  // Keep selectedLead in sync with leads list
  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find((l) => l.id === selectedLead.id);
      if (updated) {
        setSelectedLead(updated);
      }
    }
  }, [leads]);

  const reloadFromServer = async () => {
    try {
      const res = await auditApi.getLeads();
      setLeads(res.leads);
    } catch (e) {
      console.error('Failed to reload leads from server', e);
    }
  };

  const persistLead = async (lead: Lead, important = false) => {
    try {
      await auditApi.saveLead(lead);
    } catch (e: any) {
      // Conflict: another user saved a newer version → load the latest.
      if (e?.status === 409) {
        alert(e.message || 'This lead was changed by another user. Latest data loaded.');
        await reloadFromServer();
        return;
      }
      console.error('Failed to save lead to server', e);
      if (important) alert('Failed to save lead to the server. Please try again.');
    }
  };

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'activities'>): Promise<Lead> => {
    const now = new Date().toISOString();
    const newId = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const initialActivity: ActivityLog = {
      id: `act-${Date.now()}`,
      leadId: newId,
      type: 'System',
      summary: 'Lead Created',
      details: `Source: ${leadData.leadSource || 'Manual Entry'} | Assigned: ${leadData.assignedTo || 'Unassigned'}`,
      timestamp: now,
      author: 'System',
    };

    const newLead: Lead = {
      ...leadData,
      id: newId,
      createdAt: now,
      updatedAt: now,
      activities: [initialActivity],
    };

    setLeads((prev) => [newLead, ...prev]);
    await persistLead(newLead, true);
    return newLead;
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const current = leads.find((l) => l.id === id);
    if (!current) return;
    const now = new Date().toISOString();
    const updatedLead: Lead = { ...current, ...updates, updatedAt: now };

    if (updates.status && updates.status !== current.status) {
      const statusActivity: ActivityLog = {
        id: `act-${Date.now()}`,
        leadId: id,
        type: 'Status Change',
        summary: `Status updated to ${updates.status}`,
        details: `Previous status: ${current.status}`,
        timestamp: now,
        author: updates.assignedTo || current.assignedTo || 'User',
      };
      updatedLead.activities = [statusActivity, ...(current.activities || [])];
    }

    setLeads((prev) => prev.map((lead) => (lead.id === id ? updatedLead : lead)));
    await persistLead(updatedLead, true);
  };

  const deleteLead = async (id: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const now = new Date().toISOString();
    const archivedLead: Lead = {
      ...lead,
      activities: [
        {
          id: `act-${Date.now()}`,
          leadId: lead.id,
          type: 'System',
          summary: 'Deleted → moved to Datacenter',
          details: 'Lead archived in the Datacenter for future re-approach.',
          timestamp: now,
          author: 'System',
        },
        ...(lead.activities || []),
      ],
    };

    try {
      await auditApi.archiveLead(archivedLead, 'User');
      await auditApi.deleteLeadServer(id);
    } catch (e) {
      alert('Could not move the lead to the Datacenter. The lead was NOT deleted.');
      return;
    }

    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (selectedLead?.id === id) {
      setSelectedLead(null);
    }
  };

  const restoreArchivedLead = async (archived: Lead) => {
    const now = new Date().toISOString();
    let restored: Lead = archived;
    if (leads.some((l) => l.id === archived.id)) {
      restored = { ...archived, id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 4)}` };
    }
    restored = {
      ...restored,
      updatedAt: now,
      activities: [
        {
          id: `act-${Date.now()}`,
          leadId: restored.id,
          type: 'System',
          summary: 'Restored from Datacenter',
          details: 'Lead re-added to the active pipeline for re-approach.',
          timestamp: now,
          author: 'System',
        },
        ...(restored.activities || []),
      ],
    };
    setLeads((prev) => [restored, ...prev]);
    await persistLead(restored, true);
  };

  const addActivity = (
    leadId: string,
    activityData: Omit<ActivityLog, 'id' | 'leadId' | 'timestamp'>
  ) => {
    const current = leads.find((l) => l.id === leadId);
    if (!current) return;
    const now = new Date().toISOString();
    const newAct: ActivityLog = {
      ...activityData,
      id: `act-${Date.now()}`,
      leadId,
      timestamp: now,
    };
    const updatedLead: Lead = {
      ...current,
      updatedAt: now,
      activities: [newAct, ...(current.activities || [])],
    };
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updatedLead : lead)));
    persistLead(updatedLead);
  };

  const completeFollowup = (leadId: string, completionNote?: string) => {
    const current = leads.find((l) => l.id === leadId);
    if (!current) return;
    const now = new Date().toISOString();
    const activity: ActivityLog = {
      id: `act-${Date.now()}`,
      leadId,
      type: current.nextFollowupType || 'Call',
      summary: `Completed Follow-up (${current.nextFollowupType || 'Call'})`,
      details: completionNote || current.nextFollowupNote || 'Completed scheduled follow-up',
      timestamp: now,
      author: current.assignedTo || 'User',
    };
    const updatedLead: Lead = {
      ...current,
      updatedAt: now,
      nextFollowupDate: undefined,
      nextFollowupTime: undefined,
      nextFollowupType: undefined,
      nextFollowupNote: undefined,
      activities: [activity, ...(current.activities || [])],
    };
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updatedLead : lead)));
    persistLead(updatedLead);
  };

  const scheduleFollowup = (
    leadId: string,
    date: string,
    time: string,
    type: 'Call' | 'WhatsApp' | 'Email' | 'Meeting',
    note: string
  ) => {
    const current = leads.find((l) => l.id === leadId);
    if (!current) return;
    const now = new Date().toISOString();
    const activity: ActivityLog = {
      id: `act-${Date.now()}`,
      leadId,
      type: 'Note',
      summary: `Scheduled Follow-up for ${date} at ${time} (${type})`,
      details: note,
      timestamp: now,
      author: current.assignedTo || 'User',
    };
    const updatedLead: Lead = {
      ...current,
      updatedAt: now,
      nextFollowupDate: date,
      nextFollowupTime: time,
      nextFollowupType: type,
      nextFollowupNote: note,
      activities: [activity, ...(current.activities || [])],
    };
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updatedLead : lead)));
    persistLead(updatedLead);
  };

  const importLeads = async (
    newLeadsData: Array<Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'activities'>>
  ): Promise<number> => {
    const now = new Date().toISOString();
    const created = newLeadsData.map((data, idx) => {
      const id = `lead-imp-${Date.now()}-${idx}`;
      return {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
        activities: [
          {
            id: `act-imp-${Date.now()}-${idx}`,
            leadId: id,
            type: 'System' as const,
            summary: 'Imported via Excel / CSV',
            details: `Source: ${data.leadSource || 'Excel Import'}`,
            timestamp: now,
            author: 'Excel Import Worker',
          },
        ],
      } as Lead;
    });

    setLeads((prev) => [...created, ...prev]);
    try {
      await auditApi.importLeadsServer(created);
    } catch (e) {
      alert('Import was added locally but could not be saved to the server.');
    }
    return created.length;
  };

  const resetToSampleData = async () => {
    try {
      await auditApi.clearLeadsServer();
      await auditApi.importLeadsServer(INITIAL_LEADS as Lead[]);
    } catch (e) {
      alert('Could not reset data on the server.');
      return;
    }
    setLeads(INITIAL_LEADS);
    setSelectedLead(null);
  };

  const clearAllData = async () => {
    try {
      await auditApi.clearLeadsServer();
    } catch (e) {
      alert('Could not clear data on the server.');
      return;
    }
    setLeads([]);
    setSelectedLead(null);
  };

  // Compute CRM Stats
  const todayStr = new Date().toISOString().split('T')[0];
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === 'New').length;
  const followupsToday = leads.filter(
    (l) => l.nextFollowupDate === todayStr || (l.nextFollowupDate && l.nextFollowupDate < todayStr)
  ).length;
  const hotLeads = leads.filter((l) => l.priority === 'Hot').length;

  const wonLeadsList = leads.filter((l) => l.status === 'Won');
  const wonValue = wonLeadsList.reduce((acc, curr) => acc + (curr.expectedValue || 0), 0);
  const wonCount = wonLeadsList.length;
  const lostCount = leads.filter((l) => l.status === 'Lost').length;

  const pipelineValue = leads
    .filter((l) => l.status !== 'Won' && l.status !== 'Lost' && l.status !== 'Not Interested')
    .reduce((acc, curr) => acc + (curr.expectedValue || 0), 0);

  const stats: CRMStats = {
    totalLeads,
    newLeads,
    followupsToday,
    hotLeads,
    wonValue,
    wonCount,
    lostCount,
    pipelineValue,
  };

  return (
    <CRMContext.Provider
      value={{
        leads,
        selectedLead,
        setSelectedLead,
        addLead,
        updateLead,
        deleteLead,
        restoreArchivedLead,
        addActivity,
        completeFollowup,
        scheduleFollowup,
        importLeads,
        resetToSampleData,
        clearAllData,
        refreshLeads: reloadFromServer,
        stats,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
