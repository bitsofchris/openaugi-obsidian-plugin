import { App } from 'obsidian';
import { createFileWithCollisionHandling } from '../utils/filename-utils';

/**
 * TaskFileService — writes `status: pending` task files to OpenAugi/Tasks/
 * via the Obsidian vault API. No shell-out, no HTTP, mobile-safe.
 *
 * The task file IS the trigger contract: the OpenAugi task watcher
 * (`openaugi up` in the parent repo) polls OpenAugi/Tasks/ for pending
 * files and launches an agent session for each. This service, the
 * `openaugi review` CLI, and the zzz capture grammar all converge on the
 * same file format, defined authoritatively in the parent repo at
 * `src/openaugi/templates/task-template.md`.
 */

/** Where the task watcher looks for pending task files (vault-relative). */
export const TASKS_FOLDER = 'OpenAugi/Tasks';

/** Frontmatter marker identifying tasks written by this plugin. */
export const SOURCE_BLOCK_ID = 'obsidian-plugin';

export interface TaskFileOptions {
  /** Human-readable task title — becomes the `# heading` and filename slug. */
  title: string;
  /** Verbatim content for the `## Context` section. */
  context: string;
  /** The literal user directive, block-quoted under `## User instruction`. */
  instruction: string;
  /** Self-contained description for the `## Task` section (the agent's real prompt). */
  task: string;
  /** Wikilink target for `source_note` frontmatter (note title, no brackets). */
  sourceNote: string;
}

/** Strip YAML frontmatter from note content, if present. */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

/** Lowercase, filename-safe slug for the task filename. */
export function taskFileSlug(title: string, maxLen = 50): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLen).replace(/-+$/, '') || 'task';
}

/** YYYYMMDD-HHMMSS local timestamp, matching the `openaugi review` CLI. */
export function taskFileTimestamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Build the full task-file markdown per the task-template contract.
 * Section order matters: the watcher hydrates around `## Results` and the
 * agent treats `## Task` as its prompt.
 */
export function buildTaskFileContent(opts: TaskFileOptions): string {
  return `---
status: pending
source_block_id: ${SOURCE_BLOCK_ID}
source_note: "[[${opts.sourceNote}]]"
---

# ${opts.title}

## Context

${opts.context.trim()}

## User instruction

> ${opts.instruction}

## Task

${opts.task.trim()}

## Human Todo

## Results
`;
}

export class TaskFileService {
  constructor(private app: App) {}

  /**
   * Queue a full review pass. The watcher-launched agent reads
   * OpenAugi/AGENT/review-pass.md and runs the whole loop.
   */
  async createReviewPassTask(now: Date = new Date()): Promise<string> {
    const instruction = 'run the review pass';
    return this.writeTask({
      title: instruction,
      context: `Triggered via the OpenAugi plugin command "Augi: Run review pass" at ${taskFileTimestamp(now)}.`,
      instruction,
      task: `Read OpenAugi/AGENT/review-pass.md and execute: ${instruction}.`,
      sourceNote: 'OpenAugi plugin',
    }, now);
  }

  /**
   * Queue dashboard processing only — execute nomination answers,
   * no new-block routing.
   */
  async createProcessDashboardTask(now: Date = new Date()): Promise<string> {
    const instruction = 'process the dashboard';
    return this.writeTask({
      title: instruction,
      context: `Triggered via the OpenAugi plugin command "Augi: Process dashboard" at ${taskFileTimestamp(now)}.`,
      instruction,
      task: `Read OpenAugi/AGENT/review-pass.md and execute: ${instruction}.`,
      sourceNote: 'OpenAugi plugin',
    }, now);
  }

  /**
   * Queue a distill task for the given content (current selection or
   * active note body). The content goes into `## Context` verbatim; the
   * agent applies the distill lens to exactly that scope.
   */
  async createDistillTask(context: string, sourceNote: string, now: Date = new Date()): Promise<string> {
    return this.writeTask({
      title: `distill ${sourceNote}`,
      context,
      instruction: 'distill this per OpenAugi/AGENT/distill-lens.md',
      task:
        'Read OpenAugi/AGENT/distill-lens.md and apply the distill lens to the ' +
        'content in the ## Context section above. That content is the entire ' +
        'scope — do not pull in additional notes.',
      sourceNote,
    }, now);
  }

  /** Ensure OpenAugi/Tasks/ exists and write the task file into it. */
  private async writeTask(opts: TaskFileOptions, now: Date): Promise<string> {
    // Create ancestors one level at a time — createFolder is not
    // guaranteed to be recursive on all platforms.
    let folder = '';
    for (const segment of TASKS_FOLDER.split('/')) {
      folder = folder ? `${folder}/${segment}` : segment;
      if (!(await this.app.vault.adapter.exists(folder))) {
        await this.app.vault.createFolder(folder);
      }
    }
    const filename = `${taskFileSlug(opts.title)}-${taskFileTimestamp(now)}.md`;
    const content = buildTaskFileContent(opts);
    return createFileWithCollisionHandling(
      this.app.vault,
      `${TASKS_FOLDER}/${filename}`,
      content
    );
  }
}
