import { App, PluginSettingTab, Setting } from "obsidian";
import type AutoIdPlugin from "./main";

export interface FolderRule {
  folder: string; // vault-relative folder path, e.g. "questions" or "work/projects"
  prefix: string; // e.g. "Q"
}

export interface AutoIdSettings {
  rules: FolderRule[];
}

export const DEFAULT_SETTINGS: AutoIdSettings = {
  rules: [
    { folder: "questions", prefix: "Q" },
    { folder: "projects", prefix: "P" },
  ],
};

export class AutoIdSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AutoIdPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Auto ID" });
    containerEl.createEl("p", {
      text: "Notes created in or moved into a folder are renamed to PREFIX-N. Folder paths are vault-relative.",
      cls: "setting-item-description",
    });

    this.plugin.settings.rules.forEach((rule, index) => {
      new Setting(containerEl)
        .addText((t) =>
          t
            .setPlaceholder("Folder path")
            .setValue(rule.folder)
            .onChange(async (v) => {
              rule.folder = v.trim().replace(/^\/+|\/+$/g, "");
              await this.plugin.saveSettings();
            })
        )
        .addText((t) => {
          t.setPlaceholder("Letter")
            .setValue(rule.prefix)
            .onChange(async (v) => {
              rule.prefix = v.trim();
              await this.plugin.saveSettings();
            });
          t.inputEl.style.width = "4em";
        })
        .addExtraButton((b) =>
          b
            .setIcon("trash")
            .setTooltip("Remove")
            .onClick(async () => {
              this.plugin.settings.rules.splice(index, 1);
              await this.plugin.saveSettings();
              this.display();
            })
        );
    });

    new Setting(containerEl).addButton((b) =>
      b
        .setButtonText("Add folder")
        .setCta()
        .onClick(async () => {
          this.plugin.settings.rules.push({ folder: "", prefix: "" });
          await this.plugin.saveSettings();
          this.display();
        })
    );
  }
}