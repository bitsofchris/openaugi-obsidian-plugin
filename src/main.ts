import { Plugin, Notice, TFile } from 'obsidian';
import { OpenAugiSettings, DEFAULT_SETTINGS } from './types/settings';
import { OpenAIService } from './services/openai-service';
import { FileService } from './services/file-service';
import { DistillService } from './services/distill-service';
import { OpenAugiSettingTab } from './ui/settings-tab';
import { LoadingIndicator } from './ui/loading-indicator';
import { sanitizeFilename } from './utils/filename-utils';

/**
 * A simple tokeinzer to estimate the number of tokens
 * @param text Text to count tokens from
 * @returns Approximate token count
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token is approximately 4 characters
  return Math.ceil(text.length / 4);
}

export default class OpenAugiPlugin extends Plugin {
  settings: OpenAugiSettings;
  openAIService: OpenAIService;
  fileService: FileService;
  distillService: DistillService;
  loadingIndicator: LoadingIndicator;

  async onload() {
    // Load settings
    await this.loadSettings();
    
    // Initialize services
    this.initializeServices();
    
    // Initialize loading indicator
    this.app.workspace.onLayoutReady(() => {
      const statusBar = this.addStatusBarItem();
      if (statusBar.parentElement) {
        this.loadingIndicator = new LoadingIndicator(statusBar.parentElement);
      }
    });
    
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

    // Add command to distill linked notes
    this.addCommand({
      id: 'distill-notes',
      name: 'Distill Linked Notes',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          await this.distillLinkedNotes(activeFile);
        } else {
          new Notice('Please open a markdown file first');
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
    this.distillService = new DistillService(
      this.app,
      this.openAIService
    );
  }

  /**
   * Open a file in a new tab
   * @param filePath The path to the file to open
   */
  private async openFileInNewTab(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.openFile(file);
  }

  /**
   * Process a transcript file
   * @param file The file to process
   */
  private async processTranscriptFile(file: TFile): Promise<void> {
    try {
      // Show loading indicator
      this.loadingIndicator?.show('Processing voice transcript');
      
      // Read file content
      const content = await this.app.vault.read(file);
      
      // Check if API key is set
      if (!this.settings.apiKey) {
        this.loadingIndicator?.hide();
        new Notice('Please set your OpenAI API key in the plugin settings');
        return;
      }

      // Display character and token count
      new Notice(`Processing transcript: ${file.basename}\nCharacters: ${content.length}\nEst. Tokens: ${estimateTokens(content)}`);

      // Update openAIService with latest API key
      this.openAIService = new OpenAIService(this.settings.apiKey);
      
      // Parse transcript
      const parsedData = await this.openAIService.parseTranscript(content);
      
      // Write result to files
      await this.fileService.writeTranscriptFiles(file.basename, parsedData);
      
      // Hide loading indicator
      this.loadingIndicator?.hide();
      
      // Show success message
      new Notice(`Successfully parsed transcript: ${file.basename}\nCreated ${parsedData.notes.length} atomic notes`);
      
      // Open the summary file in a new tab
      const sanitizedFilename = sanitizeFilename(file.basename);
      const summaryPath = `${this.settings.summaryFolder}/${sanitizedFilename} - summary.md`;
      await this.openFileInNewTab(summaryPath);
    } catch (error) {
      // Hide loading indicator
      this.loadingIndicator?.hide();
      
      console.error('Failed to parse transcript:', error);
      new Notice('Failed to parse transcript. Check console for details.');
    }
  }

  /**
   * Distill linked notes
   * @param rootFile The root file containing links to distill
   */
  private async distillLinkedNotes(rootFile: TFile): Promise<void> {
    try {
      // Show loading indicator
      this.loadingIndicator?.show('Distilling linked notes');
      
      // Check if API key is set
      if (!this.settings.apiKey) {
        this.loadingIndicator?.hide();
        new Notice('Please set your OpenAI API key in the plugin settings');
        return;
      }

      // Update services with latest API key
      this.openAIService = new OpenAIService(this.settings.apiKey);
      this.distillService = new DistillService(this.app, this.openAIService);
      
      // Get root content for initial notice
      const rootContent = await this.app.vault.read(rootFile);
      new Notice(`Processing note: ${rootFile.basename}\nCharacters: ${rootContent.length}\nEst. Tokens: ${estimateTokens(rootContent)}`);
      
      // Get linked files
      const linkedFiles = await this.distillService.getLinkedNotes(rootFile);
      
      // Aggregate linked content
      const { content: linkedContent, sourceNotes } = await this.distillService.aggregateContent(linkedFiles);
      
      // Combine content
      const combinedContent = `# Root Note: ${rootFile.basename}\n\n${rootContent}\n\n${linkedContent}`;
      const combinedTokens = estimateTokens(combinedContent);
      
      // Show combined content notice
      new Notice(`Combined content from ${linkedFiles.length} linked notes\nTotal characters: ${combinedContent.length}\nEst. total tokens: ${combinedTokens}`);
      
      // Distill content from linked notes
      const distilledData = await this.distillService.distillFromRootNote(
        rootFile, 
        combinedContent, 
        sourceNotes
      );
      
      // Write result to files
      const summaryPath = await this.fileService.writeDistilledFiles(rootFile, distilledData);
      
      // Hide loading indicator
      this.loadingIndicator?.hide();
      
      // Show success message
      new Notice(`Successfully distilled notes from: ${rootFile.basename}\nCreated ${distilledData.notes.length} atomic notes`);
      
      // Open the summary file in a new tab
      await this.openFileInNewTab(summaryPath);
    } catch (error) {
      // Hide loading indicator
      this.loadingIndicator?.hide();
      
      console.error('Failed to distill notes:', error);
      new Notice('Failed to distill notes. Check console for details.');
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