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
      .addText(text => text
        .setPlaceholder('OpenAugi/Summaries')
        .setValue(this.plugin.settings.summaryFolder)
        .onChange(async (value) => {
          this.plugin.settings.summaryFolder = value;
          await this.plugin.saveSettings();
          // Ensure directories exist after folder path changes
          await this.plugin.fileService.ensureDirectoriesExist();
        })
      );
      
    new Setting(containerEl)
      .setName('Notes folder')
      .setDesc('Folder path where atomic notes will be saved')
      .addText(text => text
        .setPlaceholder('OpenAugi/Notes')
        .setValue(this.plugin.settings.notesFolder)
        .onChange(async (value) => {
          this.plugin.settings.notesFolder = value;
          await this.plugin.saveSettings();
          // Ensure directories exist after folder path changes
          await this.plugin.fileService.ensureDirectoriesExist();
        })
      );
      
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
      .setDesc('Markdown format for date headers in journal notes. Use YYYY for year, MM for month, DD for day.')
      .addText(text => text
        .setPlaceholder('### YYYY-MM-DD')
        .setValue(this.plugin.settings.recentActivityDefaults.dateHeaderFormat)
        .onChange(async (value) => {
          if (value.includes('YYYY') && value.includes('MM') && value.includes('DD')) {
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