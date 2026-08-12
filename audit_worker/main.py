"""Website Audit Worker entry point.

Usage:
    python audit-worker/main.py <audit_id> [max_pages] [render_js(0|1)]

Reads the website from SQLite, crawls it, analyzes, scores, and writes all
results back to the shared SQLite database.
"""
import sys
import time
import traceback
from datetime import datetime, timezone

from . import crawler
from . import db
from . import fetch
from . import scoring
from . import urlutil


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def build_availability_issues(availability, timeout_seconds: float = 60.0):
    issues = []
    online = availability.get("website_online")
    status = availability.get("http_status")
    if not online:
        if availability.get("unresponsive"):
            issues.append(
                {
                    "category": "availability",
                    "severity": "high",
                    "type": "site_unresponsive",
                    "title": "Site did not respond in time",
                    "description": (
                        f"The server accepted the connection but did not return a page within "
                        f"{timeout_seconds:g} seconds. The website is likely very slow or overloaded "
                        "(not necessarily down)."
                    ),
                    "target_url": availability.get("final_url"),
                    "recommendation": "Check server load, hosting performance and enable caching. Consider a faster host.",
                }
            )
        else:
            issues.append(
                {
                    "category": "availability",
                    "severity": "critical",
                    "type": "site_offline",
                    "title": "Website is offline or not responding",
                    "description": f"Homepage returned HTTP status {status or 'error'}. The site could not be loaded.",
                    "target_url": availability.get("final_url"),
                    "recommendation": "Check DNS, hosting/server status and web server configuration.",
                }
            )
        return issues
    if status and status >= 500:
        issues.append(
            {
                "category": "availability",
                "severity": "critical",
                "type": "server_error_homepage",
                "title": f"Homepage returns HTTP {status}",
                "description": "The server responded with a 5xx error on the homepage.",
                "recommendation": "Review server logs and hosting health.",
            }
        )
    rt = availability.get("response_time_ms")
    if rt and rt > 3000:
        issues.append(
            {
                "category": "performance",
                "severity": "medium",
                "type": "slow_response",
                "title": "Slow server response time",
                "description": f"Homepage responded in {rt / 1000:.2f} seconds.",
                "recommendation": "Enable caching, upgrade hosting, and optimize server configuration.",
            }
        )
    return issues


def build_security_issues(availability):
    issues = []
    if availability.get("https_enabled") == 0:
        issues.append(
            {
                "category": "security",
                "severity": "high",
                "type": "no_https",
                "title": "HTTPS not available",
                "description": "The site does not serve HTTPS content.",
                "recommendation": "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
            }
        )
    elif availability.get("ssl_valid") == 0:
        issues.append(
            {
                "category": "security",
                "severity": "critical",
                "type": "invalid_ssl",
                "title": "SSL certificate invalid or expired",
                "description": "The SSL certificate could not be validated on port 443.",
                "recommendation": "Renew / re-issue the SSL certificate.",
            }
        )
    return issues


def build_broken_link_issues(broken_entries):
    issues = []
    by_target = {}
    for entry in broken_entries:
        by_target.setdefault(entry["link_url"], []).append(entry)
    for target, entries in by_target.items():
        first = entries[0]
        is_image = first["link_type"] in ("image",)
        issues.append(
            {
                "category": "broken_image" if is_image else "broken_link",
                "severity": "medium" if is_image else "high",
                "type": f"broken_{first['link_type']}",
                "title": f"Broken {first['link_type']}: {target}",
                "description": f"{first.get('error_type', 'error')} · found on {len(entries)} page(s)",
                "source_url": entries[0]["source_page_url"],
                "target_url": target,
                "http_status": first.get("http_status"),
                "recommendation": "Fix or remove the link, or update the destination URL.",
            }
        )
    return issues


