import { App, Modal, Setting, TFile, ToggleComponent, Notice } from 'obsidian';
import { RecentActivitySettings } from '../types/settings';
import { createFileWithCollisionHandling } from '../utils/filename-utils';

export interface RecentActivityConfig extends RecentActivitySettings {
  rootNote?: TFile;
  selectedNotes?: TFile[];
  useDateRange?: boolean;
  fromDate?: string;
  toDate?: string;
}

interface NoteSelection {
  file: TFile;
  selected: boolean;
  modifiedTime: number;
}

export class RecentActivityModal extends Modal {
  private config: RecentActivityConfig;
  private onSubmit: (config: RecentActivityConfig) => void;
  private noteSelections: NoteSelection[] = [];
  private notesListEl: HTMLElement | null = null;
  private previewButton: HTMLElement | null = null;
  private daysBackSetting: Setting | null = null;
  private fromDateSetting: Setting | null = null;
  private toDateSetting: Setting | null = null;

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

    // Date range toggle
    new Setting(contentEl)
      .setName('Use specific date range')
      .setDesc('Toggle between "last N days" and specific date range')
      .addToggle(toggle => toggle
        .setValue(this.config.useDateRange || false)
        .onChange(async value => {
          this.config.useDateRange = value;
          this.refreshDateInputs();
          await this.updateNotesList();
        })
      );

    // Container for date inputs
    const dateInputsContainer = contentEl.createDiv('date-inputs-container');
    
    // Days back setting (shown when not using date range)
    const daysBackSetting = new Setting(dateInputsContainer)
      .setName('Days to look back')
      .setDesc('Include notes modified within this many days')
      .addText(text => text
        .setPlaceholder('7')
        .setValue(String(this.config.daysBack))
        .onChange(async value => {
          const days = parseInt(value);
          if (!isNaN(days) && days > 0) {
            this.config.daysBack = days;
            await this.updateNotesList();
          }
        })
      );

