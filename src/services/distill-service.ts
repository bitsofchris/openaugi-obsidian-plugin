import { App, TFile, MetadataCache, Component } from 'obsidian';
import { createFileWithCollisionHandling } from '../utils/filename-utils';
import { OpenAIService } from './openai-service';
import { DistillResponse } from '../types/transcript';
import { OpenAugiSettings } from '../types/settings';

/**
 * A simple tokeinzer to estimate the number of tokens
 * @param text Text to count tokens from
 * @returns Approximate token count
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token is approximately 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Service for distilling content from linked notes
 */
export class DistillService {
  private app: App;
  private openAIService: OpenAIService;
  private settings: OpenAugiSettings;
  
  constructor(app: App, openAIService: OpenAIService, settings: OpenAugiSettings) {
    this.app = app;
    this.openAIService = openAIService;
    this.settings = settings;
  }

  /**
   * Log the distill input context to a file for debugging
   * @param content The full content being sent to AI
   * @param rootFileName The name of the root file being processed
   */
  private async logDistillContext(content: string, rootFileName: string): Promise<void> {
    // Only log if enabled in settings
    if (!this.settings.enableDistillLogging) {
      return;
    }
    
    try {
      // Create log folder if it doesn't exist
      const logFolderPath = 'OpenAugi/Logs';
      if (!await this.app.vault.adapter.exists(logFolderPath)) {
        await this.app.vault.createFolder(logFolderPath);
      }

      // Create timestamp for log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFileName = `distill-log-${rootFileName}-${timestamp}.md`;
      const logFilePath = `${logFolderPath}/${logFileName}`;

      // Format log content
      const logContent = `# Distill Context Log
**Root File**: ${rootFileName}
**Timestamp**: ${new Date().toISOString()}
**Total Characters**: ${content.length}
**Estimated Tokens**: ${estimateTokens(content)}

---

## Full Input Context:

${content}

---
*End of log*`;

      // Write log file
      await createFileWithCollisionHandling(this.app.vault, logFilePath, logContent);
      
      console.log(`Distill context logged to: ${logFilePath}`);
    } catch (error) {
      console.error('Failed to log distill context:', error);
    }
  }

  /**
   * Get recently modified notes based on specified criteria
   * @param daysBack Number of days to look back
   * @param excludeFolders Folders to exclude from search
   * @returns Array of recently modified files
   */
  async getRecentlyModifiedNotes(daysBack: number, excludeFolders: string[]): Promise<TFile[]> {
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    const recentFiles: TFile[] = [];
    
    const files = this.app.vault.getMarkdownFiles();
    
    for (const file of files) {
      // Check if file is in excluded folder
      const isExcluded = excludeFolders.some(folder => 
        file.path.startsWith(folder + '/') || file.path.includes('/' + folder + '/')
      );
      
      if (isExcluded) {
        continue;
      }
      
      // Check modification time
      const stats = await this.app.vault.adapter.stat(file.path);
      if (stats && stats.mtime >= cutoffTime) {
        recentFiles.push(file);
      }
    }
    
    // Sort by modification time, most recent first
    recentFiles.sort((a, b) => {
      const aStats = this.app.vault.adapter.stat(a.path);
      const bStats = this.app.vault.adapter.stat(b.path);
      return (bStats as any).mtime - (aStats as any).mtime;
    });
    
    return recentFiles;
  }

  /**
   * Check if a string contains a dataview query
   * @param content The content to check
   * @returns True if the content contains a dataview query
   */
  private containsDataviewQuery(content: string): boolean {
    return content.includes("```dataview");
  }

  /**
   * Extract dataview queries from content
   * @param content The content to extract queries from
   * @returns Array of extracted dataview queries
   */
  private extractDataviewQueries(content: string): string[] {
    const regex = /```dataview\s+([\s\S]*?)```/g;
    const queries: string[] = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const query = match[1].trim();
      if (query) {
        queries.push(query);
      }
    }
    
