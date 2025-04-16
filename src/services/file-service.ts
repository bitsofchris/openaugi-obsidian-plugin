import { App, TFile, Vault } from 'obsidian';
import { sanitizeFilename } from '../utils/filename-utils';
import { TranscriptResponse } from '../types/transcript';

/**
 * Service for handling file operations
 */
export class FileService {
  private vault: Vault;
  private summaryFolder: string;
  private notesFolder: string;

  constructor(app: App, summaryFolder: string, notesFolder: string) {
    this.vault = app.vault;
    this.summaryFolder = summaryFolder;
    this.notesFolder = notesFolder;
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
    
    // Format summary content with tasks included
    let summaryContent = data.summary;
    
    // Add tasks section if there are tasks
    if (data.tasks && data.tasks.length > 0) {
      summaryContent += '\n\n## Tasks\n' + data.tasks.join('\n');
    }
    
    // Output Summary with tasks
    await this.vault.create(`${this.summaryFolder}/${sanitizedFilename} - summary.md`, summaryContent);

    // Output Notes
    for (const note of data.notes) {
      // Sanitize note title for filename
      const sanitizedTitle = sanitizeFilename(note.title);
      await this.vault.create(`${this.notesFolder}/${sanitizedTitle}.md`, note.content);
    }
  }
} 