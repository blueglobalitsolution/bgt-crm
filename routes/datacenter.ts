import { Router, Request, Response } from 'express';
import {
  archiveLead,
  listArchivedLeads,
  getArchivedLead,
  deleteArchivedLead,
  clearArchivedLeads,
  deleteWebsitesByLeadId,
} from '../database/repository';
import { requireAuth, requirePerm } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// List archived (deleted) leads
router.get('/datacenter/leads', requirePerm('datacenter.view'), (req: Request, res: Response) => {
  const rows = listArchivedLeads();
  const isAdmin = req.user!.designation === 'Admin';
  const mine = req.user!.name;
  res.json({
    archivedLeads: rows
      .map((r) => {
        let data: any = {};
        try {
          data = JSON.parse(r.data);
        } catch {
          data = { id: r.leadId, companyName: '(unparseable record)' };
        }
        return { id: r.id, leadId: r.leadId, deletedAt: r.deletedAt, deletedBy: r.deletedBy, data };
      })
      .filter((row: any) => isAdmin || row.data?.assignedTo === mine),
  });
});

// Archive a deleted lead (also removes its website from the audit engine)
router.post('/datacenter/leads', requirePerm('leads.archive'), (req: Request, res: Response) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'object' || !data.id) {
    return res.status(400).json({ error: 'A lead object with an id is required' });
  }
  archiveLead(data.id, JSON.stringify(data), req.body?.deletedBy);

  let websiteRemoved = 0;
  try {
    websiteRemoved = deleteWebsitesByLeadId(data.id);
  } catch (e) {
    console.error('Failed to remove lead website from audit engine', e);
  }

  res.status(201).json({ ok: true, websiteRemoved });
});

// Restore an archived lead (returns it and removes the archive row in one call)
router.post('/datacenter/leads/:id/restore', requirePerm('datacenter.restore'), (req: Request, res: Response) => {
  const row = getArchivedLead(req.params.id);
  if (!row) return res.status(404).json({ error: 'Archived lead not found' });
  let data: any = {};
  try {
    data = JSON.parse(row.data);
  } catch {
    return res.status(500).json({ error: 'Archived record is corrupted' });
  }
  deleteArchivedLead(req.params.id);
  res.json({ lead: data });
});

// Permanently delete one archived lead
router.delete('/datacenter/leads/:id', requirePerm('datacenter.purge'), (req: Request, res: Response) => {
  deleteArchivedLead(req.params.id);
  res.json({ ok: true });
});

// Clear the whole archive
router.delete('/datacenter/leads', requirePerm('datacenter.purge'), (_req: Request, res: Response) => {
  const deleted = clearArchivedLeads();
  res.json({ ok: true, deleted });
});

export { router as datacenterRouter };
