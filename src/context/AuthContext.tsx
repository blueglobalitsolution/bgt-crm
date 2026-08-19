import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Designation } from '../types';
import { auditApi, setAuthToken, getAuthToken } from '../utils/auditApi';

const CURRENT_USER_KEY = 'bgt_crm_current_user_v1';

interface AuthContextType {
  user: User | null;
  users: User[];
  roles: Designation[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUsers: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  can: (permission: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      return saved ? (JSON.parse(saved) as User) : null;
    } catch {
      return null;
    }
  });
  const [permissions, setPermissions] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await auditApi.listUsers();
      setUsers(res.users);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshRoles = useCallback(async () => {
    try {
      const res = await auditApi.listRoles();
      setRoles(res.roles);
    } catch {
      /* ignore */
    }
  }, []);

  // On reload with a saved session: re-validate and restore user + permissions,
  // and reload the team members / designations lists.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    auditApi
      .getMe()
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setPermissions(res.permissions);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(res.user));
        refreshUsers();
        refreshRoles();
      })
      .catch(() => {
        // Session invalid → the request helper already clears storage + reloads to login.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await auditApi.login(email, password);
      setAuthToken(res.token);
      setUser(res.user);
      setPermissions(res.permissions);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(res.user));
      refreshUsers();
      refreshRoles();
    },
    [refreshUsers, refreshRoles]
  );

  const logout = useCallback(() => {
    const token = getAuthToken();
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setAuthToken(null);
    setUser(null);
    setPermissions([]);
    setUsers([]);
    setRoles([]);
    localStorage.removeItem(CURRENT_USER_KEY);
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.designation === 'Admin') return true;
      return permissions.includes(permission);
    },
    [user, permissions]
  );

  const isAdmin = !!user && user.designation === 'Admin';

  return (
      <AuthContext.Provider
        value={{
          user,
          users,
          roles,
          loading,
          login,
          logout,
          refreshUsers,
          refreshRoles,
          can,
          isAdmin,
        }}
      >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
