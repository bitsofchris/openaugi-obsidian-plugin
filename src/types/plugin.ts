import { Plugin } from 'obsidian';
import { OpenAugiSettings } from './settings';
import { OpenAIService } from '../services/openai-service';
import { FileService } from '../services/file-service';
import type { TaskDispatchService } from '../services/task-dispatch-service';
import { TaskFileService } from '../services/task-file-service';

export default interface OpenAugiPlugin extends Plugin {
  settings: OpenAugiSettings;
  openAIService: OpenAIService;
  fileService: FileService;
  taskFileService: TaskFileService;
  /** @deprecated Task Dispatch bypasses the task watcher — use TaskFileService. */
  taskDispatchService: TaskDispatchService | null;
  saveSettings(): Promise<void>;
}