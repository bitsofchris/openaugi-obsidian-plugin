import { App, TFile, Vault } from 'obsidian';
import { sanitizeFilename, BacklinkMapper, createFileWithCollisionHandling } from '../utils/filename-utils';
import { TranscriptResponse, DistillResponse } from '../types/transcript';

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
   * Generate a session folder name based on type and timestamp
   * @param type Type of distillation: 'transcript', 'distill', or 'recent'
   * @param rootName Optional root note name for context
   * @returns Formatted folder name
   */
  private generateSessionFolderName(type: 'transcript' | 'distill' | 'recent', rootName?: string): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/T/, ' ')
      .replace(/\..+/, '')
      .replace(/:/g, '-');
    
    switch (type) {
      case 'transcript':
        return `Transcript ${timestamp}`;
      case 'distill':
        if (rootName) {
          const sanitizedRoot = sanitizeFilename(rootName);
          // Truncate root name if too long
          const truncatedRoot = sanitizedRoot.length > 30 
            ? sanitizedRoot.substring(0, 30) + '...' 
            : sanitizedRoot;
          return `Distill ${truncatedRoot} ${timestamp}`;
        }
        return `Distill ${timestamp}`;
      case 'recent':
        return `Recent Activity ${timestamp}`;
    }
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
    
    // Create session folder for atomic notes
    const sessionFolder = this.generateSessionFolderName('transcript');
    const sessionPath = `${this.notesFolder}/${sessionFolder}`;
    const sessionExists = await this.vault.adapter.exists(sessionPath);
    if (!sessionExists) {
      await this.vault.createFolder(sessionPath);
    }
    
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
    await createFileWithCollisionHandling(
      this.vault,
      `${this.summaryFolder}/${sanitizedFilename} - summary.md`,
      summaryContent
    );

    // Output Notes to session folder
    for (const note of data.notes) {
      // Sanitize note title for filename
      const sanitizedTitle = sanitizeFilename(note.title);
      // Process content to ensure backlinks use sanitized filenames
      const processedContent = this.backlinkMapper.processBacklinks(note.content);
      await createFileWithCollisionHandling(
        this.vault,
        `${sessionPath}/${sanitizedTitle}.md`,
        processedContent
      );
    }
  }

  /**
   * Write distilled data to files
   * @param rootFile The root file that was distilled
   * @param data Distilled data
   */
  async writeDistilledFiles(rootFile: TFile, data: DistillResponse): Promise<string> {
    // Ensure directories exist
    await this.ensureDirectoriesExist();
    
    // Determine session type based on rootFile
    const isRecentActivity = rootFile.basename.includes('temp-recent-activity');
    const sessionType = isRecentActivity ? 'recent' : 'distill';
    const sessionFolder = this.generateSessionFolderName(
      sessionType, 
      isRecentActivity ? undefined : rootFile.basename
    );
    const sessionPath = `${this.notesFolder}/${sessionFolder}`;
    
    // Create session folder for atomic notes
    const sessionExists = await this.vault.adapter.exists(sessionPath);
    if (!sessionExists) {
      await this.vault.createFolder(sessionPath);
    }
    
    // Generate appropriate filename based on content
    let summaryFilename: string;
    if (isRecentActivity) {
      // For recent activity, try to extract a meaningful title from the first atomic note
      // or use a descriptive name
      if (data.notes.length > 0) {
        const firstNoteTitle = sanitizeFilename(data.notes[0].title);
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        summaryFilename = `Recent Activity ${timestamp} - ${firstNoteTitle}`;
      } else {
        const timestamp = new Date().toISOString()
          .replace(/T/, ' ')
          .replace(/\..+/, '')
          .replace(/:/g, '-');
        summaryFilename = `Recent Activity Summary ${timestamp}`;
      }
    } else {
      // For regular distillation, use the root file name
      summaryFilename = `${sanitizeFilename(rootFile.basename)} - distilled`;
    }
    
    // Register all note titles for backlink processing
    this.backlinkMapper = new BacklinkMapper(); // Reset the mapper
    for (const note of data.notes) {
      const sanitizedTitle = sanitizeFilename(note.title);
      this.backlinkMapper.registerTitle(note.title, sanitizedTitle);
    }
    
    // Format summary content with source notes and tasks
    let summaryContent = this.backlinkMapper.processBacklinks(data.summary);
    
    // Add source notes section
    if (data.sourceNotes && data.sourceNotes.length > 0) {
      const sourceNoteLinks = data.sourceNotes.map(note => 
        `- [[${note}]]`
      );
      summaryContent += '\n\n## Source Notes\n' + sourceNoteLinks.join('\n');
    }
    
    // Add tasks section if there are tasks
    if (data.tasks && data.tasks.length > 0) {
      const processedTasks = data.tasks.map(task => 
        this.backlinkMapper.processBacklinks(task)
      );
      summaryContent += '\n\n## Tasks\n' + processedTasks.join('\n');
    }
    
    // Output Summary
    const summaryPath = await createFileWithCollisionHandling(
      this.vault,
      `${this.summaryFolder}/${summaryFilename}.md`,
      summaryContent
    );

    // Output Notes to session folder
    for (const note of data.notes) {
      // Sanitize note title for filename
      const sanitizedTitle = sanitizeFilename(note.title);
      // Process content to ensure backlinks use sanitized filenames
      const processedContent = this.backlinkMapper.processBacklinks(note.content);
      await createFileWithCollisionHandling(
        this.vault,
        `${sessionPath}/${sanitizedTitle}.md`,
        processedContent
      );
    }
    
    return summaryPath;
  }
} 