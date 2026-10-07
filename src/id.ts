import { App, TFile, normalizePath } from "obsidian";
import type { FolderRule } from "./settings";

// Returns N for "PREFIX-N", otherwise null
const parseId = (basename: string, prefix: string): number | null => {
  const head = `${prefix}-`;
  if (!basename.startsWith(head)) return null;
  const rest = basename.slice(head.length);
  return /^\d+$/.test(rest) ? parseInt(rest, 10) : null;
};

/** Renames the file to PREFIX-(max + 1), based on the notes already in its folder. */
export async function assignId(
  app: App,
  file: TFile,
  rule: FolderRule
): Promise<void> {
  const folder = file.parent;
  // Already has a valid ID: nothing to do
  if (!folder || parseId(file.basename, rule.prefix) !== null) return;

  let max = 0;
  for (const child of folder.children) {
    if (!(child instanceof TFile) || child.extension !== "md") continue;
    max = Math.max(max, parseId(child.basename, rule.prefix) ?? 0);
  }

  const newPath = normalizePath(
    `${folder.path}/${rule.prefix}-${max + 1}.${file.extension}`
  );
  // fileManager.renameFile updates links pointing to the note
  await app.fileManager.renameFile(file, newPath);
}