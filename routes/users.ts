import { Router, Request, Response } from 'express';
import {
  listUsers,
  getUserByUsername,
  getUserByEmail,
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
import { sendOtpEmail, maskEmail, OTP_TTL_MS } from './email';

const router = Router();

function toSafeUser(u: Omit<UserRow, 'passwordHash'>) {
  return { id: u.id, name: u.name, username: u.username, designation: u.designation, active: u.active, email: u.email };
}

function permissionsFor(user: { designation: string }): string[] {
  if (user.designation === 'Admin') return [...ALL_PERMISSION_KEYS];
  const role = getDesignation(user.designation);
  return role ? role.permissions : [];
}

// ─── Auth ──────────────────────────────────────────────────────────────────

// In-memory OTP store for password-reset flows (valid for 60 seconds).
interface OtpEntry {
  otp: string;
  expiresAt: number;
  verified?: boolean;
}
const otpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Login with email + password. Returns the session token directly.
router.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = getUserByEmail(String(email).trim());
  if (!user || user.active !== 1 || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
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

// ─── Forgot password (email OTP → set new password) ──────────────────────────

// Step 1: request a password-reset OTP for the registered email.
router.post('/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return res.status(400).json({ error: 'Please enter your registered email.' });
  }

  const user = getUserByEmail(normalized);
  // Always return the same shape to avoid leaking which emails are registered.
  if (!user || user.active !== 1 || !user.email) {
    return res.json({ ok: true, sentTo: maskEmail(normalized), delivered: false, expiresInSeconds: OTP_TTL_MS / 1000 });
  }

  const otp = generateOtp();
  otpStore.set(`reset:${user.email.toLowerCase()}`, { otp, expiresAt: Date.now() + OTP_TTL_MS });
  const sent = await sendOtpEmail(user.email, otp);

  res.json({ ok: true, sentTo: maskEmail(user.email), delivered: sent, expiresInSeconds: OTP_TTL_MS / 1000 });
});

// Step 2: validate the reset OTP (60s expiry).
router.post('/auth/verify-reset-otp', (req: Request, res: Response) => {
  const { email, otp } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const key = `reset:${normalized}`;
  const entry = otpStore.get(key);
  if (!entry) {
    return res.status(400).json({ error: 'No OTP was requested for this email. Please start again.' });
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ error: 'The OTP has expired. Please request a new one.' });
  }
  if (entry.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid OTP code. Please check and try again.' });
  }

  entry.verified = true;
  res.json({ ok: true });
});

// Step 3: verify again + set the new password (must match twice on the client).
router.post('/auth/reset-password', (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP and new password are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const key = `reset:${normalized}`;
  const entry = otpStore.get(key);
  if (!entry || !entry.verified) {
    return res.status(400).json({ error: 'Please verify your OTP before setting a new password.' });
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ error: 'The OTP has expired. Please request a new one.' });
  }
  if (entry.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid OTP code. Please check and try again.' });
  }

  const user = getUserByEmail(normalized);
  if (!user || user.active !== 1) {
    return res.status(400).json({ error: 'Account not found or inactive.' });
  }

  updateUser(user.id, { passwordHash: hashPassword(String(newPassword)) });
  otpStore.delete(key);
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
  const { name, username, password, designation, active, email } = req.body || {};
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
    email: email ? String(email).trim() : undefined,
  });
  res.status(201).json({ ok: true });
});

router.put('/users/:id', requireAuth, requirePerm('users.manage'), (req: Request, res: Response) => {
  const existing = getUserById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  const { name, username, password, designation, active, email } = req.body || {};

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
    email: email !== undefined ? (email ? String(email).trim() : null) : undefined,
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
