"""100-point website health scoring with the 6 weighted categories."""

# Weights per the spec: availability 15, technical 20, links 20, on-page 20,
# performance 15, security/SSL 10.


def page_score(page) -> int:
    """Score a single crawled page out of 100."""
    score = 0.0
    title = page.get("title") or ""
    title_len = page.get("title_length") or 0
    meta = page.get("meta_description") or ""
    meta_len = page.get("meta_desc_length") or 0
    h1 = page.get("h1_count") or 0
    word_count = page.get("word_count") or 0
    canonical = page.get("canonical_url")
    broken = page.get("broken_links") or 0
    missing_alt = page.get("images_missing_alt") or 0

    # title (20)
    if title and 20 <= title_len <= 65:
        score += 20
    elif title:
        score += 12

    # meta description (20)
    if meta and 50 <= meta_len <= 160:
        score += 20
    elif meta:
        score += 12

    # h1 (15)
    if h1 == 1:
        score += 15
    elif h1 > 1:
        score += 8

    # word count (15)
    if word_count >= 300:
        score += 15
    elif word_count >= 150:
        score += 10
    elif word_count >= 50:
        score += 5

    # canonical (10)
    if canonical:
        score += 10

    # broken links on page (10)
    if broken == 0:
        score += 10
    elif broken == 1:
        score += 5

    # image alt (5)
    if missing_alt == 0:
        score += 5
    elif missing_alt <= 3:
        score += 3

    # robots meta present (5)
    if page.get("robots_meta"):
        score += 5

    return int(round(min(score, 100)))


def _load_time_bucket(ms) -> int:
    if ms is None:
        return 0
    if ms < 1000:
        return 4
    if ms < 2000:
        return 3
    if ms < 3000:
        return 2
    return 1


def compute(context) -> dict:
    """Compute category scores + overall health.

    context keys:
      availability: dict from fetch.availability_check
      crawl: dict from crawler.run_crawl
      sitemap_present: bool
      robots_present: bool
    """
    availability = context["availability"]
    crawl = context["crawl"]
    pages = crawl["pages"]
    sitemap_present = context["sitemap_present"]
    robots_present = context["robots_present"]

    # ── Availability (15) ────────────────────────────────────────────────
    av = 0.0
    if availability.get("domain_resolves"):
        av += 3
    http_status = availability.get("http_status")
    if http_status and 200 <= http_status < 300:
        av += 5
    av += _load_time_bucket(availability.get("response_time_ms"))
    if availability.get("https_enabled"):
        av += 3
    availability_score = int(round(min(15, av)))

    # ── Security / SSL (10) ───────────────────────────────────────────────
    sec = 0.0
    if availability.get("https_enabled"):
        sec += 3
    if availability.get("ssl_valid"):
        sec += 4
    if availability.get("ssl_expiry_date"):
        sec += 3
    security_score = int(round(min(10, sec)))

    # ── Links (20) ────────────────────────────────────────────────────────
    total_links = max(
        1,
        len(crawl.get("internal_targets") or [])
        + len(crawl.get("external_targets") or [])
        + len(crawl.get("resource_targets") or []),
    )
    broken_count = len(crawl.get("unique_broken") or [])
    ratio = broken_count / total_links
    links_score = 20.0 * (1.0 - ratio)
    broken_images = crawl.get("broken_images") or 0
    if broken_images > 0:
        links_score -= min(3.0, broken_images * 0.5)
    links_score = max(0, round(links_score))

    # ── On-page SEO (20) ──────────────────────────────────────────────────
    if pages:
        avg_page = sum(page_score(p) for p in pages) / len(pages)
    else:
        avg_page = 0
    onpage_score = int(round((avg_page / 100.0) * 20.0))

    # ── Performance (15) ──────────────────────────────────────────────────
    if pages:
        avg_load = sum((p.get("load_time_ms") or 0) for p in pages) / len(pages)
        if avg_load < 1000:
            perf = 15
        elif avg_load < 1500:
            perf = 13
        elif avg_load < 2000:
            perf = 11
        elif avg_load < 3000:
            perf = 9
        elif avg_load < 4000:
            perf = 7
        elif avg_load < 6000:
            perf = 5
        else:
            perf = 3
    else:
        perf = 0
    performance_score = perf

    # ── Technical (20) ────────────────────────────────────────────────────
    tech = 20.0
    # duplicates
    title_groups = {}
    hash_groups = {}
    for p in pages:
        t = (p.get("title") or "").strip()
        if t:
            title_groups.setdefault(t.lower(), []).append(p["url"])
        h = p.get("content_hash")
        if h:
            hash_groups.setdefault(h, []).append(p["url"])
    duplicate_titles = sum(1 for v in title_groups.values() if len(v) > 1)
    duplicate_content = sum(1 for v in hash_groups.values() if len(v) > 1)
    if duplicate_titles > 0:
        tech -= 2
    if duplicate_content > 0:
        tech -= 3

    server_errors = 0
    for p in pages:
        if p.get("status_code") and p["status_code"] >= 500:
            server_errors += 1
    if server_errors > 0:
        tech -= 4

    redirects = crawl.get("redirect_count") or 0
    if redirects > 20:
        tech -= 2
    elif redirects > 5:
        tech -= 1

    if not sitemap_present:
        tech -= 2
    if not robots_present:
        tech -= 2

    pages_missing_h1 = sum(1 for p in pages if (p.get("h1_count") or 0) == 0)
    if pages and pages_missing_h1 / len(pages) > 0.5:
        tech -= 2

    technical_score = int(round(max(0, tech)))

    health = round(availability_score + technical_score + links_score + onpage_score + performance_score + security_score)
    health = max(0, min(100, health))

    return {
        "health_score": health,
        "availability": availability_score,
        "technical": technical_score,
        "links": links_score,
        "onpage": onpage_score,
        "performance": performance_score,
        "security": security_score,
        "avg_page_score": int(round(avg_page)) if pages else 0,
        "duplicate_titles": duplicate_titles,
        "duplicate_content": duplicate_content,
        "server_errors": server_errors,
        "redirects": redirects,
    }
