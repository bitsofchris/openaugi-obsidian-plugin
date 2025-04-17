import { App, TFile, MetadataCache } from 'obsidian';
import { OpenAIService } from './openai-service';
import { DistillResponse } from '../types/transcript';

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
  
  constructor(app: App, openAIService: OpenAIService) {
    this.app = app;
    this.openAIService = openAIService;
  }

  /**
   * Extract linked notes from a note
   * @param file The file to extract links from
   * @returns Array of linked TFiles
   */
  async getLinkedNotes(file: TFile): Promise<TFile[]> {
    const linkedFiles: TFile[] = [];
    
    // Get metadata cache for the current file
    const metadataCache = this.app.metadataCache.getFileCache(file);
    
    if (metadataCache?.links) {
      for (const link of metadataCache.links) {
        // Get the file for this link
        const linkedFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        
        if (linkedFile && linkedFile instanceof TFile) {
          linkedFiles.push(linkedFile);
        }
      }
    }
    
    // Also check for embeds
    if (metadataCache?.embeds) {
      for (const embed of metadataCache.embeds) {
        const linkedFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
        
        if (linkedFile && linkedFile instanceof TFile) {
          linkedFiles.push(linkedFile);
        }
      }
    }
    
    return linkedFiles;
  }

  /**
   * Aggregate content from a set of files
   * @param files Array of files to aggregate content from
   * @returns Aggregated content as string along with source file names
   */
  async aggregateContent(files: TFile[]): Promise<{content: string, sourceNotes: string[]}> {
    let aggregatedContent = "";
    const sourceNotes: string[] = [];
    
    for (const file of files) {
      const content = await this.app.vault.read(file);
      aggregatedContent += `\n\n# Note: ${file.basename}\n\n${content}`;
      sourceNotes.push(file.basename);
    }
    
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
      
      // Log root note content
      console.log('Root Note Content:', rootContent);
      console.log('Root Note Character Count:', rootContent.length);
      console.log('Root Note Estimated Token Count:', estimateTokens(rootContent));
      
      // Aggregate content from all linked notes
      const aggregatedResult = await this.aggregateContent(linkedFiles);
      const linkedContent = aggregatedResult.content;
      sourceNotes = aggregatedResult.sourceNotes;
      
      // Combine root content with linked content
      combinedContent = `# Root Note: ${rootFile.basename}\n\n${rootContent}\n\n${linkedContent}`;
      
      // Log combined content statistics
      console.log('Number of Linked Notes:', linkedFiles.length);
      console.log('Combined Content Character Count:', combinedContent.length);
      console.log('Combined Content Estimated Token Count:', estimateTokens(combinedContent));
    }
    
    // Send to OpenAI for distillation
    const distilledContent = await this.openAIService.distillContent(combinedContent);
    
    // Add source notes to the response
    distilledContent.sourceNotes = [rootFile.basename, ...sourceNotes];
    
    return distilledContent;
  }
} 