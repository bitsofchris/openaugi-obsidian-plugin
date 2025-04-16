import { Plugin, Notice, TFile } from 'obsidian';
import { OpenAugiSettings, DEFAULT_SETTINGS } from './types/settings';
import { OpenAIService } from './services/openai-service';
import { FileService } from './services/file-service';
import { OpenAugiSettingTab } from './ui/settings-tab';

export default class OpenAugiPlugin extends Plugin {
  settings: OpenAugiSettings;
  openAIService: OpenAIService;
  fileService: FileService;

  async onload() {
    // Load settings
    await this.loadSettings();
    
    // Initialize services
    this.initializeServices();
    
    // Add command to manually parse a transcript file
    this.addCommand({
      id: 'parse-transcript',
      name: 'Parse Transcript',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          await this.processTranscriptFile(activeFile);
        } else {
          new Notice('Please open a markdown transcript file first');
        }
      }
    });

    // Add settings tab
    this.addSettingTab(new OpenAugiSettingTab(this.app, this));
  }

  /**
   * Initialize services with current settings
   */
  private initializeServices(): void {
    this.openAIService = new OpenAIService(this.settings.apiKey);
    this.fileService = new FileService(
      this.app, 
      this.settings.summaryFolder, 
      this.settings.notesFolder
    );
  }

  /**
   * Process a transcript file
   * @param file The file to process
   */
  private async processTranscriptFile(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      
      // Check if API key is set
      if (!this.settings.apiKey) {
        new Notice('Please set your OpenAI API key in the plugin settings');
        return;
      }

      // Update openAIService with latest API key
      this.openAIService = new OpenAIService(this.settings.apiKey);
      
      // Parse transcript
      const parsedData = await this.openAIService.parseTranscript(content);
      
      // Write result to files
      await this.fileService.writeTranscriptFiles(file.basename, parsedData);
      
      new Notice(`Successfully parsed transcript: ${file.basename}`);
    } catch (error) {
      console.error('Failed to parse transcript:', error);
      new Notice('Failed to parse transcript. Check console for details.');
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Reinitialize services with new settings
    this.initializeServices();
  }
} 