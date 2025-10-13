import { App, Modal, Setting } from 'obsidian';
import { GatheredContext } from '../types/context';

export class ContextPreviewModal extends Modal {
  private context: GatheredContext;
  private onSaveRaw: () => void;
  private onProcess: () => void;
  private processButtonLabel: string;

  constructor(
    app: App,
    context: GatheredContext,
    onSaveRaw: () => void,
    onProcess: () => void,
    processButtonLabel: string = 'Process with AI'
  ) {
    super(app);
    this.context = context;
    this.onSaveRaw = onSaveRaw;
    this.onProcess = onProcess;
    this.processButtonLabel = processButtonLabel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('openaugi-preview-modal');

    contentEl.createEl('h2', { text: 'Context Preview' });

    contentEl.createEl('p', {
      text: 'Review the gathered context before processing or saving.',
      cls: 'setting-item-description'
    });

    // Summary stats
    const statsEl = contentEl.createDiv({ cls: 'context-stats' });
    statsEl.style.padding = '15px';
    statsEl.style.marginBottom = '15px';
    statsEl.style.backgroundColor = 'var(--background-secondary)';
    statsEl.style.borderRadius = '5px';

    const statsTitle = statsEl.createEl('h3', { text: '📊 Summary' });
    statsTitle.style.marginTop = '0';
    statsTitle.style.marginBottom = '10px';

    statsEl.createEl('p', {
      text: `Notes: ${this.context.totalNotes} notes`
    });
    statsEl.createEl('p', {
      text: `Characters: ${this.context.totalCharacters.toLocaleString()}`
    });
    statsEl.createEl('p', {
      text: `Estimated tokens: ~${Math.ceil(this.context.totalCharacters / 4).toLocaleString()}`
    });
    statsEl.createEl('p', {
      text: `Source: ${this.context.config.sourceMode === 'linked-notes' ? 'Linked notes' : 'Recent activity'}`
    });

    if (this.context.config.sourceMode === 'linked-notes') {
      statsEl.createEl('p', {
        text: `Link depth: ${this.context.config.linkDepth}`
      });
    }

    // List of included notes
    const notesListEl = contentEl.createDiv({ cls: 'notes-list' });
    notesListEl.style.marginBottom = '15px';

    notesListEl.createEl('h3', { text: '📝 Included Notes' });

    const listEl = notesListEl.createEl('ul');
    listEl.style.maxHeight = '150px';
    listEl.style.overflowY = 'auto';
    listEl.style.padding = '10px';
    listEl.style.margin = '0';
    listEl.style.backgroundColor = 'var(--background-primary-alt)';
    listEl.style.borderRadius = '5px';
    listEl.style.listStyle = 'none';

    this.context.notes.forEach(note => {
      const itemEl = listEl.createEl('li');
      itemEl.style.padding = '5px';
      itemEl.style.borderBottom = '1px solid var(--background-modifier-border)';

      const titleEl = itemEl.createEl('span');
      titleEl.setText(note.file.basename);
      titleEl.style.fontWeight = '500';

      if (note.depth > 0) {
        const depthBadge = itemEl.createEl('span');
        depthBadge.setText(` (L${note.depth})`);
        depthBadge.style.fontSize = '0.85em';
        depthBadge.style.color = 'var(--text-muted)';
        depthBadge.style.marginLeft = '5px';
      }

      const sizeEl = itemEl.createEl('span');
      sizeEl.setText(` · ${(note.estimatedChars / 1000).toFixed(1)}k chars`);
      sizeEl.style.fontSize = '0.85em';
      sizeEl.style.color = 'var(--text-muted)';
      sizeEl.style.marginLeft = '5px';
    });

    // Content preview (first 1000 chars)
    const previewEl = contentEl.createDiv({ cls: 'content-preview' });
    previewEl.style.marginBottom = '20px';

    previewEl.createEl('h3', { text: '👁️ Content Preview' });

    const preText = previewEl.createEl('pre');
    preText.style.maxHeight = '200px';
    preText.style.overflowY = 'auto';
    preText.style.padding = '10px';
    preText.style.backgroundColor = 'var(--background-primary-alt)';
    preText.style.border = '1px solid var(--background-modifier-border)';
    preText.style.borderRadius = '5px';
    preText.style.fontSize = '0.9em';
    preText.style.whiteSpace = 'pre-wrap';
    preText.style.wordWrap = 'break-word';

    const preview = this.context.aggregatedContent.substring(0, 1000);
    const hasMore = this.context.aggregatedContent.length > 1000;
    preText.setText(preview + (hasMore ? '\n\n...(truncated)' : ''));

    // Action buttons
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Back')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Save Raw Context')
        .setTooltip('Save the gathered context as a note without AI processing')
        .onClick(() => {
          this.onSaveRaw();
          this.close();
        })
      )
      .addButton(button => button
        .setButtonText(this.processButtonLabel)
        .setCta()
        .setTooltip('Continue to process this context with AI')
        .onClick(() => {
          this.onProcess();
          this.close();
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
