import { App, Modal, Setting, TFile } from 'obsidian';
import { ProcessingType } from '../types/context';

export interface PromptSelectionConfig {
  selectedPrompt?: TFile;
  useCustomPrompt: boolean;
  processingType?: ProcessingType;  // 'distill' or 'publish'
}

export class PromptSelectionModal extends Modal {
  private config: PromptSelectionConfig;
  private onSubmit: (config: PromptSelectionConfig) => void;
  private promptsFolder: string;
  private availablePrompts: TFile[] = [];
  private showProcessingType: boolean;

  constructor(
    app: App,
    promptsFolder: string,
    onSubmit: (config: PromptSelectionConfig) => void,
    showProcessingType: boolean = false,
    defaultProcessingType: ProcessingType = 'distill'
  ) {
    super(app);
    this.promptsFolder = promptsFolder;
    this.config = {
      useCustomPrompt: false,
      processingType: defaultProcessingType
    };
    this.onSubmit = onSubmit;
    this.showProcessingType = showProcessingType;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Process Context' });

    contentEl.createEl('p', {
      text: 'Configure how to process the gathered context with AI.',
      cls: 'setting-item-description'
    });

    // Processing type selection (if enabled)
    if (this.showProcessingType) {
      new Setting(contentEl)
        .setName('Output format')
        .setDesc('How to process the context')
        .addDropdown(dropdown => {
          dropdown
            .addOption('distill', 'Distill to atomic notes')
            .addOption('publish', 'Publish as single post')
            .setValue(this.config.processingType || 'distill')
            .onChange((value: ProcessingType) => {
              this.config.processingType = value;
            });
        });
    }

    // Load available prompts
    await this.loadAvailablePrompts();

    if (this.availablePrompts.length === 0) {
      contentEl.createEl('p', { 
        text: `No prompt files found in "${this.promptsFolder}". Create markdown files in this folder to use as custom prompts.`,
        cls: 'openaugi-prompt-warning'
      });
    } else {
      // Show preview of selected prompt
      const previewEl = contentEl.createDiv({ cls: 'openaugi-prompt-preview' });
      previewEl.style.display = 'none';

      // Create dropdown for prompt selection
      new Setting(contentEl)
        .setName('Custom prompt')
        .setDesc('Select a prompt template to customize processing')
        .addDropdown(dropdown => {
          dropdown.addOption('', 'Use default prompt');
          
          this.availablePrompts.forEach(prompt => {
            dropdown.addOption(prompt.path, prompt.basename);
          });
          
          dropdown.onChange(async value => {
            if (value) {
              this.config.useCustomPrompt = true;
              this.config.selectedPrompt = this.availablePrompts.find(p => p.path === value);
              previewEl.style.display = 'block';
              await this.updatePreview(previewEl);
            } else {
              this.config.useCustomPrompt = false;
              this.config.selectedPrompt = undefined;
              previewEl.style.display = 'none';
            }
          });
        });
    }

    // Action buttons
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Continue')
        .setCta()
        .onClick(() => {
          this.onSubmit(this.config);
          this.close();
        })
      );
  }

  private async loadAvailablePrompts() {
    try {
      // Check if prompts folder exists
      if (!await this.app.vault.adapter.exists(this.promptsFolder)) {
        return;
      }

      // Get all markdown files in the prompts folder
      const files = this.app.vault.getMarkdownFiles();
      this.availablePrompts = files.filter(file => 
        file.path.startsWith(this.promptsFolder + '/') || 
        file.path === this.promptsFolder
      );

      // Sort by name
      this.availablePrompts.sort((a, b) => a.basename.localeCompare(b.basename));
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  }

  private async updatePreview(previewEl: HTMLElement) {
    previewEl.empty();
    
    if (this.config.selectedPrompt) {
      try {
        const content = await this.app.vault.read(this.config.selectedPrompt);
        const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
        
        previewEl.createEl('h4', { text: 'Preview:' });
        previewEl.createEl('pre', { 
          text: preview,
          cls: 'openaugi-prompt-preview-content'
        });
      } catch (error) {
        previewEl.createEl('p', { 
          text: 'Unable to preview prompt',
          cls: 'openaugi-prompt-error'
        });
      }
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}