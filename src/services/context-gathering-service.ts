import { App, TFile } from 'obsidian';
import { DistillService } from './distill-service';
import { OpenAugiSettings } from '../types/settings';
import {
  ContextGatheringConfig,
  DiscoveredNote,
  GatheredContext
} from '../types/context';

/**
 * Service for unified context gathering across all commands
 * Handles link traversal, recent activity discovery, and content aggregation
 */
export class ContextGatheringService {
  private app: App;
  private distillService: DistillService;
  private settings: OpenAugiSettings;

  constructor(app: App, distillService: DistillService, settings: OpenAugiSettings) {
    this.app = app;
    this.distillService = distillService;
    this.settings = settings;
  }

  /**
   * Main entry point: Gather context based on configuration
   * @param config The configuration specifying how to gather context
   * @returns Complete gathered context with metadata
   */
  async gatherContext(config: ContextGatheringConfig): Promise<GatheredContext> {
    let discoveredNotes: DiscoveredNote[];

    if (config.sourceMode === 'linked-notes') {
      if (!config.rootNote) {
        throw new Error('Root note required for linked-notes mode');
      }
      discoveredNotes = await this.discoverLinkedNotes(
        config.rootNote,
        config.linkDepth,
        config.maxCharacters
      );
    } else {
      if (!config.timeWindow) {
        throw new Error('Time window required for recent-activity mode');
      }
      discoveredNotes = await this.discoverRecentNotes(
        config.timeWindow,
        config.excludeFolders
      );
    }

    // Apply folder filtering
    discoveredNotes = this.applyFolderFilters(discoveredNotes, config.excludeFolders);

    // Aggregate content from included notes only
    const includedNotes = discoveredNotes.filter(n => n.included);

    const aggregatedContent = await this.aggregateContent(
      includedNotes,
      config.filterRecentSectionsOnly ? config.journalSectionDays : undefined
    );

    return {
      notes: discoveredNotes,
      aggregatedContent: aggregatedContent.content,
      totalCharacters: aggregatedContent.content.length,
      totalNotes: includedNotes.length,
      config: config,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Discover notes by traversing links up to specified depth using BFS
   * @param rootNote The starting note
   * @param maxDepth Maximum depth to traverse (1-3)
   * @param maxCharacters Stop when this many characters have been gathered
   * @returns Array of discovered notes with metadata
   */
  private async discoverLinkedNotes(
    rootNote: TFile,
    maxDepth: number,
    maxCharacters: number
  ): Promise<DiscoveredNote[]> {
    const discovered = new Map<string, DiscoveredNote>();
    const queue: Array<{ file: TFile; depth: number; via: string }> = [];

    // Start with root note
    const rootContent = await this.app.vault.read(rootNote);
    discovered.set(rootNote.path, {
      file: rootNote,
      depth: 0,
      discoveredVia: 'root',
      estimatedChars: rootContent.length,
      included: true
    });

    // Get direct links from root
    const rootLinks = await this.distillService.getLinkedNotes(rootNote);
    for (const link of rootLinks) {
      queue.push({ file: link, depth: 1, via: rootNote.basename });
    }

    // BFS traversal
    let totalChars = rootContent.length;

    while (queue.length > 0) {
      const { file, depth, via } = queue.shift()!;

      // Skip if already discovered
      if (discovered.has(file.path)) {
        continue;
      }

      // Read content to check size
      const content = await this.app.vault.read(file);
      const chars = content.length;

      // Check if adding this note would exceed character limit
      if (totalChars + chars > maxCharacters) {
        // Mark as discovered but not included due to size limit
        discovered.set(file.path, {
          file,
          depth,
          discoveredVia: `linked from [[${via}]]`,
          estimatedChars: chars,
          included: false  // Excluded due to size limit
        });
        continue;
      }

      // Add to discovered and include it
      discovered.set(file.path, {
        file,
        depth,
        discoveredVia: `linked from [[${via}]]`,
        estimatedChars: chars,
        included: true
      });

      totalChars += chars;

      // If we haven't reached max depth, get links from this note
      if (depth < maxDepth) {
        try {
          const linkedNotes = await this.distillService.getLinkedNotes(file);
          for (const linkedNote of linkedNotes) {
            // Don't queue if already discovered
            if (!discovered.has(linkedNote.path)) {
              queue.push({ file: linkedNote, depth: depth + 1, via: file.basename });
            }
          }
        } catch (error) {
          console.warn(`Failed to get linked notes from ${file.path}:`, error);
          // Continue with other notes even if one fails
        }
      }
    }

    // Convert to array and sort by depth, then by name
    return Array.from(discovered.values()).sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.file.basename.localeCompare(b.file.basename);
    });
  }

