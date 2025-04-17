import { App } from 'obsidian';

export interface OpenAugiSettings {
  apiKey: string;
  summaryFolder: string;
  notesFolder: string;
  useDataviewIfAvailable: boolean;
}

export const DEFAULT_SETTINGS: OpenAugiSettings = {
  apiKey: '',
  summaryFolder: 'OpenAugi/Summaries',
  notesFolder: 'OpenAugi/Notes',
  useDataviewIfAvailable: true
}; 