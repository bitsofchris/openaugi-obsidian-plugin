import { App, Modal, Setting } from 'obsidian';
import { DiscoveredNote } from '../types/context';

export class ContextSelectionModal extends Modal {
  private discoveredNotes: DiscoveredNote[];
  private onSubmit: (selectedNotes: DiscoveredNote[]) => void;
  private checkboxStates: Map<string, boolean>;
  private summaryEl: HTMLElement;

  constructor(
    app: App,
    discoveredNotes: DiscoveredNote[],
    onSubmit: (selectedNotes: DiscoveredNote[]) => void
  ) {
    super(app);
    this.discoveredNotes = discoveredNotes;
    this.onSubmit = onSubmit;
    this.checkboxStates = new Map();

    // Initialize checkbox states from included property
    discoveredNotes.forEach(note => {
      this.checkboxStates.set(note.file.path, note.included);
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('openaugi-selection-modal');

    contentEl.createEl('h2', { text: 'Select Notes to Include' });

    contentEl.createEl('p', {
      text: 'Review and select which notes to include in the gathered context.',
      cls: 'setting-item-description'
    });

    // Summary stats
    this.summaryEl = contentEl.createDiv({ cls: 'selection-summary' });
    this.summaryEl.style.padding = '10px';
    this.summaryEl.style.marginBottom = '15px';
    this.summaryEl.style.backgroundColor = 'var(--background-secondary)';
    this.summaryEl.style.borderRadius = '5px';
    this.updateSummary();

    // Select all / Deselect all buttons
    new Setting(contentEl)
      .setName('Quick actions')
      .addButton(button => button
        .setButtonText('Select All')
        .onClick(() => {
          this.discoveredNotes.forEach(note => {
            this.checkboxStates.set(note.file.path, true);
          });
          this.renderNoteList();
        })
      )
      .addButton(button => button
        .setButtonText('Deselect All')
        .onClick(() => {
          this.discoveredNotes.forEach(note => {
            this.checkboxStates.set(note.file.path, false);
          });
          this.renderNoteList();
        })
      );

    // Scrollable list of checkboxes
    const listContainer = contentEl.createDiv({ cls: 'note-list-container' });
    listContainer.style.maxHeight = '400px';
    listContainer.style.overflowY = 'auto';
    listContainer.style.border = '1px solid var(--background-modifier-border)';
    listContainer.style.padding = '10px';
    listContainer.style.marginBottom = '20px';
    listContainer.style.borderRadius = '5px';

    this.renderNoteListInContainer(listContainer);

    // Action buttons
    const totalSelected = Array.from(this.checkboxStates.values()).filter(v => v).length;

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Back')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Continue')
        .setCta()
        .setDisabled(totalSelected === 0)
        .onClick(() => {
          // Update included property based on checkboxes
          this.discoveredNotes.forEach(note => {
            note.included = this.checkboxStates.get(note.file.path) || false;
          });
          this.onSubmit(this.discoveredNotes.filter(n => n.included));
          this.close();
        })
      );
  }

  private renderNoteList() {
    // Find and re-render the list container
    const listContainer = this.contentEl.querySelector('.note-list-container');
    if (listContainer) {
      listContainer.empty();
      this.renderNoteListInContainer(listContainer as HTMLElement);
    }
    this.updateSummary();
  }

  private renderNoteListInContainer(listContainer: HTMLElement) {
    // Group by depth for linked notes
    const byDepth = new Map<number, DiscoveredNote[]>();
    this.discoveredNotes.forEach(note => {
      if (!byDepth.has(note.depth)) {
        byDepth.set(note.depth, []);
      }
      byDepth.get(note.depth)!.push(note);
    });

    // Render notes grouped by depth
    const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);

    sortedDepths.forEach(depth => {
      const notes = byDepth.get(depth)!;

      // Depth header
      if (sortedDepths.length > 1 && depth > 0) {
        const depthHeader = listContainer.createEl('div', {
          cls: 'depth-header',
          text: `📁 Level ${depth}`
        });
        depthHeader.style.fontWeight = 'bold';
        depthHeader.style.marginTop = depth > 0 ? '15px' : '0';
        depthHeader.style.marginBottom = '5px';
        depthHeader.style.color = 'var(--text-muted)';
      } else if (depth === 0 && sortedDepths.length > 1) {
        const depthHeader = listContainer.createEl('div', {
          cls: 'depth-header',
          text: '📄 Root Note'
        });
        depthHeader.style.fontWeight = 'bold';
        depthHeader.style.marginBottom = '5px';
        depthHeader.style.color = 'var(--text-muted)';
      }

      // Notes at this depth
      notes.forEach(note => {
        const noteEl = listContainer.createDiv({ cls: 'note-item' });
        noteEl.style.display = 'flex';
        noteEl.style.alignItems = 'center';
        noteEl.style.padding = '8px';
        noteEl.style.marginLeft = `${depth * 20}px`;  // Indent by depth
        noteEl.style.borderRadius = '3px';
        noteEl.style.cursor = 'pointer';

        // Hover effect
        noteEl.addEventListener('mouseenter', () => {
          noteEl.style.backgroundColor = 'var(--background-secondary-alt)';
        });
        noteEl.addEventListener('mouseleave', () => {
          noteEl.style.backgroundColor = 'transparent';
        });

        const checkbox = noteEl.createEl('input', { type: 'checkbox' });
        checkbox.checked = this.checkboxStates.get(note.file.path) || false;
        checkbox.style.marginRight = '10px';
        checkbox.style.cursor = 'pointer';
        checkbox.addEventListener('change', () => {
          this.checkboxStates.set(note.file.path, checkbox.checked);
          this.updateSummary();
        });

        // Make the whole row clickable
        noteEl.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            this.checkboxStates.set(note.file.path, checkbox.checked);
            this.updateSummary();
          }
        });

        const contentDiv = noteEl.createDiv();
        contentDiv.style.flex = '1';
        contentDiv.style.display = 'flex';
        contentDiv.style.flexDirection = 'column';
        contentDiv.style.gap = '2px';

        const titleEl = contentDiv.createEl('span');
        titleEl.setText(note.file.basename);
        titleEl.style.fontWeight = '500';

        const metaEl = contentDiv.createEl('span');
        metaEl.style.fontSize = '0.85em';
        metaEl.style.color = 'var(--text-muted)';
        const sizeKb = (note.estimatedChars / 1000).toFixed(1);
        metaEl.setText(`${sizeKb}k chars · ${note.discoveredVia}`);
      });
    });

    // Show message if no notes
    if (this.discoveredNotes.length === 0) {
      const emptyEl = listContainer.createEl('div');
      emptyEl.style.textAlign = 'center';
      emptyEl.style.padding = '20px';
      emptyEl.style.color = 'var(--text-muted)';
      emptyEl.setText('No notes discovered');
    }
  }

  private updateSummary() {
    const totalSelected = Array.from(this.checkboxStates.values()).filter(v => v).length;
    const totalChars = this.discoveredNotes
      .filter(n => this.checkboxStates.get(n.file.path))
      .reduce((sum, n) => sum + n.estimatedChars, 0);

    this.summaryEl.setText(
      `✓ Selected: ${totalSelected} of ${this.discoveredNotes.length} notes (${totalChars.toLocaleString()} characters, ~${Math.ceil(totalChars / 4).toLocaleString()} tokens)`
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
