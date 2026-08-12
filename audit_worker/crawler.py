"""BFS website crawler + broken link / broken image checker."""
import hashlib
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed

from . import fetch
from . import seo
from . import urlutil

MAX_LINK_CHECKS = 400
LINK_CHECK_WORKERS = 10
RESOURCE_TYPES = {
    "image",
    "script",
    "stylesheet",
    "font",
    "media",
    "pdf",
    "document",
    "archive",
    "iframe",
    "form",
    "resource",
}


def run_crawl(start_url: str, base_domain: str, max_pages: int, use_playwright: bool, disallow_patterns, progress_cb=None, time_budget=600.0):
    """Crawl a site. Returns a rich result dict consumed by main.py."""
    start_url = urlutil.normalize(start_url)
    origin = start_url.split("/")[0] + "//" + urlutil.hostname(start_url)
    crawl_start = time.time()

    def emit(stage, message):
        if progress_cb:
            try:
                progress_cb(stage, message)
            except Exception:
                pass

    frontier = deque([start_url])
    visited = set()          # urls fetched as pages
    discovered = set()       # every url ever discovered
    pages = []               # page result dicts
    page_by_url = {}
    link_map = {}            # target_url -> list of {source, type, text}
    internal_targets = set()
    external_targets = set()
    resource_targets = set()
    redirect_count = 0
    total_requests = 0

    def record_link(source_url, target_url, link_type, anchor_text):
        if target_url not in link_map:
            link_map[target_url] = []
        link_map[target_url].append({"source": source_url, "type": link_type, "text": anchor_text})
        if link_type == "internal":
            internal_targets.add(target_url)
        elif link_type == "external":
            external_targets.add(target_url)
        else:
            resource_targets.add(target_url)

    while frontier and len(visited) < max_pages:
        if time.time() - crawl_start > time_budget:
            emit("crawl", f"Time budget reached ({time_budget:g}s) — stopping crawl with {len(visited)} page(s).")
            break
        url = frontier.popleft()
        if url in visited:
            continue
        visited.add(url)
        discovered.add(url)
        emit("crawl", f"Crawling page {len(visited)}/{max_pages}: {url}")

        if not fetch.allowed_by_robots(url, disallow_patterns):
            continue

        result = fetch.fetch_html(url, use_playwright)
        total_requests += 1
        redirect_count += result.get("redirects", 0)

        is_ok = result["status"] in (200, 201, 202, 203, 204, 206) and result.get("html")
        if not is_ok:
            # 4xx/5xx / network failures are not pages; they are reported as
            # broken internal links (their target is added to check_targets below).
            continue

        page = {
            "url": url,
            "status_code": result["status"],
            "load_time_ms": result["elapsed_ms"],
            "content_hash": hashlib.md5((result.get("html") or "").encode("utf-8", errors="replace")).hexdigest(),
            "internal_links": 0,
            "external_links": 0,
            "broken_links": 0,
            "images_missing_alt": 0,
            "broken_targets": set(),
        }
        page.update(seo.analyze_page(result["html"], url))
        discovered_links, images = seo.extract_elements(result["html"], url, base_domain)

        for link in discovered_links:
            if not discovered.__contains__(link["url"]):
                discovered.add(link["url"])
            record_link(url, link["url"], link["type"], link["anchor_text"])
            if link["type"] == "internal" and link["url"] not in visited:
                if fetch.allowed_by_robots(link["url"], disallow_patterns):
                    frontier.append(link["url"])

        internal_on_page = set()
        external_on_page = set()
        for link in discovered_links:
            if link["type"] == "internal":
                internal_on_page.add(link["url"])
            elif link["type"] == "external":
                external_on_page.add(link["url"])
        page["internal_links"] = len(internal_on_page)
        page["external_links"] = len(external_on_page)
        page["images_missing_alt"] = sum(1 for img in images if not img["has_alt"])

        pages.append(page)
        page_by_url[url] = page

    # ─── Determine which URLs still need an HTTP check ────────────────────
    check_targets = set()
    # external + resource URLs (never crawled)
    for target in list(external_targets) + list(resource_targets):
        check_targets.add(target)
    # internal URLs that were not fetched with a 2xx result
    for target in internal_targets:
        page = page_by_url.get(target)
        if page is None or not (page["status_code"] and 200 <= page["status_code"] < 300):
            check_targets.add(target)

    # cap link checks
    ordered = sorted(check_targets)
    if len(ordered) > MAX_LINK_CHECKS:
        ordered = ordered[:MAX_LINK_CHECKS]

    status_of = {}

    def classify_status(status_code, error_type):
        if error_type:
            return error_type
        if status_code is None:
            return "unknown"
        if 200 <= status_code < 300:
            return "ok"
        if 300 <= status_code < 400:
            return "redirect"
        # 405 Method Not Allowed / 409 Conflict mean the URL exists and responds;
        # e.g. a form action that only accepts POST, or an access-protected handler.
        # These are not dead links and shouldn't be reported as broken.
        if status_code in (405, 409):
            return "ok"
        return f"http_{status_code}"

    # check URLs concurrently to keep large audits fast
    total_to_check = len(ordered)
    emit("broken-links", f"Checking {total_to_check} internal/external links & resources…")
    with ThreadPoolExecutor(max_workers=LINK_CHECK_WORKERS) as pool:
        futures = {pool.submit(fetch.check_url, target): target for target in ordered}
        done = 0
        for future in as_completed(futures):
            target = futures[future]
            try:
                status, hops, error_type = future.result()
            except Exception:
                status, hops, error_type = None, 0, "unknown"
            total_requests += 1
            redirect_count += hops
            status_of[target] = {"status_code": status, "error_type": classify_status(status, error_type)}
            done += 1
            if done % 20 == 0 or done == total_to_check:
                emit("broken-links", f"Checked {done}/{total_to_check} links & resources…")
    # ─── Build broken link entries & propagate to pages ───────────────────
    broken_entries = []
    broken_images = 0
    all_broken_targets = set()

    for target, meta in status_of.items():
        status_code = meta["status_code"]
        err = meta["error_type"]
        if err == "ok" or err == "redirect":
            continue
        for occurrence in link_map[target]:
            broken_entries.append(
                {
                    "source_page_url": occurrence["source"],
                    "link_url": target,
                    "link_text": occurrence["text"],
                    "link_type": occurrence["type"],
                    "http_status": status_code,
                    "error_type": err,
                }
            )
            all_broken_targets.add(target)
        if status_code and status_code >= 400:
            for occurrence in link_map[target]:
                if occurrence["type"] == "image":
                    broken_images += 1

    emit("broken-links", f"Broken link scan complete — {len(all_broken_targets)} broken target(s), {broken_images} broken image(s)")

    # propagate broken target counts back onto pages
    for page in pages:
        seen_targets = set()
        broken_on_page = 0
        for target, occs in link_map.items():
            if target in all_broken_targets:
                for occ in occs:
                    if occ["source"] == page["url"] and target not in seen_targets:
                        seen_targets.add(target)
                        broken_on_page += 1
        page["broken_links"] = broken_on_page

    unique_broken = all_broken_targets

    return {
        "pages": pages,
        "link_map": link_map,
        "internal_targets": internal_targets,
        "external_targets": external_targets,
        "resource_targets": resource_targets,
        "broken_entries": broken_entries,
        "broken_images": broken_images,
        "unique_broken": unique_broken,
        "redirect_count": redirect_count,
        "total_requests": total_requests,
        "start_url": start_url,
        "origin": origin,
    }
