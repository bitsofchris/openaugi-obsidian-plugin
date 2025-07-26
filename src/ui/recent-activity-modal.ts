import { App, Modal, Setting, TFile } from 'obsidian';
import { RecentActivitySettings } from '../types/settings';

export interface RecentActivityConfig extends RecentActivitySettings {
  rootNote?: TFile;
}

export class RecentActivityModal extends Modal {
  private config: RecentActivityConfig;
  private onSubmit: (config: RecentActivityConfig) => void;

  constructor(
    app: App, 
    defaultConfig: RecentActivitySettings,
    onSubmit: (config: RecentActivityConfig) => void
  ) {
    super(app);
    this.config = { ...defaultConfig };
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Configure Recent Activity Distillation' });

    new Setting(contentEl)
      .setName('Days to look back')
      .setDesc('Include notes modified within this many days')
      .addText(text => text
        .setPlaceholder('7')
        .setValue(String(this.config.daysBack))
        .onChange(value => {
          const days = parseInt(value);
          if (!isNaN(days) && days > 0) {
            this.config.daysBack = days;
          }
        })
      );

    new Setting(contentEl)
      .setName('Filter journal sections by date')
      .setDesc('For notes with date headers, only include sections within the time window')
      .addToggle(toggle => toggle
        .setValue(this.config.filterJournalSections)
        .onChange(value => {
          this.config.filterJournalSections = value;
        })
      );

    new Setting(contentEl)
      .setName('Root note for context (optional)')
      .setDesc('Enter the name of a note to provide additional context. Leave empty to skip.')
      .addText(text => text
        .setPlaceholder('Note name (without .md)')
        .setValue(this.config.rootNote?.basename || '')
        .onChange(value => {
          if (value) {
            // Try to find the file
            const files = this.app.vault.getMarkdownFiles();
            const matchingFile = files.find(f => 
              f.basename.toLowerCase() === value.toLowerCase() ||
              f.path.toLowerCase() === value.toLowerCase() ||
              f.path.toLowerCase() === value.toLowerCase() + '.md'
            );
            
            if (matchingFile) {
              this.config.rootNote = matchingFile;
            }
          } else {
            this.config.rootNote = undefined;
          }
        })
      );

    new Setting(contentEl)
      .setName('Exclude folders')
      .setDesc('Comma-separated list of folders to exclude (e.g., Templates, Archive)')
      .addText(text => text
        .setPlaceholder('Templates, Archive, OpenAugi')
        .setValue(this.config.excludeFolders.join(', '))
        .onChange(value => {
          this.config.excludeFolders = value
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0);
        })
      );

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Distill')
        .setCta()
        .onClick(() => {
          this.onSubmit(this.config);
          this.close();
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}