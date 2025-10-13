import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type OpenAugiPlugin from '../types/plugin';

export class OpenAugiSettingTab extends PluginSettingTab {
  plugin: OpenAugiPlugin;

  constructor(app: App, plugin: OpenAugiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('OpenAI API key')
      .setDesc('Your OpenAI API key')
      .addText(text => text
        .setPlaceholder('sk-...')
        .setValue(this.plugin.settings.apiKey)
        .inputEl.type = 'password'
      )
      .addButton(button => button
        .setButtonText(this.plugin.settings.apiKey ? 'Update' : 'Save')
        .onClick(async () => {
          const inputEl = button.buttonEl.parentElement?.querySelector('input');
          if (inputEl) {
            this.plugin.settings.apiKey = inputEl.value;
            await this.plugin.saveSettings();
            new Notice('API Key saved');
            button.setButtonText('Update');
          }
        })
      );
    
    new Setting(containerEl)
      .setName('Summaries folder')
      .setDesc('Folder path where summary files will be saved')
      .addText(text => {
        text
          .setPlaceholder('OpenAugi/Summaries')
          .setValue(this.plugin.settings.summaryFolder);
        
        // Save only when input loses focus
        text.inputEl.addEventListener('blur', async () => {
          const value = text.getValue();
          if (value !== this.plugin.settings.summaryFolder) {
            this.plugin.settings.summaryFolder = value;
            await this.plugin.saveSettings();
            // Ensure directories exist after folder path changes
            await this.plugin.fileService.ensureDirectoriesExist();
          }
        });
        
        return text;
      });
      
    new Setting(containerEl)
      .setName('Notes folder')
      .setDesc('Folder path where atomic notes will be saved')
      .addText(text => {
        text
          .setPlaceholder('OpenAugi/Notes')
          .setValue(this.plugin.settings.notesFolder);
        
        // Save only when input loses focus
        text.inputEl.addEventListener('blur', async () => {
          const value = text.getValue();
          if (value !== this.plugin.settings.notesFolder) {
            this.plugin.settings.notesFolder = value;
            await this.plugin.saveSettings();
            // Ensure directories exist after folder path changes
            await this.plugin.fileService.ensureDirectoriesExist();
          }
        });
        
        return text;
      });
      
    new Setting(containerEl)
      .setName('Prompts folder')
      .setDesc('Folder path where custom prompt templates are stored')
      .addText(text => {
        text
          .setPlaceholder('OpenAugi/Prompts')
          .setValue(this.plugin.settings.promptsFolder);

        // Save only when input loses focus
        text.inputEl.addEventListener('blur', async () => {
          const value = text.getValue();
          if (value !== this.plugin.settings.promptsFolder) {
            this.plugin.settings.promptsFolder = value;
            await this.plugin.saveSettings();
          }
        });

        return text;
      });

    new Setting(containerEl)
      .setName('Published folder')
      .setDesc('Folder path where published blog posts will be saved')
      .addText(text => {
        text
          .setPlaceholder('OpenAugi/Published')
          .setValue(this.plugin.settings.publishedFolder);

        // Save only when input loses focus
        text.inputEl.addEventListener('blur', async () => {
          const value = text.getValue();
          if (value !== this.plugin.settings.publishedFolder) {
            this.plugin.settings.publishedFolder = value;
            await this.plugin.saveSettings();
            // Ensure directories exist after folder path changes
            await this.plugin.fileService.ensureDirectoriesExist();
          }
        });

        return text;
      });
      
    // Check if Dataview plugin is installed
    // @ts-ignore - Dataview API is not typed
    const dataviewPluginInstalled = this.app.plugins.plugins["dataview"] !== undefined;
      
    new Setting(containerEl)
      .setName('Use Dataview plugin')
      .setDesc(dataviewPluginInstalled 
        ? 'Process dataview queries in notes to find linked notes'
        : 'Dataview plugin is not installed. Install it to enable this feature.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useDataviewIfAvailable)
        .setDisabled(!dataviewPluginInstalled)
        .onChange(async (value) => {
          this.plugin.settings.useDataviewIfAvailable = value;
          await this.plugin.saveSettings();
        })
      );
      
    // Recent Activity Settings Header
    containerEl.createEl('h3', { text: 'Recent Activity Settings' });
    
    new Setting(containerEl)
      .setName('Default days to look back')
      .setDesc('Default number of days for the "Distill recent activity" command')
      .addText(text => text
        .setPlaceholder('7')
        .setValue(String(this.plugin.settings.recentActivityDefaults.daysBack))
        .onChange(async (value) => {
          const days = parseInt(value);
          if (!isNaN(days) && days > 0) {
            this.plugin.settings.recentActivityDefaults.daysBack = days;
            await this.plugin.saveSettings();
          }
        })
      );
      
    new Setting(containerEl)
      .setName('Filter journal sections by date')
      .setDesc('For notes with date headers, only include sections within the time window')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.recentActivityDefaults.filterJournalSections)
        .onChange(async (value) => {
          this.plugin.settings.recentActivityDefaults.filterJournalSections = value;
          await this.plugin.saveSettings();
        })
      );
      
    new Setting(containerEl)
      .setName('Date header format')
      .setDesc('Markdown format for date headers in journal notes. Use YYYY for year, MM for month, DD for day. Leave empty to disable journal parsing.')
      .addText(text => text
        .setValue(this.plugin.settings.recentActivityDefaults.dateHeaderFormat)
        .onChange(async (value) => {
          // Allow empty value to disable journal parsing
          if (value === '' || (value.includes('YYYY') && value.includes('MM') && value.includes('DD'))) {
            this.plugin.settings.recentActivityDefaults.dateHeaderFormat = value;
            await this.plugin.saveSettings();
          }
        })
      );
      
    new Setting(containerEl)
      .setName('Exclude folders')
      .setDesc('Comma-separated list of folders to exclude from recent activity (e.g., Templates, Archive)')
      .addText(text => text
        .setPlaceholder('Templates, Archive, OpenAugi')
        .setValue(this.plugin.settings.recentActivityDefaults.excludeFolders.join(', '))
        .onChange(async (value) => {
          this.plugin.settings.recentActivityDefaults.excludeFolders = value
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0);
          await this.plugin.saveSettings();
        })
      );
      
    // Context Gathering Settings Header
    containerEl.createEl('h3', { text: 'Context Gathering Settings' });

    new Setting(containerEl)
      .setName('Default link depth')
      .setDesc('Default depth for link traversal (1-3)')
      .addSlider(slider => slider
        .setLimits(1, 3, 1)
        .setValue(this.plugin.settings.contextGatheringDefaults.linkDepth)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.contextGatheringDefaults.linkDepth = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Default max characters')
      .setDesc('Default maximum characters to gather')
      .addText(text => text
        .setPlaceholder('100000')
        .setValue(String(this.plugin.settings.contextGatheringDefaults.maxCharacters))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num > 0) {
            this.plugin.settings.contextGatheringDefaults.maxCharacters = num;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName('Filter recent sections by default')
      .setDesc('For journal-style notes, only include recent sections by default')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.contextGatheringDefaults.filterRecentSectionsOnly)
        .onChange(async (value) => {
          this.plugin.settings.contextGatheringDefaults.filterRecentSectionsOnly = value;
          await this.plugin.saveSettings();
        })
      );

    // Advanced Settings Header
    containerEl.createEl('h3', { text: 'Advanced Settings' });

    new Setting(containerEl)
      .setName('Enable distill logging')
      .setDesc('Log the full input context sent to AI when distilling notes. Logs are saved to OpenAugi/Logs folder.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableDistillLogging)
        .onChange(async (value) => {
          this.plugin.settings.enableDistillLogging = value;
          await this.plugin.saveSettings();
        })
      );
  }
} 