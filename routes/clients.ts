import { Router, Request, Response } from 'express';
import {
  listClients,
  getClient,
  getClientByLeadId,
  upsertClient,
  deleteClient,
  getServerLead,
  upsertServerLead,
  leadIdsAssignedTo,
  listSubscriptionsForClient,
  getSubscription,
  upsertSubscription,
  deleteSubscription,
  getMonthlyLog,
  upsertMonthlyLog,
  deleteMonthlyLog,
  ClientRow,
} from '../database/repository';
import { requireAuth, requirePerm } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

function clientAccessible(req: Request, client: ClientRow): boolean {
  if (req.user!.designation === 'Admin') return true;
  const mine = req.user!.name;
  if (client.accountManager === mine) return true;
  if (client.leadId) {
    const leadIds = leadIdsAssignedTo(mine);
    if (leadIds.includes(client.leadId)) return true;
  }
  return false;
}

function withSubs(client: ClientRow) {
  return { ...client, subscriptions: listSubscriptionsForClient(client.id) };
}

router.get('/clients', requirePerm('customers.view'), (req: Request, res: Response) => {
  const clients = listClients();
  if (req.user!.designation !== 'Admin') {
    res.json({ clients: clients.filter((c) => clientAccessible(req, c)).map(withSubs) });
    return;
  }
  res.json({ clients: clients.map(withSubs) });
});

router.get('/clients/:id', requirePerm('customers.view'), (req: Request, res: Response) => {
  const client = getClient(req.params.id);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  res.json({ client: withSubs(client) });
});

// ─── Client subscriptions ──────────────────────────────────────────────────

router.get('/clients/:id/subscriptions', requirePerm('customers.view'), (req: Request, res: Response) => {
  const client = getClient(req.params.id);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  res.json({ subscriptions: listSubscriptionsForClient(client.id) });
});

router.post('/subscriptions', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const { clientId, service, billingType, amount, startDate, endDate, status, notes } = req.body || {};
  if (!clientId || !service) {
    return res.status(400).json({ error: 'clientId and service are required' });
  }
  const client = getClient(clientId);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  upsertSubscription({
    id,
    clientId,
    service,
    billingType: billingType || 'Monthly',
    amount: Number(amount) || 0,
    startDate,
    endDate,
    status: status || 'Active',
    notes,
  });
  res.status(201).json({ ok: true, subscription: getSubscription(id) });
});

router.put('/subscriptions/:id', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const existing = getSubscription(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subscription not found' });
  const client = getClient(existing.clientId);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  const body = req.body || {};
  upsertSubscription({
    id: existing.id,
    clientId: existing.clientId,
    service: body.service !== undefined ? body.service : existing.service,
    billingType: body.billingType !== undefined ? body.billingType : existing.billingType,
    amount: body.amount !== undefined ? Number(body.amount) || 0 : existing.amount,
    startDate: body.startDate !== undefined ? body.startDate : existing.startDate,
    endDate: body.endDate !== undefined ? body.endDate : existing.endDate,
    status: body.status !== undefined ? body.status : existing.status,
    notes: body.notes !== undefined ? body.notes : existing.notes,
  });
  res.json({ ok: true, subscription: getSubscription(existing.id) });
});

router.delete('/subscriptions/:id', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const existing = getSubscription(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subscription not found' });
  const client = getClient(existing.clientId);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  deleteSubscription(existing.id);
  res.json({ ok: true });
});

// ─── Subscription monthly content logs (posts + reels per month) ───────────

