import { App, Modal, Setting } from 'obsidian';
import { ContextGatheringConfig } from '../types/context';
import { OpenAugiSettings } from '../types/settings';
import { ContextGatheringService } from '../services/context-gathering-service';

export class ContextGatheringModal extends Modal {
  private config: ContextGatheringConfig;
  private onSubmit: (config: ContextGatheringConfig) => void;
  private settings: OpenAugiSettings;
  private contextService: ContextGatheringService;
  private estimateEl: HTMLElement;
  private modeSpecificContainer: HTMLElement;

  constructor(
    app: App,
    settings: OpenAugiSettings,
    contextService: ContextGatheringService,
    onSubmit: (config: ContextGatheringConfig) => void,
    defaultSourceMode: 'linked-notes' | 'recent-activity' = 'linked-notes',
    defaultDepth: number = 1
  ) {
    super(app);
    this.settings = settings;
    this.contextService = contextService;
    this.onSubmit = onSubmit;

    // Initialize with defaults
    this.config = {
      sourceMode: defaultSourceMode,
      rootNote: app.workspace.getActiveFile() || undefined,
      linkDepth: defaultDepth,
      maxCharacters: settings.contextGatheringDefaults.maxCharacters,
      excludeFolders: settings.recentActivityDefaults.excludeFolders,
      filterRecentSectionsOnly: settings.contextGatheringDefaults.filterRecentSectionsOnly,
      dateHeaderFormat: settings.recentActivityDefaults.dateHeaderFormat,
      journalSectionDays: settings.recentActivityDefaults.daysBack
    };
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('openaugi-context-modal');

    contentEl.createEl('h2', { text: 'Gather Context' });

    contentEl.createEl('p', {
      text: 'Configure how to discover and gather notes for processing.',
      cls: 'setting-item-description'
    });

    // Source mode selection
    new Setting(contentEl)
      .setName('Source')
      .setDesc('How to discover notes')
      .addDropdown(dropdown => {
        dropdown
          .addOption('linked-notes', 'Linked notes from current note')
          .addOption('recent-activity', 'Recently modified notes')
          .setValue(this.config.sourceMode)
          .onChange(async (value: 'linked-notes' | 'recent-activity') => {
            this.config.sourceMode = value;
            await this.renderModeSpecificSettings();
            await this.updateEstimate();
          });
      });

    // Container for mode-specific settings
    this.modeSpecificContainer = contentEl.createDiv({ cls: 'mode-specific-settings' });
    await this.renderModeSpecificSettings();

    // Folder filtering
    new Setting(contentEl)
      .setName('Exclude folders')
      .setDesc('Comma-separated list of folders to exclude')
      .addText(text => {
        text
          .setPlaceholder('Templates, Archive, OpenAugi')
          .setValue(this.config.excludeFolders.join(', '))
          .onChange(async value => {
            this.config.excludeFolders = value
              .split(',')
              .map(f => f.trim())
              .filter(f => f.length > 0);
            await this.updateEstimate();
          });
      });

    // Recent sections filtering
    new Setting(contentEl)
      .setName('Recent sections only')
      .setDesc('For journal-style notes with date headers, only include recent sections')
      .addToggle(toggle => {
        toggle
          .setValue(this.config.filterRecentSectionsOnly)
          .onChange(async value => {
            this.config.filterRecentSectionsOnly = value;
            if (value) {
              await this.showJournalDaysInput();
            }
          });
      });

    // Journal days input (conditional)
    if (this.config.filterRecentSectionsOnly) {
      await this.showJournalDaysInput();
    }

    // Estimate display
    this.estimateEl = contentEl.createDiv({ cls: 'context-estimate' });
    this.estimateEl.style.padding = '10px';
    this.estimateEl.style.marginTop = '10px';
    this.estimateEl.style.backgroundColor = 'var(--background-secondary)';
    this.estimateEl.style.borderRadius = '5px';
    await this.updateEstimate();

    // Action buttons
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Discover Notes')
        .setCta()
        .onClick(() => {
          this.onSubmit(this.config);
          this.close();
        })
      );
  }

  private async renderModeSpecificSettings() {
    this.modeSpecificContainer.empty();

    if (this.config.sourceMode === 'linked-notes') {
      this.renderLinkedNotesSettings();
    } else {
      this.renderRecentActivitySettings();
    }
  }

  private renderLinkedNotesSettings() {
    // Root note display
    if (this.config.rootNote) {
      new Setting(this.modeSpecificContainer)
        .setName('Root note')
        .setDesc('Starting note for link traversal')
        .addText(text => {
          text
            .setValue(this.config.rootNote!.basename)
            .setDisabled(true);
        });
    } else {
      const noNoteEl = this.modeSpecificContainer.createDiv();
      noNoteEl.style.padding = '10px';
      noNoteEl.style.color = 'var(--text-error)';
      noNoteEl.setText('⚠️ No active note. Please open a note first.');
    }

    // Link depth slider
    new Setting(this.modeSpecificContainer)
      .setName('Link depth')
      .setDesc('How many levels of links to traverse (1-3)')
      .addSlider(slider => {
        slider
          .setLimits(1, 3, 1)
          .setValue(this.config.linkDepth)
          .setDynamicTooltip()
          .onChange(async value => {
            this.config.linkDepth = value;
            await this.updateEstimate();
          });
      })
      .addExtraButton(button => {
        button.setIcon('info');
        button.setTooltip('Depth 1: direct links only\nDepth 2: links of links\nDepth 3: three levels deep');
      });

    // Character limit
    new Setting(this.modeSpecificContainer)
      .setName('Max characters')
      .setDesc('Stop gathering when this many characters collected')
      .addText(text => {
        text
          .setPlaceholder('100000')
          .setValue(String(this.config.maxCharacters))
          .onChange(async value => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.config.maxCharacters = num;
              await this.updateEstimate();
            }
          });
      });
  }

  private renderRecentActivitySettings() {
    // Initialize time window if not set
    if (!this.config.timeWindow) {
      this.config.timeWindow = {
        mode: 'days-back',
        daysBack: this.settings.recentActivityDefaults.daysBack
      };
    }

    // Time window mode
    new Setting(this.modeSpecificContainer)
      .setName('Time window')
      .setDesc('How to select recent notes')
      .addDropdown(dropdown => {
        dropdown
          .addOption('days-back', 'Last N days')
          .addOption('date-range', 'Specific date range')
          .setValue(this.config.timeWindow!.mode)
          .onChange(async (value: 'days-back' | 'date-range') => {
            this.config.timeWindow!.mode = value;
            await this.renderModeSpecificSettings();
            await this.updateEstimate();
          });
      });

    // Days back or date range inputs
    if (this.config.timeWindow.mode === 'days-back') {
      new Setting(this.modeSpecificContainer)
        .setName('Days back')
        .setDesc('Number of days to look back')
        .addText(text => {
          text
            .setPlaceholder('7')
            .setValue(String(this.config.timeWindow!.daysBack || 7))
            .onChange(async value => {
              const days = parseInt(value);
              if (!isNaN(days) && days > 0) {
                this.config.timeWindow!.daysBack = days;
                await this.updateEstimate();
              }
            });
        });
    } else {
      // Date range inputs
      new Setting(this.modeSpecificContainer)
        .setName('From date')
        .setDesc('Start date (YYYY-MM-DD)')
        .addText(text => {
          text
            .setPlaceholder('YYYY-MM-DD')
            .setValue(this.config.timeWindow!.fromDate || '')
            .onChange(async value => {
              this.config.timeWindow!.fromDate = value;
              await this.updateEstimate();
            });
        });

      new Setting(this.modeSpecificContainer)
        .setName('To date')
        .setDesc('End date (YYYY-MM-DD)')
        .addText(text => {
          text
            .setPlaceholder('YYYY-MM-DD')
            .setValue(this.config.timeWindow!.toDate || '')
            .onChange(async value => {
              this.config.timeWindow!.toDate = value;
              await this.updateEstimate();
            });
        });
    }
  }

  private async showJournalDaysInput() {
    // Check if input already exists
    const existingInput = this.contentEl.querySelector('.journal-days-setting');
    if (existingInput) {
      return;
    }

    new Setting(this.contentEl)
      .setName('Journal sections days back')
      .setDesc('For journal filtering, how many days back to include sections')
      .setClass('journal-days-setting')
      .addText(text => {
        text
          .setPlaceholder('7')
          .setValue(String(this.config.journalSectionDays || 7))
          .onChange(value => {
            const days = parseInt(value);
            if (!isNaN(days) && days > 0) {
              this.config.journalSectionDays = days;
            }
          });
      });
  }

  private async updateEstimate() {
    if (!this.estimateEl) {
      return;
    }

    if (!this.config.rootNote && this.config.sourceMode === 'linked-notes') {
      this.estimateEl.setText('⚠️ No active note selected');
      return;
    }

    try {
      const estimate = await this.contextService.estimateSize(
        this.config.rootNote,
        this.config.sourceMode,
        this.config.linkDepth
      );

      this.estimateEl.setText(
        `📊 Estimated: ${estimate.noteCount} notes, ~${estimate.estimatedChars.toLocaleString()} characters`
      );
    } catch (error) {
      console.warn('Failed to estimate size:', error);
      this.estimateEl.setText('⚠️ Unable to estimate size');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
