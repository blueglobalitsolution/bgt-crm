"""URL normalization and classification helpers."""
import os
import urllib.parse

SKIPPED_SCHEMES = ("mailto:", "tel:", "javascript:", "data:", "whatsapp:", "sms:", "ftp:", "file:", "about:", "blob:")

_EXT_TO_TYPE = {
    ".pdf": "pdf",
    ".doc": "document",
    ".docx": "document",
    ".xls": "document",
    ".xlsx": "document",
    ".ppt": "document",
    ".pptx": "document",
    ".zip": "archive",
    ".rar": "archive",
    ".7z": "archive",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".gif": "image",
    ".webp": "image",
    ".svg": "image",
    ".avif": "image",
    ".ico": "image",
    ".bmp": "image",
    ".tiff": "image",
    ".mp4": "media",
    ".mov": "media",
    ".avi": "media",
    ".mkv": "media",
    ".mp3": "media",
    ".wav": "media",
    ".woff": "font",
    ".woff2": "font",
    ".ttf": "font",
    ".otf": "font",
    ".eot": "font",
    ".css": "stylesheet",
    ".js": "script",
}


def normalize(url: str) -> str:
    """Return an absolute http(s) URL string, or '' if it cannot be normalized."""
    if not url:
        return ""
    url = url.strip().strip('"').strip("'")
    if not url:
        return ""
    # protocol-relative
    if url.startswith("//"):
        url = "https:" + url
    # scheme-less absolute path that looks like a host
    if not re_match_scheme(url):
        url = "https://" + url
    if not re_match_scheme(url):
        return ""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("http", "https"):
        return ""
    # strip fragment
    parsed = parsed._replace(fragment="")
    # normalize empty path to "/" so the homepage has one canonical form
    if not parsed.path:
        parsed = parsed._replace(path="/")
    return urllib.parse.urlunsplit(parsed)


def re_match_scheme(url: str) -> bool:
    import re

    return bool(re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url))


def resolve(base_url: str, href: str) -> str:
    """Resolve an href against a base page URL. Returns normalized absolute URL or ''."""
    if not href:
        return ""
    href = href.strip()
    if not href:
        return ""
    if href.lower().startswith(SKIPPED_SCHEMES):
        return ""
    if href.startswith("#"):
        return ""
    try:
        abs_url = urllib.parse.urljoin(base_url, href)
    except Exception:
        return ""
    return normalize(abs_url)


def hostname(url: str) -> str:
    try:
        return urllib.parse.urlsplit(normalize(url)).hostname or ""
    except Exception:
        return ""


def domain_of(url: str) -> str:
    h = hostname(url)
    if h.startswith("www."):
        h = h[4:]
    return h.lower()


def is_same_domain(url: str, base_domain: str) -> bool:
    return domain_of(url) == base_domain


def path_and_query(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    q = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.path}{q}"


def classify_link_type(src_tag: str, url: str, base_domain: str) -> str:
    """Return a link type string for a discovered URL."""
    parsed = urllib.parse.urlsplit(url)
    path = parsed.path or ""
    ext = os.path.splitext(path)[1].lower()

    if src_tag in ("img", "source"):
        return "image"
    if src_tag == "script":
        return "script"
    if src_tag == "link":
        return "stylesheet" if ext == ".css" else "resource"
    if src_tag == "iframe":
        return "iframe"
    if src_tag == "form":
        return "form"
    # anchor links
    if ext in _EXT_TO_TYPE:
        return _EXT_TO_TYPE[ext]
    return "internal" if is_same_domain(url, base_domain) else "external"
