import { Router, Request, Response } from 'express';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  backupDatabase,
  validateSqliteFile,
  restoreDatabaseFromFile,
  getPasswordHashByUserId,
  verifyPassword,
  listRunningAudits,
} from '../database/repository';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

function adminPasswordMatches(req: Request): boolean {
  const user = req.user;
  if (!user) return false;
  const stored = getPasswordHashByUserId(user.id);
  if (!stored) return false;
  const entered = (req.headers['x-db-password'] as string) || '';
  return verifyPassword(entered, stored);
}

router.post('/admin/backup', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const dest = backupDatabase();
  if (!dest) return res.status(500).json({ error: 'Backup failed' });
  res.json({ ok: true, file: dest });
});

// Export the whole database as a download (password-protected, admin only)
router.get('/admin/db/export', requireAuth, requireAdmin, (req: Request, res: Response) => {
  if (!adminPasswordMatches(req)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const dest = backupDatabase();
  if (!dest) return res.status(500).json({ error: 'Backup failed' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.download(dest, `bgt-crm-db-${stamp}.db`);
});

// Import / replace the whole database from an uploaded SQLite file (password-protected, admin only)
router.post(
  '/admin/db/import',
  requireAuth,
  requireAdmin,
  express.raw({ type: ['application/octet-stream', 'application/x-sqlite3'], limit: '200mb' }),
  (req: Request, res: Response) => {
    if (!adminPasswordMatches(req)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    if (listRunningAudits().length > 0) {
      return res.status(409).json({ error: 'Cannot import the database while an audit is running' });
    }
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length < 100) {
      return res.status(400).json({ error: 'No database file received' });
    }

    const importsDir = path.join(process.cwd(), 'imports');
    if (!fs.existsSync(importsDir)) fs.mkdirSync(importsDir, { recursive: true });
    const temp = path.join(importsDir, `import-${Date.now()}.db`);
    fs.writeFileSync(temp, req.body);

    const validationError = validateSqliteFile(temp);
    if (validationError) {
      fs.rmSync(temp, { force: true });
      return res.status(400).json({ error: validationError });
    }

    try {
      restoreDatabaseFromFile(temp);
    } catch (e: any) {
      console.error('Database import failed', e);
      fs.rmSync(temp, { force: true });
      return res.status(500).json({ error: `Database import failed: ${e?.message || 'unknown error'}` });
    }
    fs.rmSync(temp, { force: true });
    res.json({ ok: true });
  }
);

export { router as adminRouter };
