"""SQLite access helpers shared with the Node backend."""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "crm.db")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    conn.execute("PRAGMA journal_size_limit = 1048576")
    conn.execute("PRAGMA wal_autocheckpoint = 200")
    return conn


def checkpoint():
    """Flush WAL pages back into the main DB so subsequent reads stay fast.

    Big audit writes bloat the WAL file; without an explicit checkpoint the
    first Node read afterwards stalls for seconds doing a synchronous merge.
    """
    try:
        conn = connect()
        try:
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        finally:
            conn.close()
    except Exception:
        pass


def get_website_for_audit(audit_id: str):
    conn = connect()
    try:
        row = conn.execute(
            "SELECT w.url, w.domain, w.id AS website_id FROM website_audits a JOIN websites w ON w.id = a.website_id WHERE a.id = ?",
            (audit_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def mark_running(audit_id: str):
    conn = connect()
    try:
        conn.execute(
            "UPDATE website_audits SET status = 'running', started_at = datetime('now'), error = NULL WHERE id = ?",
            (audit_id,),
        )
        conn.commit()
    finally:
        conn.close()


def mark_failed(audit_id: str, message: str):
    conn = connect()
    try:
        conn.execute(
            "UPDATE website_audits SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?",
            (message[:2000], audit_id),
        )
        conn.commit()
    finally:
        conn.close()


def save_progress(audit_id: str, stage: str, message: str):
    """Append a live progress checkpoint for an in-progress audit."""
    try:
        conn = connect()
        try:
            conn.execute(
                "INSERT INTO audit_progress (audit_id, stage, message, created_at) VALUES (?, ?, ?, datetime('now'))",
                (audit_id, stage, message),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        # Progress logging must never break the audit itself.
        pass


def save_results(audit_id, audit_fields, pages, issues, broken_links):
    """Write all audit results in a single transaction."""
    conn = connect()
    try:
        # update audit summary
        cols = [
            "status",
            "completed_at",
            "duration_ms",
            "pages_found",
            "pages_crawled",
            "internal_links",
            "external_links",
            "broken_links",
            "broken_images",
            "redirects",
            "seo_issues",
            "technical_issues",
            "website_online",
            "domain_resolves",
            "https_enabled",
            "ssl_valid",
            "ssl_expiry_date",
            "http_status",
            "response_time_ms",
            "www_status",
            "error",
            "unresponsive",
            "health_score",
            "score_availability",
            "score_technical",
            "score_links",
            "score_onpage",
            "score_performance",
            "score_security",
        ]
        set_clause = ", ".join(f"{c} = ?" for c in cols)
        values = [audit_fields.get(c) for c in cols]
        values.append(audit_id)
        conn.execute(f"UPDATE website_audits SET {set_clause} WHERE id = ?", values)

        page_ids = {}

        # pages
        for i, p in enumerate(pages):
            conn.execute(
                """INSERT INTO audit_pages (
                    id, audit_id, url, status_code, title, title_length, meta_description,
                    meta_desc_length, h1_count, h1_text, h2_count, canonical_url, robots_meta,
                    word_count, score, load_time_ms, content_hash, internal_links, external_links,
                    broken_links, images_missing_alt, created_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))""",
                (
                    f"page-{audit_id}-{i}",
                    audit_id,
                    p["url"],
                    p.get("status_code"),
                    p.get("title"),
                    p.get("title_length"),
                    p.get("meta_description"),
                    p.get("meta_desc_length"),
                    p.get("h1_count"),
                    p.get("h1_text"),
                    p.get("h2_count"),
                    p.get("canonical_url"),
                    p.get("robots_meta"),
                    p.get("word_count"),
                    p.get("score"),
                    p.get("load_time_ms"),
                    p.get("content_hash"),
                    p.get("internal_links", 0),
                    p.get("external_links", 0),
                    p.get("broken_links", 0),
                    p.get("images_missing_alt", 0),
                ),
            )
            page_ids[pages[i]["url"]] = f"page-{audit_id}-{i}"

        # issues
        for j, issue in enumerate(issues):
            page_id = issue.get("page_id")
            if not page_id and issue.get("page_url"):
                page_id = page_ids.get(issue["page_url"])
            conn.execute(
                """INSERT INTO audit_issues (
                    id, audit_id, page_id, category, severity, type, title, description,
                    source_url, target_url, http_status, recommendation, created_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))""",
                (
                    f"iss-{audit_id}-{j}",
                    audit_id,
                    issue.get("page_id"),
                    issue["category"],
                    issue["severity"],
                    issue["type"],
                    issue["title"],
                    issue.get("description"),
                    issue.get("source_url"),
                    issue.get("target_url"),
                    issue.get("http_status"),
                    issue.get("recommendation"),
                ),
            )

        # broken links
        for k, bl in enumerate(broken_links):
            conn.execute(
                """INSERT INTO broken_links (
                    id, audit_id, source_page_url, source_page_title, link_url, link_text,
                    link_type, http_status, error_type, is_fixed, is_ignored, found_at
                ) VALUES (?,?,?,?,?,?,?,?,?,0,0, datetime('now'))""",
                (
                    f"blk-{audit_id}-{k}",
                    audit_id,
                    bl["source_page_url"],
                    bl.get("source_page_title"),
                    bl["link_url"],
                    bl.get("link_text"),
                    bl["link_type"],
                    bl.get("http_status"),
                    bl["error_type"],
                ),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
