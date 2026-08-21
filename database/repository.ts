import { getDb, closeDb, DB_PATH } from './db';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DESIGNATIONS, ALL_PERMISSION_KEYS } from '../src/permissions';
import type {
  Website,
  WebsiteAudit,
  AuditPage,
  AuditIssue,
  BrokenLink,
  WebsiteAuditDashboardStats,
  AuditSeverity,
} from '../src/types';

// ─── helpers ───────────────────────────────────────────────────────────────

function camel<T = any>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
    out[camelKey] = value;
  }
  return out as T;
}

function rowToWebsite(row: Record<string, any>): Website {
  return camel<Website>(row);
}

// ─── websites ──────────────────────────────────────────────────────────────

export interface CreateWebsiteInput {
  url: string;
  leadId?: string;
  name?: string;
}

export function listWebsites(): Website[] {
  const db = getDb();
  const websiteRows = db.prepare('SELECT * FROM websites ORDER BY created_at DESC').all() as Record<string, any>[];
  const latestAuditRows = db
    .prepare(
      `SELECT a.* FROM website_audits a
       INNER JOIN (
         SELECT website_id, MAX(created_at) AS max_created
         FROM website_audits GROUP BY website_id
       ) m ON a.website_id = m.website_id AND a.created_at = m.max_created`
    )
    .all() as Record<string, any>[];
  const auditMap = new Map<string, WebsiteAudit>();
  for (const r of latestAuditRows) auditMap.set(r.website_id, camel<WebsiteAudit>(r));

  return websiteRows.map((r) => ({
    ...rowToWebsite(r),
    latestAudit: auditMap.get(r.id) || null,
  }));
}

export function getWebsite(id: string): Website | null {
  const row = getDb().prepare('SELECT * FROM websites WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!row) return null;
  const website = rowToWebsite(row);
  website.latestAudit = getLatestAudit(id);
  return website;
}

export function findWebsiteByUrl(url: string): Website | null {
  const row = getDb().prepare('SELECT * FROM websites WHERE url = ?').get(url) as Record<string, any> | undefined;
  return row ? rowToWebsite(row) : null;
}

export function findWebsiteByLeadId(leadId: string): Website | null {
  const row = getDb().prepare('SELECT * FROM websites WHERE lead_id = ? LIMIT 1').get(leadId) as
    | Record<string, any>
    | undefined;
  return row ? rowToWebsite(row) : null;
}

export function createWebsite(input: CreateWebsiteInput): Website {
  const db = getDb();
  const { url, leadId, name } = input;
  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  db.prepare(
    `INSERT INTO websites (id, lead_id, url, domain, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(id, leadId || null, url, domain, name || null);
  return getWebsite(id)!;
}

export function upsertWebsiteByUrl(input: CreateWebsiteInput): { website: Website; created: boolean } {
  const db = getDb();
  const existing = findWebsiteByUrl(input.url);
  if (existing) {
    const updateParts: string[] = [];
    const params: any[] = [];
    if (input.name && existing.name !== input.name) {
      updateParts.push('name = ?');
      params.push(input.name);
    }
    if (input.leadId && existing.leadId !== input.leadId) {
      updateParts.push('lead_id = ?');
      params.push(input.leadId);
    }
    if (updateParts.length > 0) {
      updateParts.push("updated_at = datetime('now')");
      db.prepare(`UPDATE websites SET ${updateParts.join(', ')} WHERE id = ?`).run(...params, existing.id);
    }
    return { website: getWebsite(existing.id)!, created: false };
  }
  return { website: createWebsite(input), created: true };
}

export function deleteWebsite(id: string): void {
  getDb().prepare('DELETE FROM websites WHERE id = ?').run(id);
}

export function deleteWebsitesByLeadId(leadId: string): number {
  const result = getDb().prepare('DELETE FROM websites WHERE lead_id = ?').run(leadId);
  return Number(result.changes);
}

export function clearAllWebsites(): number {
  const result = getDb().prepare('DELETE FROM websites').run();
  return Number(result.changes);
}

/**
 * Ensure websites exist for a list of lead-website mappings (idempotent).
 */
export function syncWebsites(items: Array<{ leadId?: string; url: string; name?: string }>): number {
  let created = 0;
  for (const item of items) {
    if (!item.url) continue;
    const res = upsertWebsiteByUrl({ url: item.url, leadId: item.leadId, name: item.name });
    if (res.created) created += 1;
  }
  return created;
}

// ─── audits ────────────────────────────────────────────────────────────────

const AUDIT_COLUMNS = new Set([
  'status',
  'health_score',
  'started_at',
  'completed_at',
  'duration_ms',
  'pages_found',
  'pages_crawled',
  'internal_links',
  'external_links',
  'broken_links',
  'broken_images',
  'redirects',
  'seo_issues',
  'technical_issues',
  'website_online',
  'domain_resolves',
  'https_enabled',
  'ssl_valid',
  'ssl_expiry_date',
  'http_status',
  'response_time_ms',
  'www_status',
  'error',
  'unresponsive',
  'score_availability',
  'score_technical',
  'score_links',
  'score_onpage',
  'score_performance',
  'score_security',
]);

export function createAudit(websiteId: string): WebsiteAudit {
  const db = getDb();
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO website_audits (id, website_id, status, started_at, created_at)
     VALUES (?, ?, 'pending', datetime('now'), datetime('now'))`
  ).run(id, websiteId);
  return getAudit(id)!;
}

export function getAudit(id: string): WebsiteAudit | null {
  const row = getDb().prepare('SELECT * FROM website_audits WHERE id = ?').get(id) as
    | Record<string, any>
    | undefined;
  return row ? camel<WebsiteAudit>(row) : null;
}

export function listAudits(): WebsiteAudit[] {
  const rows = getDb().prepare('SELECT * FROM website_audits ORDER BY created_at DESC').all() as Record<string, any>[];
  return rows.map((r) => camel<WebsiteAudit>(r));
}

export function listRunningAudits(): WebsiteAudit[] {
  const rows = getDb()
    .prepare(`SELECT * FROM website_audits WHERE status IN ('pending', 'running') ORDER BY created_at DESC`)
    .all() as Record<string, any>[];
  return rows.map((r) => camel<WebsiteAudit>(r));
}

export function listAuditsByWebsite(websiteId: string): WebsiteAudit[] {
  const rows = getDb()
    .prepare('SELECT * FROM website_audits WHERE website_id = ? ORDER BY created_at DESC')
    .all(websiteId) as Record<string, any>[];
  return rows.map((r) => camel<WebsiteAudit>(r));
}

export function getLatestAudit(websiteId: string): WebsiteAudit | null {
  const row = getDb()
    .prepare('SELECT * FROM website_audits WHERE website_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(websiteId) as Record<string, any> | undefined;
  return row ? camel<WebsiteAudit>(row) : null;
}

export function updateAudit(id: string, updates: Record<string, any>): void {
  const entries = Object.entries(updates).filter(([key]) => AUDIT_COLUMNS.has(key));
  if (entries.length === 0) return;
  const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  getDb().prepare(`UPDATE website_audits SET ${setClause} WHERE id = ?`).run(...values, id);
}

export function deleteAudit(id: string): void {
  getDb().prepare('DELETE FROM website_audits WHERE id = ?').run(id);
}

export function clearAllAudits(): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM website_audits').run();
  return Number(result.changes);
}

/** Mark audits stuck in pending/running (e.g. after a server restart) as failed. */
export function sweepOrphanedAudits(maxAgeMinutes = 60): number {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE website_audits SET status = 'failed', error = 'Interrupted — server restarted',
              completed_at = datetime('now')
       WHERE status IN ('pending', 'running')
         AND COALESCE(started_at, created_at) < datetime('now', ?)`
    )
    .run(`-${maxAgeMinutes} minutes`);
  return Number(result.changes);
}

// ─── Datacenter (deleted-lead archive) ─────────────────────────────────────

export interface ArchivedLeadRow {
  id: number;
  leadId: string;
  data: string;
  deletedAt: string;
  deletedBy?: string;
}

export function archiveLead(leadId: string, data: string, deletedBy?: string): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO deleted_leads (lead_id, data, deleted_at, deleted_by)
       VALUES (?, ?, datetime('now'), ?)`
    )
    .run(leadId, data, deletedBy || null);
}

