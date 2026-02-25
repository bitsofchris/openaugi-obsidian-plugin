import { TFile } from 'obsidian';

export interface AgentConfig {
  id: string;
  name: string;
  command: string;
  contextFlag: string;
}

export type TerminalApp = 'iterm2' | 'terminal-app';

export interface TaskDispatchSettings {
  terminalApp: TerminalApp;
  tmuxPath: string; // absolute path to tmux binary; empty = auto-detect
  defaultWorkingDir: string; // directory Claude launches in; overridden by `repo` frontmatter
  agents: AgentConfig[];
  defaultAgent: string;
  contextTempDir: string;
  maxContextChars: number;
}

export interface TaskSession {
  taskId: string;
  tmuxSessionName: string;
  startedAt: string;
  noteFile?: TFile;
}
