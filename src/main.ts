import { Plugin, TAbstractFile, TFile } from "obsidian";
import { AutoIdSettings, AutoIdSettingTab, normalizeSettings } from "./settings";
import { assignId } from "./id";
import { applyTemplate, isEmptyNote } from "./template";
import { promptTitle } from "./title";

export default class AutoIdPlugin extends Plugin {
  settings!: AutoIdSettings;

  // Serializes ID + template work so two quick creations can't grab the same number
  private queue: Promise<void> = Promise.resolve();

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AutoIdSettingTab(this.app, this));

    // Skip the burst of 'create' events fired while the vault indexes at startup
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", (f) => this.enqueue(f)));
    });
  }

  private enqueue(file: TAbstractFile) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    this.queue = this.queue
      .then(() => this.process(file))
      .catch((e) => console.error("[auto-id]", e));
  }

  private async process(file: TFile) {
    // Let Obsidian/Bases/sync finish writing the file
    //await sleep(300);
    if (!this.app.vault.getAbstractFileByPath(file.path)) return;

    const rule = this.settings.rules.find(
      (r) => r.folder && r.prefix && r.folder === file.parent?.path
    );
    if (!rule) return;

    // Evaluated before anything is written, so template and title only apply to new, empty notes
    const isNew = await isEmptyNote(this.app, file);

    await assignId(this.app, file, rule);
    if (!isNew) return;

    await applyTemplate(this.app, file, rule);

    // Not awaited: waiting on the user must not block the queue
    void promptTitle(this.app, file, this.settings.titleKey).catch((e) =>
      console.error("[auto-id]", e)
    );
  }

  async loadSettings() {
    this.settings = normalizeSettings(
      (await this.loadData()) as Partial<AutoIdSettings> | null
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}