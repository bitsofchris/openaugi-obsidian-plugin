import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { resolveRepoPath, TaskDispatchService } from '../src/services/task-dispatch-service';
import { DEFAULT_SETTINGS, OpenAugiSettings } from '../src/types/settings';
import { RepoPath } from '../src/types/task-dispatch';
import { TFile } from './mocks/obsidian-module';

// ─── Mock child_process.exec to avoid real tmux/osascript calls ──────────────

const mockExecAsync = vi.fn();
vi.mock('child_process', () => ({
  exec: (...args: any[]) => {
    // promisify(exec) wraps exec into a function that returns a promise.
    // We intercept the callback-style call and delegate to mockExecAsync.
    const cb = args[args.length - 1];
    if (typeof cb === 'function') {
      mockExecAsync(args[0], args[1])
        .then((result: any) => cb(null, result))
        .catch((err: any) => cb(err));
    }
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockApp(vaultBasePath: string) {
  return {
    vault: {
      adapter: { getBasePath: () => vaultBasePath },
      read: vi.fn(),
      getMarkdownFiles: vi.fn().mockReturnValue([]),
    },
    metadataCache: {
      getFileCache: vi.fn(),
    },
  };
}

function createMockDistillService() {
  return {
    getLinkedNotes: vi.fn().mockResolvedValue([]),
    aggregateContent: vi.fn().mockResolvedValue({ content: '', sourceNotes: [] }),
  };
}

function makeSettings(overrides: Partial<OpenAugiSettings['taskDispatch']> = {}): OpenAugiSettings {
  return {
    ...DEFAULT_SETTINGS,
    taskDispatch: {
      ...DEFAULT_SETTINGS.taskDispatch,
      tmuxPath: '/usr/bin/tmux',
      ...overrides,
    },
  };
}

function makeTFile(relativePath: string, frontmatter?: Record<string, any>): { file: TFile; frontmatter: Record<string, any> | undefined } {
  const file = new TFile(relativePath);
  return { file, frontmatter };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('resolveRepoPath (pure function)', () => {
  const repoPaths: RepoPath[] = [
    { name: 'my-repo', path: '/Users/chris/repos/my-repo' },
    { name: 'Other Project', path: '/opt/projects/other' },
  ];

  it('matches by name (case-insensitive)', () => {
    expect(resolveRepoPath('my-repo', repoPaths)).toBe('/Users/chris/repos/my-repo');
    expect(resolveRepoPath('MY-REPO', repoPaths)).toBe('/Users/chris/repos/my-repo');
    expect(resolveRepoPath('My-Repo', repoPaths)).toBe('/Users/chris/repos/my-repo');
  });

  it('returns null for unknown names', () => {
    expect(resolveRepoPath('nonexistent', repoPaths)).toBeNull();
  });

  it('returns null for empty repo paths', () => {
    expect(resolveRepoPath('anything', [])).toBeNull();
  });

  it('returns null for null/undefined repo paths', () => {
    expect(resolveRepoPath('anything', null as any)).toBeNull();
    expect(resolveRepoPath('anything', undefined as any)).toBeNull();
  });
});

describe('TaskDispatchService', () => {
  let app: ReturnType<typeof createMockApp>;
  let distillService: ReturnType<typeof createMockDistillService>;
  let settings: OpenAugiSettings;
  let service: TaskDispatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createMockApp('/Users/chris/vault');
    distillService = createMockDistillService();
    settings = makeSettings();
    service = new TaskDispatchService(app as any, settings, distillService as any);
  });

  // ─── shellEscape ─────────────────────────────────────────────────────────

  describe('shellEscape', () => {
    const escape = (str: string) => (service as any).shellEscape(str);

    it('wraps in single quotes', () => {
      expect(escape('hello')).toBe("'hello'");
    });

    it('escapes single quotes in the string', () => {
      expect(escape("it's")).toBe("'it'\\''s'");
    });

    it('handles empty string', () => {
      expect(escape('')).toBe("''");
    });

    it('handles strings with spaces and special chars', () => {
      expect(escape('hello world $HOME')).toBe("'hello world $HOME'");
    });

    it('handles multiple single quotes', () => {
      expect(escape("a'b'c")).toBe("'a'\\''b'\\''c'");
    });
  });

  // ─── getTaskId ───────────────────────────────────────────────────────────

  describe('getTaskId', () => {
    const getTaskId = (file: TFile) => (service as any).getTaskId(file);

    it('reads task_id from frontmatter', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { task_id: 'abc-123' },
      });
      expect(getTaskId(file)).toBe('abc-123');
    });

    it('reads task-id (hyphenated) from frontmatter', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { 'task-id': 'def-456' },
      });
      expect(getTaskId(file)).toBe('def-456');
    });

    it('returns null when no frontmatter', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue(null);
      expect(getTaskId(file)).toBeNull();
    });

    it('returns null when frontmatter has no task_id', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { title: 'Hello' },
      });
      expect(getTaskId(file)).toBeNull();
    });

    it('converts numeric task_id to string', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { task_id: 42 },
      });
      expect(getTaskId(file)).toBe('42');
    });
  });

  // ─── getWorkingDir ───────────────────────────────────────────────────────

  describe('getWorkingDir', () => {
    const getWorkingDir = (file: TFile) => (service as any).getWorkingDir(file);

    it('uses working_dir frontmatter as absolute path', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { working_dir: '/absolute/path' },
      });
      expect(getWorkingDir(file)).toBe('/absolute/path');
    });

    it('uses working-dir (hyphenated) frontmatter', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { 'working-dir': '/other/path' },
      });
      expect(getWorkingDir(file)).toBe('/other/path');
    });

    it('resolves named repo path from frontmatter', () => {
      settings.taskDispatch.repoPaths = [
        { name: 'my-repo', path: '/Users/chris/repos/my-repo' },
      ];
      service = new TaskDispatchService(app as any, settings, distillService as any);

      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { working_dir: 'my-repo' },
      });
      expect(getWorkingDir(file)).toBe('/Users/chris/repos/my-repo');
    });

    it('resolves relative path against vault root', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { working_dir: 'projects/foo' },
      });
      expect(getWorkingDir(file)).toBe('/Users/chris/vault/projects/foo');
    });

    it('falls back to defaultWorkingDir setting', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({ frontmatter: {} });
      settings.taskDispatch.defaultWorkingDir = '/default/dir';
      service = new TaskDispatchService(app as any, settings, distillService as any);

      expect(getWorkingDir(file)).toBe('/default/dir');
    });

    it('resolves relative defaultWorkingDir against vault root', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({ frontmatter: {} });
      settings.taskDispatch.defaultWorkingDir = 'OpenAugi/Tasks';
      service = new TaskDispatchService(app as any, settings, distillService as any);

      expect(getWorkingDir(file)).toBe('/Users/chris/vault/OpenAugi/Tasks');
    });

    it('falls back to HOME when no working dir configured', () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({ frontmatter: {} });
      settings.taskDispatch.defaultWorkingDir = '';
      service = new TaskDispatchService(app as any, settings, distillService as any);

      expect(getWorkingDir(file)).toBe(process.env.HOME);
    });
  });

  // ─── getAgentConfig ──────────────────────────────────────────────────────

  describe('getAgentConfig', () => {
    const getAgentConfig = () => (service as any).getAgentConfig();

    it('returns the configured default agent', () => {
      const config = getAgentConfig();
      expect(config.id).toBe('claude-code');
      expect(config.command).toBe('claude');
    });

    it('falls back to first agent if default not found', () => {
      settings.taskDispatch.defaultAgent = 'nonexistent';
      service = new TaskDispatchService(app as any, settings, distillService as any);

      const config = getAgentConfig();
      expect(config.id).toBe('claude-code');
    });
  });

  // ─── assembleContext ─────────────────────────────────────────────────────

  describe('assembleContext', () => {
    it('includes task ID, note body, and instructions', async () => {
      const file = new TFile('Notes/Task 1.md');
      app.vault.read.mockResolvedValue('---\ntask_id: test-1\n---\n\nDo the thing.\n\n## Details\nMore info.');
      distillService.getLinkedNotes.mockResolvedValue([]);

      const context = await (service as any).assembleContext(file, 'test-1');

      expect(context).toContain('# Task: test-1');
      expect(context).toContain('Do the thing.');
      expect(context).toContain('## Details');
      expect(context).toContain('More info.');
      // Instructions section
      expect(context).toContain('## Instructions');
      expect(context).toContain('Task file: Notes/Task 1.md');
      expect(context).toContain('Task ID: test-1');
      expect(context).toContain('MCP append_results tool');
      expect(context).toContain('## Results section');
      expect(context).toContain('[[wikilinks]]');
    });

    it('strips frontmatter from note body', async () => {
      const file = new TFile('Notes/Task.md');
      app.vault.read.mockResolvedValue('---\ntask_id: t1\nworking_dir: /foo\n---\n\nBody text.');

      const context = await (service as any).assembleContext(file, 't1');

      expect(context).not.toContain('task_id: t1');
      expect(context).not.toContain('working_dir: /foo');
      expect(context).toContain('Body text.');
    });

    it('includes linked context when present', async () => {
      const file = new TFile('Notes/Task.md');
      app.vault.read.mockResolvedValue('---\ntask_id: t1\n---\n\nMain body.');

      const linkedFile = new TFile('Notes/Reference.md');
      distillService.getLinkedNotes.mockResolvedValue([linkedFile]);
      distillService.aggregateContent.mockResolvedValue({
        content: '# Note: Reference\n\nLinked content here.',
        sourceNotes: ['Reference'],
      });

      const context = await (service as any).assembleContext(file, 't1');

      expect(context).toContain('## Linked Context');
      expect(context).toContain('Linked content here.');
    });

    it('omits linked context section when no linked notes', async () => {
      const file = new TFile('Notes/Task.md');
      app.vault.read.mockResolvedValue('---\ntask_id: t1\n---\n\nBody.');
      distillService.getLinkedNotes.mockResolvedValue([]);

      const context = await (service as any).assembleContext(file, 't1');

      expect(context).not.toContain('## Linked Context');
    });

    it('truncates context at maxContextChars', async () => {
      const file = new TFile('Notes/Task.md');
      const longBody = 'A'.repeat(500);
      app.vault.read.mockResolvedValue(`---\ntask_id: t1\n---\n\n${longBody}`);
      distillService.getLinkedNotes.mockResolvedValue([]);

      settings.taskDispatch.maxContextChars = 100;
      service = new TaskDispatchService(app as any, settings, distillService as any);

      const context = await (service as any).assembleContext(file, 't1');

      expect(context.length).toBeLessThanOrEqual(100 + 50); // 100 + truncation message
      expect(context).toContain('...(context truncated at character limit)');
    });
  });

  // ─── writeContextFile / cleanupContextFile ───────────────────────────────

  describe('writeContextFile and cleanupContextFile', () => {
    const tmpDir = path.join('/tmp', `openaugi-test-${process.pid}`);

    beforeEach(() => {
      settings.taskDispatch.contextTempDir = tmpDir;
      service = new TaskDispatchService(app as any, settings, distillService as any);
    });

    afterEach(() => {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ok */ }
    });

    it('writes context to file and returns path', async () => {
      const filePath = await (service as any).writeContextFile('abc', 'hello world');

      expect(filePath).toBe(path.join(tmpDir, 'task-abc-context.md'));
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello world');
    });

    it('creates directory if it does not exist', async () => {
      const deepDir = path.join(tmpDir, 'nested', 'dir');
      settings.taskDispatch.contextTempDir = deepDir;
      service = new TaskDispatchService(app as any, settings, distillService as any);

      const filePath = await (service as any).writeContextFile('xyz', 'content');
      expect(fs.existsSync(filePath)).toBe(true);

      // cleanup
      fs.rmSync(deepDir, { recursive: true });
    });

    it('cleans up context file', async () => {
      await (service as any).writeContextFile('cleanup-test', 'data');
      const filePath = path.join(tmpDir, 'task-cleanup-test-context.md');
      expect(fs.existsSync(filePath)).toBe(true);

      (service as any).cleanupContextFile('cleanup-test');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('cleanupContextFile does not throw for missing file', () => {
      expect(() => (service as any).cleanupContextFile('nonexistent')).not.toThrow();
    });
  });

  // ─── tmuxSessionExists ──────────────────────────────────────────────────

  describe('tmuxSessionExists', () => {
    it('returns true when tmux has-session succeeds', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      const result = await (service as any).tmuxSessionExists('/usr/bin/tmux', 'task-abc');
      expect(result).toBe(true);
    });

    it('returns false when tmux has-session fails', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('no session'));
      const result = await (service as any).tmuxSessionExists('/usr/bin/tmux', 'task-abc');
      expect(result).toBe(false);
    });
  });

  // ─── createTmuxSession ──────────────────────────────────────────────────

  describe('createTmuxSession', () => {
    beforeEach(() => {
      // Mock fs.promises.mkdir
      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates tmux session then sends agent command with context as user prompt', async () => {
      // new-session
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // capture-pane for waitForShellReady
      mockExecAsync.mockResolvedValueOnce({ stdout: '$ ', stderr: '' });
      // send-keys
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const agentConfig = {
        id: 'claude-code',
        name: 'Claude Code',
        command: 'claude',
        contextFlag: '--append-system-prompt',
      };

      await (service as any).createTmuxSession(
        '/usr/bin/tmux', 'task-test', agentConfig, '/tmp/ctx.md', '/home/user/project'
      );

      const calls = mockExecAsync.mock.calls.map((c: any[]) => c[0] as string);

      // Verify new-session was called
      expect(calls.some(c => c.includes('new-session -d -s'))).toBe(true);

      // Verify send-keys passes context file via $(cat ...) as user prompt
      const sendKeysCmd = calls.find(c => c.includes('send-keys'));
      expect(sendKeysCmd).toBeTruthy();
      expect(sendKeysCmd).toContain('$(cat');
      expect(sendKeysCmd).toContain('/tmp/ctx.md');
      expect(sendKeysCmd).toContain('Enter');
      // Should NOT contain the contextFlag — context is the user prompt now
      expect(sendKeysCmd).not.toContain('--append-system-prompt');
    });
  });

  // ─── listActiveSessions ──────────────────────────────────────────────────

  describe('listActiveSessions', () => {
    it('parses tmux list-sessions output', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      mockExecAsync.mockResolvedValueOnce({
        stdout: `task-abc ${timestamp}\ntask-def ${timestamp}\nnon-task-session ${timestamp}\n`,
        stderr: '',
      });

      const sessions = await service.listActiveSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].taskId).toBe('abc');
      expect(sessions[0].tmuxSessionName).toBe('task-abc');
      expect(sessions[1].taskId).toBe('def');
    });

    it('filters out non-task sessions', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'my-other-session 1234567890\n',
        stderr: '',
      });

      const sessions = await service.listActiveSessions();
      expect(sessions).toHaveLength(0);
    });

    it('returns empty array when tmux is not running', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('no server running'));

      const sessions = await service.listActiveSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  // ─── launchOrAttach ──────────────────────────────────────────────────────

  describe('launchOrAttach', () => {
    beforeEach(() => {
      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('does nothing for notes without task_id', async () => {
      const file = new TFile('Notes/Regular.md');
      app.metadataCache.getFileCache.mockReturnValue({ frontmatter: {} });

      await service.launchOrAttach(file as any);

      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it('attaches to existing session', async () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { task_id: 'existing' },
      });

      // has-session succeeds (session exists)
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // osascript for openTerminal
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await service.launchOrAttach(file as any);

      // Should NOT call new-session
      const calls = mockExecAsync.mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((c: string) => c.includes('new-session'))).toBe(false);
      // Should call osascript to attach
      expect(calls.some((c: string) => c.includes('osascript'))).toBe(true);
    });

    it('creates new session for fresh task', async () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { task_id: 'fresh' },
      });
      app.vault.read.mockResolvedValue('---\ntask_id: fresh\n---\n\nDo stuff.');

      // Ensure contextTempDir exists for writeContextFile
      const tmpDir = path.join('/tmp', `openaugi-launch-test-${process.pid}`);
      settings.taskDispatch.contextTempDir = tmpDir;
      service = new TaskDispatchService(app as any, settings, distillService as any);

      // has-session fails (no existing session)
      mockExecAsync.mockRejectedValueOnce(new Error('no session'));
      // new-session
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // capture-pane (waitForShellReady)
      mockExecAsync.mockResolvedValueOnce({ stdout: '$ ', stderr: '' });
      // send-keys
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // osascript (openTerminal)
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await service.launchOrAttach(file as any);

      const calls = mockExecAsync.mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((c: string) => c.includes('new-session'))).toBe(true);

      // cleanup
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ok */ }
    });
  });

  // ─── killSession ─────────────────────────────────────────────────────────

  describe('killSession', () => {
    it('does nothing for notes without task_id', async () => {
      const file = new TFile('Notes/Regular.md');
      app.metadataCache.getFileCache.mockReturnValue({ frontmatter: {} });

      await service.killSession(file as any);
      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it('kills existing session and cleans up context file', async () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { task_id: 'kill-me' },
      });

      // has-session succeeds
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // kill-session
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await service.killSession(file as any);

      const calls = mockExecAsync.mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((c: string) => c.includes('kill-session'))).toBe(true);
    });

    it('notifies when no active session found', async () => {
      const file = new TFile('Notes/Task.md');
      app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { task_id: 'no-session' },
      });

      // has-session fails
      mockExecAsync.mockRejectedValueOnce(new Error('no session'));

      // Should not throw
      await service.killSession(file as any);

      // Should NOT call kill-session
      const calls = mockExecAsync.mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((c: string) => c.includes('kill-session'))).toBe(false);
    });
  });

  // ─── openTerminal ────────────────────────────────────────────────────────

  describe('openTerminal', () => {
    it('opens iTerm2 when configured', async () => {
      settings.taskDispatch.terminalApp = 'iterm2';
      service = new TaskDispatchService(app as any, settings, distillService as any);

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      await service.openTerminal('task-test');

      const cmd = mockExecAsync.mock.calls[0][0] as string;
      expect(cmd).toContain('iTerm2');
    });

    it('opens Terminal.app when configured', async () => {
      settings.taskDispatch.terminalApp = 'terminal-app';
      service = new TaskDispatchService(app as any, settings, distillService as any);

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      await service.openTerminal('task-test');

      const cmd = mockExecAsync.mock.calls[0][0] as string;
      expect(cmd).toContain('Terminal');
      expect(cmd).not.toContain('iTerm2');
    });
  });
});
