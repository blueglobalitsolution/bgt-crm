import { Router, Request, Response } from 'express';
import {
  listServerLeads,
  getServerLead,
  upsertServerLead,
  bulkImportLeads,
  deleteServerLead,
  clearServerLeads,
  serverLeadCount,
  leadIdsAssignedTo,
} from '../database/repository';
import { requireAuth, requirePerm } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/leads', requirePerm('leads.view'), (req: Request, res: Response) => {
  let leads = listServerLeads();
  if (req.user!.designation !== 'Admin') {
    const mine = req.user!.name;
    leads = leads.filter((l) => l.assignedTo === mine);
  }
  res.json({ leads });
});

router.get('/leads/count', requirePerm('leads.view'), (req: Request, res: Response) => {
  if (req.user!.designation !== 'Admin') {
    res.json({ count: leadIdsAssignedTo(req.user!.name).length });
    return;
  }
  res.json({ count: serverLeadCount() });
});

router.post('/leads', requirePerm('leads.add'), (req: Request, res: Response) => {
  const { lead } = req.body || {};
  if (!lead || !lead.id) return res.status(400).json({ error: 'A lead with an id is required' });
  // Only admins can assign leads to a specific member; others create for themselves.
  if (req.user!.designation !== 'Admin') {
    lead.assignedTo = req.user!.name;
  }
  upsertServerLead(lead);
  res.status(201).json({ ok: true, lead: getServerLead(lead.id) });
});

router.put('/leads/:id', requirePerm('leads.edit'), (req: Request, res: Response) => {
  const { lead } = req.body || {};
  if (!lead || lead.id !== req.params.id) {
    return res.status(400).json({ error: 'Lead payload id must match the URL' });
  }
  // Conflict detection: if another user saved a newer version, refuse to overwrite.
  const existing = getServerLead(req.params.id);
  if (existing && existing.updatedAt && lead.updatedAt) {
    const existingTs = new Date(existing.updatedAt).getTime();
    const incomingTs = new Date(lead.updatedAt).getTime();
    if (Number.isFinite(existingTs) && Number.isFinite(incomingTs) && existingTs > incomingTs) {
      return res.status(409).json({
        error: 'This lead was updated by another user. The latest version has been loaded.',
        lead: existing,
      });
    }
  }
  // Only admins can reassign a lead to someone else.
  if (req.user!.designation !== 'Admin' && lead.assignedTo && existing && lead.assignedTo !== existing.assignedTo) {
    return res.status(403).json({ error: 'Only admins can reassign leads' });
  }
  upsertServerLead(lead);
  res.json({ ok: true, lead: getServerLead(req.params.id) });
});

router.delete('/leads/:id', requirePerm('leads.archive'), (req: Request, res: Response) => {
  deleteServerLead(req.params.id);
  res.json({ ok: true });
});

router.post('/leads/import', requirePerm('import.excel'), (req: Request, res: Response) => {
  const { leads } = req.body || {};
  if (!Array.isArray(leads)) return res.status(400).json({ error: 'leads array is required' });
  const count = bulkImportLeads(leads);
  res.status(201).json({ ok: true, imported: count });
});

router.delete('/leads', requirePerm('settings.manage'), (_req: Request, res: Response) => {
  const deleted = clearServerLeads();
  res.json({ ok: true, deleted });
});

export { router as leadsRouter };
