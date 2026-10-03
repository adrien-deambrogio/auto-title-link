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
  hostnameOf,
  validateURL as validateURL,
} from "./title";

const FETCH_TIMEOUT_MS = 10_000;
const PLACEHOLDER_TITLE = "Fetching title…";

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

  /** Inserts a placeholder link, fetches the title, then swaps in the final link. */
  private async convert(editor: Editor, file: TFile | null, url: string) {
    const placeholder = buildLink(PLACEHOLDER_TITLE, url);
    const offset = editor.posToOffset(editor.getCursor());
    editor.replaceSelection(placeholder);

    let title: string | null = null;
    try {
      title = await fetchTitle(url);
    } catch (err) {
      console.debug("[paste-url-title] fetch failed, using domain:", err);
    }

    const link = buildLink(title ?? hostnameOf(url), url);
    if (link === placeholder) return;
    await this.swap(file, editor, offset, placeholder, link);
  }

  /** Replaces the placeholder wherever it now lives; does nothing if the user removed it. */
  private async swap(
    file: TFile | null,
    editor: Editor,
    offset: number,
    placeholder: string,
    link: string
  ) {
    if (!file) {
      replaceInEditor(editor, offset, placeholder, link);
      return;
    }

    // The user may have switched notes: target the editor showing the original file.
    const view = this.app.workspace
      .getLeavesOfType("markdown")
      .map((leaf) => leaf.view)
      .find((v): v is MarkdownView => v instanceof MarkdownView && v.file?.path === file.path);

    if (view) {
      replaceInEditor(view.editor, offset, placeholder, link);
      return;
    }

    // File no longer open: edit it on disk.
    await this.app.vault.process(file, (data) => {
      const idx = findNearest(data, placeholder, offset);
      if (idx === -1) return data;
      return data.slice(0, idx) + link + data.slice(idx + placeholder.length);
    });
  }
}

function replaceInEditor(
  editor: Editor,
  offset: number,
  placeholder: string,
  link: string
): boolean {
  const doc = editor.getValue();
  const idx = doc.startsWith(placeholder, offset)
    ? offset
    : findNearest(doc, placeholder, offset);
  if (idx === -1) return false;
  editor.replaceRange(
    link,
    editor.offsetToPos(idx),
    editor.offsetToPos(idx + placeholder.length)
  );
  return true;
}

async function fetchTitle(url: string): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([
      requestUrl({
        url,
        method: "GET",
        headers: { Accept: "text/html,application/xhtml+xml" },
      }),
      timeout,
    ]);

    const contentType =
      Object.entries(res.headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
    if (contentType && !/html|xml/i.test(contentType)) return null;

    return extractTitle(res.text);
  } finally {
    if (timer) clearTimeout(timer);
  }
}