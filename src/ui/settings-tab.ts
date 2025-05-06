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
  }
} 