  /**
   * Discover notes by recent activity
   * @param timeWindow Time window configuration
   * @param excludeFolders Folders to exclude
   * @returns Array of discovered notes
   */
  private async discoverRecentNotes(
    timeWindow: { mode: string; daysBack?: number; fromDate?: string; toDate?: string },
    excludeFolders: string[]
  ): Promise<DiscoveredNote[]> {
    const recentFiles = await this.distillService.getRecentlyModifiedNotes(
      timeWindow.daysBack || 7,
      excludeFolders,
      timeWindow.fromDate,
      timeWindow.toDate
    );

    const discovered: DiscoveredNote[] = [];

    for (const file of recentFiles) {
      const content = await this.app.vault.read(file);
      discovered.push({
        file,
        depth: 0,  // No depth concept for recent activity
        discoveredVia: 'recent activity',
        estimatedChars: content.length,
        included: true
      });
    }

    return discovered;
  }

  /**
   * Apply folder filtering to discovered notes
   * @param notes Notes to filter
   * @param excludeFolders Folders to exclude
   * @returns Filtered notes with updated included property
   */
  private applyFolderFilters(
    notes: DiscoveredNote[],
    excludeFolders: string[]
  ): DiscoveredNote[] {
    return notes.map(note => {
      const isExcluded = excludeFolders.some(folder =>
        note.file.path.startsWith(folder + '/') ||
        note.file.path.includes('/' + folder + '/')
      );

      if (isExcluded && note.included) {
        return { ...note, included: false };
      }

      return note;
    });
  }

  /**
   * Aggregate content from notes
   * @param notes Notes to aggregate
   * @param filterJournalDays Optional days back for journal section filtering
   * @returns Aggregated content and source note names
   */
  private async aggregateContent(
    notes: DiscoveredNote[],
    filterJournalDays?: number
  ): Promise<{ content: string; sourceNotes: string[] }> {
    // Reuse existing aggregateContent from DistillService
    const files = notes.map(n => n.file);
    return await this.distillService.aggregateContent(files, filterJournalDays);
  }

  /**
   * Estimate size before gathering (quick estimation for UI)
   * @param rootNote Root note for linked-notes mode
   * @param mode Source mode
   * @param depth Link depth for linked-notes mode
   * @returns Estimated note count and character count
   */
  async estimateSize(
    rootNote: TFile | undefined,
    mode: 'linked-notes' | 'recent-activity',
    depth?: number
  ): Promise<{ noteCount: number; estimatedChars: number }> {
    if (mode === 'linked-notes') {
      if (!rootNote) {
        return { noteCount: 0, estimatedChars: 0 };
      }

      try {
        const links = await this.distillService.getLinkedNotes(rootNote);
        // Rough estimate: 5000 chars per note average
        // For depth > 1, multiply by depth factor
        const depthFactor = depth || 1;
        const estimatedNoteCount = (links.length * depthFactor) + 1; // +1 for root
        const estimated = estimatedNoteCount * 5000;
        return { noteCount: estimatedNoteCount, estimatedChars: estimated };
      } catch (error) {
        console.warn('Failed to estimate size:', error);
        return { noteCount: 0, estimatedChars: 0 };
      }
    } else {
      // For recent activity, get actual recent files
      try {
        const recentFiles = await this.distillService.getRecentlyModifiedNotes(
          7,  // Default estimate
          this.settings.recentActivityDefaults.excludeFolders
        );
        const estimated = recentFiles.length * 5000;
        return { noteCount: recentFiles.length, estimatedChars: estimated };
      } catch (error) {
        console.warn('Failed to estimate size:', error);
        return { noteCount: 0, estimatedChars: 0 };
      }
    }
  }
}