def build_page_seo_issues(page):
    issues = []
    url = page["url"]
    status = page.get("status_code")
    if status and not (200 <= status < 300):
        return issues  # broken pages are reported elsewhere

    if not page.get("title"):
        issues.append(
            {
                "category": "seo",
                "severity": "high",
                "type": "missing_title",
                "title": "Missing <title> tag",
                "description": "This page has no title tag.",
                "source_url": url,
                "target_url": url,
                "recommendation": "Add a unique, keyword-rich title under 65 characters.",
            }
        )
    else:
        tl = page.get("title_length") or 0
        if tl > 65:
            issues.append(
                {
                    "category": "seo",
                    "severity": "low",
                    "type": "long_title",
                    "title": f"Title tag too long ({tl} chars)",
                    "source_url": url,
                    "target_url": url,
                    "recommendation": "Shorten the title to under 65 characters.",
                }
            )
        elif tl < 20:
            issues.append(
                {
                    "category": "seo",
                    "severity": "low",
                    "type": "short_title",
                    "title": f"Title tag too short ({tl} chars)",
                    "source_url": url,
                    "target_url": url,
                    "recommendation": "Expand the title to 20-65 characters.",
                }
            )

    if not page.get("meta_description"):
        issues.append(
            {
                "category": "seo",
                "severity": "medium",
                "type": "missing_meta_description",
                "title": "Missing meta description",
                "source_url": url,
                "target_url": url,
                "recommendation": "Add a 50-160 character meta description.",
            }
        )
    else:
        ml = page.get("meta_desc_length") or 0
        if ml > 160:
            issues.append(
                {
                    "category": "seo",
                    "severity": "low",
                    "type": "long_meta_description",
                    "title": f"Meta description too long ({ml} chars)",
                    "source_url": url,
                    "target_url": url,
                    "recommendation": "Shorten the meta description to 160 characters.",
                }
            )
        elif ml < 50:
            issues.append(
                {
                    "category": "seo",
                    "severity": "low",
                    "type": "short_meta_description",
                    "title": f"Meta description too short ({ml} chars)",
                    "source_url": url,
                    "target_url": url,
                    "recommendation": "Expand the meta description to at least 50 characters.",
                }
            )

    h1 = page.get("h1_count") or 0
    if h1 == 0:
        issues.append(
            {
                "category": "seo",
                "severity": "medium",
                "type": "missing_h1",
                "title": "Missing H1 heading",
                "source_url": url,
                "target_url": url,
                "recommendation": "Add exactly one H1 heading describing the page topic.",
            }
        )
    elif h1 > 1:
        issues.append(
            {
                "category": "seo",
                "severity": "medium",
                "type": "multiple_h1",
                "title": f"Multiple H1 headings ({h1})",
                "source_url": url,
                "target_url": url,
                "recommendation": "Use a single H1 per page and structure the rest with H2/H3.",
            }
        )

    wc = page.get("word_count") or 0
    if wc < 150:
        issues.append(
            {
                "category": "content",
                "severity": "medium",
                "type": "thin_content",
                "title": f"Thin content ({wc} words)",
                "source_url": url,
                "target_url": url,
                "recommendation": "Expand the page with more useful, original content.",
            }
        )

    if not page.get("canonical_url"):
        issues.append(
            {
                "category": "seo",
                "severity": "low",
                "type": "missing_canonical",
                "title": "Missing canonical tag",
                "source_url": url,
                "target_url": url,
                "recommendation": "Add a self-referencing canonical URL.",
            }
        )

    missing_alt = page.get("images_missing_alt") or 0
    if missing_alt > 0:
        issues.append(
            {
                "category": "seo",
                "severity": "medium",
                "type": "missing_alt",
                "title": f"{missing_alt} image(s) missing ALT text",
                "source_url": url,
                "target_url": url,
                "recommendation": "Add descriptive ALT text to all images.",
            }
        )

    return issues


