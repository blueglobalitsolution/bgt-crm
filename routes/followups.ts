import { Router, Request, Response } from 'express';
import { listServerLeads, getServerLead, listClients, upsertServerLead } from '../database/repository';

// Public endpoint (no auth) so the mobile app can pull follow-up reminders.
// NOTE: The web/Flutter client should interpret nextFollowupDate + nextFollowupTime
// in the DEVICE's local timezone (the CRM user and the phone are the same person),
// so reminders fire at the wall-clock time the user entered. followupAt/reminderAt
// below are computed in the server's local timezone for reference only.

const router = Router();

const TERMINAL_STATUSES = ['Won', 'Lost', 'Not Interested', 'No Response'];

function parseTime12(t?: string): { hour: number; minute: number } {
  if (!t) return { hour: 9, minute: 0 };
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return { hour: 9, minute: 0 };
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && hour < 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

function followupDate(date?: string, time?: string): Date | null {
  if (!date) return null;
  const { hour, minute } = parseTime12(time);
  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, hour, minute, 0, 0);
}

function toFollowup(lead: any, converted: Set<string>, reminderMinutes: number) {
  const date = lead.nextFollowupDate;
  const time = lead.nextFollowupTime || '11:00 AM';
  const at = followupDate(date, time);
  const now = Date.now();
  const reminderMs = Math.max(0, reminderMinutes) * 60000;

  let lastActivity: { type: string; summary: string; outcome: string | null; timestamp: string | null } | null = null;
  if (Array.isArray(lead.activities) && lead.activities.length > 0) {
    const sorted = [...lead.activities].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    const a = sorted[0];
    lastActivity = {
      type: a.type || 'Note',
      summary: a.summary || '',
      outcome: a.outcome || null,
      timestamp: a.timestamp || null,
    };
  }

  return {
    leadId: lead.id,
    companyName: lead.companyName || '',
    contactPerson: lead.contactPerson || '',
    mobile: lead.mobile || '',
    whatsapp: lead.whatsapp || lead.mobile || '',
    email: lead.email || '',
    website: lead.website || '',
    city: lead.city || '',
    state: lead.state || '',
    status: lead.status || 'New',
    priority: lead.priority || 'Warm',
    interestedServices: Array.isArray(lead.interestedServices) ? lead.interestedServices : [],
    requirementNotes: lead.requirementNotes || '',
    assignedTo: lead.assignedTo || 'Unassigned',
    convertedToClient: converted.has(lead.id),
    nextFollowupDate: date,
    nextFollowupTime: time,
    nextFollowupType: lead.nextFollowupType || 'Call',
    nextFollowupNote: lead.nextFollowupNote || '',
    followupAt: at ? at.toISOString() : null,
    reminderAt: at ? new Date(at.getTime() - reminderMs).toISOString() : null,
    overdue: at ? at.getTime() < now : false,
    lastActivity,
  };
}

router.get('/followups', (req: Request, res: Response) => {
  const reminderMinutes = Math.max(0, parseInt(String(req.query.reminderMinutes || '60'), 10) || 60);
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const converted = new Set(listClients().map((c) => c.leadId).filter(Boolean));

  const followups = listServerLeads()
    .filter((l) => l && l.nextFollowupDate && !TERMINAL_STATUSES.includes(l.status))
    .map((l) => toFollowup(l, converted, reminderMinutes))
    .filter((f) => {
      if (from && f.nextFollowupDate && f.nextFollowupDate < from) return false;
      if (to && f.nextFollowupDate && f.nextFollowupDate > to) return false;
      return true;
    })
    .sort((a, b) => (a.nextFollowupDate || '').localeCompare(b.nextFollowupDate || ''));

  res.json({ serverTime: new Date().toISOString(), count: followups.length, followups });
});

router.get('/followups/:leadId', (req: Request, res: Response) => {
  const lead = getServerLead(req.params.leadId);
  if (!lead || !lead.nextFollowupDate || TERMINAL_STATUSES.includes(lead.status)) {
    return res.status(404).json({ error: 'No pending follow-up found for this lead' });
  }
  const converted = new Set(listClients().map((c) => c.leadId).filter(Boolean));
  res.json({ followup: toFollowup(lead, converted, 60) });
});

/**
 * Public write endpoint for the mobile app: marks a pending follow-up as done,
 * sets the customer's status (default 'Connected') and clears the follow-up so
 * it stops appearing in the pending list. Logs a Follow-up + Status Change activity.
 */
router.post('/followups/:leadId/complete', (req: Request, res: Response) => {
  const lead = getServerLead(req.params.leadId);
  if (!lead || !lead.nextFollowupDate || TERMINAL_STATUSES.includes(lead.status)) {
    return res.status(404).json({ error: 'No pending follow-up found for this lead' });
  }
  const rawStatus = req.body?.status;
  const status =
    typeof rawStatus === 'string' && rawStatus.trim() ? rawStatus.trim() : 'Connected';
  const now = new Date().toISOString();
  const actId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const activities = Array.isArray(lead.activities) ? [...lead.activities] : [];

  activities.unshift({
    id: actId(),
    leadId: lead.id,
    type: 'Follow-up',
    summary: 'Follow-up completed from mobile app',
    details: `Marked ${status} and cleared the follow-up.`,
    timestamp: now,
    author: lead.assignedTo || 'User',
  });
  if (lead.status !== status) {
    activities.unshift({
      id: actId(),
      leadId: lead.id,
      type: 'Status Change',
      summary: `Status updated to ${status}`,
      details: `Previous status: ${lead.status}`,
      timestamp: now,
      author: lead.assignedTo || 'User',
    });
  }

  upsertServerLead({
    ...lead,
    status,
    updatedAt: now,
    nextFollowupDate: undefined,
    nextFollowupTime: undefined,
    nextFollowupType: undefined,
    nextFollowupNote: undefined,
    activities,
  });

  res.json({ ok: true, leadId: lead.id, status });
});

export { router as followupsRouter };
