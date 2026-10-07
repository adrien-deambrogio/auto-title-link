import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type AutoIdPlugin from "./main";
import { resolveTemplate } from "./template";

export interface FolderRule {
  folder: string; // vault-relative folder path, e.g. "questions" or "work/projects"
  prefix: string; // e.g. "Q" -> Q-1, Q-2...
  templatePath: string; // vault-relative path of the template note, e.g. "templates/Question"
}

export interface AutoIdSettings {
  titleKey: string; // frontmatter property that receives the prompted title
  rules: FolderRule[];
}

const DEFAULT_RULE: FolderRule = {
  folder: "",
  prefix: "",
  templatePath: "",
};

export const DEFAULT_SETTINGS: AutoIdSettings = {
  titleKey: "title",
  rules: [],
};

// Fills in missing fields, e.g. when loading data saved by an older version
export function normalizeSettings(
  data: Partial<AutoIdSettings> | null
): AutoIdSettings {
  const rules = (data?.rules ?? DEFAULT_SETTINGS.rules).map((r) => ({
    ...DEFAULT_RULE,
    ...r,
  }));
  return {
    titleKey: data?.titleKey?.trim() || DEFAULT_SETTINGS.titleKey,
    rules,
  };
}

// Characters that can't appear in a file name or would break links
const INVALID_PREFIX_CHARS = /[\\/:*?"<>|#^[\]]/;

export class AutoIdSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AutoIdPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Title property")
      .setDesc("Frontmatter key that receives the title you enter after creating a note.")
      .addText((t) =>
        t
          .setPlaceholder("Title")
          .setValue(this.plugin.settings.titleKey)
          .onChange(async (v) => {
            this.plugin.settings.titleKey = v.trim() || "title";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName("Folders").setHeading();
    containerEl.createEl("p", {
      text: "Notes created in a folder are renamed to PREFIX-N. Folder and template paths are vault-relative.",
      cls: "setting-item-description",
    });

    this.plugin.settings.rules.forEach((rule, index) =>
      this.renderRule(containerEl, rule, index)
    );

    new Setting(containerEl).addButton((b) =>
      b
        .setButtonText("Add folder")
        .setCta()
        .onClick(async () => {
          this.plugin.settings.rules.push({ ...DEFAULT_RULE });
          await this.plugin.saveSettings();
          this.display();
        })
    );
  }

  private renderRule(containerEl: HTMLElement, rule: FolderRule, index: number) {
    new Setting(containerEl)
      .setName(`Folder ${index + 1}`)
      .addText((t) =>
        t
          .setPlaceholder("Folder path")
          .setValue(rule.folder)
          .onChange(async (v) => {
            const path = v.trim();
            rule.folder = path ? normalizePath(path) : "";
            await this.plugin.saveSettings();
          })
      )
      .addText((t) => {
        t.setPlaceholder("Prefix")
          .setValue(rule.prefix)
          .onChange(async (v) => {
            const invalid = INVALID_PREFIX_CHARS.test(v);
            t.inputEl.toggleClass("mod-error", invalid);
            if (invalid) return;
            rule.prefix = v.trim();
            await this.plugin.saveSettings();
          });
        t.inputEl.setCssProps({ width: "5em" });
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

    const templateSetting = new Setting(containerEl)
      .setDesc(this.templateStatus(rule.templatePath))
      .addText((t) =>
        t
          .setPlaceholder("Template path")
          .setValue(rule.templatePath)
          .onChange(async (v) => {
            const path = v.trim();
            rule.templatePath = path ? normalizePath(path) : "";
            templateSetting.setDesc(this.templateStatus(rule.templatePath));
            await this.plugin.saveSettings();
          })
      );
  }

  private templateStatus(path: string): string {
    if (!path) return "No template: only the ID and title steps run.";
    return resolveTemplate(this.app, path)
      ? "Template found."
      : "Warning: template not found in the vault.";
  }
}