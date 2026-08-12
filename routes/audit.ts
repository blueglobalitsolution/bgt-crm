import { Router, Request, Response } from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  getDb,
  normalizeUrl,
  extractDomain,
  seedWebsitesFromLeads,
} from '../database/db';
import {
  listWebsites,
  getWebsite,
  createWebsite,
  upsertWebsiteByUrl,
  deleteWebsite,
  syncWebsites,
  createAudit,
  getAudit,
  listAudits,
  listAuditsByWebsite,
  getLatestAudit,
  updateAudit,
  deleteAudit,
  listPages,
  insertPages,
  deletePagesForAudit,
  listIssues,
  countIssuesBySeverity,
  deleteIssuesForAudit,
  listBrokenLinks,
  markBrokenLinkFixed,
  ignoreBrokenLink,
  reopenBrokenLink,
  deleteBrokenLinksForAudit,
  getAuditDashboardStats,
  listProgress,
  listRunningAudits,
  clearAllAudits,
  leadIdsAssignedTo,
  clearAllWebsites,
} from '../database/repository';
import { requireAuth, requirePerm } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// Website scope helpers (admin = everything; others = websites linked to their assigned leads)
function accessibleWebsiteIds(req: Request): string[] | null {
  if (req.user!.designation === 'Admin') return null;
  const leadIds = leadIdsAssignedTo(req.user!.name);
  if (leadIds.length === 0) return [];
  const ids = new Set(leadIds);
  return listWebsites().filter((w) => w.leadId && ids.has(w.leadId)).map((w) => w.id);
}

function canAccessWebsite(req: Request, websiteId: string): boolean {
  const ids = accessibleWebsiteIds(req);
  return ids === null || ids.includes(websiteId);
}

function canAccessAudit(req: Request, auditId: string): boolean {
  const audit = getAudit(auditId);
  if (!audit) return false;
  return canAccessWebsite(req, audit.websiteId);
}

function resolvePythonCommand(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function workerPath(): string {
  return path.join(process.cwd(), 'audit_worker', 'main.py');
}

function spawnAuditWorker(auditId: string, maxPages: number, renderJs: boolean, timeoutSeconds: number, timeBudget: number) {
  const child = spawn(
    resolvePythonCommand(),
    [
      '-m',
      'audit_worker.main',
      auditId,
      String(maxPages),
      renderJs ? '1' : '0',
      String(timeoutSeconds),
      String(timeBudget),
    ],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    }
  );

  let stderr = '';
  child.stderr?.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('error', (err) => {
    updateAudit(auditId, { status: 'failed', error: `Failed to start worker: ${err.message}` });
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      const errMsg = stderr.slice(-800) || `Worker exited with code ${code}`;
      updateAudit(auditId, { status: 'failed', error: errMsg });
    }
  });

  return child;
}

// ─── Websites ──────────────────────────────────────────────────────────────

router.get('/websites', (req: Request, res: Response) => {
  const scope = accessibleWebsiteIds(req);
  const websites = scope === null ? listWebsites() : listWebsites().filter((w) => scope.includes(w.id));
  res.json({ websites });
});

router.get('/websites/:id', (req: Request, res: Response) => {
  const website = getWebsite(req.params.id);
  if (!website || !canAccessWebsite(req, website.id)) return res.status(404).json({ error: 'Website not found' });
  res.json({ website });
});

router.post('/websites', requirePerm('audit.run'), (req: Request, res: Response) => {
  const { url, leadId, name } = req.body || {};
  const normalized = normalizeUrl(url);
  if (!normalized || !extractDomain(normalized)) {
    return res.status(400).json({ error: 'A valid website URL is required' });
  }
  const result = upsertWebsiteByUrl({ url: normalized, leadId, name });
  res.status(201).json({ website: result.website, created: result.created });
});

router.post('/websites/sync', requirePerm('audit.run'), (req: Request, res: Response) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array is required' });
  const created = syncWebsites(
    items
      .filter((item: any) => item && item.url)
      .map((item: any) => ({
        leadId: item.leadId,
        url: normalizeUrl(item.url),
        name: item.name,
      }))
  );
  res.json({ created, websites: listWebsites() });
});