export function listArchivedLeads(): ArchivedLeadRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM deleted_leads ORDER BY deleted_at DESC, id DESC')
    .all() as Record<string, any>[];
  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    data: r.data,
    deletedAt: r.deleted_at,
    deletedBy: r.deleted_by,
  }));
}

export function getArchivedLead(leadId: string): ArchivedLeadRow | null {
  const row = getDb().prepare('SELECT * FROM deleted_leads WHERE lead_id = ?').get(leadId) as
    | Record<string, any>
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    data: row.data,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
  };
}

export function deleteArchivedLead(leadId: string): void {
  getDb().prepare('DELETE FROM deleted_leads WHERE lead_id = ?').run(leadId);
}

export function clearArchivedLeads(): number {
  const result = getDb().prepare('DELETE FROM deleted_leads').run();
  return Number(result.changes);
}

// ─── audit pages ───────────────────────────────────────────────────────────

export interface PageInsert {
  url: string;
  statusCode?: number | null;
  title?: string | null;
  titleLength?: number | null;
  metaDescription?: string | null;
  metaDescLength?: number | null;
  h1Count?: number | null;
  h1Text?: string | null;
  h2Count?: number | null;
  canonicalUrl?: string | null;
  robotsMeta?: string | null;
  wordCount?: number | null;
  score?: number | null;
  loadTimeMs?: number | null;
  contentHash?: string | null;
  internalLinks?: number;
  externalLinks?: number;
  brokenLinks?: number;
  imagesMissingAlt?: number;
}

