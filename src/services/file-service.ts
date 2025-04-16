import { App, TFile, Vault } from 'obsidian';
import { sanitizeFilename, BacklinkMapper } from '../utils/filename-utils';
import { TranscriptResponse } from '../types/transcript';

/**
 * Service for handling file operations
 */
export class FileService {
  private vault: Vault;
  private summaryFolder: string;
  private notesFolder: string;
  private backlinkMapper: BacklinkMapper;

  constructor(app: App, summaryFolder: string, notesFolder: string) {
    this.vault = app.vault;
    this.summaryFolder = summaryFolder;
    this.notesFolder = notesFolder;
    this.backlinkMapper = new BacklinkMapper();
  }

  /**
   * Ensure output directories exist
   */
  async ensureDirectoriesExist(): Promise<void> {
    const dirs = [
      this.summaryFolder,
      this.notesFolder
    ];
    
    for (const dir of dirs) {
      const exists = await this.vault.adapter.exists(dir);
      if (!exists) {
        await this.vault.createFolder(dir);
      }
    }
  }

  /**
   * Write transcript data to files
   * @param filename Base filename
   * @param data Parsed transcript data
   */
  async writeTranscriptFiles(filename: string, data: TranscriptResponse): Promise<void> {
    // Ensure directories exist
    await this.ensureDirectoriesExist();
    
    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(filename);
    
    // Register all note titles for backlink processing
    this.backlinkMapper = new BacklinkMapper(); // Reset the mapper
    for (const note of data.notes) {
      const sanitizedTitle = sanitizeFilename(note.title);
      this.backlinkMapper.registerTitle(note.title, sanitizedTitle);
    }
    
    // Format summary content with tasks included
    let summaryContent = this.backlinkMapper.processBacklinks(data.summary);
    
    // Add tasks section if there are tasks
    if (data.tasks && data.tasks.length > 0) {
      const processedTasks = data.tasks.map(task => 
        this.backlinkMapper.processBacklinks(task)
      );
      summaryContent += '\n\n## Tasks\n' + processedTasks.join('\n');
    }
    
    // Output Summary with tasks
    await this.vault.create(`${this.summaryFolder}/${sanitizedFilename} - summary.md`, summaryContent);

    // Output Notes
    for (const note of data.notes) {
      // Sanitize note title for filename
      const sanitizedTitle = sanitizeFilename(note.title);
      // Process content to ensure backlinks use sanitized filenames
      const processedContent = this.backlinkMapper.processBacklinks(note.content);
      await this.vault.create(`${this.notesFolder}/${sanitizedTitle}.md`, processedContent);
    }
  }
} 