import { Plugin } from 'obsidian';
import { OpenAugiSettings } from './settings';
import { OpenAIService } from '../services/openai-service';
import { FileService } from '../services/file-service';
import type { TaskDispatchService } from '../services/task-dispatch-service';

export default interface OpenAugiPlugin extends Plugin {
  settings: OpenAugiSettings;
  openAIService: OpenAIService;
  fileService: FileService;
  taskDispatchService: TaskDispatchService | null;
  saveSettings(): Promise<void>;
} 