import { App } from 'obsidian';
import { TaskDispatchSettings } from './task-dispatch';

export interface RecentActivitySettings {
  daysBack: number;
  excludeFolders: string[];
  filterJournalSections: boolean;
  dateHeaderFormat: string;
}

export interface ContextGatheringDefaults {
  linkDepth: number;
  maxCharacters: number;
  filterRecentSectionsOnly: boolean;
  includeBacklinks: boolean;
  backlinkContextLines: number;  // 0 = header section, N = lines before/after
}

export interface OpenAugiSettings {
  apiKey: string;
  defaultModel: string;
  customModelOverride: string;
  cachedModels: string[];
  summaryFolder: string;
  notesFolder: string;
  promptsFolder: string;
  publishedFolder: string;
  useDataviewIfAvailable: boolean;
  enableDistillLogging: boolean;
  recentActivityDefaults: RecentActivitySettings;
  contextGatheringDefaults: ContextGatheringDefaults;
  taskDispatch: TaskDispatchSettings;
}

export const DEFAULT_SETTINGS: OpenAugiSettings = {
  apiKey: '',
  defaultModel: 'gpt-5.2',
  customModelOverride: '',
  cachedModels: ['gpt-5.2', 'gpt-5.2-instant', 'gpt-5.2-thinking', 'gpt-5.2-pro', 'gpt-5.2-codex', 'gpt-5.1', 'gpt-5', 'o4-mini'],
  summaryFolder: 'OpenAugi/Summaries',
  notesFolder: 'OpenAugi/Notes',
  promptsFolder: 'OpenAugi/Prompts',
  publishedFolder: 'OpenAugi/Published',
  useDataviewIfAvailable: true,
  enableDistillLogging: false,
  recentActivityDefaults: {
    daysBack: 7,
    excludeFolders: ['Templates', 'Archive', 'OpenAugi'],
    filterJournalSections: true,
    dateHeaderFormat: '### YYYY-MM-DD'
  },
  contextGatheringDefaults: {
    linkDepth: 1,
    maxCharacters: 100000,
    filterRecentSectionsOnly: true,
    includeBacklinks: true,
    backlinkContextLines: 0
  },
  taskDispatch: {
    terminalApp: 'iterm2',
    tmuxPath: '',
    defaultWorkingDir: 'OpenAugi/Tasks',
    agents: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        command: 'claude',
        contextFlag: '--append-system-prompt'
      }
    ],
    defaultAgent: 'claude-code',
    contextTempDir: '/tmp/openaugi',
    maxContextChars: 200000
  }
}; 