export function insertPages(auditId: string, pages: PageInsert[]): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO audit_pages (
      id, audit_id, url, status_code, title, title_length, meta_description, meta_desc_length,
      h1_count, h1_text, h2_count, canonical_url, robots_meta, word_count, score, load_time_ms,
      content_hash, internal_links, external_links, broken_links, images_missing_alt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const insertMany = (items: PageInsert[]) => {
    db.exec('BEGIN');
    try {
      for (const p of items) {
        stmt.run(
          `page-${auditId}-${Math.random().toString(36).slice(2, 10)}`,
          auditId,
          p.url,
          p.statusCode ?? null,
          p.title ?? null,
          p.titleLength ?? null,
          p.metaDescription ?? null,
          p.metaDescLength ?? null,
          p.h1Count ?? null,
          p.h1Text ?? null,
          p.h2Count ?? null,
          p.canonicalUrl ?? null,
          p.robotsMeta ?? null,
          p.wordCount ?? null,
          p.score ?? null,
          p.loadTimeMs ?? null,
          p.contentHash ?? null,
          p.internalLinks ?? 0,
          p.externalLinks ?? 0,
          p.brokenLinks ?? 0,
          p.imagesMissingAlt ?? 0
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  insertMany(pages);
  return pages.length;
}

export function listPages(auditId: string): AuditPage[] {
  const rows = getDb()
    .prepare('SELECT * FROM audit_pages WHERE audit_id = ? ORDER BY score ASC')
    .all(auditId) as Record<string, any>[];
  return rows.map((r) => camel<AuditPage>(r));
}

export function getPage(id: string): AuditPage | null {
  const row = getDb().prepare('SELECT * FROM audit_pages WHERE id = ?').get(id) as Record<string, any> | undefined;
  return row ? camel<AuditPage>(row) : null;
}

export function deletePagesForAudit(auditId: string): void {
  getDb().prepare('DELETE FROM audit_pages WHERE audit_id = ?').run(auditId);
}

// ─── audit issues ──────────────────────────────────────────────────────────

export interface IssueInsert {
  pageId?: string;
  category: string;
  severity: string;
  type: string;
  title: string;
  description?: string;
  sourceUrl?: string;
  targetUrl?: string;
  httpStatus?: number;
  recommendation?: string;
}

export function insertIssues(auditId: string, issues: IssueInsert[]): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO audit_issues (
      id, audit_id, page_id, category, severity, type, title, description,
      source_url, target_url, http_status, recommendation, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const insertMany = (items: IssueInsert[]) => {
    db.exec('BEGIN');
    try {
      for (const issue of items) {
        stmt.run(
          `iss-${auditId}-${Math.random().toString(36).slice(2, 10)}`,
          auditId,
          issue.pageId ?? null,
          issue.category,
          issue.severity,
          issue.type,
          issue.title,
          issue.description ?? null,
          issue.sourceUrl ?? null,
          issue.targetUrl ?? null,
          issue.httpStatus ?? null,
          issue.recommendation ?? null
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  insertMany(issues);
  return issues.length;
}

export interface IssueFilter {
  severity?: AuditSeverity | 'all';
  category?: string | 'all';
}

export function listIssues(auditId: string, filter?: IssueFilter): AuditIssue[] {
  const clauses: string[] = ['audit_id = ?'];
  const params: any[] = [auditId];
  if (filter?.severity && filter.severity !== 'all') {
    clauses.push('severity = ?');
    params.push(filter.severity);
  }
  if (filter?.category && filter.category !== 'all') {
    clauses.push('category = ?');
    params.push(filter.category);
  }
  const rows = getDb()
    .prepare(`SELECT * FROM audit_issues WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC`)
    .all(...params) as Record<string, any>[];
  return rows.map((r) => camel<AuditIssue>(r));
}

export function countIssuesBySeverity(auditId: string): Record<AuditSeverity, number> {
  const rows = getDb()
    .prepare('SELECT severity, COUNT(*) AS n FROM audit_issues WHERE audit_id = ? GROUP BY severity')
    .all(auditId) as Record<string, any>[];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.severity] = r.n;
  return {
    critical: counts.critical || 0,
    high: counts.high || 0,
    medium: counts.medium || 0,
    low: counts.low || 0,
    notice: counts.notice || 0,
  };
}

export function deleteIssuesForAudit(auditId: string): void {
  getDb().prepare('DELETE FROM audit_issues WHERE audit_id = ?').run(auditId);
}

// ─── broken links ──────────────────────────────────────────────────────────

export interface BrokenLinkInsert {
  sourcePageUrl: string;
  sourcePageTitle?: string;
  linkUrl: string;
  linkText?: string;
  linkType: string;
  httpStatus?: number | null;
  errorType: string;
}

export function insertBrokenLinks(auditId: string, links: BrokenLinkInsert[]): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO broken_links (
      id, audit_id, source_page_url, source_page_title, link_url, link_text, link_type,
      http_status, error_type, is_fixed, is_ignored, found_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`
  );
  const insertMany = (items: BrokenLinkInsert[]) => {
    db.exec('BEGIN');
    try {
      for (const l of items) {
        stmt.run(
          `blk-${auditId}-${Math.random().toString(36).slice(2, 10)}`,
          auditId,
          l.sourcePageUrl,
          l.sourcePageTitle ?? null,
          l.linkUrl,
          l.linkText ?? null,
          l.linkType,
          l.httpStatus ?? null,
          l.errorType
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  insertMany(links);
  return links.length;
}

export function listBrokenLinks(auditId: string, filter?: 'open' | 'fixed' | 'ignored' | 'all'): BrokenLink[] {
  let sql = 'SELECT * FROM broken_links WHERE audit_id = ?';
  const params: any[] = [auditId];
  if (filter && filter !== 'all') {
    if (filter === 'fixed') {
      sql += ' AND is_fixed = 1';
    } else if (filter === 'ignored') {
      sql += ' AND is_ignored = 1';
    } else {
      sql += ' AND is_fixed = 0 AND is_ignored = 0';
    }
  }
  sql += ' ORDER BY http_status IS NULL DESC, http_status DESC';
  const rows = getDb().prepare(sql).all(...params) as Record<string, any>[];
  return rows.map((r) => camel<BrokenLink>(r));
}

export function markBrokenLinkFixed(id: string): void {
  getDb()
    .prepare('UPDATE broken_links SET is_fixed = 1, is_ignored = 0, fixed_at = datetime(\'now\') WHERE id = ?')
    .run(id);
}

export function ignoreBrokenLink(id: string): void {
  getDb().prepare('UPDATE broken_links SET is_ignored = 1, is_fixed = 0 WHERE id = ?').run(id);
}

export function reopenBrokenLink(id: string): void {
  getDb().prepare('UPDATE broken_links SET is_fixed = 0, is_ignored = 0, fixed_at = NULL WHERE id = ?').run(id);
}

export function deleteBrokenLinksForAudit(auditId: string): void {
  getDb().prepare('DELETE FROM broken_links WHERE audit_id = ?').run(auditId);
}

// ─── live progress ─────────────────────────────────────────────────────────

export interface ProgressEntry {
  id: number;
  auditId: string;
  stage: string;
  message: string;
  createdAt: string;
}

export function saveProgress(auditId: string, stage: string, message: string): void {
  getDb()
    .prepare(
      `INSERT INTO audit_progress (audit_id, stage, message, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .run(auditId, stage, message);
}

export function listProgress(auditId: string, limit = 300): ProgressEntry[] {
  const rows = getDb()
    .prepare('SELECT * FROM audit_progress WHERE audit_id = ? ORDER BY id ASC LIMIT ?')
    .all(auditId, limit) as Record<string, any>[];
  return rows.map((r) => ({
    id: r.id,
    auditId: r.audit_id,
    stage: r.stage,
    message: r.message,
    createdAt: r.created_at,
  }));
}

// ─── dashboard stats ───────────────────────────────────────────────────────

export function getAuditDashboardStats(websiteIds?: string[]): WebsiteAuditDashboardStats {
  const db = getDb();
  const scopeClause = websiteIds && websiteIds.length > 0 ? ` WHERE id IN (${websiteIds.map(() => '?').join(',')})` : '';
  const scopeParams = websiteIds && websiteIds.length > 0 ? websiteIds : [];

  const totalWebsites = (db.prepare(`SELECT COUNT(*) AS n FROM websites${scopeClause}`).get(...scopeParams) as any).n;
  const totalAudits = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM website_audits
         WHERE website_id IN (SELECT id FROM websites${scopeClause})`
      )
      .get(...scopeParams) as any
  ).n;

  const latestSql = `SELECT a.* FROM website_audits a
       INNER JOIN (
         SELECT website_id, MAX(created_at) AS max_created FROM website_audits GROUP BY website_id
       ) m ON a.website_id = m.website_id AND a.created_at = m.max_created
       WHERE a.status = 'completed'
         ${websiteIds && websiteIds.length > 0 ? `AND a.website_id IN (${websiteIds.map(() => '?').join(',')})` : ''}`;
  const latest = db.prepare(latestSql).all(...(websiteIds || [])) as Record<string, any>[];

  const completed = latest.filter((a) => a.health_score != null);
  const averageHealthScore =
    completed.length > 0
      ? Math.round(completed.reduce((acc, a) => acc + a.health_score, 0) / completed.length)
      : 0;

  const totalBrokenLinks = latest.reduce((acc, a) => acc + (a.broken_links || 0), 0);
  const totalSeoIssues = latest.reduce((acc, a) => acc + (a.seo_issues || 0), 0);
  const totalTechnicalIssues = latest.reduce((acc, a) => acc + (a.technical_issues || 0), 0);
  const sitesWithIssues = latest.filter(
    (a) => (a.broken_links || 0) > 0 || (a.seo_issues || 0) > 0 || (a.technical_issues || 0) > 0
  ).length;
  const websitesOnline = latest.filter((a) => a.website_online === 1).length;
  const websitesOffline = latest.filter((a) => a.website_online === 0).length;

  return {
    totalWebsites,
    totalAudits,
    auditedWebsites: latest.length,
    averageHealthScore,
    totalBrokenLinks,
    totalSeoIssues,
    totalTechnicalIssues,
    sitesWithIssues,
    websitesOnline,
    websitesOffline,
  };
}

// ─── Users & designations (auth / RBAC) ────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  designation: string;
  active: number;
  email?: string | null;
  createdAt: string;
}

export function listUsers(): Omit<UserRow, 'passwordHash'>[] {
  const rows = getDb()
    .prepare('SELECT id, name, username, designation, active, email, created_at FROM users ORDER BY name')
    .all() as Record<string, any>[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    designation: r.designation,
    active: r.active,
    email: r.email || undefined,
    createdAt: r.created_at,
  }));
}

export function getUserByUsername(username: string): UserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as Record<string, any> | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    passwordHash: row.password_hash,
    designation: row.designation,
    active: row.active,
    email: row.email || undefined,
    createdAt: row.created_at,
  };
}

export function getUserById(id: string): Omit<UserRow, 'passwordHash'> | null {
  const row = getDb().prepare('SELECT id, name, username, designation, active, email, created_at FROM users WHERE id = ?').get(id) as
    | Record<string, any>
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    designation: row.designation,
    active: row.active,
    email: row.email || undefined,
    createdAt: row.created_at,
  };
}

export function getUserByEmail(email: string): UserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email.trim()) as Record<string, any> | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    passwordHash: row.password_hash,
    designation: row.designation,
    active: row.active,
    email: row.email || undefined,
    createdAt: row.created_at,
  };
}

export function getPasswordHashByUserId(id: string): string | null {
  const row = getDb().prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as Record<string, any> | undefined;
  return row ? row.password_hash : null;
}

export function createUser(input: { name: string; username: string; passwordHash: string; designation: string; active?: number; email?: string }): void {
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  getDb()
    .prepare(
      `INSERT INTO users (id, name, username, password_hash, designation, active, email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(id, input.name, input.username, input.passwordHash, input.designation, input.active ?? 1, input.email?.trim() || null);
}

export function updateUser(
  id: string,
  updates: { name?: string; username?: string; passwordHash?: string; designation?: string; active?: number; email?: string | null }
): void {
  const parts: string[] = [];
  const params: any[] = [];
  if (updates.name !== undefined) {
    parts.push('name = ?');
    params.push(updates.name);
  }
  if (updates.username !== undefined) {
    parts.push('username = ?');
    params.push(updates.username);
  }
  if (updates.passwordHash !== undefined) {
    parts.push('password_hash = ?');
    params.push(updates.passwordHash);
  }
  if (updates.designation !== undefined) {
    parts.push('designation = ?');
    params.push(updates.designation);
  }
  if (updates.active !== undefined) {
    parts.push('active = ?');
    params.push(updates.active);
  }
  if (updates.email !== undefined) {
    parts.push('email = ?');
    params.push(updates.email === null ? null : (updates.email as string).trim() || null);
  }
  if (parts.length === 0) return;
  getDb().prepare(`UPDATE users SET ${parts.join(', ')} WHERE id = ?`).run(...params, id);
}

export function deleteUser(id: string): void {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ─── designations / roles ──────────────────────────────────────────────────

export interface DesignationRow {
  designation: string;
  permissions: string[];
}

export function listDesignations(): DesignationRow[] {
  const rows = getDb().prepare('SELECT designation, permissions FROM designations ORDER BY designation').all() as Record<string, any>[];
  return rows.map((r) => {
    let perms: string[] = [];
    try {
      perms = JSON.parse(r.permissions);
    } catch {
      perms = [];
    }
    return { designation: r.designation, permissions: Array.isArray(perms) ? perms : [] };
  });
}

export function getDesignation(designation: string): DesignationRow | null {
  const row = getDb().prepare('SELECT designation, permissions FROM designations WHERE designation = ?').get(designation) as
    | Record<string, any>
    | undefined;
  if (!row) return null;
  let perms: string[] = [];
  try {
    perms = JSON.parse(row.permissions);
  } catch {
    perms = [];
  }
  return { designation: row.designation, permissions: Array.isArray(perms) ? perms : [] };
}

export function saveDesignation(designation: string, permissions: string[]): void {
  const filtered = permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p));
  getDb()
    .prepare(
      `INSERT INTO designations (designation, permissions) VALUES (?, ?)
       ON CONFLICT(designation) DO UPDATE SET permissions = excluded.permissions`
    )
    .run(designation, JSON.stringify(filtered));
}

export function deleteDesignation(designation: string): void {
  getDb().prepare('DELETE FROM designations WHERE designation = ?').run(designation);
}

export function seedDefaultData(): void {
  const db = getDb();
  const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as any).n;
  const roleCount = (db.prepare('SELECT COUNT(*) AS n FROM designations').get() as any).n;

  if (roleCount === 0) {
    for (const [name, perms] of Object.entries(DEFAULT_DESIGNATIONS)) {
      saveDesignation(name, perms);
    }
  }

  if (userCount === 0) {
    // Default admin: admin / admin123
    const hash = hashPassword('admin123');
    createUser({
      name: 'Administrator',
      username: 'admin',
      passwordHash: hash,
      designation: 'Admin',
      active: 1,
      email: process.env.ADMIN_EMAIL || 'blueglobtech@gmail.com',
    });
  } else {
    // Backfill email for the default admin if it was created before the column existed.
    const adminRow = db
      .prepare('SELECT id, email FROM users WHERE username = ?')
      .get('admin') as Record<string, any> | undefined;
    if (adminRow && !adminRow.email) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(
        process.env.ADMIN_EMAIL || 'blueglobtech@gmail.com',
        adminRow.id
      );
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return candidate === hash;
}

// ─── Sessions (token-based auth) ───────────────────────────────────────────

export function createSession(userId: string, token: string, ttlMs = 7 * 24 * 60 * 60 * 1000): void {
  const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const expires = new Date(Date.now() + ttlMs).toISOString();
  getDb()
    .prepare('INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, datetime(\'now\'), ?)')
    .run(id, userId, sha256(token), expires);
}

export function getUserBySessionToken(token: string): Omit<UserRow, 'passwordHash'> | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.name, u.username, u.designation, u.active, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND u.active = 1
         AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))`
    )
    .get(sha256(token)) as Record<string, any> | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    designation: row.designation,
    active: row.active,
    createdAt: row.created_at,
  };
}

export function deleteSession(token: string): void {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Active leads (server-backed, shared across the team) ──────────────────

export interface ServerLeadRow {
  id: string;
  data: string;
}

function leadKeyColumns(lead: any): { companyName: string; contactPerson: string; mobile: string; email: string; status: string; assignedTo: string } {
  return {
    companyName: lead.companyName || '',
    contactPerson: lead.contactPerson || '',
    mobile: lead.mobile || '',
    email: lead.email || '',
    status: lead.status || '',
    assignedTo: lead.assignedTo || '',
  };
}

export function listServerLeads(): any[] {
  const rows = getDb().prepare('SELECT data FROM leads ORDER BY created_at DESC').all() as Record<string, any>[];
  return rows.map((r) => {
    try {
      return JSON.parse(r.data);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function getServerLead(id: string): any | null {
  const row = getDb().prepare('SELECT data FROM leads WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export function upsertServerLead(lead: any): void {
  if (!lead || !lead.id) return;
  const keys = leadKeyColumns(lead);
  getDb()
    .prepare(
      `INSERT INTO leads (id, data, company_name, contact_person, mobile, email, status, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM leads WHERE id = ?), datetime('now')), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         data = excluded.data,
         company_name = excluded.company_name,
         contact_person = excluded.contact_person,
         mobile = excluded.mobile,
         email = excluded.email,
         status = excluded.status,
         assigned_to = excluded.assigned_to,
         updated_at = datetime('now')`
    )
    .run(
      lead.id,
      JSON.stringify(lead),
      keys.companyName,
      keys.contactPerson,
      keys.mobile,
      keys.email,
      keys.status,
      keys.assignedTo,
      lead.id
    );
}

export function bulkImportLeads(leads: any[]): number {
  if (!Array.isArray(leads) || leads.length === 0) return 0;
  const db = getDb();
  db.exec('BEGIN');
  try {
    for (const lead of leads) {
      upsertServerLead(lead);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return leads.length;
}

export function deleteServerLead(id: string): void {
  getDb().prepare('DELETE FROM leads WHERE id = ?').run(id);
}

export function clearServerLeads(): number {
  const result = getDb().prepare('DELETE FROM leads').run();
  return Number(result.changes);
}

export function serverLeadCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM leads').get() as any).n;
}

/** Ids of the leads assigned to a given user (by display name). */
export function leadIdsAssignedTo(userName: string): string[] {
  const rows = getDb().prepare('SELECT id FROM leads WHERE assigned_to = ?').all(userName) as Record<string, any>[];
  return rows.map((r) => r.id);
}

/**
 * One-time migration: 'Follow-up' was removed as a lead status in favor of the
 * New → Contacted → Connected → … funnel. Existing 'Follow-up' leads move to
 * 'Contacted' (both the mirrored status column and the lead data JSON).
 */
export function migrateLegacyStatuses(): number {
  const db = getDb();
  const rows = db.prepare("SELECT id, data FROM leads WHERE status = 'Follow-up'").all() as Record<string, any>[];
  let changed = 0;
  for (const row of rows) {
    try {
      const data = JSON.parse(row.data);
      if (data.status === 'Follow-up') {
        data.status = 'Contacted';
        data.updatedAt = new Date().toISOString();
        const activities = Array.isArray(data.activities) ? data.activities : [];
        data.activities = [
          {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            leadId: data.id,
            type: 'Status Change',
            summary: 'Status updated to Contacted',
            details: 'Previous status: Follow-up (legacy status removed)',
            timestamp: new Date().toISOString(),
            author: data.assignedTo || 'System',
          },
          ...activities,
        ];
        db.prepare(
          "UPDATE leads SET data = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(JSON.stringify(data), 'Contacted', row.id);
        changed += 1;
      }
    } catch {
      /* skip malformed rows */
    }
  }
  return changed;
}

// ─── Backups ───────────────────────────────────────────────────────────────

export function backupDatabase(): string | null {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(backupsDir, `crm-${stamp}.db`).replace(/\\/g, '/');
    getDb().exec(`VACUUM INTO '${dest}'`);
    return dest;
  } catch (e) {
    console.error('Backup failed', e);
    return null;
  }
}

/** Validate that a file is a usable SQLite database with our schema. Returns an error message or null. */
export function validateSqliteFile(filePath: string): string | null {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 100 || buf.subarray(0, 15).toString('latin1') !== 'SQLite format 3') {
      return 'Not a valid SQLite database file';
    }
    const probe = new DatabaseSync(filePath, { readOnly: true });
    try {
      const integrity = probe.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      if (!integrity || integrity.integrity_check !== 'ok') {
        return 'Database integrity check failed';
      }
      const tables = new Set(
        (probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((r) => r.name)
      );
      const required = ['websites', 'leads', 'users', 'website_audits'];
      const missing = required.filter((t) => !tables.has(t));
      if (missing.length > 0) {
        return `Imported file is missing required tables: ${missing.join(', ')}`;
      }
    } finally {
      probe.close();
    }
    return null;
  } catch (e: any) {
    return `Could not read database file: ${e?.message || 'unknown error'}`;
  }
}

/** Replace the live database with the given SQLite file (safe swap with restore-on-failure). */
export function restoreDatabaseFromFile(filePath: string): void {
  const safety = backupDatabase();
  closeDb();
  try {
    const wal = `${DB_PATH}-wal`;
    const shm = `${DB_PATH}-shm`;
    if (fs.existsSync(wal)) fs.rmSync(wal, { force: true });
    if (fs.existsSync(shm)) fs.rmSync(shm, { force: true });
    fs.copyFileSync(filePath, DB_PATH);
    getDb(); // reopen (runs schema + migrations)
    seedDefaultData();
    sweepOrphanedAudits();
    seedClientsFromWonLeads();
  } catch (e) {
    closeDb();
    if (safety) {
      try {
        fs.copyFileSync(safety, DB_PATH);
        getDb();
      } catch (restoreErr) {
        console.error('Failed to restore from safety backup after import error', restoreErr);
      }
    }
    throw e;
  }
}

// ─── Clients (converted leads) ─────────────────────────────────────────────

export interface ClientRow {
  id: string;
  leadId?: string;
  companyName: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  website?: string;
  contractValue: number;
  monthlyRetainer: number;
  startDate?: string;
  endDate?: string;
  services: string[];
  accountManager?: string;
  agreementStatus: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  onboarding?: any;
  contacts?: any;
}

function rowToClient(r: Record<string, any>): ClientRow {
  let services: string[] = [];
  try {
    services = JSON.parse(r.services || '[]');
  } catch {
    services = [];
  }
  let onboarding: any;
  try {
    onboarding = r.onboarding_data ? JSON.parse(r.onboarding_data) : undefined;
  } catch {
    onboarding = undefined;
  }
  let contacts: any;
  try {
    contacts = r.contacts_data ? JSON.parse(r.contacts_data) : undefined;
  } catch {
    contacts = undefined;
  }
  return {
    id: r.id,
    leadId: r.lead_id || undefined,
    companyName: r.company_name,
    contactPerson: r.contact_person || undefined,
    mobile: r.mobile || undefined,
    email: r.email || undefined,
    website: r.website || undefined,
    contractValue: r.contract_value || 0,
    monthlyRetainer: r.monthly_retainer || 0,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    services: Array.isArray(services) ? services : [],
    accountManager: r.account_manager || undefined,
    agreementStatus: r.agreement_status || 'Active',
    notes: r.notes || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    onboarding,
    contacts,
  };
}

export function listClients(): ClientRow[] {
  const rows = getDb().prepare('SELECT * FROM clients ORDER BY created_at DESC').all() as Record<string, any>[];
  return rows.map(rowToClient);
}

export function getClient(id: string): ClientRow | null {
  const row = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id) as Record<string, any> | undefined;
  return row ? rowToClient(row) : null;
}

export function getClientByLeadId(leadId: string): ClientRow | null {
  const row = getDb().prepare('SELECT * FROM clients WHERE lead_id = ?').get(leadId) as Record<string, any> | undefined;
  return row ? rowToClient(row) : null;
}

export function upsertClient(client: ClientRow): void {
  getDb()
    .prepare(
      `INSERT INTO clients (
        id, lead_id, company_name, contact_person, mobile, email, website,
        contract_value, monthly_retainer, start_date, end_date, services,
        account_manager, agreement_status, notes, onboarding_data, contacts_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM clients WHERE id = ?), datetime('now')), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        lead_id = excluded.lead_id,
        company_name = excluded.company_name,
        contact_person = excluded.contact_person,
        mobile = excluded.mobile,
        email = excluded.email,
        website = excluded.website,
        contract_value = excluded.contract_value,
        monthly_retainer = excluded.monthly_retainer,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        services = excluded.services,
        account_manager = excluded.account_manager,
        agreement_status = excluded.agreement_status,
        notes = excluded.notes,
        onboarding_data = excluded.onboarding_data,
        contacts_data = excluded.contacts_data,
        updated_at = datetime('now')`
    )
    .run(
      client.id,
      client.leadId || null,
      client.companyName,
      client.contactPerson || null,
      client.mobile || null,
      client.email || null,
      client.website || null,
      client.contractValue || 0,
      client.monthlyRetainer || 0,
      client.startDate || null,
      client.endDate || null,
      JSON.stringify(client.services || []),
      client.accountManager || null,
      client.agreementStatus || 'Active',
      client.notes || null,
      client.onboarding ? JSON.stringify(client.onboarding) : null,
      client.contacts ? JSON.stringify(client.contacts) : null,
      client.id
    );
}

export function deleteClient(id: string): void {
  getDb().prepare('DELETE FROM clients WHERE id = ?').run(id);
}

// ─── Client subscriptions ──────────────────────────────────────────────────

export interface ClientSubscriptionRow {
  id: string;
  clientId: string;
  service: string;
  billingType: string;
  amount: number;
  startDate?: string;
  endDate?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  monthlyLogs?: SubscriptionMonthlyLogRow[];
}

export interface SubscriptionMonthlyLogRow {
  id: string;
  subscriptionId: string;
  month: string;
  posts: number;
  reels: number;
  total: number;
  recordedBy?: string;
  recordedAt?: string;
  fields?: Record<string, any>;
}

function rowToSubscription(r: Record<string, any>): ClientSubscriptionRow {
  return {
    id: r.id,
    clientId: r.client_id,
    service: r.service,
    billingType: r.billing_type,
    amount: r.amount || 0,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    status: r.status || 'Active',
    notes: r.notes || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    monthlyLogs: listMonthlyLogsForSubscription(r.id),
  };
}

export function listSubscriptionsForClient(clientId: string): ClientSubscriptionRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM client_subscriptions WHERE client_id = ? ORDER BY status, start_date DESC')
    .all(clientId) as Record<string, any>[];
  return rows.map(rowToSubscription);
}

export function listAllSubscriptions(): ClientSubscriptionRow[] {
  const rows = getDb().prepare('SELECT * FROM client_subscriptions ORDER BY created_at DESC').all() as Record<string, any>[];
  return rows.map(rowToSubscription);
}

export function getSubscription(id: string): ClientSubscriptionRow | null {
  const row = getDb().prepare('SELECT * FROM client_subscriptions WHERE id = ?').get(id) as Record<string, any> | undefined;
  return row ? rowToSubscription(row) : null;
}

export function upsertSubscription(sub: Partial<ClientSubscriptionRow> & { id: string; clientId: string }): void {
  getDb()
    .prepare(
      `INSERT INTO client_subscriptions (
        id, client_id, service, billing_type, amount, start_date, end_date, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM client_subscriptions WHERE id = ?), datetime('now')), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        service = excluded.service,
        billing_type = excluded.billing_type,
        amount = excluded.amount,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = datetime('now')`
    )
    .run(
      sub.id,
      sub.clientId,
      sub.service || 'Service',
      sub.billingType || 'Monthly',
      sub.amount || 0,
      sub.startDate || null,
      sub.endDate || null,
      sub.status || 'Active',
      sub.notes || null,
      sub.id
    );
}

export function deleteSubscription(id: string): void {
  getDb().prepare('DELETE FROM client_subscriptions WHERE id = ?').run(id);
}

// ─── Subscription monthly logs (posts + reels per month) ───────────────────

function rowToMonthlyLog(r: Record<string, any>): SubscriptionMonthlyLogRow {
  let data: Record<string, any> | undefined;
  try {
    data = r.data ? JSON.parse(r.data) : undefined;
  } catch {
    data = undefined;
  }
  return {
    id: r.id,
    subscriptionId: r.subscription_id,
    month: r.month || data?.month || '',
    posts: r.posts || Number(data?.posts) || 0,
    reels: r.reels || Number(data?.reels) || 0,
    total: r.total || 0,
    recordedBy: r.recorded_by || undefined,
    recordedAt: r.recorded_at,
    fields: data,
  };
}

export function listMonthlyLogsForSubscription(subscriptionId: string): SubscriptionMonthlyLogRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM subscription_monthly_logs WHERE subscription_id = ? ORDER BY month DESC')
    .all(subscriptionId) as Record<string, any>[];
  return rows.map(rowToMonthlyLog);
}

export function getMonthlyLog(id: string): SubscriptionMonthlyLogRow | null {
  const row = getDb().prepare('SELECT * FROM subscription_monthly_logs WHERE id = ?').get(id) as Record<string, any> | undefined;
  return row ? rowToMonthlyLog(row) : null;
}

export function upsertMonthlyLog(log: {
  id: string;
  subscriptionId: string;
  month?: string;
  posts?: number;
  reels?: number;
  total?: number;
  fields?: Record<string, any>;
  recordedBy?: string;
}): void {
  const month = log.month || log.fields?.month || '';
  const posts = log.posts ?? (Number(log.fields?.posts) || 0);
  const reels = log.reels ?? (Number(log.fields?.reels) || 0);
  const total = log.total ?? (Number(log.fields?.total) || posts + reels);
  getDb()
    .prepare(
      `INSERT INTO subscription_monthly_logs (id, subscription_id, month, posts, reels, total, data, recorded_by, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         month = excluded.month,
         posts = excluded.posts,
         reels = excluded.reels,
         total = excluded.total,
         data = excluded.data,
         recorded_by = excluded.recorded_by,
         recorded_at = datetime('now')`
    )
    .run(log.id, log.subscriptionId, month, posts, reels, total, log.fields ? JSON.stringify(log.fields) : null, log.recordedBy || null);
}

export function deleteMonthlyLog(id: string): void {
  getDb().prepare('DELETE FROM subscription_monthly_logs WHERE id = ?').run(id);
}

/** One-time migration: create subscription rows from existing client retainer/contract data. */
export function seedClientSubscriptions(): number {
  const clients = listClients();
  let created = 0;
  for (const client of clients) {
    const existing = listSubscriptionsForClient(client.id);
    if (existing.length > 0) continue;
    if (client.monthlyRetainer > 0) {
      upsertSubscription({
        id: `sub-${client.id}-retainer`,
        clientId: client.id,
        service: 'Monthly Retainer',
        billingType: 'Retainer',
        amount: client.monthlyRetainer,
        startDate: client.startDate,
        endDate: client.endDate,
        status: 'Active',
      });
      created += 1;
    } else if (client.contractValue > 0) {
      upsertSubscription({
        id: `sub-${client.id}-contract`,
        clientId: client.id,
        service: 'Project / One-Time',
        billingType: 'One-Time',
        amount: client.contractValue,
        startDate: client.startDate,
        endDate: client.endDate,
        status: 'Active',
      });
      created += 1;
    }
  }
  return created;
}

export function clientCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM clients').get() as any).n;
}

/** One-time migration: create basic client records for Won leads that lack one. */
export function seedClientsFromWonLeads(): number {
  const leads = listServerLeads();
  let created = 0;
  for (const lead of leads) {
    if (lead.status !== 'Won') continue;
    if (getClientByLeadId(lead.id)) continue;
    upsertClient({
      id: `client-${lead.id}`,
      leadId: lead.id,
      companyName: lead.companyName || 'Unknown',
      contactPerson: lead.contactPerson,
      mobile: lead.mobile,
      email: lead.email,
      website: lead.website,
      contractValue: lead.expectedValue || 0,
      monthlyRetainer: 0,
      startDate: lead.updatedAt ? lead.updatedAt.slice(0, 10) : undefined,
      services: Array.isArray(lead.interestedServices) ? lead.interestedServices : [],
      accountManager: lead.assignedTo,
      agreementStatus: 'Active',
    });
    created += 1;
  }
  return created;
}
