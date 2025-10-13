import { Plugin, Notice, TFile } from 'obsidian';
import { OpenAugiSettings, DEFAULT_SETTINGS } from './types/settings';
import { OpenAIService } from './services/openai-service';
import { FileService } from './services/file-service';
import { DistillService } from './services/distill-service';
import { ContextGatheringService } from './services/context-gathering-service';
import { OpenAugiSettingTab } from './ui/settings-tab';
import { LoadingIndicator } from './ui/loading-indicator';
import { sanitizeFilename, createFileWithCollisionHandling } from './utils/filename-utils';
import { PromptSelectionModal, PromptSelectionConfig } from './ui/prompt-selection-modal';
import { ContextGatheringModal } from './ui/context-gathering-modal';
import { ContextSelectionModal } from './ui/context-selection-modal';
import { ContextPreviewModal } from './ui/context-preview-modal';
import { CommandOptions, ContextGatheringConfig, GatheredContext, DiscoveredNote } from './types/context';

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
  contextGatheringService: ContextGatheringService;
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

    // Add new unified context gathering commands
    this.addCommand({
      id: 'openaugi-process-notes',
      name: 'Process notes',
      callback: async () => {
        await this.gatherAndProcessContext({
          commandType: 'distill',
          defaultSourceMode: 'linked-notes',
          defaultDepth: 1
        });
      }
    });

    this.addCommand({
      id: 'openaugi-process-recent',
      name: 'Process recent activity',
      callback: async () => {
        await this.gatherAndProcessContext({
          commandType: 'distill',
          defaultSourceMode: 'recent-activity',
          defaultDepth: 1
        });
      }
    });

    this.addCommand({
      id: 'openaugi-save-context',
      name: 'Save context',
      callback: async () => {
        await this.gatherAndProcessContext({
          commandType: 'save-raw',
          defaultSourceMode: 'linked-notes',
          defaultDepth: 1,
          skipPreview: false
        });
      }
    });

    // Add settings tab
    this.addSettingTab(new OpenAugiSettingTab(this.app, this));
  }

  /**
   * Get the configured model (custom override or default)
   */
  private getConfiguredModel(): string {
    return this.settings.customModelOverride.trim() || this.settings.defaultModel;
  }

  /**
   * Initialize services with current settings
   */
  private initializeServices(): void {
    this.openAIService = new OpenAIService(this.settings.apiKey, this.getConfiguredModel());
    this.fileService = new FileService(
      this.app,
      this.settings.summaryFolder,
      this.settings.notesFolder,
      this.settings.publishedFolder
    );
    this.distillService = new DistillService(
      this.app,
      this.openAIService,
      this.settings
    );
    this.contextGatheringService = new ContextGatheringService(
      this.app,
      this.distillService,
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

      // Update openAIService with latest API key and model
      this.openAIService = new OpenAIService(this.settings.apiKey, this.getConfiguredModel());
      
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
    // Show prompt selection modal
    const modal = new PromptSelectionModal(
      this.app,
      this.settings.promptsFolder,
      async (config: PromptSelectionConfig) => {
        await this.executeDistillLinkedNotes(rootFile, config);
      }
    );
    modal.open();
  }

  /**
   * Execute the distillation of linked notes with the selected prompt configuration
   * @param rootFile The root note file
   * @param promptConfig The prompt configuration from the modal
   */
  private async executeDistillLinkedNotes(rootFile: TFile, promptConfig: PromptSelectionConfig): Promise<void> {
    try {
      // Show loading indicator
      this.loadingIndicator?.show('Distilling linked notes');
      
      // Check if API key is set
      if (!this.settings.apiKey) {
        this.loadingIndicator?.hide();
        new Notice('Please set your OpenAI API key in the plugin settings');
        return;
      }

      // Update services with latest API key and model
      this.openAIService = new OpenAIService(this.settings.apiKey, this.getConfiguredModel());
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
      
      // Read custom prompt if selected
      let customPrompt: string | undefined;
      if (promptConfig.useCustomPrompt && promptConfig.selectedPrompt) {
        try {
          customPrompt = await this.app.vault.read(promptConfig.selectedPrompt);
        } catch (error) {
          console.error('Failed to read custom prompt:', error);
          new Notice('Failed to read custom prompt, using default');
        }
      }
      
      // Let the distill service handle all the content aggregation (no time filtering)
      const distilledData = await this.distillService.distillFromRootNote(
        rootFile,
        undefined,
        undefined,
        0,  // No time filtering for regular distill command
        customPrompt
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
   * Main orchestration method for unified context gathering and processing
   * @param options Options specifying the command type and defaults
   */
  private async gatherAndProcessContext(options: CommandOptions): Promise<void> {
    // Step 1: Show context gathering configuration modal
    const configModal = new ContextGatheringModal(
      this.app,
      this.settings,
      this.contextGatheringService,
      async (config: ContextGatheringConfig) => {
        await this.executeContextGathering(config, options);
      },
      options.defaultSourceMode,
      options.defaultDepth
    );
    configModal.open();
  }

  /**
   * Execute context gathering with the given configuration
   * @param config Context gathering configuration
   * @param options Command options
   */
  private async executeContextGathering(
    config: ContextGatheringConfig,
    options: CommandOptions
  ): Promise<void> {
    try {
      this.loadingIndicator?.show('Discovering notes...');

      // Gather context
      const gatheredContext = await this.contextGatheringService.gatherContext(config);

      this.loadingIndicator?.hide();

      // Check if any notes were discovered
      if (gatheredContext.notes.length === 0) {
        new Notice('No notes discovered with the given configuration');
        return;
      }

      // Step 2: Show checkbox selection modal
      const selectionModal = new ContextSelectionModal(
        this.app,
        gatheredContext.notes,
        async (selectedNotes: DiscoveredNote[]) => {
          await this.showContextPreview(gatheredContext, selectedNotes, options);
        }
      );
      selectionModal.open();
    } catch (error) {
      this.loadingIndicator?.hide();
      console.error('Failed to gather context:', error);
      new Notice('Failed to gather context: ' + error.message);
    }
  }

  /**
   * Show context preview with save/process options
   * @param context Original gathered context
   * @param selectedNotes User-selected notes
   * @param options Command options
   */
  private async showContextPreview(
    context: GatheredContext,
    selectedNotes: DiscoveredNote[],
    options: CommandOptions
  ): Promise<void> {
    try {
      // Check if any notes selected
      if (selectedNotes.length === 0) {
        new Notice('No notes selected');
        return;
      }

      this.loadingIndicator?.show('Aggregating content...');

      // Re-aggregate with only selected notes
      const files = selectedNotes.map(n => n.file);
      const aggregated = await this.distillService.aggregateContent(
        files,
        context.config.filterRecentSectionsOnly ? context.config.journalSectionDays : undefined
      );

      // Update context with selected notes
      const finalContext: GatheredContext = {
        ...context,
        notes: selectedNotes,
        aggregatedContent: aggregated.content,
        totalCharacters: aggregated.content.length,
        totalNotes: selectedNotes.length
      };

      this.loadingIndicator?.hide();

      // Determine button label based on command type
      const processButtonLabel = options.commandType === 'save-raw'
        ? 'Save Context'
        : 'Process with AI';

      // Step 3: Show preview modal
      const previewModal = new ContextPreviewModal(
        this.app,
        finalContext,
        async () => await this.saveRawContext(finalContext),
        async () => {
          if (options.commandType === 'save-raw') {
            await this.saveRawContext(finalContext);
          } else {
            await this.processContextWithAI(finalContext, options);
          }
        },
        processButtonLabel
      );
      previewModal.open();
    } catch (error) {
      this.loadingIndicator?.hide();
      console.error('Failed to preview context:', error);
      new Notice('Failed to preview context: ' + error.message);
    }
  }

  /**
   * Save raw context to a note without AI processing
   * @param context The gathered context to save
   */
  private async saveRawContext(context: GatheredContext): Promise<void> {
    try {
      this.loadingIndicator?.show('Saving context...');

      // Ensure OpenAugi folder exists
      if (!await this.app.vault.adapter.exists('OpenAugi')) {
        await this.app.vault.createFolder('OpenAugi');
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const timeString = new Date().toISOString().split('T')[1].substring(0, 8).replace(/:/g, '-');
      const filename = `Context ${timestamp} ${timeString}`;
      const path = `OpenAugi/${filename}.md`;

      // Build content
      let content = `# Gathered Context\n\n`;
      content += `**Source**: ${context.config.sourceMode}\n`;
      content += `**Notes**: ${context.totalNotes}\n`;
      content += `**Characters**: ${context.totalCharacters.toLocaleString()}\n`;
      content += `**Timestamp**: ${context.timestamp}\n`;

      if (context.config.sourceMode === 'linked-notes') {
        content += `**Link Depth**: ${context.config.linkDepth}\n`;
      }

      content += `\n## Included Notes\n`;
      content += context.notes.map(n => `- [[${n.file.basename}]]`).join('\n');
      content += `\n\n---\n\n`;
      content += context.aggregatedContent;

      // Save file
      await createFileWithCollisionHandling(this.app.vault, path, content);

      this.loadingIndicator?.hide();

      new Notice(`Context saved to: ${filename}`);

      // Open the file
      await this.openFileInNewTab(path);
    } catch (error) {
      this.loadingIndicator?.hide();
      console.error('Failed to save raw context:', error);
      new Notice('Failed to save context: ' + error.message);
    }
  }

  /**
   * Process context with AI (distill or publish)
   * @param context The gathered context
   * @param options Command options
   */
  private async processContextWithAI(
    context: GatheredContext,
    options: CommandOptions
  ): Promise<void> {
    // Show prompt selection modal with processing type option
    const promptModal = new PromptSelectionModal(
      this.app,
      this.settings.promptsFolder,
      async (promptConfig: PromptSelectionConfig) => {
        await this.executeProcessing(context, promptConfig, options);
      },
      true,  // Show processing type selector
      'distill'  // Default to distill
    );
    promptModal.open();
  }

  /**
   * Execute AI processing with the selected prompt and processing type
   * @param context The gathered context
   * @param promptConfig Prompt selection configuration
   * @param options Command options
   */
  private async executeProcessing(
    context: GatheredContext,
    promptConfig: PromptSelectionConfig,
    options: CommandOptions
  ): Promise<void> {
    try {
      // Check API key
      if (!this.settings.apiKey) {
        new Notice('Please set your OpenAI API key in the settings');
        return;
      }

      // Read custom prompt if selected
      let customPrompt: string | undefined;
      if (promptConfig.useCustomPrompt && promptConfig.selectedPrompt) {
        try {
          customPrompt = await this.app.vault.read(promptConfig.selectedPrompt);
        } catch (error) {
          console.error('Failed to read custom prompt:', error);
          new Notice('Failed to read custom prompt, using default');
        }
      }

      const processingType = promptConfig.processingType || 'distill';

      if (processingType === 'publish') {
        await this.executePublish(context, customPrompt, promptConfig.selectedPrompt?.basename || 'default');
      } else {
        await this.executeDistill(context, customPrompt);
      }
    } catch (error) {
      this.loadingIndicator?.hide();
      console.error('Failed to process context:', error);
      new Notice('Failed to process context: ' + error.message);
    }
  }

  /**
   * Execute distill processing
   * @param context The gathered context
   * @param customPrompt Optional custom prompt
   */
  private async executeDistill(
    context: GatheredContext,
    customPrompt?: string
  ): Promise<void> {
    try {
      this.loadingIndicator?.show('Distilling content...');

      // Update services with latest API key and model
      this.openAIService = new OpenAIService(this.settings.apiKey, this.getConfiguredModel());
      this.distillService = new DistillService(
        this.app,
        this.openAIService,
        this.settings
      );

      // Call distill API
      const distilledData = await this.openAIService.distillContent(
        context.aggregatedContent,
        customPrompt
      );

      // Add source notes
      distilledData.sourceNotes = context.notes.map(n => n.file.basename);

      // Write files using first note as synthetic root
      const syntheticRoot = context.notes[0].file;
      const summaryPath = await this.fileService.writeDistilledFiles(syntheticRoot, distilledData);

      this.loadingIndicator?.hide();

      new Notice(`Successfully distilled! Created ${distilledData.notes.length} atomic notes`);

      // Open the summary file
      await this.openFileInNewTab(summaryPath);
    } catch (error) {
      this.loadingIndicator?.hide();
      throw error;
    }
  }

  /**
   * Execute publish processing
   * @param context The gathered context
   * @param customPrompt Optional custom prompt
   * @param promptName Name of the prompt used
   */
  private async executePublish(
    context: GatheredContext,
    customPrompt: string | undefined,
    promptName: string
  ): Promise<void> {
    try {
      this.loadingIndicator?.show('Publishing content...');

      // Update services with latest API key and model
      this.openAIService = new OpenAIService(this.settings.apiKey, this.getConfiguredModel());

      // Call publish API
      const publishedContent = await this.openAIService.publishContent(
        context.aggregatedContent,
        customPrompt
      );

      // Write published post
      const sourceNotes = context.notes.map(n => n.file.basename);
      const publishedPath = await this.fileService.writePublishedPost(
        publishedContent,
        sourceNotes,
        promptName
      );

      this.loadingIndicator?.hide();

      new Notice('Successfully published blog post!');

      // Open the published file
      await this.openFileInNewTab(publishedPath);
    } catch (error) {
      this.loadingIndicator?.hide();
      throw error;
    }
  }
} 