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
