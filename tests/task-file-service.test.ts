import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  TaskFileService,
  TASKS_FOLDER,
  buildTaskFileContent,
  stripFrontmatter,
  taskFileSlug,
  taskFileTimestamp,
} from '../src/services/task-file-service';
import { createMockApp, MockApp } from './mocks/obsidian-mock';

// Mirrors FRONTMATTER_RE in the parent repo's task_watcher.py — the reader
// side of the task-file contract. If a file doesn't match this, the watcher
// never sees its frontmatter.
const WATCHER_FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

// ─── Pure helpers ────────────────────────────────────────────────────────────

describe('stripFrontmatter', () => {
  it('removes a leading frontmatter block', () => {
    expect(stripFrontmatter('---\nfoo: bar\n---\nBody text.')).toBe('Body text.');
  });

  it('leaves content without frontmatter untouched', () => {
    expect(stripFrontmatter('Just a note.')).toBe('Just a note.');
  });

  it('does not strip --- separators mid-document', () => {
    const content = 'Intro.\n\n---\n\nMore.';
    expect(stripFrontmatter(content)).toBe(content);
  });
});

describe('taskFileSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(taskFileSlug('run the review pass')).toBe('run-the-review-pass');
  });

  it('strips special characters', () => {
    expect(taskFileSlug('distill Journal 2026-07-07!')).toBe('distill-journal-2026-07-07');
  });

  it('truncates long titles without a trailing hyphen', () => {
    const slug = taskFileSlug('a'.repeat(45) + ' bcdef ghijk');
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('falls back to "task" for empty input', () => {
    expect(taskFileSlug('!!!')).toBe('task');
  });
});

describe('taskFileTimestamp', () => {
  it('formats as YYYYMMDD-HHMMSS', () => {
    const ts = taskFileTimestamp(new Date(2026, 6, 7, 9, 5, 3));
    expect(ts).toBe('20260707-090503');
  });
});

// ─── buildTaskFileContent ────────────────────────────────────────────────────

describe('buildTaskFileContent', () => {
  const content = buildTaskFileContent({
    title: 'run the review pass',
    context: 'Triggered via the plugin.',
    instruction: 'run the review pass',
    task: 'Read OpenAugi/AGENT/review-pass.md and execute: run the review pass.',
    sourceNote: 'OpenAugi plugin',
  });

  it('produces frontmatter the watcher can parse, with status pending', () => {
    const match = content.match(WATCHER_FRONTMATTER_RE);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('status: pending');
    expect(match![1]).toContain('source_block_id: obsidian-plugin');
    expect(match![1]).toContain('source_note: "[[OpenAugi plugin]]"');
  });

  it('contains all template sections in order', () => {
    const sections = [
      '# run the review pass',
      '## Context',
      '## User instruction',
      '## Task',
      '## Human Todo',
      '## Results',
    ];
    let lastIndex = -1;
    for (const section of sections) {
      const idx = content.indexOf(section);
      expect(idx, `missing section: ${section}`).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('block-quotes the user instruction', () => {
    expect(content).toContain('> run the review pass');
  });

  it('keeps the context verbatim under ## Context', () => {
    const multiline = buildTaskFileContent({
      title: 't',
      context: 'Line one.\n\n- bullet\n- another',
      instruction: 'i',
      task: 'do it',
      sourceNote: 'Note',
    });
    expect(multiline).toContain('## Context\n\nLine one.\n\n- bullet\n- another\n\n## User instruction');
  });
});

// ─── TaskFileService (fs-backed vault) ───────────────────────────────────────

describe('TaskFileService', () => {
  let vaultRoot: string;
  let app: MockApp;
  let service: TaskFileService;
  const now = new Date(2026, 6, 7, 14, 30, 0);

  beforeEach(() => {
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openaugi-taskfile-'));
    app = createMockApp(vaultRoot);
    service = new TaskFileService(app as any);
  });

  afterEach(() => {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  });

  function readTask(relPath: string): string {
    return fs.readFileSync(path.join(vaultRoot, relPath), 'utf-8');
  }

  it('creates the OpenAugi/Tasks folder if missing', async () => {
    expect(fs.existsSync(path.join(vaultRoot, TASKS_FOLDER))).toBe(false);
    await service.createReviewPassTask(now);
    expect(fs.existsSync(path.join(vaultRoot, TASKS_FOLDER))).toBe(true);
  });

  it('writes a pending review-pass task with the expected filename', async () => {
    const taskPath = await service.createReviewPassTask(now);

    expect(taskPath).toBe(`${TASKS_FOLDER}/run-the-review-pass-20260707-143000.md`);
    const content = readTask(taskPath);
    expect(content.match(WATCHER_FRONTMATTER_RE)![1]).toContain('status: pending');
    expect(content).toContain('> run the review pass');
    expect(content).toContain('Read OpenAugi/AGENT/review-pass.md and execute: run the review pass.');
  });

  it('writes a process-dashboard task with its own instruction', async () => {
    const taskPath = await service.createProcessDashboardTask(now);

    expect(taskPath).toBe(`${TASKS_FOLDER}/process-the-dashboard-20260707-143000.md`);
    const content = readTask(taskPath);
    expect(content).toContain('> process the dashboard');
    expect(content).toContain('Read OpenAugi/AGENT/review-pass.md and execute: process the dashboard.');
  });

  it('writes a distill task with the given content as ## Context', async () => {
    const selection = 'Idea one about capture.\n\nIdea two about routing.';
    const taskPath = await service.createDistillTask(selection, 'Journal 2026-07-07', now);

    expect(taskPath).toBe(`${TASKS_FOLDER}/distill-journal-2026-07-07-20260707-143000.md`);
    const content = readTask(taskPath);
    expect(content).toContain('source_note: "[[Journal 2026-07-07]]"');
    expect(content).toContain(`## Context\n\n${selection}\n\n## User instruction`);
    expect(content).toContain('> distill this per OpenAugi/AGENT/distill-lens.md');
  });

  it('does not overwrite when two tasks land in the same second', async () => {
    const first = await service.createReviewPassTask(now);
    const second = await service.createReviewPassTask(now);

    expect(second).not.toBe(first);
    expect(fs.existsSync(path.join(vaultRoot, first))).toBe(true);
    expect(fs.existsSync(path.join(vaultRoot, second))).toBe(true);
  });

  it('never sets a repo/working_dir key — the watcher defaults to the vault', async () => {
    const taskPath = await service.createReviewPassTask(now);
    const frontmatter = readTask(taskPath).match(WATCHER_FRONTMATTER_RE)![1];
    expect(frontmatter).not.toContain('repo:');
    expect(frontmatter).not.toContain('working_dir');
  });
});
