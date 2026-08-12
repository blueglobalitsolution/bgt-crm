import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_LEADS } from '../src/data/initialLeads';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = path.join(__dirname, 'crm.db');
export const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 3000');
    db.exec('PRAGMA journal_size_limit = 1048576');
    db.exec('PRAGMA wal_autocheckpoint = 200');
    if (fs.existsSync(SCHEMA_PATH)) {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      db.exec(schema);
    }
    runMigrations(db);
  }
  return db;
}

function tableColumns(table: string): Set<string> {
  const rows = getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

/** Idempotent migrations for databases created before columns were added. */
function runMigrations(database: DatabaseSync): void {
  const auditCols = tableColumns('website_audits');
  const additions: Record<string, string> = {
    unresponsive: 'INTEGER DEFAULT 0',
    score_availability: 'INTEGER DEFAULT 0',
    score_technical: 'INTEGER DEFAULT 0',
    score_links: 'INTEGER DEFAULT 0',
    score_onpage: 'INTEGER DEFAULT 0',
    score_performance: 'INTEGER DEFAULT 0',
    score_security: 'INTEGER DEFAULT 0',
  };
  for (const [name, ddl] of Object.entries(additions)) {
    if (!auditCols.has(name)) {
      database.exec(`ALTER TABLE website_audits ADD COLUMN ${name} ${ddl}`);
    }
  }
}

export function normalizeUrl(input: string): string {
  let url = (input || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

export function extractDomain(input: string): string {
  try {
    const hostname = new URL(normalizeUrl(input)).hostname;
    return hostname.toLowerCase().startsWith('www.') ? hostname.slice(4) : hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Seed websites from the sample leads, but ONLY when the websites table is empty.
 * This keeps deleted/archived sample websites from coming back on server restarts.
 * Returns the number of websites newly created.
 */
export function seedWebsitesFromLeads(): number {
  const database = getDb();
  const existingCount = (database.prepare('SELECT COUNT(*) AS n FROM websites').get() as any).n;
  if (existingCount > 0) {
    return 0;
  }

  const insert = database.prepare(
    `INSERT OR IGNORE INTO websites (id, lead_id, url, domain, name, created_at, updated_at)
     VALUES ($id, $leadId, $url, $domain, $name, datetime('now'), datetime('now'))`
  );

  let count = 0;
  for (const lead of INITIAL_LEADS) {
    if (!lead.website) continue;
    const url = normalizeUrl(lead.website);
    const domain = extractDomain(url);
    if (!domain) continue;

    const result = insert.run({
      $id: `web-${lead.id}`,
      $leadId: lead.id,
      $url: url,
      $domain: domain,
      $name: lead.companyName,
    });
    if (result.changes > 0) count += 1;
  }
  return count;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
