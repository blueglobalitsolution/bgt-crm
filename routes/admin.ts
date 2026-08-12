import { Router, Request, Response } from 'express';
import { backupDatabase } from '../database/repository';
import { requireAuth, requirePerm } from '../middleware/auth';

const router = Router();

router.post('/admin/backup', requireAuth, requirePerm('settings.manage'), (_req: Request, res: Response) => {
  const dest = backupDatabase();
  if (!dest) return res.status(500).json({ error: 'Backup failed' });
  res.json({ ok: true, file: dest });
});

export { router as adminRouter };
