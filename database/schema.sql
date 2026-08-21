-- BGT CRM Website Audit Engine - SQLite Schema

CREATE TABLE IF NOT EXISTS websites (
  id         TEXT PRIMARY KEY,
  lead_id    TEXT,
  url        TEXT NOT NULL UNIQUE,
  domain     TEXT NOT NULL,
  name       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS website_audits (
  id              TEXT PRIMARY KEY,
  website_id      TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',
  health_score    INTEGER,
  started_at      TEXT,
  completed_at    TEXT,
  duration_ms     INTEGER,
  pages_found     INTEGER DEFAULT 0,
  pages_crawled   INTEGER DEFAULT 0,
  internal_links  INTEGER DEFAULT 0,
  external_links  INTEGER DEFAULT 0,
  broken_links    INTEGER DEFAULT 0,
  broken_images   INTEGER DEFAULT 0,
  redirects       INTEGER DEFAULT 0,
  seo_issues      INTEGER DEFAULT 0,
  technical_issues INTEGER DEFAULT 0,
  website_online  INTEGER,
  domain_resolves INTEGER,
  https_enabled   INTEGER,
  ssl_valid       INTEGER,
  ssl_expiry_date TEXT,
  http_status     INTEGER,
  response_time_ms INTEGER,
  www_status      TEXT,
  error           TEXT,
  unresponsive    INTEGER DEFAULT 0,
  score_availability INTEGER DEFAULT 0,
  score_technical    INTEGER DEFAULT 0,
  score_links        INTEGER DEFAULT 0,
  score_onpage       INTEGER DEFAULT 0,
  score_performance  INTEGER DEFAULT 0,
  score_security     INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_pages (
  id                 TEXT PRIMARY KEY,
  audit_id           TEXT NOT NULL REFERENCES website_audits(id) ON DELETE CASCADE,
  url                TEXT NOT NULL,
  status_code        INTEGER,
  title              TEXT,
  title_length       INTEGER,
  meta_description   TEXT,
  meta_desc_length   INTEGER,
  h1_count           INTEGER,
  h1_text            TEXT,
  h2_count           INTEGER,
  canonical_url      TEXT,
  robots_meta        TEXT,
  word_count         INTEGER,
  score              INTEGER,
  load_time_ms       INTEGER,
  content_hash       TEXT,
  internal_links     INTEGER DEFAULT 0,
  external_links     INTEGER DEFAULT 0,
  broken_links       INTEGER DEFAULT 0,
  images_missing_alt INTEGER DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_issues (
  id              TEXT PRIMARY KEY,
  audit_id        TEXT NOT NULL REFERENCES website_audits(id) ON DELETE CASCADE,
  page_id         TEXT REFERENCES audit_pages(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  severity        TEXT NOT NULL,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  source_url      TEXT,
  target_url      TEXT,
  http_status     INTEGER,
  recommendation  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS broken_links (
  id                TEXT PRIMARY KEY,
  audit_id          TEXT NOT NULL REFERENCES website_audits(id) ON DELETE CASCADE,
  source_page_url   TEXT NOT NULL,
  source_page_title TEXT,
  link_url          TEXT NOT NULL,
  link_text         TEXT,
  link_type         TEXT,
  http_status       INTEGER,
  error_type        TEXT,
  is_fixed          INTEGER DEFAULT 0,
  is_ignored        INTEGER DEFAULT 0,
  found_at          TEXT NOT NULL DEFAULT (datetime('now')),
  fixed_at          TEXT
);

CREATE TABLE IF NOT EXISTS audit_progress (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id   TEXT NOT NULL REFERENCES website_audits(id) ON DELETE CASCADE,
  stage      TEXT,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deleted_leads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    TEXT UNIQUE NOT NULL,
  data       TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_deleted_leads_deleted_at ON deleted_leads(deleted_at);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  designation   TEXT NOT NULL,
  active        INTEGER DEFAULT 1,
  email         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS designations (
  designation TEXT PRIMARY KEY,
  permissions TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id             TEXT PRIMARY KEY,
  data           TEXT NOT NULL,
  company_name   TEXT,
  contact_person TEXT,
  mobile         TEXT,
  email          TEXT,
  status         TEXT,
  assigned_to    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads(updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

CREATE TABLE IF NOT EXISTS clients (
  id               TEXT PRIMARY KEY,
  lead_id          TEXT UNIQUE,
  company_name     TEXT NOT NULL,
  contact_person   TEXT,
  mobile           TEXT,
  email            TEXT,
  website          TEXT,
  contract_value   REAL DEFAULT 0,
  monthly_retainer REAL DEFAULT 0,
  start_date       TEXT,
  end_date         TEXT,
  services         TEXT,
  account_manager  TEXT,
  agreement_status TEXT DEFAULT 'Active',
  notes            TEXT,
  onboarding_data  TEXT,
  contacts_data    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clients_lead ON clients(lead_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(agreement_status);

CREATE TABLE IF NOT EXISTS client_subscriptions (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service      TEXT NOT NULL,
  billing_type TEXT NOT NULL DEFAULT 'Monthly',
  amount       REAL DEFAULT 0,
  start_date   TEXT,
  end_date     TEXT,
  status       TEXT DEFAULT 'Active',
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON client_subscriptions(status);

CREATE TABLE IF NOT EXISTS subscription_monthly_logs (
  id              TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES client_subscriptions(id) ON DELETE CASCADE,
  month           TEXT,
  posts           INTEGER DEFAULT 0,
  reels           INTEGER DEFAULT 0,
  total           INTEGER DEFAULT 0,
  data            TEXT,
  recorded_by     TEXT,
  recorded_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_monthly_logs_sub ON subscription_monthly_logs(subscription_id);

CREATE INDEX IF NOT EXISTS idx_websites_lead ON websites(lead_id);
CREATE INDEX IF NOT EXISTS idx_audits_website ON website_audits(website_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON website_audits(status);
CREATE INDEX IF NOT EXISTS idx_pages_audit ON audit_pages(audit_id);
CREATE INDEX IF NOT EXISTS idx_issues_audit ON audit_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON audit_issues(severity);
CREATE INDEX IF NOT EXISTS idx_broken_links_audit ON broken_links(audit_id);
CREATE INDEX IF NOT EXISTS idx_progress_audit ON audit_progress(audit_id);
