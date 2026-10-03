/**
 * Pure helpers (no Obsidian imports) so they can be unit-tested.
 */

/** Returns the trimmed text if it is a single http(s) URL, otherwise null. */
export function validateURL(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? t : null;
  } catch {
    return null;
  }
}

/**
 * Extracts the page title from raw HTML.
 * 
 * Uses `<title>` first (via `doc.title` on a parsed Document
 * 
 * Falls back to the Open Graph `og:title` meta tag only when `<title>` is empty.
 * This helps with JavaScript-rendered pages that ship an empty `<title>` in the
 * raw HTML but still include Open Graph tags for link previews. Both
 * `property="og:title"` (standard) and `name="og:title"` (common mistake) are checked.
 * 
 * @param html Raw HTML of the page.
 * @returns The title with whitespace collapsed, or null if none is found.
 */

export function extractTitle(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const raw =
    doc.title ||
    doc
      .querySelector('meta[property="og:title"], meta[name="og:title"]')
      ?.getAttribute("content") ||
    "";

  const title = raw.replace(/\s+/g, " ").trim();
  return title || null;
}

/** Escapes characters that would break Markdown link text: \  [  ]  | */
export function escapeLinkText(text: string): string {
  return text.replace(/[\\\[\]|]/g, "\\$&");
}

/** Makes a URL safe inside the (...) part of a Markdown link. */
export function encodeLinkUrl(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/ /g, "%20");
}

export function buildLink(title: string, url: string): string {
  return `[${escapeLinkText(title)}](${encodeLinkUrl(url)})`;
}

/** Domain name used as the fallback title (leading "www." removed). */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Index of the occurrence of `needle` in `haystack` closest to `around`, or -1. */
export function findNearest(haystack: string, needle: string, around: number): number {
  let best = -1;
  let bestDist = Infinity;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    const dist = Math.abs(i - around);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
    i = haystack.indexOf(needle, i + 1);
  }
  return best;
}
