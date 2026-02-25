import { App, TFile, Notice } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAugiSettings } from '../types/settings';
import { DistillService } from './distill-service';
import { AgentConfig, TaskSession } from '../types/task-dispatch';

const execAsync = promisify(exec);

/** Common locations where Homebrew installs tmux. */
const TMUX_SEARCH_PATHS = [
  '/opt/homebrew/bin/tmux',   // Apple Silicon Homebrew
  '/usr/local/bin/tmux',      // Intel Homebrew
  '/usr/bin/tmux',            // system install
];

/**
 * Try to locate the tmux binary on disk.
 * Returns the absolute path if found, or null.
 */
export async function detectTmuxPath(): Promise<string | null> {
  for (const p of TMUX_SEARCH_PATHS) {
    try {
      await fs.promises.access(p, fs.constants.X_OK);
      return p;
    } catch { /* not here */ }
  }
  // Fallback: try `which` with an augmented PATH
  try {
    const { stdout } = await execAsync('which tmux', {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? '/usr/bin:/bin'}`,
      },
    });
    const found = stdout.trim();
    if (found) return found;
  } catch { /* not found */ }
  return null;
}

export class TaskDispatchService {
  private app: App;
  private settings: OpenAugiSettings;
  private distillService: DistillService;

  constructor(
    app: App,
    settings: OpenAugiSettings,
    distillService: DistillService
  ) {
    this.app = app;
    this.settings = settings;
    this.distillService = distillService;
  }

  /** Resolve the tmux binary path from settings or auto-detect. */
  private async getTmux(): Promise<string> {
    const configured = this.settings.taskDispatch.tmuxPath;
    if (configured) return configured;

    const detected = await detectTmuxPath();
    if (detected) return detected;
    throw new Error('tmux not found. Set the path in Settings → Task Dispatch, or install with: brew install tmux');
  }

  /**
   * Launch a new session or attach to an existing one for the given task note.
   * The plugin only reads task_id from frontmatter — all other task state
   * is managed by the MCP server / agent inside the session.
   */
  async launchOrAttach(file: TFile): Promise<void> {
    const taskId = this.getTaskId(file);
    if (!taskId) {
      new Notice('This note is not a task note. Add task_id to frontmatter.');
      return;
    }

    const sessionName = `task-${taskId}`;
    const agentConfig = this.getAgentConfig();

    try {
      const tmux = await this.getTmux();
      const exists = await this.tmuxSessionExists(tmux, sessionName);

      if (exists) {
        new Notice(`Attaching to session: ${taskId}`);
        await this.openTerminal(sessionName);
      } else {
        new Notice(`Launching session: ${taskId}`);

        const contextContent = await this.assembleContext(file, taskId);
        const contextFilePath = await this.writeContextFile(taskId, contextContent);

        const workingDir = this.getWorkingDir(file);
        await this.createTmuxSession(tmux, sessionName, agentConfig, contextFilePath, workingDir);
        await this.openTerminal(sessionName);
      }
    } catch (error) {
      console.error('Task dispatch error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Task dispatch failed: ${msg}`);
    }
  }

  /**
   * Kill the tmux session for the given task note.
   */
  async killSession(file: TFile): Promise<void> {
    const taskId = this.getTaskId(file);
    if (!taskId) {
      new Notice('This note is not a task note. Add task_id to frontmatter.');
      return;
    }

    const sessionName = `task-${taskId}`;

    try {
      const tmux = await this.getTmux();
      const exists = await this.tmuxSessionExists(tmux, sessionName);
      if (!exists) {
        new Notice(`No active session for: ${taskId}`);
        return;
      }

      await execAsync(`${tmux} kill-session -t ${this.shellEscape(sessionName)}`);
      this.cleanupContextFile(taskId);

      new Notice(`Killed session: ${taskId}`);
    } catch (error) {
      console.error('Failed to kill session:', error);
      new Notice(`Failed to kill session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Kill a session by task ID (used from the session list modal).
   */
  async killSessionById(taskId: string): Promise<void> {
    const sessionName = `task-${taskId}`;
    try {
      const tmux = await this.getTmux();
      await execAsync(`${tmux} kill-session -t ${this.shellEscape(sessionName)}`);
      this.cleanupContextFile(taskId);
    } catch (error) {
      console.error('Failed to kill session:', error);
      throw error;
    }
  }

  /**
   * List all active task tmux sessions.
   */
  async listActiveSessions(): Promise<TaskSession[]> {
    try {
      const tmux = await this.getTmux();
      const { stdout } = await execAsync(
        `${tmux} list-sessions -F "#{session_name} #{session_created}" 2>/dev/null`
      );

      const sessions: TaskSession[] = [];

      for (const line of stdout.trim().split('\n')) {
        if (!line.trim()) continue;

        const parts = line.trim().split(' ');
        const sessionName = parts[0];
        const createdTimestamp = parts[1];

        if (!sessionName.startsWith('task-')) continue;

        const taskId = sessionName.replace('task-', '');
        const noteFile = this.findTaskNote(taskId);

        const startedAt = createdTimestamp
          ? new Date(parseInt(createdTimestamp) * 1000).toISOString()
          : 'unknown';

        sessions.push({
          taskId,
          tmuxSessionName: sessionName,
          startedAt,
          noteFile
        });
      }

      return sessions;
    } catch {
      // tmux not running or no sessions — return empty
      return [];
    }
  }

  /**
   * Open terminal attached to a tmux session (public for use from modal).
   */
  async openTerminal(sessionName: string): Promise<void> {
    const tmux = await this.getTmux();
    const terminalApp = this.settings.taskDispatch.terminalApp;
    const attachCmd = `${tmux} attach -t ${this.shellEscape(sessionName)}`;

    let osascript: string;
    if (terminalApp === 'iterm2') {
      osascript = `tell application "iTerm2" to create window with default profile command "${attachCmd}"`;
    } else {
      osascript = `tell app "Terminal" to do script "${attachCmd}"`;
    }

    try {
      await execAsync(`osascript -e '${osascript}'`);
    } catch (error) {
      console.error('Failed to open terminal:', error);
      new Notice(`Could not open ${terminalApp === 'iterm2' ? 'iTerm2' : 'Terminal.app'}. Check your terminal settings.`);
    }
  }

  // --- Private helpers ---

  /**
   * Read task_id from frontmatter. This is the only field the plugin cares about.
   */
  private getTaskId(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const taskId = fm?.['task_id'] || fm?.['task-id'];
    return taskId ? String(taskId) : null;
  }

  /**
   * Resolve the working directory for a task session.
   * Priority: `repo` frontmatter → defaultWorkingDir setting → home dir.
   */
  private getWorkingDir(file: TFile): string {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const repo = fm?.['repo'];
    if (repo && typeof repo === 'string') return repo;

    const defaultDir = this.settings.taskDispatch.defaultWorkingDir;
    if (defaultDir) return defaultDir;

    return process.env.HOME ?? '/tmp';
  }

  private async assembleContext(file: TFile, taskId: string): Promise<string> {
    // Read note body and strip frontmatter
    const rawContent = await this.app.vault.read(file);
    const noteBody = rawContent.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

    // Get linked notes and aggregate their content
    const linkedFiles = await this.distillService.getLinkedNotes(file);
    let linkedContent = '';

    if (linkedFiles.length > 0) {
      const { content } = await this.distillService.aggregateContent(linkedFiles);
      linkedContent = content;
    }

    let context = `# Task: ${taskId}\n\n---\n\n## Task Note\n\n${noteBody}`;

    if (linkedContent) {
      context += `\n\n---\n\n## Linked Context\n${linkedContent}`;
    }

    context += '\n\n---\n\n## Additional Context\n\nThe OpenAugi MCP server is available if you need to query for more context beyond what\'s provided here.';

    // Cap at max characters
    const maxChars = this.settings.taskDispatch.maxContextChars;
    if (context.length > maxChars) {
      context = context.substring(0, maxChars) + '\n\n...(context truncated at character limit)';
    }

    return context;
  }

  private async writeContextFile(taskId: string, content: string): Promise<string> {
    const dir = this.settings.taskDispatch.contextTempDir;
    const filePath = path.join(dir, `task-${taskId}-context.md`);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  private cleanupContextFile(taskId: string): void {
    const filePath = path.join(
      this.settings.taskDispatch.contextTempDir,
      `task-${taskId}-context.md`
    );
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Non-critical, ignore cleanup failures
    }
  }

  private async tmuxSessionExists(tmux: string, sessionName: string): Promise<boolean> {
    try {
      await execAsync(`${tmux} has-session -t ${this.shellEscape(sessionName)} 2>/dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  private async createTmuxSession(
    tmux: string,
    sessionName: string,
    agentConfig: AgentConfig,
    contextFilePath: string,
    workingDir: string
  ): Promise<void> {
    await execAsync(`${tmux} new-session -d -s ${this.shellEscape(sessionName)} -c ${this.shellEscape(workingDir)}`);

    const agentCommand = `${agentConfig.command} ${agentConfig.contextFlag} ${this.shellEscape(contextFilePath)}`;
    await execAsync(
      `${tmux} send-keys -t ${this.shellEscape(sessionName)} ${this.shellEscape(agentCommand)} Enter`
    );
  }

  private getAgentConfig(): AgentConfig {
    const agents = this.settings.taskDispatch.agents;
    const id = this.settings.taskDispatch.defaultAgent;
    return agents.find(a => a.id === id) || agents[0];
  }

  private findTaskNote(taskId: string): TFile | undefined {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (fm?.['task_id'] === taskId || fm?.['task-id'] === taskId) {
        return file;
      }
    }
    return undefined;
  }

  private shellEscape(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
  }
}
