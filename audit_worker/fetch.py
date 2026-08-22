"""HTTP fetching, availability checks, SSL/DNS inspection and robots.txt handling."""
import datetime
import re
import socket
import ssl
import threading
import time
from urllib.parse import urlsplit

import httpx

from . import urlutil

USER_AGENT = "BGT-CRM-WebsiteAudit/1.0 (+internal digital marketing website health checker)"
# A real desktop Chrome UA so JS-heavy pages (Google Maps, GMB) serve the full UI.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
TIMEOUT = httpx.Timeout(30.0, connect=10.0)

_client = None
_pw = None
_browser = None
_check_local = threading.local()


def get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            follow_redirects=True,
            timeout=TIMEOUT,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.8",
            },
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
    return _client


def get_check_client() -> httpx.Client:
    """Short-timeout, per-thread client used for bulk link/resource checking."""
    client = getattr(_check_local, "client", None)
    if client is None:
        client = httpx.Client(
            follow_redirects=True,
            timeout=httpx.Timeout(12.0, connect=5.0),
            headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
            limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
        )
        _check_local.client = client
    return client


# ─── Playwright (JS rendering) ──────────────────────────────────────────────

def playwright_available() -> bool:
    try:
        import playwright  # noqa: F401
        return True
    except Exception:
        return False


def get_browser():
    global _pw, _browser
    if _browser is None:
        from playwright.sync_api import sync_playwright
        _pw = sync_playwright().start()
        _browser = _pw.chromium.launch(headless=True)
    return _browser


