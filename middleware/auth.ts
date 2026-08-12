import { Request, Response, NextFunction } from 'express';
import { getUserBySessionToken, getDesignation } from '../database/repository';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  designation: string;
  active: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

/** Requires a valid session; attaches req.user. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const user = getUserBySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  (req as Request & { user: AuthUser }).user = {
    id: user.id,
    name: user.name,
    username: user.username,
    designation: user.designation,
    active: user.active,
  };
  next();
}

/** Requires an authenticated user with the given permission (Admin always passes). */
export function requirePerm(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (user.designation === 'Admin') return next();
    const role = getDesignation(user.designation);
    if (!role || !role.permissions.includes(permission)) {
      return res.status(403).json({ error: 'You do not have permission for this action' });
    }
    next();
  };
}
