import { App, TFile, MetadataCache, Component } from 'obsidian';
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
    let file = null;
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
      if (!files.some(existingFile => existingFile.path === file.path)) {
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
   * Aggregate content from a set of files
   * @param files Array of files to aggregate content from
   * @returns Aggregated content as string along with source file names
   */
  async aggregateContent(files: TFile[]): Promise<{content: string, sourceNotes: string[]}> {
    let aggregatedContent = "";
    const sourceNotes: string[] = [];
    
    // Create a map to track processed files by path to avoid duplicates
    const processedFiles = new Map<string, boolean>();
    
    for (const file of files) {
      // Skip if we've already processed this file
      if (processedFiles.has(file.path)) {
        continue;
      }
      
      const content = await this.app.vault.read(file);
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
   * @returns Distilled content as a DistillResponse
   */
  async distillFromRootNote(
    rootFile: TFile, 
    preparedContent?: string, 
    preparedSourceNotes?: string[]
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
      const rootContent = await this.app.vault.read(rootFile);
      
      // Aggregate content from all linked notes
      const aggregatedResult = await this.aggregateContent(linkedFiles);
      const linkedContent = aggregatedResult.content;
      sourceNotes = aggregatedResult.sourceNotes;
      
      // Combine root content with linked content
      combinedContent = `# Root Note: ${rootFile.basename}\n\n${rootContent}\n\n${linkedContent}`;
    }
    
    // Send to OpenAI for distillation
    const distilledContent = await this.openAIService.distillContent(combinedContent);
    
    // Add source notes to the response
    distilledContent.sourceNotes = [rootFile.basename, ...sourceNotes];
    
    return distilledContent;
  }
} 