    // Date range inputs (shown when using date range)
    const fromDateSetting = new Setting(dateInputsContainer)
      .setName('From date')
      .setDesc('Start date for the range (YYYY-MM-DD)')
      .addText(text => {
        // Set default from date to 7 days ago
        if (!this.config.fromDate) {
          const defaultFrom = new Date();
          defaultFrom.setDate(defaultFrom.getDate() - 7);
          this.config.fromDate = defaultFrom.toISOString().split('T')[0];
        }
        
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.config.fromDate)
          .onChange(async value => {
            if (this.isValidDate(value)) {
              this.config.fromDate = value;
              await this.updateNotesList();
            }
          });
        
        // Add date input type for better UX
        text.inputEl.type = 'date';
      });

    const toDateSetting = new Setting(dateInputsContainer)
      .setName('To date')
      .setDesc('End date for the range (YYYY-MM-DD)')
      .addText(text => {
        // Set default to date to today
        if (!this.config.toDate) {
          this.config.toDate = new Date().toISOString().split('T')[0];
        }
        
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.config.toDate)
          .onChange(async value => {
            if (this.isValidDate(value)) {
              this.config.toDate = value;
              await this.updateNotesList();
            }
          });
        
        // Add date input type for better UX
        text.inputEl.type = 'date';
      });

    // Store references for show/hide
    this.daysBackSetting = daysBackSetting;
    this.fromDateSetting = fromDateSetting;
    this.toDateSetting = toDateSetting;
    
    // Initial visibility
    this.refreshDateInputs();

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
        .onChange(async value => {
          this.config.excludeFolders = value
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0);
          await this.updateNotesList();
        })
      );

    // Preview button to show/refresh the notes list
    const previewSetting = new Setting(contentEl)
      .setName('Select notes to include')
      .setDesc('Choose which notes to include in the distillation')
      .addButton(button => {
        this.previewButton = button.buttonEl;
        button
          .setButtonText('Select Notes')
          .onClick(async () => {
            if (this.notesListEl && this.notesListEl.style.display !== 'none') {
              // Hide the list
              this.notesListEl.style.display = 'none';
              button.setButtonText('Select Notes');
            } else {
              // Show/update the list
              await this.updateNotesList();
              if (this.notesListEl) {
                this.notesListEl.style.display = 'block';
              }
              button.setButtonText('Hide Selection');
            }
          });
      });

    // Container for the notes list (initially hidden)
    this.notesListEl = contentEl.createDiv('recent-notes-list');
    this.notesListEl.style.display = 'none';
    this.notesListEl.style.maxHeight = '300px';
    this.notesListEl.style.overflowY = 'auto';
    this.notesListEl.style.border = '1px solid var(--background-modifier-border)';
    this.notesListEl.style.borderRadius = '4px';
    this.notesListEl.style.padding = '10px';
    this.notesListEl.style.marginBottom = '20px';

    // Action buttons
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Save as Collection')
        .onClick(async () => {
          await this.saveAsCollection();
        })
      )
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Distill')
        .setCta()
        .onClick(() => {
          // Only include selected notes
          this.config.selectedNotes = this.noteSelections
            .filter(ns => ns.selected)
            .map(ns => ns.file);
          this.onSubmit(this.config);
          this.close();
        })
      );
  }

  private async updateNotesList(): Promise<void> {
    if (!this.notesListEl) return;

    // Clear existing content
    this.notesListEl.empty();

    // Show loading
    this.notesListEl.createEl('div', { 
      text: 'Loading recent notes...', 
      cls: 'loading-text' 
    });

    try {
      // Get recent notes using the distill service logic
      const files = await this.getRecentlyModifiedNotes(
        this.config.daysBack, 
        this.config.excludeFolders
      );

      // Clear loading text
      this.notesListEl.empty();

      if (files.length === 0) {
        this.notesListEl.createEl('div', { 
          text: 'No notes found in the specified time range.', 
          cls: 'no-notes-text' 
        });
        return;
      }

      // Create header with select all
      const headerEl = this.notesListEl.createDiv('notes-list-header');
      headerEl.style.marginBottom = '10px';
      headerEl.style.paddingBottom = '10px';
      headerEl.style.borderBottom = '1px solid var(--background-modifier-border)';
      
      // Create descriptive header text
      let headerText: string;
      if (this.config.useDateRange && this.config.fromDate && this.config.toDate) {
        headerText = `Found ${files.length} notes (${this.config.fromDate} to ${this.config.toDate})`;
      } else {
        headerText = `Found ${files.length} notes (last ${this.config.daysBack} days)`;
      }
      
      const selectAllSetting = new Setting(headerEl)
        .setName(headerText)
        .addToggle(toggle => toggle
          .setValue(true)
          .onChange(value => {
            // Update all selections
            this.noteSelections.forEach(ns => ns.selected = value);
            // Update all checkboxes
            this.notesListEl?.querySelectorAll('.note-checkbox input[type="checkbox"]')
              .forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = value;
              });
          })
        );

      // Initialize note selections
      this.noteSelections = await Promise.all(files.map(async file => {
        const stats = await this.app.vault.adapter.stat(file.path);
        return {
          file,
          selected: true,
          modifiedTime: stats?.mtime || 0
        };
      }));

      // Sort by modification time (most recent first)
      this.noteSelections.sort((a, b) => b.modifiedTime - a.modifiedTime);

      // Create individual note items
      const listEl = this.notesListEl.createDiv('notes-items');
      this.noteSelections.forEach((noteSelection, index) => {
        const itemEl = listEl.createDiv('note-item');
        itemEl.style.marginBottom = '8px';
        
        const itemSetting = new Setting(itemEl)
          .setClass('note-item-setting')
          .setName(noteSelection.file.basename)
          .setDesc(this.formatNoteInfo(noteSelection))
          .addToggle(toggle => {
            toggle
              .setValue(noteSelection.selected)
              .onChange(value => {
                noteSelection.selected = value;
                // Update select all toggle if needed
                const allSelected = this.noteSelections.every(ns => ns.selected);
                const selectAllToggle = headerEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
                if (selectAllToggle) {
                  selectAllToggle.checked = allSelected;
                }
              });
            toggle.toggleEl.addClass('note-checkbox');
          });
      });

    } catch (error) {
      console.error('Error loading recent notes:', error);
      this.notesListEl.empty();
      this.notesListEl.createEl('div', { 
        text: 'Error loading notes. Check console for details.', 
        cls: 'error-text' 
      });
    }
  }

  private formatNoteInfo(noteSelection: NoteSelection): string {
    const date = new Date(noteSelection.modifiedTime);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const folder = noteSelection.file.parent?.path || 'Root';
    return `${folder} • Modified: ${dateStr} ${timeStr}`;
  }

  private refreshDateInputs(): void {
    if (!this.daysBackSetting || !this.fromDateSetting || !this.toDateSetting) return;
    
    if (this.config.useDateRange) {
      // Hide days back, show date range
      this.daysBackSetting.settingEl.style.display = 'none';
      this.fromDateSetting.settingEl.style.display = '';
      this.toDateSetting.settingEl.style.display = '';
    } else {
      // Show days back, hide date range
      this.daysBackSetting.settingEl.style.display = '';
      this.fromDateSetting.settingEl.style.display = 'none';
      this.toDateSetting.settingEl.style.display = 'none';
    }
  }

  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  private async getRecentlyModifiedNotes(daysBack: number, excludeFolders: string[]): Promise<TFile[]> {
    let startTime: number;
    let endTime: number;
    
    if (this.config.useDateRange && this.config.fromDate && this.config.toDate) {
      // Use date range
      const fromDate = new Date(this.config.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      startTime = fromDate.getTime();
      
      const toDate = new Date(this.config.toDate);
      toDate.setHours(23, 59, 59, 999);
      endTime = toDate.getTime();
    } else {
      // Use days back
      endTime = Date.now();
      startTime = endTime - (daysBack * 24 * 60 * 60 * 1000);
    }
    
    const recentFiles: TFile[] = [];
    const files = this.app.vault.getMarkdownFiles();
    
    for (const file of files) {
      // Check if file is in excluded folder
      const isExcluded = excludeFolders.some(folder => 
        file.path.startsWith(folder + '/') || file.path.includes('/' + folder + '/')
      );
      
      if (isExcluded) {
        continue;
      }
      
      let includeFile = false;
      
      // Check if filename starts with a date (YYYY-MM-DD format)
      const dateMatch = file.basename.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const day = parseInt(dateMatch[3]);
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const fileDate = new Date(year, month - 1, day);
          const fileTime = fileDate.getTime();
          
          if (!isNaN(fileTime) && fileTime >= startTime && fileTime <= endTime) {
            includeFile = true;
          }
        }
      }
      
      // If not included by filename date, check modification time
      if (!includeFile) {
        const stats = await this.app.vault.adapter.stat(file.path);
        if (stats && stats.mtime >= startTime && stats.mtime <= endTime) {
          includeFile = true;
        }
      }
      
      if (includeFile) {
        recentFiles.push(file);
      }
    }
    
    return recentFiles;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Save the current selection as a collection note
   */
  private async saveAsCollection(): Promise<void> {
    if (this.noteSelections.length === 0) {
      new Notice('No notes to save. Please show and select notes first.');
      return;
    }

    // Generate collection content
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let timeWindowDesc: string;
    if (this.config.useDateRange && this.config.fromDate && this.config.toDate) {
      timeWindowDesc = `Date Range: ${this.config.fromDate} to ${this.config.toDate}`;
    } else {
      timeWindowDesc = `Last ${this.config.daysBack} days`;
    }
    
    let content = `# Recent Activity Collection
Created: ${dateStr} ${timeStr}
Time Window: ${timeWindowDesc}
${this.config.rootNote ? `Context Root: [[${this.config.rootNote.basename}]]` : ''}

## Notes

`;

    // Add notes with checkboxes
    const selectedCount = this.noteSelections.filter(ns => ns.selected).length;
    content += `Selected ${selectedCount} of ${this.noteSelections.length} notes:\n\n`;

    for (const noteSelection of this.noteSelections) {
      const checkbox = noteSelection.selected ? '[x]' : '[ ]';
      const date = new Date(noteSelection.modifiedTime);
      const modifiedStr = date.toLocaleDateString();
      content += `- ${checkbox} [[${noteSelection.file.basename}]] - Modified: ${modifiedStr}\n`;
    }

    // Add instructions
    content += `\n## Instructions

This collection was generated from recent activity. You can:
1. Check/uncheck notes to adjust the selection
2. Run "Distill Linked Notes" on this note to process the checked items
3. Add additional notes manually using standard Obsidian links

## Configuration

The following settings were used:
- Time window: ${timeWindowDesc}
- Filter journal sections: ${this.config.filterJournalSections}
- Excluded folders: ${this.config.excludeFolders.join(', ')}
`;

    // Create the collection file
    try {
      const collectionsFolder = 'OpenAugi/Collections';
      
      // Ensure collections folder exists
      if (!await this.app.vault.adapter.exists(collectionsFolder)) {
        await this.app.vault.createFolder(collectionsFolder);
      }

      const timestamp = now.toISOString()
        .replace(/T/, ' ')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
      const filename = `Recent Activity ${timestamp}.md`;
      const filepath = `${collectionsFolder}/${filename}`;
      
      const createdPath = await createFileWithCollisionHandling(
        this.app.vault,
        filepath,
        content
      );

      new Notice(`Collection saved to ${createdPath}`);
      
      // Open the created file
      const file = this.app.vault.getAbstractFileByPath(createdPath);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(file);
      }
    } catch (error) {
      console.error('Failed to save collection:', error);
      new Notice('Failed to save collection. Check console for details.');
    }
  }
}