router.post('/subscriptions/:id/monthly-logs', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const { month, posts, reels, fields } = req.body || {};
  const existing = getSubscription(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subscription not found' });
  const client = getClient(existing.clientId);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  const f = fields && typeof fields === 'object' ? fields : {};
  if (!f.month && !month && !f.date && !f.task && !f.deliverable && !f.quantity && !f.remarks) {
    return res.status(400).json({ error: 'Entry details are required' });
  }
  const id = `mlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const data = { ...f, month: f.month || month };
  if (!('posts' in data)) data.posts = Number(posts) || 0;
  if (!('reels' in data)) data.reels = Number(reels) || 0;
  upsertMonthlyLog({ id, subscriptionId: existing.id, fields: data, recordedBy: req.user!.name });
  res.status(201).json({ ok: true, log: getMonthlyLog(id) });
});

router.put('/subscriptions/:id/monthly-logs/:logId', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const existing = getSubscription(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subscription not found' });
  const client = getClient(existing.clientId);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  const log = getMonthlyLog(req.params.logId);
  if (!log || log.subscriptionId !== existing.id) return res.status(404).json({ error: 'Monthly log not found' });
  const body = req.body || {};
  const fields = body.fields && typeof body.fields === 'object' ? { ...(log.fields || {}), ...body.fields } : log.fields;
  if (body.month !== undefined) fields.month = body.month;
  if (body.posts !== undefined) fields.posts = Number(body.posts) || 0;
  if (body.reels !== undefined) fields.reels = Number(body.reels) || 0;
  upsertMonthlyLog({ id: log.id, subscriptionId: existing.id, fields, recordedBy: log.recordedBy || req.user!.name });
  res.json({ ok: true, log: getMonthlyLog(log.id) });
});

router.delete('/subscriptions/:id/monthly-logs/:logId', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const existing = getSubscription(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subscription not found' });
  const client = getClient(existing.clientId);
  if (!client || !clientAccessible(req, client)) return res.status(404).json({ error: 'Client not found' });
  const log = getMonthlyLog(req.params.logId);
  if (!log || log.subscriptionId !== existing.id) return res.status(404).json({ error: 'Monthly log not found' });
  deleteMonthlyLog(log.id);
  res.json({ ok: true });
});

router.post('/clients', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const { client } = req.body || {};
  if (!client || !client.id || !client.companyName) {
    return res.status(400).json({ error: 'A client with an id and company name is required' });
  }
  if (client.leadId && getClientByLeadId(client.leadId)) {
    return res.status(409).json({ error: 'A client already exists for this lead' });
  }
  upsertClient(client);
  res.status(201).json({ ok: true, client: getClient(client.id) });
});

// Convert a lead into a client (creates the client AND marks the lead Won atomically)
router.post('/clients/convert', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const { leadId, client } = req.body || {};
  if (!leadId || !client) return res.status(400).json({ error: 'leadId and client are required' });
  const lead = getServerLead(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (getClientByLeadId(leadId)) {
    return res.status(409).json({ error: 'A client already exists for this lead' });
  }
  const clientRow: ClientRow = {
    id: `client-${leadId}`,
    leadId,
    companyName: client.companyName || lead.companyName || 'Unknown',
    contactPerson: client.contactPerson || lead.contactPerson,
    mobile: client.mobile || lead.mobile,
    email: client.email || lead.email,
    website: client.website || lead.website,
    contractValue: Number(client.contractValue) || lead.expectedValue || 0,
    monthlyRetainer: Number(client.monthlyRetainer) || 0,
    startDate: client.startDate || lead.updatedAt?.slice(0, 10) || undefined,
    endDate: client.endDate || undefined,
    services: Array.isArray(client.services) && client.services.length > 0 ? client.services : lead.interestedServices || [],
    accountManager: client.accountManager || lead.assignedTo || req.user!.name,
    agreementStatus: client.agreementStatus || 'Active',
    notes: client.notes || undefined,
    onboarding: client.onboarding || undefined,
    contacts: Array.isArray(client.contacts) && client.contacts.length > 0
      ? client.contacts
      : [
          {
            id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: lead.contactPerson || client.contactPerson || 'Primary Contact',
            mobile: lead.mobile || client.mobile,
            whatsapp: lead.whatsapp,
            email: lead.email || client.email,
            role: 'Primary Contact',
            isPrimary: true,
          },
        ],
  };
  upsertClient(clientRow);
  if (lead.status !== 'Won') {
    lead.status = 'Won';
    lead.updatedAt = new Date().toISOString();
    upsertServerLead(lead);
  }
  res.status(201).json({ ok: true, client: getClient(clientRow.id), lead: getServerLead(leadId) });
});

router.put('/clients/:id', requirePerm('customers.manage'), (req: Request, res: Response) => {
  const { client } = req.body || {};
  if (!client || client.id !== req.params.id) {
    return res.status(400).json({ error: 'Client payload id must match the URL' });
  }
  upsertClient(client);
  res.json({ ok: true, client: getClient(client.id) });
});

router.delete('/clients/:id', requirePerm('customers.manage'), (req: Request, res: Response) => {
  deleteClient(req.params.id);
  res.json({ ok: true });
});

export { router as clientsRouter };
