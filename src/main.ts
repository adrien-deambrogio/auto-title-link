import { Notice, Plugin, TFile, TAbstractFile } from "obsidian";
import {
  AutoIdSettings,
  AutoIdSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default class AutoIdPlugin extends Plugin {
  settings!: AutoIdSettings;

  // Serializes all work so two quick creations can't grab the same number
  private queue: Promise<void> = Promise.resolve();

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AutoIdSettingTab(this.app, this));

    // Skip the burst of 'create' events fired while the vault indexes at startup
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.vault.on("create", (f) => this.enqueue(f))
      );
      // 'rename' fires for both renames and moves
      this.registerEvent(
        this.app.vault.on("rename", (f) => this.enqueue(f))
      );
      // Optional: assign the ID on first edit instead of on creation
      // this.registerEvent(this.app.vault.on("modify", (f) => this.enqueue(f)));
    });

    // Manual trigger for the active note
    this.addCommand({
      id: "assign-id-to-current-note",
      name: "Assign ID to current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.enqueue(file);
        return true;
      },
    });
  }

  private enqueue(file: TAbstractFile) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    this.queue = this.queue
      .then(() => this.assignId(file))
      .catch((e) => console.error("[auto-id]", e));
  }

  private async assignId(file: TFile) {
    // File may have been deleted/renamed while waiting in the queue
    if (!this.app.vault.getAbstractFileByPath(file.path)) return;

    const folder = file.parent;
    if (!folder) return;

    const rule = this.settings.rules.find(
      (r) => r.folder && r.prefix && r.folder === folder.path
    );
    if (!rule) return;

    const pattern = new RegExp(`^${escapeRegex(rule.prefix)}-(\\d+)$`);

    // Already valid: nothing to do (also stops rename loops)
    if (pattern.test(file.basename)) return;

    // Let Obsidian/sync finish writing the file
    await new Promise((r) => setTimeout(r, 300));

    let max = 0;
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const m = child.basename.match(pattern);
      if (m && m[1] !== undefined) max = Math.max(max, parseInt(m[1], 10));
    }

    const newPath = `${folder.path}/${rule.prefix}-${max + 1}.${file.extension}`;
    await this.app.fileManager.renameFile(file, newPath);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}