import { TFile } from 'obsidian';

export interface AgentConfig {
  id: string;
  name: string;
  command: string;
  contextFlag: string;
}

export interface RepoPath {
  name: string;   // short name used in frontmatter, e.g. "my-repo"
  path: string;   // absolute filesystem path, e.g. "/Users/chris/repos/my-repo"
}

export type TerminalApp = 'iterm2' | 'terminal-app';

export interface TaskDispatchSettings {
  terminalApp: TerminalApp;
  tmuxPath: string; // absolute path to tmux binary; empty = auto-detect
  defaultWorkingDir: string; // directory Claude launches in; overridden by `working_dir` frontmatter
  agents: AgentConfig[];
  defaultAgent: string;
  contextTempDir: string;
  maxContextChars: number;
  repoPaths: RepoPath[];
}

export interface TaskSession {
  taskId: string;
  tmuxSessionName: string;
  startedAt: string;
  noteFile?: TFile;
}
