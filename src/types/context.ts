import { TFile } from 'obsidian';

/**
 * Configuration for context gathering
 */
export interface ContextGatheringConfig {
  // Source mode
  sourceMode: 'linked-notes' | 'recent-activity';
  rootNote?: TFile;  // Required for linked-notes mode

  // Link traversal settings (for linked-notes mode)
  linkDepth: number;  // 1-3
  maxCharacters: number;  // Default: 100000

  // Time filtering (for recent-activity mode)
  timeWindow?: {
    mode: 'days-back' | 'date-range';
    daysBack?: number;
    fromDate?: string;
    toDate?: string;
  };

  // Folder filtering
  excludeFolders: string[];

  // Section filtering for journal-style notes
  filterRecentSectionsOnly: boolean;  // Uses date header logic from settings
  dateHeaderFormat: string;  // e.g., "### YYYY-MM-DD"

  // For recent activity: how many days back to filter journal sections
  journalSectionDays?: number;
}

/**
 * Represents a discovered note with metadata about how it was found
 */
export interface DiscoveredNote {
  file: TFile;
  depth: number;  // 0 = root, 1 = direct link, 2 = second level, etc.
  discoveredVia: string;  // "root" | "linked from [[Note]]" | "recent activity"
  estimatedChars: number;
  included: boolean;  // User can toggle in checkbox modal
}

/**
 * The complete gathered context with all metadata
 */
export interface GatheredContext {
  notes: DiscoveredNote[];
  aggregatedContent: string;
  totalCharacters: number;
  totalNotes: number;
  config: ContextGatheringConfig;
  timestamp: string;
}

/**
 * Options that customize the flow per command
 */
export interface CommandOptions {
  commandType: 'distill' | 'publish' | 'save-raw';
  defaultSourceMode: 'linked-notes' | 'recent-activity';
  defaultDepth: number;
  skipPreview?: boolean;  // For "save raw" command
}

/**
 * Processing type for AI operations
 */
export type ProcessingType = 'distill' | 'publish';

/**
 * Configuration for processing with AI
 */
export interface ProcessingConfig {
  type: ProcessingType;
  customPrompt?: string;
  customPromptName?: string;
}
