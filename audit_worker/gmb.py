"""Google My Business / Maps link extraction helper (aggregation pipeline).

Usage:
    python -m audit_worker.gmb "<maps_or_gmb_or_share_url>"

Flow:
  1. Resolve the short link (already done by Node) and extract the business name.
  2. Search DuckDuckGo lite for '"<name>" <city>' to discover real sources
     (business website, Restaurant Guru, IndiaMART, Swiggy, Justdial, etc.).
  3. Fetch the best sources (business website + a couple of aggregators) and
     collect their visible text + phone/email/social-link signals.
  4. Print a single JSON object to stdout for the Node server to feed to DeepSeek.
"""
import json
import re
import sys

from . import fetch

DDG_LITE_URL = "https://lite.duckduckgo.com/lite/"


def _strip_html(html):
    if not html:
        return ""
    text = html.replace("<script", " <script").replace("<style", " <style")
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _fetch_text(url, timeout=15):
    """Fetch a URL and return {url, status, text, html} or None."""
    try:
        fetched = fetch.fetch_html(url, use_playwright=False, timeout_seconds=timeout)
        html = fetched.get("html") or ""
        return {
            "url": fetched.get("final_url") or url,
            "status": fetched.get("status"),
            "html": html,
            "text": _strip_html(html)[:20000],
        }
    except Exception:
        return None


def _extract_phone(text):
    phones = re.findall(r"\+?[0-9]{2,3}[-.\s]?[0-9]{3,5}[-.\s]?[0-9]{4,6}", text or "")
    return list(dict.fromkeys(p for p in phones if len(re.sub(r"\D", "", p)) >= 10))[:6]


def _extract_emails(text):
    emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text or "")
    return list(dict.fromkeys(e for e in emails if not e.lower().endswith((".png", ".jpg", ".gif", ".webp"))))[:6]


def _extract_social_links(html):
    links = re.findall(r'href="(https?://[^"]+)"', html or "")
    social = []
    for l in links:
        low = l.lower()
        if any(k in low for k in ("facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "pinterest.com", "wa.me", "whatsapp.com", "telegram.me")):
            if l not in social:
                social.append(l)
    return social[:8]


def _extract_name_from_url(raw):
    """Best-effort: derive the business name from a Maps / search URL."""
    q = None
    try:
        from urllib.parse import urlparse, parse_qs
        q = (parse_qs(urlparse(raw).query).get("q") or [None])[0]
    except Exception:
        q = None
    if q and not q.startswith("place_id:"):
        return q.strip()
    m = re.search(r"/maps/place/([^/@]+)", raw)
    if m:
        return m.group(1).replace("+", " ").replace("-", " ").strip()
    m2 = re.search(r"/place/([^/@]+)", raw)
    if m2:
        return m2.group(1).replace("+", " ").replace("-", " ").strip()
    return ""


def search_duckduckgo(query: str, max_results=8):
    """Search DDG lite and return decoded result URLs."""
    try:
        resp = fetch.get_client().get(
            DDG_LITE_URL,
            params={"q": query},
            follow_redirects=True,
            timeout=fetch.TIMEOUT,
        )
        html = resp.text
    except Exception:
        return []
    results = []
    for m in re.finditer(r'uddg=([^&"]+)', html):
        try:
            from urllib.parse import unquote
            results.append(unquote(m.group(1)))
        except Exception:
            continue
    # dedupe, drop google/duckduckgo links
    seen = set()
    out = []
    for r in results:
        low = r.lower()
        if "google" in low or "duckduckgo" in low or "youtube" in low:
            continue
        if r not in seen:
            seen.add(r)
            out.append(r)
        if len(out) >= max_results:
            break
    return out


def extract(url: str, name_hint: str = ""):
    final_url = url
    name = name_hint or _extract_name_from_url(url)

    # Aggregated content from all sources.
    sources = []
    website_url = ""
    website_text = ""
    all_phones = []
    all_emails = []
    all_social = []

    # 1) Search DDG for real sources.
    search_query = f'"{name}"' if name else "business"
    try:
        from urllib.parse import urlparse
        host = urlparse(url).hostname or ""
        if "maps" in host or "google" in host:
            # add a location hint from the URL if present
            city_match = re.search(r"/place/[^/@]+,([^@/,]+)", url)
            if city_match:
                search_query = f'"{name}" {city_match.group(1).strip()}'
        results = search_duckduckgo(search_query)
    except Exception:
        results = []

    # 2) Classify and pick sources: prefer business website, then aggregators.
    if results:
        # Choose the official website: prefer a result whose title/domain resembles the name.
        website_candidates = [
            r for r in results
            if re.search(r"(\.(com|in|co\.in|org|net|info)(/|$))", r) and not re.search(
                r"(indiamart|justdial|swiggy|zomato|restaurant|guru|bajajfinserv|medindia|esi\.in|cybo|tradeindia|dnb|bharatbz|facebook|instagram|linkedin)", r, re.I
            )
        ]
        if website_candidates:
            website_url = website_candidates[0]
        aggregators = [
            r for r in results
            if re.search(r"(indiamart|justdial|swiggy|zomato|restaurant-guru|bajajfinserv|medindia|esi\.in|cybo|tradeindia|bharatbz|facebook|instagram|linkedin)", r, re.I)
        ]
        fetch_targets = []
        if website_url:
            fetch_targets.append(("website", website_url))
        for agg in aggregators[:3]:
            fetch_targets.append(("aggregator", agg))

        for kind, u in fetch_targets:
            page = _fetch_text(u)
            if not page or not page.get("text"):
                continue
            sources.append({"kind": kind, "url": page["url"], "text": page["text"][:12000]})
            all_phones.extend(_extract_phone(page["text"]))
            all_emails.extend(_extract_emails(page["text"]))
            all_social.extend(_extract_social_links(page.get("html") or ""))
            if kind == "website" and not website_text:
                website_text = page["text"]

    # 3) Also try rendering the Maps page for name/address (best-effort, no CAPTCHA).
    name_address = ""
    try:
        if "google.com/maps" in url or "maps.app.goo.gl" in url:
            rendered = fetch.render_page_visible(url)
            browser_text = rendered.get("text") or ""
            name_address = _extract_name_address(fetch.fetch_html_playwright(url).get("html") or "")
            if browser_text and len(browser_text) > 50:
                sources.append({"kind": "maps", "url": rendered.get("final_url") or url, "text": browser_text[:12000]})
    except Exception:
        pass

    print(
        json.dumps(
            {
                "name": name,
                "final_url": final_url,
                "name_address": name_address,
                "website_url": website_url,
                "website_text": website_text[:12000],
                "phones": list(dict.fromkeys(all_phones))[:8],
                "emails": list(dict.fromkeys(all_emails))[:6],
                "social_links": list(dict.fromkeys(all_social))[:8],
                "sources": sources[:8],
            }
        )
    )


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else ""
    hint = sys.argv[2] if len(sys.argv) > 2 else ""
    if not target:
        print(json.dumps({"error": "No URL provided"}))
        sys.exit(1)
    try:
        extract(target, hint)
    except Exception as exc:  # pragma: no cover - defensive
        print(json.dumps({"error": str(exc)[:300]}))
        sys.exit(1)