def main():
    if len(sys.argv) < 2:
        print("usage: python -m audit_worker.main <audit_id> [max_pages] [render_js] [timeout_seconds]")
        sys.exit(2)

    audit_id = sys.argv[1]
    try:
        max_pages = max(1, min(int(sys.argv[2]) if len(sys.argv) > 2 else 500, 5000))
    except ValueError:
        max_pages = 500
    render_js = (sys.argv[3] if len(sys.argv) > 3 else "0") == "1"
    try:
        timeout_seconds = max(20, min(float(sys.argv[4]) if len(sys.argv) > 4 else 60.0, 300.0))
    except ValueError:
        timeout_seconds = 60.0
    try:
        time_budget = max(60, min(float(sys.argv[5]) if len(sys.argv) > 5 else 600.0, 3600.0))
    except ValueError:
        time_budget = 600.0

    start_time = time.time()
    website = db.get_website_for_audit(audit_id)
    if not website:
        print(f"ERROR: audit {audit_id} not found")
        sys.exit(1)

    start_url = urlutil.normalize(website["url"])
    base_domain = website["domain"] or urlutil.domain_of(start_url)

    try:
        db.mark_running(audit_id)
        print(
            f"[audit] started {audit_id} for {start_url} "
            f"(max_pages={max_pages}, render_js={render_js}, timeout={timeout_seconds}s)"
        )

        def progress(stage, message):
            db.save_progress(audit_id, stage, message)
            print(f"[audit] {stage}: {message}")

        progress("start", f"Audit started for {start_url}")
        progress("availability", "Checking DNS, SSL certificate and HTTP availability…")
        availability = fetch.availability_check(start_url, render_js, timeout_seconds=timeout_seconds)
        progress(
            "availability",
            f"DNS {'OK' if availability.get('domain_resolves') else 'FAIL'} · "
            f"HTTPS {'OK' if availability.get('https_enabled') else 'OFF'} · "
            f"SSL {'OK' if availability.get('ssl_valid') else 'FAIL'} · "
            f"HTTP {availability.get('http_status')} · {availability.get('response_time_ms')}ms",
        )

        needs_js = fetch.detect_rendering(start_url, render_js)
        if needs_js:
            progress("availability", "JavaScript rendering detected — using Playwright")
            availability = fetch.availability_check(start_url, True, timeout_seconds=timeout_seconds)

        # If the site is offline, short-circuit: record availability/security
        # issues only. Crawling a dead host just burns time on timeouts.
        if not availability.get("website_online"):
            issues = build_availability_issues(availability, timeout_seconds)
            issues += build_security_issues(availability)
            seo_issues_count = sum(1 for i in issues if i["category"] in ("seo", "content"))
            technical_issues_count = sum(1 for i in issues if i["category"] == "technical")
            audit_fields = {
                "status": "completed",
                "completed_at": _now(),
                "duration_ms": int((time.time() - start_time) * 1000),
                "pages_found": 0,
                "pages_crawled": 0,
                "internal_links": 0,
                "external_links": 0,
                "broken_links": 0,
                "broken_images": 0,
                "redirects": 0,
                "seo_issues": seo_issues_count,
                "technical_issues": technical_issues_count,
                "website_online": availability.get("website_online"),
                "domain_resolves": availability.get("domain_resolves"),
                "https_enabled": availability.get("https_enabled"),
                "ssl_valid": availability.get("ssl_valid"),
                "ssl_expiry_date": availability.get("ssl_expiry_date"),
                "http_status": availability.get("http_status"),
                "response_time_ms": availability.get("response_time_ms"),
                "www_status": availability.get("www_status"),
                "unresponsive": availability.get("unresponsive", 0),
                "error": None,
                "health_score": 0,
                "score_availability": scoring.compute({
                    "availability": availability,
                    "crawl": {"pages": [], "internal_targets": [], "external_targets": [], "resource_targets": [], "unique_broken": [], "redirect_count": 0, "broken_images": 0},
                    "sitemap_present": False,
                    "robots_present": False,
                })["availability"],
                "score_technical": 0,
                "score_links": 0,
                "score_onpage": 0,
                "score_performance": 0,
                "score_security": 0,
            }
            db.save_results(audit_id, audit_fields, pages=[], issues=issues, broken_links=[])
            db.checkpoint()
            print(f"[audit] completed {audit_id} — site offline, health=0 issues={len(issues)}")
            sys.exit(0)

        origin = f"{start_url.split('/')[0]}//{urlutil.hostname(start_url)}"
        progress("config", "Fetching robots.txt and checking for XML sitemap…")
        disallow_rules, robots_present = fetch.fetch_robots(origin)
        has_sitemap = fetch.sitemap_present(origin)
        progress("config", f"robots.txt {'found' if robots_present else 'not found'} · sitemap {'found' if has_sitemap else 'not found'}")

        progress("crawl", f"Starting crawl of up to {max_pages} pages…")
        crawl_result = crawler.run_crawl(
            start_url,
            base_domain,
            max_pages,
            use_playwright=needs_js,
            disallow_patterns=disallow_rules,
            progress_cb=progress,
            time_budget=time_budget,
        )
        progress("seo", f"Analyzing on-page SEO for {len(crawl_result['pages'])} page(s)…")

        # apply page scores
        for page in crawl_result["pages"]:
            page["score"] = scoring.page_score(page)

        scoring_context = {
            "availability": availability,
            "crawl": crawl_result,
            "sitemap_present": has_sitemap,
            "robots_present": robots_present,
        }
        progress("score", "Computing 100-point website health score…")
        scores = scoring.compute(scoring_context)
        progress("score", f"Health score computed: {scores['health_score']}/100")

        # ── build issues ─────────────────────────────────────────────────
        issues = []
        issues += build_availability_issues(availability, timeout_seconds)
        issues += build_security_issues(availability)
        issues += build_broken_link_issues(crawl_result["broken_entries"])

        title_groups = {}
        hash_groups = {}
        for page in crawl_result["pages"]:
            issues += build_page_seo_issues(page)
            t = (page.get("title") or "").strip()
            if t:
                title_groups.setdefault(t.lower(), []).append(page["url"])
            if page.get("content_hash"):
                hash_groups.setdefault(page["content_hash"], []).append(page["url"])

        for urls in title_groups.values():
            if len(urls) > 1:
                issues.append(
                    {
                        "category": "seo",
                        "severity": "medium",
                        "type": "duplicate_title",
                        "title": f"Duplicate title on {len(urls)} pages",
                        "description": f"Pages: {', '.join(urls[:5])}",
                        "source_url": urls[0],
                        "target_url": urls[0],
                        "recommendation": "Give each page a unique title tag.",
                    }
                )
        for urls in hash_groups.values():
            if len(urls) > 1:
                issues.append(
                    {
                        "category": "technical",
                        "severity": "high",
                        "type": "duplicate_content",
                        "title": f"Duplicate content on {len(urls)} pages",
                        "description": f"Pages: {', '.join(urls[:5])}",
                        "source_url": urls[0],
                        "target_url": urls[0],
                        "recommendation": "Make each page's body content unique.",
                    }
                )

        if scores["server_errors"] > 0:
            issues.append(
                {
                    "category": "technical",
                    "severity": "critical",
                    "type": "server_errors",
                    "title": f"{scores['server_errors']} page(s) returned 5xx errors",
                    "recommendation": "Fix server-side errors (check hosting, scripts, database).",
                }
            )
        if not has_sitemap:
            issues.append(
                {
                    "category": "technical",
                    "severity": "low",
                    "type": "missing_sitemap",
                    "title": "XML sitemap not found",
                    "recommendation": "Create and submit an XML sitemap to search engines.",
                }
            )
        if not robots_present:
            issues.append(
                {
                    "category": "technical",
                    "severity": "low",
                    "type": "missing_robots",
                    "title": "robots.txt not found",
                    "recommendation": "Create a robots.txt file to control crawling.",
                }
            )
        if crawl_result.get("redirect_count", 0) > 5:
            issues.append(
                {
                    "category": "technical",
                    "severity": "medium",
                    "type": "many_redirects",
                    "title": f"{crawl_result['redirect_count']} redirects detected",
                    "recommendation": "Reduce redirect chains and update links to final URLs.",
                }
            )

        seo_issues_count = sum(1 for i in issues if i["category"] in ("seo", "content"))
        technical_issues_count = sum(1 for i in issues if i["category"] == "technical")

        audit_fields = {
            "status": "completed",
            "completed_at": _now(),
            "duration_ms": int((time.time() - start_time) * 1000),
            "pages_found": len(crawl_result["internal_targets"]) + len(crawl_result["external_targets"]) + len(crawl_result["resource_targets"]),
            "pages_crawled": len(crawl_result["pages"]),
            "internal_links": len(crawl_result["internal_targets"]),
            "external_links": len(crawl_result["external_targets"]),
            "broken_links": len(crawl_result["unique_broken"]),
            "broken_images": crawl_result["broken_images"],
            "redirects": crawl_result["redirect_count"],
            "seo_issues": seo_issues_count,
            "technical_issues": technical_issues_count,
            "website_online": availability.get("website_online"),
            "domain_resolves": availability.get("domain_resolves"),
            "https_enabled": availability.get("https_enabled"),
            "ssl_valid": availability.get("ssl_valid"),
            "ssl_expiry_date": availability.get("ssl_expiry_date"),
            "http_status": availability.get("http_status"),
            "response_time_ms": availability.get("response_time_ms"),
            "www_status": availability.get("www_status"),
            "unresponsive": availability.get("unresponsive", 0),
            "error": None,
            "health_score": scores["health_score"],
            "score_availability": scores["availability"],
            "score_technical": scores["technical"],
            "score_links": scores["links"],
            "score_onpage": scores["onpage"],
            "score_performance": scores["performance"],
            "score_security": scores["security"],
        }

        db.save_results(
            audit_id,
            audit_fields,
            pages=crawl_result["pages"],
            issues=issues,
            broken_links=crawl_result["broken_entries"],
        )
        # Flush the WAL immediately so the CRM UI never hits a slow checkpoint read.
        db.checkpoint()
        progress(
            "done",
            f"Audit complete — health {scores['health_score']}/100 · {len(crawl_result['pages'])} pages · "
            f"{len(crawl_result['unique_broken'])} broken · {len(issues)} issues",
        )
        print(
            f"[audit] completed {audit_id} health={scores['health_score']} "
            f"pages={len(crawl_result['pages'])} broken={len(crawl_result['unique_broken'])} "
            f"issues={len(issues)} in {audit_fields['duration_ms']}ms"
        )
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        try:
            db.mark_failed(audit_id, str(exc)[:2000])
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
