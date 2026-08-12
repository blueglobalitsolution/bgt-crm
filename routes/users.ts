import { Router, Request, Response } from 'express';
import {
  listUsers,
  getUserByUsername,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  listDesignations,
  saveDesignation,
  deleteDesignation,
  hashPassword,
  verifyPassword,
  UserRow,
  createSession,
  getUserBySessionToken,
  deleteSession,
  generateToken,
} from '../database/repository';
import { requireAuth, requirePerm } from '../middleware/auth';
import { getDesignation } from '../database/repository';
import { ALL_PERMISSION_KEYS } from '../src/permissions';

const router = Router();

function toSafeUser(u: Omit<UserRow, 'passwordHash'>) {
  return { id: u.id, name: u.name, username: u.username, designation: u.designation, active: u.active };
}

function permissionsFor(user: { designation: string }): string[] {
  if (user.designation === 'Admin') return [...ALL_PERMISSION_KEYS];
  const role = getDesignation(user.designation);
  return role ? role.permissions : [];
}

// ─── Auth ──────────────────────────────────────────────────────────────────

router.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const user = getUserByUsername(String(username).trim());
  if (!user || user.active !== 1 || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = generateToken();
  createSession(user.id, token);
  res.json({ user: toSafeUser(user), token, permissions: permissionsFor(user) });
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) deleteSession(token);
  res.json({ ok: true });
});

router.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user, permissions: permissionsFor(req.user!) });
});

// ─── Users & roles (admin only) ────────────────────────────────────────────

router.get('/users', requireAuth, requirePerm('users.manage'), (_req: Request, res: Response) => {
  res.json({ users: listUsers() });
});

router.post('/users', requireAuth, requirePerm('users.manage'), (req: Request, res: Response) => {
  const { name, username, password, designation, active } = req.body || {};
  if (!name || !username || !password || !designation) {
    return res.status(400).json({ error: 'name, username, password and designation are required' });
  }
  if (getUserByUsername(String(username).trim())) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  createUser({
    name: String(name).trim(),
    username: String(username).trim(),
    passwordHash: hashPassword(String(password)),
    designation: String(designation),
    active: active === false ? 0 : 1,
  });
  res.status(201).json({ ok: true });
});

router.put('/users/:id', requireAuth, requirePerm('users.manage'), (req: Request, res: Response) => {
  const existing = getUserById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  const { name, username, password, designation, active } = req.body || {};

  if (username) {
    const dup = getUserByUsername(String(username).trim());
    if (dup && dup.id !== req.params.id) {
      return res.status(409).json({ error: 'Username already exists' });
    }
  }

  updateUser(req.params.id, {
    name: name !== undefined ? String(name).trim() : undefined,
    username: username !== undefined ? String(username).trim() : undefined,
    passwordHash: password ? hashPassword(String(password)) : undefined,
    designation: designation !== undefined ? String(designation) : undefined,
    active: active !== undefined ? (active === false ? 0 : 1) : undefined,
  });
  res.json({ ok: true });
});

router.delete('/users/:id', requireAuth, requirePerm('users.manage'), (req: Request, res: Response) => {
  deleteUser(req.params.id);
  res.json({ ok: true });
});

router.get('/roles', requireAuth, requirePerm('users.manage'), (_req: Request, res: Response) => {
  res.json({ roles: listDesignations() });
});

router.post('/roles/:designation', requireAuth, requirePerm('users.manage'), (req: Request, res: Response) => {
  const { permissions } = req.body || {};
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions array is required' });
  }
  saveDesignation(decodeURIComponent(req.params.designation), permissions);
  res.json({ ok: true });
});

router.delete('/roles/:designation', requireAuth, requirePerm('users.manage'), (req: Request, res: Response) => {
  deleteDesignation(decodeURIComponent(req.params.designation));
  res.json({ ok: true });
});

export { router as usersRouter };
