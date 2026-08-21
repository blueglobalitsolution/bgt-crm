/**
 * Returns a URL guaranteed to be usable as an external <a href>.
 * Values that already carry a protocol (http/https/mailto/tel), are anchors,
 * or start with a slash are returned unchanged; anything else gets https://.
 */
export function externalHref(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
