import { App, Modal, Setting, TFile } from "obsidian";

class TitleModal extends Modal {
  private value = "";
  private submitted = false;

  constructor(app: App, private onDone: (title: string) => void) {
    super(app);
  }

  onOpen() {
    this.setTitle("Note title");

    new Setting(this.contentEl)
      .addText((t) => {
        t.setPlaceholder("Title").onChange((v) => (this.value = v));
        t.inputEl.focus();
      })
      .addButton((b) =>
        b
          .setButtonText("Save")
          .setCta()
          .onClick(() => this.submit())
      );

    // Enter confirms; Esc is handled by Modal and cancels
    this.scope.register([], "Enter", () => {
      this.submit();
      return false;
    });
  }

  private submit() {
    this.submitted = true;
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    // Cancelling (Esc) or an empty title reports an empty string
    this.onDone(this.submitted ? this.value.trim() : "");
  }
}

/** Asks for a title and stores it in the frontmatter. Cancelling leaves the note untouched. */
export async function promptTitle(
  app: App,
  file: TFile,
  key: string
): Promise<void> {
  const title = await new Promise<string>((resolve) =>
    new TitleModal(app, resolve).open()
  );
  if (!title) return;

  await app.fileManager.processFrontMatter(file, (fm) => {
    fm[key] = title;
  });
}