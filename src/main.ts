import { Plugin, Notice, TFile } from 'obsidian';
import { OpenAugiSettings, DEFAULT_SETTINGS } from './types/settings';
import { OpenAIService } from './services/openai-service';
import { FileService } from './services/file-service';
import { DistillService } from './services/distill-service';
import { OpenAugiSettingTab } from './ui/settings-tab';
import { LoadingIndicator } from './ui/loading-indicator';
import { sanitizeFilename, createFileWithCollisionHandling } from './utils/filename-utils';
import { RecentActivityModal, RecentActivityConfig } from './ui/recent-activity-modal';

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
      name: 'Parse transcript',
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
      name: 'Distill linked notes',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          await this.distillLinkedNotes(activeFile);
        } else {
          new Notice('Please open a markdown file first');
        }
      }
    });

    // Add command to distill recent activity
    this.addCommand({
      id: 'distill-recent-activity',
      name: 'Distill recent activity',
      callback: async () => {
        await this.distillRecentActivity();
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
      this.openAIService,
      this.settings
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
      this.distillService = new DistillService(
        this.app, 
        this.openAIService,
        this.settings
      );
      
      // Get linked files
      let linkedFiles = await this.distillService.getLinkedNotes(rootFile);
      
      // Deduplicate the linked files by path
      const uniqueFiles = new Map<string, TFile>();
      for (const file of linkedFiles) {
        if (!uniqueFiles.has(file.path)) {
          uniqueFiles.set(file.path, file);
        }
      }
      
      // Convert back to array
      linkedFiles = Array.from(uniqueFiles.values());
      
      if (linkedFiles.length === 0) {
        this.loadingIndicator?.hide();
        new Notice('No linked notes found to distill');
        return;
      }
      
      // Show notice about linked files
      new Notice(`Found ${linkedFiles.length} linked notes to process.`);
      
      // Let the distill service handle all the content aggregation (no time filtering)
      const distilledData = await this.distillService.distillFromRootNote(
        rootFile,
        undefined,
        undefined,
        0  // No time filtering for regular distill command
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

  /**
   * Distill recent activity based on user configuration
   */
  private async distillRecentActivity(): Promise<void> {
    // Show configuration modal
    const modal = new RecentActivityModal(
      this.app,
      this.settings.recentActivityDefaults,
      async (config: RecentActivityConfig) => {
        await this.executeRecentActivityDistill(config);
      }
    );
    modal.open();
  }

  /**
   * Execute the recent activity distillation with the given configuration
   * @param config The configuration for recent activity distillation
   */
  private async executeRecentActivityDistill(config: RecentActivityConfig): Promise<void> {
    try {
      // Check API key
      if (!this.settings.apiKey) {
        new Notice('Please set your OpenAI API key in the settings');
        return;
      }

      // Show loading indicator
      this.loadingIndicator?.show('Discovering recent activity...');

      // Update services with latest API key
      this.openAIService = new OpenAIService(this.settings.apiKey);
      this.distillService = new DistillService(
        this.app, 
        this.openAIService,
        this.settings
      );

      // Get recently modified notes
      const recentFiles = await this.distillService.getRecentlyModifiedNotes(
        config.daysBack,
        config.excludeFolders
      );

      if (recentFiles.length === 0 && !config.rootNote) {
        this.loadingIndicator?.hide();
        new Notice(`No notes modified in the last ${config.daysBack} days`);
        return;
      }

      // Prepare files list including root note if provided
      let allFiles = [...recentFiles];
      if (config.rootNote && !recentFiles.some(f => f.path === config.rootNote!.path)) {
        allFiles = [config.rootNote, ...recentFiles];
      }

      // Show notice about discovered files
      const message = config.rootNote 
        ? `Found ${recentFiles.length} recent notes plus root note: ${config.rootNote.basename}`
        : `Found ${recentFiles.length} notes modified in the last ${config.daysBack} days`;
      new Notice(message);

      // Update loading message
      this.loadingIndicator?.show('Processing recent activity...');

      // Use appropriate time window for filtering
      const timeWindow = config.filterJournalSections ? config.daysBack : 0;

      // Create a synthetic root file for the distillation
      const syntheticRootContent = `# Recent Activity Summary

This is an automated summary of notes modified in the last ${config.daysBack} days.
${config.rootNote ? `\nUsing [[${config.rootNote.basename}]] as context root.` : ''}

## Recently Modified Notes:
${allFiles.map(f => `- [[${f.basename}]]`).join('\n')}`;

      // Ensure OpenAugi folder exists
      if (!await this.app.vault.adapter.exists('OpenAugi')) {
        await this.app.vault.createFolder('OpenAugi');
      }
      
      // Create a temporary root file
      const tempRootPath = `OpenAugi/temp-recent-activity-${Date.now()}.md`;
      await createFileWithCollisionHandling(this.app.vault, tempRootPath, syntheticRootContent);
      const tempRootFile = this.app.vault.getAbstractFileByPath(tempRootPath) as TFile;

      // Aggregate content with time filtering
      const { content: aggregatedContent, sourceNotes } = await this.distillService.aggregateContent(
        allFiles,
        timeWindow
      );

      // Combine with synthetic root content
      const combinedContent = `# Recent Activity: Last ${config.daysBack} Days\n\n${syntheticRootContent}\n\n${aggregatedContent}`;

      // Distill the recent activity
      const distilledData = await this.distillService.distillFromRootNote(
        tempRootFile,
        combinedContent,
        sourceNotes
      );

      // Update the distilled data to reflect recent activity
      distilledData.summary = `## Recent Activity Summary (Last ${config.daysBack} Days)\n\n${distilledData.summary}`;

      // Write result to files
      const summaryPath = await this.fileService.writeDistilledFiles(tempRootFile, distilledData);

      // Clean up temporary file
      await this.app.vault.delete(tempRootFile);

      // Hide loading indicator
      this.loadingIndicator?.hide();

      // Show success message
      new Notice(`Successfully distilled recent activity\nCreated ${distilledData.notes.length} atomic notes`);

      // Open the summary file in a new tab
      await this.openFileInNewTab(summaryPath);
    } catch (error) {
      // Hide loading indicator
      this.loadingIndicator?.hide();
      
      console.error('Failed to distill recent activity:', error);
      new Notice('Failed to distill recent activity. Check console for details.');
    }
  }
} 