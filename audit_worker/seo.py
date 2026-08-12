"""HTML element extraction and on-page SEO analysis using lxml."""
import re
from urllib.parse import urlsplit

from lxml import html as lxml_html

from . import urlutil

_WORD_RE = re.compile(r"\w+")


def parse_html(html_text: str):
    if not html_text:
        return None
    try:
        return lxml_html.fromstring(html_text)
    except Exception:
        try:
            return lxml_html.fromstring(html_text.encode("utf-8", errors="replace"))
        except Exception:
            return None


def _srcset_urls(srcset: str) -> list:
    if not srcset:
        return []
    urls = []
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        url = part.split()[0]
        if url:
            urls.append(url)
    return urls


def extract_elements(html_text: str, base_url: str, base_domain: str):
    """Extract links, images and resources from a page.

    Returns (discovered, images):
      discovered: list of {url, type, anchor_text}
      images: list of {url, has_alt}
    """
    discovered = []
    images = []
    tree = parse_html(html_text)
    if tree is None:
        return discovered, images

    seen_src = set()

    def add(url_raw, src_tag, anchor_text=""):
        if not url_raw:
            return
        resolved = urlutil.resolve(base_url, url_raw)
        if not resolved or resolved.lower().startswith(urlutil.SKIPPED_SCHEMES):
            return
        key = (src_tag, resolved)
        if key in seen_src:
            return
        seen_src.add(key)
        discovered.append(
            {"url": resolved, "type": urlutil.classify_link_type(src_tag, resolved, base_domain), "anchor_text": anchor_text.strip()[:200]}
        )

    # anchor links
    for a in tree.xpath("//a[@href]"):
        href = a.get("href", "")
        text = " ".join(a.text_content().split()) if a.text_content() else ""
        add(href, "a", text)

    # images
    for img in tree.xpath("//img"):
        src = img.get("src", "")
        has_alt = "alt" in img.attrib and (img.get("alt") or "").strip() != ""
        if src:
            resolved = urlutil.resolve(base_url, src)
            if resolved:
                images.append({"url": resolved, "has_alt": has_alt})
                add(src, "img")
        for s in _srcset_urls(img.get("srcset", "")):
            add(s, "img")

    # source / picture srcset
    for src in tree.xpath("//source"):
        for s in _srcset_urls(src.get("srcset", "")):
            add(s, "source")
        if src.get("src"):
            add(src.get("src"), "source")

    # scripts
    for script in tree.xpath("//script[@src]"):
        add(script.get("src"), "script")

    # stylesheets & resources
    for link in tree.xpath("//link[@href]"):
        add(link.get("href"), "link")

    # iframes
    for iframe in tree.xpath("//iframe[@src]"):
        add(iframe.get("src"), "iframe")

    # forms
    for form in tree.xpath("//form[@action]"):
        add(form.get("action"), "form")

    return discovered, images


def analyze_page(html_text: str, url: str):
    """Run on-page SEO checks. Returns a dict of page SEO fields."""
    tree = parse_html(html_text)
    empty = {
        "title": None,
        "title_length": 0,
        "meta_description": None,
        "meta_desc_length": 0,
        "h1_count": 0,
        "h1_text": None,
        "h2_count": 0,
        "canonical_url": None,
        "robots_meta": None,
        "word_count": 0,
        "images_total": 0,
        "images_missing_alt": 0,
        "has_noindex": False,
    }
    if tree is None:
        return empty

    # title
    title_nodes = tree.xpath("//title")
    title = (title_nodes[0].text_content().strip() if title_nodes else "") or None
    title = " ".join(title.split()) if title else None

    # meta description
    meta = tree.xpath("//meta[@name='description' and @content]")
    meta_desc = meta[0].get("content", "").strip() if meta else None
    meta_desc = meta_desc or None

    # headings
    h1_nodes = tree.xpath("//h1")
    h1_count = len(h1_nodes)
    h1_text = " ".join(h1_nodes[0].text_content().split())[:300] if h1_nodes else None
    h2_count = len(tree.xpath("//h2"))

    # canonical
    canon = tree.xpath("//link[@rel='canonical' and @href]")
    canonical_url = canon[0].get("href", "").strip() if canon else None

    # robots
    robots = tree.xpath("//meta[@name='robots' and @content]")
    robots_meta = robots[0].get("content", "").strip() if robots else None

    # word count (visible text, excluding scripts/styles)
    body = tree.xpath("//body")
    if body:
        for tag in body[0].xpath(".//script | .//style"):
            try:
                tag.drop_tree()
            except Exception:
                pass
        body_text = body[0].text_content() or ""
    else:
        body_text = ""
    word_count = len(_WORD_RE.findall(body_text))

    # images
    img_nodes = tree.xpath("//img[@src]")
    images_total = len(img_nodes)
    images_missing_alt = sum(
        1 for img in img_nodes if "alt" not in img.attrib or (img.get("alt") or "").strip() == ""
    )

    return {
        "title": title,
        "title_length": len(title) if title else 0,
        "meta_description": meta_desc,
        "meta_desc_length": len(meta_desc) if meta_desc else 0,
        "h1_count": h1_count,
        "h1_text": h1_text,
        "h2_count": h2_count,
        "canonical_url": canonical_url,
        "robots_meta": robots_meta,
        "word_count": word_count,
        "images_total": images_total,
        "images_missing_alt": images_missing_alt,
        "has_noindex": bool(robots_meta and "noindex" in robots_meta.lower()),
    }