def fetch_html_playwright(url: str):
    browser = get_browser()
    context = browser.new_context(user_agent=USER_AGENT, ignore_https_errors=False)
    page = context.new_page()
    start = time.time()
    try:
        resp = page.goto(url, timeout=40000, wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        html = page.content()
        status = resp.status if resp else 0
        final_url = page.url
        return {
            "html": html,
            "status": status,
            "final_url": final_url,
            "elapsed_ms": int((time.time() - start) * 1000),
            "redirects": 0,
            "content_type": "text/html",
        }
    except Exception as exc:
        return {
            "html": "",
            "status": 0,
            "final_url": url,
            "elapsed_ms": int((time.time() - start) * 1000),
            "redirects": 0,
            "content_type": "",
            "error": str(exc)[:300],
        }
    finally:
        page.close()
        context.close()


def render_page_visible(url: str, timeout_ms: int = 25000):
    """Headless-render a URL and return visible body text + anchor links.

    Used by the business-intel (Google My Business) extractor so DeepSeek can
    see the fully rendered business panel. Best-effort: returns empty fields on
    consent/bot pages or timeouts rather than raising.
    """
    browser = get_browser()
    context = browser.new_context(
        locale="en-US",
        user_agent=BROWSER_USER_AGENT,
        viewport={"width": 1280, "height": 900},
        ignore_https_errors=True,
    )
    page = context.new_page()
    start = time.time()
    try:
        try:
            page.goto(url, timeout=timeout_ms, wait_until="networkidle")
        except Exception:
            # networkidle often never settles on Google Maps — fall back to
            # domcontentloaded + a fixed settle wait.
            try:
                page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
            except Exception:
                pass
            page.wait_for_timeout(2500)
        else:
            page.wait_for_timeout(1200)

        # Wait a little longer for the business panel to render (the map tiles
        # load first; the place panel / "Directions" button appears after).
        try:
            page.wait_for_selector("button[aria-label='Directions']", timeout=6000)
            page.wait_for_timeout(800)
        except Exception:
            page.wait_for_timeout(1500)

        text = ""
        links = []
        try:
            text = page.inner_text("body")[:30000]
        except Exception:
            text = ""
        try:
            links = page.eval_on_selector_all(
                "a",
                "els => els.map(e => ({href: e.href, text: (e.textContent||'').trim()}))",
            )
        except Exception:
            links = []
        return {
            "text": text,
            "links": links,
            "final_url": page.url,
            "elapsed_ms": int((time.time() - start) * 1000),
        }
    except Exception as exc:
        return {"text": "", "links": [], "final_url": url, "error": str(exc)[:300]}
    finally:
        try:
            page.close()
        except Exception:
            pass
        try:
            context.close()
        except Exception:
            pass


def detect_rendering(base_url: str, render_js: bool) -> bool:
    """Return True when the site needs JS rendering (only if render_js enabled)."""
    if not render_js or not playwright_available():
        return False
    try:
        from lxml import html as lxml_html

        plain = get_client().get(base_url)
        if plain.status_code != 200:
            return False
        tree = lxml_html.fromstring(plain.text)
        plain_links = len(tree.xpath("//a[@href]"))
        plain_words = len(re.findall(r"\w+", (tree.text_content() or "")[:20000]))

        rendered = fetch_html_playwright(base_url)
        if not rendered.get("html"):
            return False
        rtree = lxml_html.fromstring(rendered["html"])
        js_links = len(rtree.xpath("//a[@href]"))
        js_words = len(re.findall(r"\w+", (rtree.text_content() or "")[:20000]))

        # JS renders significantly more content than plain HTML
        if (js_links > plain_links * 1.5 and plain_links < 30) or (js_words > plain_words * 2 and plain_words < 100):
            return True
    except Exception:
        return False
    return False


# ─── Page fetching ──────────────────────────────────────────────────────────

def fetch_html(url: str, use_playwright: bool, timeout_seconds: float | None = None):
    """Fetch a page. Returns dict with html/status/final_url/elapsed_ms/redirects."""
    if use_playwright and playwright_available():
        result = fetch_html_playwright(url)
        if result["html"]:
            return result
        # fall through to httpx on playwright failure
    client = get_client()
    start = time.time()
    try:
        kwargs = {}
        if timeout_seconds is not None:
            kwargs["timeout"] = httpx.Timeout(timeout_seconds, connect=min(10.0, timeout_seconds))
        resp = client.get(url, **kwargs)
        elapsed_ms = int((time.time() - start) * 1000)
        return {
            "html": resp.text,
            "status": resp.status_code,
            "final_url": str(resp.url),
            "elapsed_ms": elapsed_ms,
            "redirects": len(resp.history),
            "content_type": resp.headers.get("content-type", ""),
        }
    except httpx.TimeoutException:
        return _error_result(url, "timeout", start)
    except httpx.ConnectError:
        return _error_result(url, "connection_error", start)
    except httpx.HTTPStatusError:
        return _error_result(url, "http_error", start)
    except httpx.HTTPError:
        return _error_result(url, "http_error", start)
    except ssl.SSLError:
        return _error_result(url, "ssl_error", start)
    except Exception:
        return _error_result(url, "unknown", start)


def _error_result(url, error_type, start):
    return {
        "html": "",
        "status": 0,
        "final_url": url,
        "elapsed_ms": int((time.time() - start) * 1000),
        "redirects": 0,
        "content_type": "",
        "error": error_type,
    }


# ─── Link / resource checking ───────────────────────────────────────────────

def check_url(url: str):
    """Check a single URL. Returns (status_code, redirects, error_type).

    Uses HEAD first, then falls back to a streamed GET for servers that reject
    HEAD or return an error status on it.
    """
    client = get_check_client()

    def try_get():
        try:
            with client.stream("GET", url) as sr:
                code = sr.status_code
                for _ in sr.iter_bytes():
                    sr.close()
                    break
            return code, len(sr.history), None
        except httpx.TimeoutException:
            return None, 0, "timeout"
        except ssl.SSLError:
            return None, 0, "ssl_error"
        except httpx.ConnectError:
            return None, 0, "connection_error"
        except httpx.HTTPError:
            return None, 0, "http_error"
        except Exception:
            return None, 0, "unknown"

    try:
        resp = client.head(url)
        if resp.status_code >= 400 or resp.status_code in (405, 403, 501):
            return try_get()
        return resp.status_code, len(resp.history), None
    except httpx.TimeoutException:
        return try_get()
    except ssl.SSLError:
        return None, 0, "ssl_error"
    except httpx.ConnectError:
        return try_get()
    except httpx.HTTPError:
        return try_get()
    except Exception:
        return None, 0, "unknown"


# ─── Availability ───────────────────────────────────────────────────────────

def dns_resolves(host: str):
    try:
        infos = socket.getaddrinfo(host, 443, socket.AF_UNSPEC, socket.SOCK_STREAM)
        ipv4 = any(info[0] == socket.AF_INET for info in infos)
        ipv6 = any(info[0] == socket.AF_INET6 for info in infos)
        return True, ipv4, ipv6
    except Exception:
        return False, False, False


def check_ssl(host: str):
    """Return (valid, expiry_date_iso) for the host over 443."""
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
        not_after = cert.get("notAfter")
        if not not_after:
            return True, None
        # notAfter format: 'Aug 15 12:00:00 2026 GMT'
        parsed = datetime.datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
        return True, parsed.strftime("%Y-%m-%d")
    except ssl.SSLCertVerificationError:
        return False, None
    except ssl.SSLError:
        return False, None
    except Exception:
        return False, None


def tcp_connectable(host: str, port: int, timeout=6.0) -> bool:
    """Quick TCP connect probe (does the server accept connections?)."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def availability_check(start_url: str, use_playwright: bool, timeout_seconds: float = 60.0):
    """Run the full website availability probe.

    Two-tier strategy:
      - Tier 1 (fast): DNS + TCP connect. Dead sites are flagged offline in seconds.
      - Tier 2 (patient): if the server accepts connections but is slow to respond,
        wait up to `timeout_seconds` for the homepage. Slow-but-alive sites are not
        mistaken for being down.

    Returns dict with:
      domain_resolves, website_online, http_status, response_time_ms, https_enabled,
      ssl_valid, ssl_expiry_date, www_status, final_url, unresponsive
    """
    parsed = urlsplit(start_url)
    host = parsed.hostname or ""
    base_domain = urlutil.domain_of(start_url)
    port = 443 if parsed.scheme == "https" else 80

    resolves, _ipv4, _ipv6 = dns_resolves(host)
    unresponsive = 0

    if resolves and tcp_connectable(host, port):
        # Server accepts connections -> be patient and wait for the homepage.
        result = fetch_html(start_url, use_playwright, timeout_seconds=timeout_seconds)
        if result.get("error") == "timeout":
            unresponsive = 1
    elif resolves:
        result = fetch_html(start_url, use_playwright, timeout_seconds=timeout_seconds)
        if result.get("error") == "timeout":
            unresponsive = 1
    else:
        # DNS doesn't resolve -> dead fast, no point waiting.
        result = {"html": "", "status": 0, "elapsed_ms": 0, "redirects": 0, "error": "connection_error"}

    website_online = 1 if result["status"] >= 200 and result["status"] < 500 and result["html"] else 0
    if result["status"] == 0:
        website_online = 0

    # Determine whether HTTPS is actually served (probe https for http-only URLs)
    https_enabled = 0
    ssl_valid = None
    ssl_expiry = None
    if parsed.scheme == "https":
        if result["status"] and result["status"] < 500:
            https_enabled = 1
    else:
        try:
            probe = get_client().get(f"https://{host}/", follow_redirects=False, timeout=httpx.Timeout(8.0, connect=5.0))
            if probe.status_code < 500:
                https_enabled = 1
        except Exception:
            https_enabled = 0

    if https_enabled:
        ssl_valid, ssl_expiry = check_ssl(host)

    # www vs non-www redirect status
    www_status = "unknown"
    try:
        non_www = base_domain if not host.startswith("www.") else host[4:]
        target = f"https://{non_www}"
        resp = get_client().get(target, follow_redirects=False)
        if resp.status_code in (301, 302, 307, 308):
            location = resp.headers.get("location", "")
            www_status = f"{resp.status_code} -> {location}"
        else:
            www_status = "no-redirect"
    except Exception:
        pass

    return {
        "domain_resolves": 1 if resolves else 0,
        "website_online": website_online,
        "http_status": result["status"] if result["status"] else None,
        "response_time_ms": result["elapsed_ms"],
        "https_enabled": 1 if https_enabled else 0,
        "ssl_valid": 1 if ssl_valid else 0,
        "ssl_expiry_date": ssl_expiry,
        "www_status": www_status,
        "final_url": result["final_url"] or start_url,
        "unresponsive": unresponsive,
    }


# ─── robots.txt ─────────────────────────────────────────────────────────────

def fetch_robots(base_origin: str):
    """Return (disallow_rules, robots_present). Rules contain * wildcards."""
    client = get_client()
    try:
        resp = client.get(f"{base_origin}/robots.txt", follow_redirects=True)
        if resp.status_code != 200:
            return [], False
        rules = []
        for line in resp.text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or ":" not in line:
                continue
            key, _, value = line.partition(":")
            if key.strip().lower() == "disallow" and value.strip() and value.strip() != "/":
                rules.append(value.strip())
        return rules, True
    except Exception:
        return [], False


def sitemap_present(base_origin: str) -> bool:
    client = get_client()
    for path in ("/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"):
        try:
            resp = client.head(f"{base_origin}{path}", follow_redirects=True)
            if resp.status_code in (200, 201, 202, 203, 204):
                return True
        except Exception:
            continue
    return False


def allowed_by_robots(url: str, disallow_patterns) -> bool:
    if not disallow_patterns:
        return True
    path = urlutil.path_and_query(url)
    for pattern in disallow_patterns:
        regex = "^" + re.escape(pattern).replace(r"\*", ".*") + "$"
        if re.search(regex, path):
            return False
    return True