    return queries;
  }

  /**
   * Get files from a dataview query
   * @param query The dataview query
   * @param sourcePath The source file path
   * @returns Array of files from dataview query result
   */
  private async getFilesFromDataviewQuery(query: string, sourcePath: string): Promise<TFile[]> {
    // Check if dataview plugin is available
    // @ts-ignore - Dataview API is not typed
    const dataviewPlugin = this.app.plugins.plugins["dataview"];
    if (!dataviewPlugin?.api) {
      console.log("Dataview plugin not available");
      return [];
    }

    const dvApi = dataviewPlugin.api;
    const files: TFile[] = [];
    
    try {
      // Use dataview API to execute query
      const queryResult = await dvApi.queryMarkdown(query, sourcePath);

      if (queryResult.successful) {
        // Process based on query type
        if (typeof queryResult.value === "object" && queryResult.value !== null && queryResult.value.type === "list") {
          // Handle LIST query result as object
          for (const item of queryResult.value.values) {
            if (item.type === "file" && item.path) {
              const file = this.app.vault.getAbstractFileByPath(item.path);
              if (file instanceof TFile) {
                files.push(file);
              }
            }
          }
        } else if (typeof queryResult.value === "object" && queryResult.value !== null && queryResult.value.type === "table") {
          // Handle TABLE query result as object
          for (const row of queryResult.value.values) {
            if (row[0]?.path) {
              const file = this.app.vault.getAbstractFileByPath(row[0].path);
              if (file instanceof TFile) {
                files.push(file);
              }
            }
          }
        } else if (typeof queryResult.value === "string") {
          // Extract all kinds of links that might appear in dataview output
          this.extractLinksFromString(queryResult.value, sourcePath, files);
        }
      }
    } catch (error) {
      console.error("Error executing dataview query:", error);
    }
    
    return files;
  }
  
  /**
   * Extract links from a string and resolve them to files
   * @param content The string content to search for links
   * @param sourcePath The source file path for resolving links
   * @param files Array to add found files to
   */
  private extractLinksFromString(content: string, sourcePath: string, files: TFile[]): void {
    // Try multiple patterns to extract links
    
    // Standard markdown links: [[link]] or [[link|alias]]
    const standardLinkRegex = /\[\[(.*?)\]\]/g;
    this.processRegexMatches(standardLinkRegex, content, sourcePath, files);
    
    // Dataview specific format links: [link](link.md) or [alias](link.md)
    const markdownLinkRegex = /\[(.*?)\]\((.*?)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(content)) !== null) {
      // Use the URL part (second group) as the link
      const linkPath = match[2];
      this.resolveAndAddFile(linkPath, sourcePath, files);
    }
    
    // Handle line items that might be paths
    const lines = content.split("\n");
    for (const line of lines) {
      // Check if line is a list item with potential path (starts with - or *)
      const trimmedLine = line.trim();
      if ((trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) && !trimmedLine.includes("[[") && !trimmedLine.includes("](")) {
        // Extract the potential path (remove the list marker and trim)
        const potentialPath = trimmedLine.substring(2).trim();
        // If it looks like a path (contains '/' or '.md' or doesn't have spaces)
        if (potentialPath.includes("/") || potentialPath.endsWith(".md") || !potentialPath.includes(" ")) {
          this.resolveAndAddFile(potentialPath, sourcePath, files);
        }
      }
    }
  }
  
  /**
   * Process regex matches to extract links
   * @param regex The regex to use
   * @param content The content to search
   * @param sourcePath The source path for resolving links
   * @param files Array to add found files to
   */
  private processRegexMatches(regex: RegExp, content: string, sourcePath: string, files: TFile[]): void {
    let match;
    while ((match = regex.exec(content)) !== null) {
      let linkPath = match[1];
      
      // Handle aliased links: [[path|alias]] -> path
      if (linkPath.includes("|")) {
        linkPath = linkPath.split("|")[0];
      }
      
      this.resolveAndAddFile(linkPath, sourcePath, files);
    }
  }
  
  /**
   * Resolve a path to a file and add it to the files array if found
   * @param linkPath The path to resolve
   * @param sourcePath The source path for resolving
   * @param files Array to add the file to if found
   */
  private resolveAndAddFile(linkPath: string, sourcePath: string, files: TFile[]): void {
    // Check if the path already has an extension
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(linkPath);
    
    // Only add .md extension if no extension exists
    if (!hasExtension) {
      linkPath += ".md";
    }
    
    // Try to resolve the file using the Obsidian metadata API first
    const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
    
    // Fallback to direct path resolution if needed
    let file: TFile | null = null;
    if (resolvedFile instanceof TFile) {
      file = resolvedFile;
    } else if (!resolvedFile) {
      const abstractFile = this.app.vault.getAbstractFileByPath(linkPath);
      if (abstractFile instanceof TFile) {
        file = abstractFile;
      }
    }
    
    if (file instanceof TFile) {
      // Avoid duplicate files
      if (!files.some(existingFile => existingFile.path === file!.path)) {
        files.push(file);
      }
    }
  }

  /**
   * Extract linked notes from a note
   * @param file The file to extract links from
   * @returns Array of linked TFiles
   */
  async getLinkedNotes(file: TFile): Promise<TFile[]> {
    let linkedFiles: TFile[] = [];
    
    // First check if content contains dataview query and settings allow using dataview
    if (this.settings.useDataviewIfAvailable) {
      const fileContent = await this.app.vault.read(file);
      
      if (this.containsDataviewQuery(fileContent)) {
        const queries = this.extractDataviewQueries(fileContent);
        
        if (queries.length > 0) {
          // Process each query and collect results
          for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            
            const dataviewFiles = await this.getFilesFromDataviewQuery(query, file.path);
            
            if (dataviewFiles.length > 0) {
              // Add new files that aren't already in the linked files array
              for (const dataviewFile of dataviewFiles) {
                if (!linkedFiles.some(existingFile => existingFile.path === dataviewFile.path)) {
                  linkedFiles.push(dataviewFile);
                }
              }
            }
          }
        }
      }
    }
    
    // Always extract regular links as well, and combine with dataview results
    const metadataCache = this.app.metadataCache.getFileCache(file);
    const initialCount = linkedFiles.length;
    
    if (metadataCache?.links) {
      for (const link of metadataCache.links) {
        // Get the file for this link
        const linkedFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        
        if (linkedFile && linkedFile instanceof TFile) {
          // Check if the file is already in the linkedFiles array
          if (!linkedFiles.some(existingFile => existingFile.path === linkedFile.path)) {
            linkedFiles.push(linkedFile);
          }
        }
      }
    }
    
    // Also check for embeds
    if (metadataCache?.embeds) {
      for (const embed of metadataCache.embeds) {
        const linkedFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
        
        if (linkedFile && linkedFile instanceof TFile) {
          // Check if the file is already in the linkedFiles array
          if (!linkedFiles.some(existingFile => existingFile.path === linkedFile.path)) {
            linkedFiles.push(linkedFile);
          }
        }
      }
    }
    
    // Final deduplication step
    const uniquePaths = new Set<string>();
    const uniqueFiles: TFile[] = [];
    
    for (const linkedFile of linkedFiles) {
      if (!uniquePaths.has(linkedFile.path)) {
        uniquePaths.add(linkedFile.path);
        uniqueFiles.push(linkedFile);
      }
    }
    
    return uniqueFiles;
  }

  /**
   * Convert date format string to regex pattern
   * @param format The date format string (e.g., "### YYYY-MM-DD")
   * @returns Regex pattern for matching date headers
   */
  private dateFormatToRegex(format: string): RegExp {
    // Escape special regex characters except for the date placeholders
    let pattern = format
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
      .replace(/YYYY/g, '\\d{4}')               // Replace YYYY with year pattern
      .replace(/MM/g, '\\d{2}')                 // Replace MM with month pattern
      .replace(/DD/g, '\\d{2}');                // Replace DD with day pattern
    
    return new RegExp(`^${pattern}\\s*$`, 'm');
  }

  /**
   * Extract date from header using the configured format
   * @param header The header line to parse
   * @param format The date format string
   * @returns Date object or null if not a valid date header
   */
  private extractDateFromHeader(header: string, format: string): Date | null {
    const regex = this.dateFormatToRegex(format);
    if (!regex.test(header)) {
      return null;
    }

    // Find positions of date components in format
    const yearPos = format.indexOf('YYYY');
    const monthPos = format.indexOf('MM');
    const dayPos = format.indexOf('DD');

    if (yearPos === -1 || monthPos === -1 || dayPos === -1) {
      return null;
    }

    // Extract date components from the header at the same positions
    const year = header.substr(yearPos, 4);
    const month = header.substr(monthPos, 2);
    const day = header.substr(dayPos, 2);

    // Validate extracted values are numbers
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
      return null;
    }

    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Check if a note is journal-style (contains headers with configured date format)
   * @param content The content to check
   * @returns True if the note contains date headers
   */
  private isJournalStyleNote(content: string): boolean {
    const dateFormat = this.settings.recentActivityDefaults.dateHeaderFormat;
    const dateHeaderRegex = this.dateFormatToRegex(dateFormat);
    return dateHeaderRegex.test(content);
  }

  /**
   * Parse a date from a header
   * @param header The header line to parse
   * @returns Date object or null if not a valid date header
   */
  private parseDateFromHeader(header: string): Date | null {
    const dateFormat = this.settings.recentActivityDefaults.dateHeaderFormat;
    return this.extractDateFromHeader(header, dateFormat);
  }

  /**
   * Extract sections from content based on date headers
   * @param content The content to parse
   * @returns Array of sections with their dates
   */
  private getDateSections(content: string): Array<{date: Date | null, content: string}> {
    const lines = content.split('\n');
    const sections: Array<{date: Date | null, content: string}> = [];
    let currentSection: string[] = [];
    let currentDate: Date | null = null;
    let hasFoundFirstDate = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsedDate = this.parseDateFromHeader(line);

      if (parsedDate) {
        // Found a date header
        if (!hasFoundFirstDate) {
          // First date header - save any content before it as undated
          if (currentSection.length > 0) {
            sections.push({
              date: null,
              content: currentSection.join('\n').trim()
            });
          }
          hasFoundFirstDate = true;
        } else if (currentSection.length > 0) {
          // Save the previous section
          sections.push({
            date: currentDate,
            content: currentSection.join('\n').trim()
          });
        }

        // Start new section with the date header
        currentDate = parsedDate;
        currentSection = [line];
      } else {
        // Regular content line
        currentSection.push(line);
      }
    }

    // Don't forget the last section
    if (currentSection.length > 0) {
      sections.push({
        date: currentDate,
        content: currentSection.join('\n').trim()
      });
    }

    return sections;
  }

  /**
   * Extract content from a note within a specific date range
   * @param content The full note content
   * @param daysBack Number of days to look back from today
   * @returns Filtered content within the date range
   */
  private extractContentByDateRange(content: string, daysBack: number): string {
    if (!this.isJournalStyleNote(content)) {
      // Not a journal-style note, return full content
      return content;
    }

    const sections = this.getDateSections(content);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);

    const filteredSections: string[] = [];

    for (const section of sections) {
      if (section.date === null) {
        // Include undated content (header/intro)
        filteredSections.push(section.content);
      } else if (section.date >= cutoffDate) {
        // Include sections within the date range
        filteredSections.push(section.content);
      }
    }

    return filteredSections.join('\n\n');
  }

  /**
   * Aggregate content from a set of files
   * @param files Array of files to aggregate content from
   * @param timeWindowDays Optional time window in days for filtering journal content
   * @returns Aggregated content as string along with source file names
   */
  async aggregateContent(files: TFile[], timeWindowDays?: number): Promise<{content: string, sourceNotes: string[]}> {
    let aggregatedContent = "";
    const sourceNotes: string[] = [];
    
    // Create a map to track processed files by path to avoid duplicates
    const processedFiles = new Map<string, boolean>();
    
    for (const file of files) {
      // Skip if we've already processed this file
      if (processedFiles.has(file.path)) {
        continue;
      }
      
      let content = await this.app.vault.read(file);
      
      // Apply time filtering if specified
      if (timeWindowDays !== undefined && timeWindowDays > 0) {
        content = this.extractContentByDateRange(content, timeWindowDays);
        
        // Skip this file if no content remains after filtering
        if (!content.trim()) {
          continue;
        }
      }
      
      aggregatedContent += `\n\n# Note: ${file.basename}\n\n${content}`;
      sourceNotes.push(file.basename);
      
      // Mark this file as processed
      processedFiles.set(file.path, true);
    }
    
    const uniqueFileCount = processedFiles.size;
    
    return { content: aggregatedContent, sourceNotes };
  }

  /**
   * Distill content from linked notes in a root note
   * @param rootFile The root note file to distill from
   * @param preparedContent Optional preprocessed combined content
   * @param preparedSourceNotes Optional preprocessed source notes
   * @param timeWindowDays Optional time window in days for filtering journal content
   * @returns Distilled content as a DistillResponse
   */
  async distillFromRootNote(
    rootFile: TFile, 
    preparedContent?: string, 
    preparedSourceNotes?: string[],
    timeWindowDays?: number
  ): Promise<DistillResponse> {
    let combinedContent: string;
    let sourceNotes: string[];
    
    if (preparedContent && preparedSourceNotes) {
      // Use the provided content and source notes
      combinedContent = preparedContent;
      sourceNotes = preparedSourceNotes;
    } else {
      // Get all linked notes
      const linkedFiles = await this.getLinkedNotes(rootFile);
      
      // Get content from root note
      let rootContent = await this.app.vault.read(rootFile);
      
      // Apply time filtering to root note if specified
      if (timeWindowDays !== undefined && timeWindowDays > 0) {
        rootContent = this.extractContentByDateRange(rootContent, timeWindowDays);
      }
      
      // Aggregate content from all linked notes with time filtering
      const aggregatedResult = await this.aggregateContent(linkedFiles, timeWindowDays);
      const linkedContent = aggregatedResult.content;
      sourceNotes = aggregatedResult.sourceNotes;
      
      // Combine root content with linked content
      combinedContent = `# Root Note: ${rootFile.basename}\n\n${rootContent}\n\n${linkedContent}`;
    }
    
    // Log the combined content before sending to AI
    await this.logDistillContext(combinedContent, rootFile.basename);
    
    // Send to OpenAI for distillation
    const distilledContent = await this.openAIService.distillContent(combinedContent);
    
    // Add source notes to the response
    distilledContent.sourceNotes = [rootFile.basename, ...sourceNotes];
    
    return distilledContent;
  }
} 