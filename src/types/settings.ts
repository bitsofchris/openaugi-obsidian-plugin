import { App } from 'obsidian';

export interface RecentActivitySettings {
  daysBack: number;
  excludeFolders: string[];
  filterJournalSections: boolean;
  dateHeaderFormat: string;
}

export interface OpenAugiSettings {
  apiKey: string;
  summaryFolder: string;
  notesFolder: string;
  useDataviewIfAvailable: boolean;
  enableDistillLogging: boolean;
  recentActivityDefaults: RecentActivitySettings;
}

export const DEFAULT_SETTINGS: OpenAugiSettings = {
  apiKey: '',
  summaryFolder: 'OpenAugi/Summaries',
  notesFolder: 'OpenAugi/Notes',
  useDataviewIfAvailable: true,
  enableDistillLogging: false,
  recentActivityDefaults: {
    daysBack: 7,
    excludeFolders: ['Templates', 'Archive', 'OpenAugi'],
    filterJournalSections: true,
    dateHeaderFormat: '### YYYY-MM-DD'
  }
}; 