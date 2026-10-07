import {
  App,
  Notice,
  TFile,
  getFrontMatterInfo,
  normalizePath,
  parseYaml,
} from "obsidian";
import type { FolderRule } from "./settings";

/** Finds the template note, with or without the `.md` extension. */
export function resolveTemplate(app: App, path: string): TFile | null {
  if (!path) return null;
  const p = normalizePath(path);
  return app.vault.getFileByPath(p) ?? app.vault.getFileByPath(`${p}.md`);
}

/** True when the note has no body (frontmatter-only notes, as created by Bases, count as empty). */
export async function isEmptyNote(app: App, file: TFile): Promise<boolean> {
  const data = await app.vault.read(file);
  return data.slice(getFrontMatterInfo(data).contentStart).trim() === "";
}

/**
 * Adds the template's missing frontmatter fields and its body to the note,
 * replacing the rule's placeholder with the note name in the body.
 */
export async function applyTemplate(
  app: App,
  file: TFile,
  rule: FolderRule
): Promise<void> {
  const template = resolveTemplate(app, rule.templatePath);
  if (!template) {
    if (rule.templatePath) {
      new Notice(`Auto ID: template "${rule.templatePath}" not found.`);
    }
    return;
  }

  const raw = await app.vault.cachedRead(template);
  const info = getFrontMatterInfo(raw);
  const fields = (info.exists ? parseYaml(info.frontmatter) : null) as Record<
    string,
    unknown
  > | null;

  // Only add keys the note doesn't already have (Bases may have pre-filled some)
  if (fields && Object.keys(fields).length > 0) {
    await app.fileManager.processFrontMatter(file, (fm) => {
      for (const [key, value] of Object.entries(fields)) {
        if (!(key in fm)) fm[key] = value;
      }
    });
  }

  let body = raw.slice(info.contentStart);
  if (rule.placeholder) {
    body = body.split(rule.placeholder).join(file.basename);
  }

  // The note body is empty at this point, so keep the frontmatter and append the template body
  await app.vault.process(file, (data) => {
    let head = data.slice(0, getFrontMatterInfo(data).contentStart);
    if (head && !head.endsWith("\n")) head += "\n";
    return head + body;
  });
}