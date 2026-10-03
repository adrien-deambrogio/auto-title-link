/**
 * Pure helpers (no Obsidian imports) so they can be unit-tested.
 */

/** Returns the trimmed text if it is a single http(s) URL, otherwise null.
 * `parseUrl` takes the pasted text and decides whether it is a single, valid web address. It returns the URL if so, and `null` otherwise. In `main.ts` that return value is the gate: if it's `null`, the plugin does nothing and the paste proceeds normally.
 * 
 * Step by step:
 * 
 * 1. **Trim**: `text.trim()` removes leading and trailing whitespace,
 * so a URL copied with a trailing newline or space still works.
 * 
 * 2. **Reject empty or multi-part text**: `if (!t || /\s/.test(t)) return null;`
 * bails out if the string is empty or contains any whitespace inside it.
 * This means `https://example.com some words` or two URLs on separate lines are not treated as a URL.
 * 
 * 3. **Validate with the `URL` constructor**: `new URL(t)` throws if the string isn't
 * a well-formed absolute URL (for example, `example.com` with no scheme, or `hello`).
 * The `catch` turns that into `null`.
 * 
 * 4. **Allow only http and https**: if parsing succeeds, it returns `t` only
 * when the protocol is `http:` or `https:`. Things like `ftp://...`, `mailto:...`,
 * `file:///...` or `obsidian://...` return `null`.
 * 
 * A few examples:
 * 
 * | Pasted text | Result |
 * |---|---|
 * | `https://example.com/page` | `"https://example.com/page"` |
 * | `  https://example.com  ` | `"https://example.com"` (trimmed) |
 * | `example.com` | `null` (no scheme) |
 * | `https://a.com https://b.com` | `null` (contains whitespace) |
 * | `mailto:me@example.com` | `null` (wrong protocol) |
 * | `check this https://example.com` | `null` (contains whitespace) |
 * 
 * It returns the trimmed original string, not `u.href`, so the URL is not normalized
 * (no added trailing slash, no lowercased host). The link inserted into the note
 * is exactly what the user pasted.
 */
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
