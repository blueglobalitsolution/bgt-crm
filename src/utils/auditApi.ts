import {
  Website,
  WebsiteAudit,
  AuditPage,
  AuditIssue,
  BrokenLink,
  WebsiteAuditDashboardStats,
  AuditSeverity,
  User,
  Designation,
  Lead,
  Client,
} from '../types';
export const AUTH_TOKEN_KEY = 'bgt_crm_token_v1';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Session expired / not authenticated → force re-login.
    if (res.status === 401 && !url.includes('/auth/login')) {
      setAuthToken(null);
      try {
        localStorage.removeItem('bgt_crm_current_user_v1');
      } catch {
        /* ignore */
      }
      window.location.reload();
      throw new Error('Session expired. Please sign in again.');
    }
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}


export interface StartAuditOptions {
  maxPages?: number;
  renderJs?: boolean;
  timeoutSeconds?: number;
}

export const auditApi = {
  listWebsites: () => request<{ websites: Website[] }>('/api/websites'),

  addWebsite: (payload: { url: string; leadId?: string; name?: string }) =>
    request<{ website: Website; created: boolean }>('/api/websites', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateWebsite: (id: string, payload: { url?: string; name?: string; leadId?: string }) =>
    request<{ website: Website }>(`/api/websites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteWebsite: (id: string) => request<{ ok: true }>(`/api/websites/${id}`, { method: 'DELETE' }),

  syncWebsites: (items: Array<{ leadId?: string; url: string; name?: string }>) =>
    request<{ created: number; websites: Website[] }>('/api/websites/sync', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  getWebsite: (id: string) => request<{ website: Website }>(`/api/websites/${id}`),

  getAuditsForWebsite: (id: string) =>
    request<{ audits: WebsiteAudit[] }>(`/api/websites/${id}/audits`),

  listAudits: () => request<{ audits: WebsiteAudit[] }>('/api/audits'),

  getRunningAudits: () =>
    request<{ running: number; audits: WebsiteAudit[] }>('/api/audits/running'),

  getAudit: (id: string) =>
    request<{ audit: WebsiteAudit; website: Website }>(`/api/audits/${id}`),

  startAudit: (websiteId: string, options?: StartAuditOptions) =>
    request<{ audit: WebsiteAudit; spawned: boolean }>('/api/audits', {
      method: 'POST',
      body: JSON.stringify({ websiteId, options }),
    }),

  rerunAudit: (id: string, options?: StartAuditOptions) =>
    request<{ audit: WebsiteAudit; spawned: boolean }>(`/api/audits/${id}/rerun`, {
      method: 'POST',
      body: JSON.stringify({ options }),
    }),

  deleteAudit: (id: string) => request<{ ok: true }>(`/api/audits/${id}`, { method: 'DELETE' }),

  clearAudits: () => request<{ ok: true; deleted: number }>('/api/audits/clear', { method: 'POST' }),

  clearAllWebsites: () => request<{ ok: true; deleted: number }>('/api/websites', { method: 'DELETE' }),

  getPages: (auditId: string) =>
    request<{ pages: AuditPage[] }>(`/api/audits/${auditId}/pages`),

  getIssues: (auditId: string, filter?: { severity?: AuditSeverity | 'all'; category?: string | 'all' }) =>
    request<{ issues: AuditIssue[]; severityCounts: Record<AuditSeverity, number> }>(
      `/api/audits/${auditId}/issues?severity=${filter?.severity || 'all'}&category=${filter?.category || 'all'}`
    ),

  getBrokenLinks: (auditId: string, status: 'open' | 'fixed' | 'ignored' | 'all' = 'open') =>
    request<{ brokenLinks: BrokenLink[] }>(`/api/audits/${auditId}/broken-links?status=${status}`),

  getProgress: (auditId: string) =>
    request<{ entries: Array<{ id: number; auditId: string; stage: string; message: string; createdAt: string }> }>(
      `/api/audits/${auditId}/progress`
    ),

  getReport: (auditId: string) =>
    request<{ audit: WebsiteAudit; website: Website; pages: AuditPage[]; issues: AuditIssue[]; brokenLinks: BrokenLink[] }>(
      `/api/audits/${auditId}/report`
    ),

  fixBrokenLink: (id: string) => request<{ ok: true }>(`/api/broken-links/${id}/fix`, { method: 'POST' }),
  ignoreBrokenLink: (id: string) => request<{ ok: true }>(`/api/broken-links/${id}/ignore`, { method: 'POST' }),
  reopenBrokenLink: (id: string) => request<{ ok: true }>(`/api/broken-links/${id}/reopen`, { method: 'POST' }),

  getStats: () => request<{ stats: WebsiteAuditDashboardStats }>('/api/audit/stats'),

  // ── Datacenter (deleted-lead archive) ──
  getArchivedLeads: () =>
    request<{ archivedLeads: Array<{ id: number; leadId: string; deletedAt: string; deletedBy?: string; data: any }> }>(
      '/api/datacenter/leads'
    ),

  archiveLead: (data: any, deletedBy?: string) =>
    request<{ ok: true }>('/api/datacenter/leads', {
      method: 'POST',
      body: JSON.stringify({ data, deletedBy }),
    }),

  restoreArchivedLead: (leadId: string) =>
    request<{ lead: any }>(`/api/datacenter/leads/${leadId}/restore`, { method: 'POST' }),

  purgeArchivedLead: (leadId: string) =>
    request<{ ok: true }>(`/api/datacenter/leads/${leadId}`, { method: 'DELETE' }),

  clearArchivedLeads: () => request<{ ok: true; deleted: number }>('/api/datacenter/leads', { method: 'DELETE' }),

  // ── Users & roles ──
  login: (username: string, password: string) =>
    request<{ user: User; token: string; permissions: string[] }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<{ user: User; permissions: string[] }>('/api/auth/me'),

  listUsers: () => request<{ users: User[] }>('/api/users'),

  createUser: (payload: { name: string; username: string; password: string; designation: string; active?: boolean }) =>
    request<{ ok: true }>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),

  updateUser: (id: string, payload: { name?: string; username?: string; password?: string; designation?: string; active?: boolean }) =>
    request<{ ok: true }>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteUser: (id: string) => request<{ ok: true }>(`/api/users/${id}`, { method: 'DELETE' }),

  listRoles: () => request<{ roles: Designation[] }>('/api/roles'),

  saveRole: (designation: string, permissions: string[]) =>
    request<{ ok: true }>(`/api/roles/${encodeURIComponent(designation)}`, {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    }),

  deleteRole: (designation: string) =>
    request<{ ok: true }>(`/api/roles/${encodeURIComponent(designation)}`, { method: 'DELETE' }),

  // ── Shared leads ──
  getLeads: () => request<{ leads: Lead[] }>('/api/leads'),

  saveLead: (lead: Lead) =>
    request<{ ok: true; lead: Lead }>('/api/leads', { method: 'POST', body: JSON.stringify({ lead }) }),

  updateLeadServer: (id: string, lead: Lead) =>
    request<{ ok: true; lead: Lead }>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify({ lead }) }),

  deleteLeadServer: (id: string) => request<{ ok: true }>(`/api/leads/${id}`, { method: 'DELETE' }),

  importLeadsServer: (leads: Lead[]) =>
    request<{ ok: true; imported: number }>('/api/leads/import', {
      method: 'POST',
      body: JSON.stringify({ leads }),
    }),

  clearLeadsServer: () => request<{ ok: true; deleted: number }>('/api/leads', { method: 'DELETE' }),

  // ── Clients (converted leads) ──
  listClients: () => request<{ clients: Client[] }>('/api/clients'),

  createClient: (client: Client) =>
    request<{ ok: true; client: Client }>('/api/clients', { method: 'POST', body: JSON.stringify({ client }) }),

  updateClient: (id: string, client: Client) =>
    request<{ ok: true; client: Client }>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify({ client }) }),

  deleteClient: (id: string) => request<{ ok: true }>(`/api/clients/${id}`, { method: 'DELETE' }),

  convertLeadToClient: (leadId: string, client: Partial<Client>) =>
    request<{ ok: true; client: Client; lead: Lead }>('/api/clients/convert', {
      method: 'POST',
      body: JSON.stringify({ leadId, client }),
    }),
};
