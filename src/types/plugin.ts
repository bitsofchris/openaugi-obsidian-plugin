import { Plugin } from 'obsidian';
import { OpenAugiSettings } from './settings';
import { OpenAIService } from '../services/openai-service';
import { FileService } from '../services/file-service';

export default interface OpenAugiPlugin extends Plugin {
  settings: OpenAugiSettings;
  openAIService: OpenAIService;
  fileService: FileService;
  saveSettings(): Promise<void>;
} 