router.put('/websites/:id', requirePerm('audit.run'), (req: Request, res: Response) => {
  const website = getWebsite(req.params.id);
  if (!website) return res.status(404).json({ error: 'Website not found' });
  const { url, name, leadId } = req.body || {};
  const db = getDb();
  const parts: string[] = [];
  const params: any[] = [];
  if (url) {
    const normalized = normalizeUrl(url);
    if (!extractDomain(normalized)) return res.status(400).json({ error: 'Invalid URL' });
    parts.push('url = ?');
    params.push(normalized);
    parts.push('domain = ?');
    params.push(extractDomain(normalized));
  }
  if (name !== undefined) {
    parts.push('name = ?');
    params.push(name || null);
  }
  if (leadId !== undefined) {
    parts.push('lead_id = ?');
    params.push(leadId || null);
  }
  if (parts.length > 0) {
    parts.push("updated_at = datetime('now')");
    db.prepare(`UPDATE websites SET ${parts.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  }
  res.json({ website: getWebsite(req.params.id) });
});

router.get('/websites/:id/audits', (req: Request, res: Response) => {
  const website = getWebsite(req.params.id);
  if (!website || !canAccessWebsite(req, website.id)) return res.status(404).json({ error: 'Website not found' });
  res.json({ audits: listAuditsByWebsite(req.params.id) });
});

router.delete('/websites/:id', requirePerm('audit.run'), (req: Request, res: Response) => {
  if (!canAccessWebsite(req, req.params.id)) return res.status(404).json({ error: 'Website not found' });
  deleteWebsite(req.params.id);
  res.json({ ok: true });
});

// Full reset of the Website Audit Engine (websites + all their audits, cascade)
router.delete('/websites', requirePerm('settings.manage'), (_req: Request, res: Response) => {
  const deleted = clearAllWebsites();
  res.json({ ok: true, deleted });
});

// ─── Audits ────────────────────────────────────────────────────────────────

router.get('/audits', (req: Request, res: Response) => {
  const scope = accessibleWebsiteIds(req);
  const audits = scope === null ? listAudits() : listAudits().filter((a) => scope.includes(a.websiteId));
  res.json({ audits });
});

// Must be registered before /audits/:id so it isn't treated as an id.
router.get('/audits/running', (req: Request, res: Response) => {
  const scope = accessibleWebsiteIds(req);
  const runningAudits =
    scope === null ? listRunningAudits() : listRunningAudits().filter((a) => scope.includes(a.websiteId));
  res.json({ running: runningAudits.length, audits: runningAudits });
});

router.post('/audits/clear', requirePerm('settings.manage'), (_req: Request, res: Response) => {
  const deleted = clearAllAudits();
  res.json({ ok: true, deleted });
});

router.post('/audits', requirePerm('audit.run'), (req: Request, res: Response) => {
  const { websiteId, options } = req.body || {};
  if (!websiteId) return res.status(400).json({ error: 'websiteId is required' });

  const website = getWebsite(websiteId);
  if (!website || !canAccessWebsite(req, websiteId)) return res.status(404).json({ error: 'Website not found' });

  const latest = getLatestAudit(websiteId);
  if (latest && (latest.status === 'pending' || latest.status === 'running')) {
    return res.status(409).json({ error: 'An audit is already in progress for this website', audit: latest });
  }

  const audit = createAudit(websiteId);
  const maxPages = Math.min(Number(options?.maxPages) || 500, 5000);
  const renderJs = options?.renderJs === true;
  const timeoutSeconds = Math.min(Math.max(Number(options?.timeoutSeconds) || 60, 20), 300);
  const timeBudget = Math.min(Math.max(Number(options?.timeBudgetSeconds) || 600, 60), 3600);

  let spawned = false;
  try {
    spawnAuditWorker(audit.id, maxPages, renderJs, timeoutSeconds, timeBudget);
    spawned = true;
  } catch (err: any) {
    updateAudit(audit.id, { status: 'failed', error: err?.message || 'Failed to spawn worker' });
  }

  res.status(202).json({ audit: getAudit(audit.id), spawned });
});

router.post('/audits/:id/rerun', requirePerm('audit.run'), (req: Request, res: Response) => {
  const audit = getAudit(req.params.id);
  if (!audit || !canAccessAudit(req, audit.id)) return res.status(404).json({ error: 'Audit not found' });
  const website = getWebsite(audit.websiteId);
  if (!website) return res.status(404).json({ error: 'Website not found' });

  const latest = getLatestAudit(audit.websiteId);
  if (latest && latest.id !== audit.id && (latest.status === 'pending' || latest.status === 'running')) {
    return res.status(409).json({ error: 'An audit is already in progress for this website' });
  }
  // Reuse the same audit record for re-run.
  const options = req.body?.options || {};
  updateAudit(audit.id, { status: 'pending', error: null, completed_at: null, health_score: null });
  deletePagesForAudit(audit.id);
  deleteIssuesForAudit(audit.id);
  deleteBrokenLinksForAudit(audit.id);

  const maxPages = Math.min(Number(options.maxPages) || 500, 5000);
  const renderJs = options.renderJs === true;
  const timeoutSeconds = Math.min(Math.max(Number(options.timeoutSeconds) || 60, 20), 300);
  const timeBudget = Math.min(Math.max(Number(options.timeBudgetSeconds) || 600, 60), 3600);

  try {
    spawnAuditWorker(audit.id, maxPages, renderJs, timeoutSeconds, timeBudget);
  } catch (err: any) {
    updateAudit(audit.id, { status: 'failed', error: err?.message || 'Failed to spawn worker' });
  }

  res.status(202).json({ audit: getAudit(audit.id), spawned: true });
});

router.get('/audits/:id', (req: Request, res: Response) => {
  const audit = getAudit(req.params.id);
  if (!audit || !canAccessAudit(req, audit.id)) return res.status(404).json({ error: 'Audit not found' });
  const website = getWebsite(audit.websiteId);
  res.json({ audit, website });
});

router.delete('/audits/:id', requirePerm('audit.run'), (req: Request, res: Response) => {
  if (!canAccessAudit(req, req.params.id)) return res.status(404).json({ error: 'Audit not found' });
  deleteAudit(req.params.id);
  res.json({ ok: true });
});

router.get('/audits/:id/pages', (req: Request, res: Response) => {
  if (!canAccessAudit(req, req.params.id)) return res.status(404).json({ error: 'Audit not found' });
  res.json({ pages: listPages(req.params.id) });
});

router.get('/audits/:id/issues', (req: Request, res: Response) => {
  if (!canAccessAudit(req, req.params.id)) return res.status(404).json({ error: 'Audit not found' });
  const severity = (req.query.severity as string) || 'all';
  const category = (req.query.category as string) || 'all';
  const issues = listIssues(req.params.id, { severity: severity as any, category });
  res.json({
    issues,
    severityCounts: countIssuesBySeverity(req.params.id),
  });
});

router.get('/audits/:id/broken-links', (req: Request, res: Response) => {
  if (!canAccessAudit(req, req.params.id)) return res.status(404).json({ error: 'Audit not found' });
  const filter = (req.query.status as string) || 'open';
  const links = listBrokenLinks(req.params.id, filter as any);
  res.json({ brokenLinks: links });
});

router.get('/audits/:id/progress', (req: Request, res: Response) => {
  const audit = getAudit(req.params.id);
  if (!audit || !canAccessAudit(req, audit.id)) return res.status(404).json({ error: 'Audit not found' });
  res.json({ entries: listProgress(req.params.id) });
});

router.get('/audits/:id/report', (req: Request, res: Response) => {
  const audit = getAudit(req.params.id);
  if (!audit || !canAccessAudit(req, audit.id)) return res.status(404).json({ error: 'Audit not found' });
  const website = getWebsite(audit.websiteId);
  const pages = listPages(req.params.id);
  const issues = listIssues(req.params.id);
  const brokenLinks = listBrokenLinks(req.params.id, 'open');
  res.json({ audit, website, pages, issues, brokenLinks });
});

// ─── Broken link actions ───────────────────────────────────────────────────

router.post('/broken-links/:id/fix', requirePerm('audit.run'), (req: Request, res: Response) => {
  markBrokenLinkFixed(req.params.id);
  res.json({ ok: true });
});

router.post('/broken-links/:id/ignore', requirePerm('audit.run'), (req: Request, res: Response) => {
  ignoreBrokenLink(req.params.id);
  res.json({ ok: true });
});

router.post('/broken-links/:id/reopen', requirePerm('audit.run'), (req: Request, res: Response) => {
  reopenBrokenLink(req.params.id);
  res.json({ ok: true });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────

router.get('/audit/stats', (req: Request, res: Response) => {
  const scope = accessibleWebsiteIds(req);
  const stats = scope === null ? getAuditDashboardStats() : getAuditDashboardStats(scope);
  res.json({ stats });
});

export { router as auditRouter, seedWebsitesFromLeads };

