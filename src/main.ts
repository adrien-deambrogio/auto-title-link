import {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Plugin,
  TFile,
  requestUrl,
} from "obsidian";
import {
  buildLink,
  extractTitle,
  findNearest,
  validateURL,
} from "./title";

const FETCH_TIMEOUT_MS = 5_000;

export default class PasteUrlTitlePlugin extends Plugin {
  async onload() {
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (evt: ClipboardEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
          if (evt.defaultPrevented) return;

          const url = validateURL(evt.clipboardData?.getData("text/plain") ?? "");
          if (!url) return;

          // Skip: text selected (Obsidian handles it).
          if (editor.somethingSelected()) return;

          evt.preventDefault();
          void this.convert(editor, info.file ?? null, url);
        }
      )
    );
  }

  /** Inserts the URL as-is, fetches the title, then swaps in the final link. */
  private async convert(editor: Editor, file: TFile | null, url: string) {
    const offset = editor.posToOffset(editor.getCursor());
    editor.replaceSelection(url);

    let title: string | null = null;
    try {
      title = await fetchTitle(url);
    } catch (err) {
      console.debug("[paste-url-title] fetch failed, leaving URL as-is:", err);
    }

    if (!title) return;

    const link = buildLink(title, url);
    await this.swap(file, editor, offset, url, link);
  }

  /** Replaces the pasted URL wherever it now lives; does nothing if the user removed it. */
  private async swap(
    file: TFile | null,
    editor: Editor,
    offset: number,
    original: string,
    link: string
  ) {
    if (!file) {
      replaceInEditor(editor, offset, original, link);
      return;
    }

    // The user may have switched notes: target the editor showing the original file.
    const view = this.app.workspace
      .getLeavesOfType("markdown")
      .map((leaf) => leaf.view)
      .find((v): v is MarkdownView => v instanceof MarkdownView && v.file?.path === file.path);

    if (view) {
      replaceInEditor(view.editor, offset, original, link);
      return;
    }

    // File no longer open: edit it on disk.
    await this.app.vault.process(file, (data) => {
      const idx = findNearest(data, original, offset);
      if (idx === -1) return data;
      return data.slice(0, idx) + link + data.slice(idx + original.length);
    });
  }
}

function replaceInEditor(
  editor: Editor,
  offset: number,
  original: string,
  link: string
): boolean {
  const doc = editor.getValue();
  const idx = doc.startsWith(original, offset)
    ? offset
    : findNearest(doc, original, offset);
  if (idx === -1) return false;
  editor.replaceRange(
    link,
    editor.offsetToPos(idx),
    editor.offsetToPos(idx + original.length)
  );
  return true;
}


/**
 * Fetches a web page and returns its title.
 *
 * The request is abandoned after FETCH_TIMEOUT_MS milliseconds. Note that
 * the underlying request is not cancelled (requestUrl has no abort option);
 * its result is simply ignored.
 *
 * Every failure is logged with `console.error`.
 *
 * @param url - The absolute URL of the page to fetch.
 * @returns The page title, or `null` if the response is not HTML/XML or
 *          no title could be extracted.
 * @throws If the request fails (network or HTTP error) or times out.
 *         Callers are expected to catch and handle this.
 */
async function fetchTitle(url: string): Promise<string | null> {
  // Handle of the timeout timer, kept so it can be cancelled in `finally`.
  let timer: ReturnType<typeof setTimeout> | undefined;

  // A promise that never resolves: it only rejects once the timeout elapses.
  // Racing it against the request below enforces the time limit.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS);
  });

  try {
    // Whichever settles first wins: the response, or the timeout rejection.
    const res = await Promise.race([
      requestUrl({
        url,
        method: "GET",
        // Ask for HTML so servers are less likely to return JSON, images, etc.
        headers: { Accept: "text/html,application/xhtml+xml" },
      }),
      timeout,
    ]);

    // Header names are case-insensitive and servers differ in casing,
    // so look up "content-type" with a case-insensitive comparison.
    const contentType =
      Object.entries(res.headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";

    // Skip non-HTML responses (PDFs, images, JSON...): they have no <title>.
    // If the header is missing, try to parse the body anyway.
    if (contentType && !/html|xml/i.test(contentType)) {
      console.error(
        `[paste-url-title] Could not get title for ${url}: unsupported content type "${contentType}"`
      );
      return null;
    }

    // Parse the HTML body; returns null if no title is found.
    const title = extractTitle(res.text);
    if (!title) {
      console.error(`[paste-url-title] Could not get title for ${url}: no title found in page`);
    }
    return title;
  } catch (err) {
    // Network error, HTTP error or timeout: log it, then let the caller decide.
    console.error(`[paste-url-title] Could not get title for ${url}:`, err);
    throw err;
  } finally {
    // Always cancel the timer, whether we returned or threw, so it doesn't
    // linger after a fast response or fire against a promise nobody awaits.
    if (timer) clearTimeout(timer);
  }
}