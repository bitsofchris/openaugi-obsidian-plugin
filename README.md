# OpenAugi
## The Personal Intelligence Layer for Your Agents

OpenAugi is a context engineering layer and personal agent harness for your data (currently as an Obsidian plugin). It sits between your knowledge and your AI agents — gathering the right context, dispatching tasks, and shortcutting the loop from idea to action.

Your vault is full of plans, decisions, research, and context. OpenAugi makes that context available to agents so they can actually do useful work.

Works with the [OpenAugi MCP server](https://github.com/bitsofchris/openaugi) for semantic search, hub discovery, and structured access to your vault data. (MCP server coming soon.)

Join the [Discord](https://discord.gg/d26BVBrnRP). Parent [repo](https://github.com/bitsofchris/openaugi).

---

## What It Does

### 1. Context Engineering

Gather precisely the right context from your vault — not too much, not too little.

- **Link traversal** — Follow wikilinks up to 3 levels deep (breadth-first)
- **Backlink discovery** — Find notes that reference your notes, not just notes you link to
- **Journal filtering** — Extract only recent sections from date-headed journal notes
- **Character budgets** — Stay within token limits with configurable caps
- **Checkbox review** — Toggle individual notes on/off before processing

### 2. Agent Tasks

Queue work for your agents without leaving Obsidian. The **Augi** commands write task files to `OpenAugi/Tasks/` — the [OpenAugi task watcher](https://github.com/bitsofchris/openaugi) picks them up and runs an agent session for each.

- **Augi: Run review pass** — Route new blocks, refresh views, surface Dashboard nominations
- **Augi: Process dashboard** — Execute your nomination answers only
- **Augi: Distill selection** — Distill the current selection (or active note) through the distill lens
- **File-based trigger** — Pure vault API, no shell or HTTP, works on Obsidian Mobile with a synced vault

See [Agent Tasks docs](docs/AGENT_TASKS.md).

The older **Task Dispatch** feature (launching tmux sessions directly from the plugin) is deprecated in favor of the task-file flow — see [Task Dispatch docs](docs/TASK_DISPATCH.md).

### 3. Note Processing

Turn raw notes into organized, atomic knowledge.

- **Voice transcripts** — Break voice notes into atomic notes + tasks + summary
- **Distillation** — Synthesize multiple linked notes into deduplicated atomic notes
- **Publishing** — Turn research notes into a single polished blog post
- **Custom prompts** — Apply different "lenses" to extract different insights from the same content

---

## Quick Start

### Setup

1. Install from Obsidian Community Plugins (or manually)
2. Settings → OpenAugi → Enter your OpenAI API key
3. For agent tasks: install [OpenAugi](https://github.com/bitsofchris/openaugi) and run `openaugi up` (the task watcher)

### Queue an Agent Task

Run **Augi: Run review pass** (or **Augi: Process dashboard**, **Augi: Distill selection**) from the command palette. The plugin writes a pending task file to `OpenAugi/Tasks/`; the task watcher launches an agent session that does the work and writes its results back into the task file.

For **Augi: Distill selection**, select the text you want distilled first — the selection (or the whole active note if nothing is selected) becomes the task's context.

### Gather Context

1. Open any note with links to content you want to process
2. Run **Process notes**
3. Configure depth, filters, and character limits
4. Review discovered notes with checkboxes
5. Choose: **Distill** (atomic notes), **Publish** (blog post), or **Save** (raw context)

---

## Commands

| Command | Purpose |
|---------|---------|
| **Augi: Run review pass** | Queue a full review pass for the task watcher |
| **Augi: Process dashboard** | Queue Dashboard nomination processing for the task watcher |
| **Augi: Distill selection** | Queue a distill of the current selection or active note |
| **Process notes** | Gather linked notes → review → distill / publish / save |
| **Process recent activity** | Same flow but discovers by recent modification date |
| **Save context** | Gather and save raw context (no AI processing) |
| **Task dispatch: Launch or attach** | Deprecated — launch agent session from task note |
| **Task dispatch: Kill session** | Deprecated — kill tmux session for current task note |
| **Task dispatch: List active sessions** | Deprecated — view and manage running agent sessions |
| **Parse transcript** | Process voice transcript into atomic notes |
| **Distill linked notes** | Legacy command — use Process notes instead |

---

## Agent Tasks

The Augi commands are the trigger surface for the OpenAugi agent loop. Each command writes a `status: pending` task file to `OpenAugi/Tasks/`; the task watcher (`openaugi up`) hydrates it, launches a Claude agent session, and the agent writes its results back into the same file.

See [Agent Tasks docs](docs/AGENT_TASKS.md) for the full reference, including the task-file format.

**Key concepts:**
- The vault filesystem is the API — the plugin only writes a file, so the commands work on mobile with a synced vault
- The same contract is shared with the `openaugi review` CLI and the `zzz:` capture grammar
- The task file doubles as the record: results and status land back in it

### Task Dispatch (deprecated)

The older agent harness: reads a task note, assembles context from linked notes, creates a tmux session, and launches your agent CLI directly from the plugin. Deprecated in favor of the task-file flow above; it keeps working for now but will be removed over a release or two. See [Task Dispatch docs](docs/TASK_DISPATCH.md).

---

## Context Gathering

The context gathering pipeline is a three-stage flow:

1. **Configure** — Source mode (linked notes or recent activity), depth, filters
2. **Review** — Checkbox list of discovered notes with character/token counts
3. **Process** — Distill to atomic notes, publish as blog post, or save raw

Features:
- Breadth-first link traversal up to 3 levels
- Bidirectional: forward links + backlinks at each depth
- Journal-style date filtering
- Dataview query support
- Custom prompt lenses

---

## Configuration

Settings are in **Settings → OpenAugi**.

**Core:**
- OpenAI API key (required for AI processing)
- Output folders: Summaries, Notes, Published, Prompts

**Context Gathering:**
- Default link depth (1-3)
- Max characters (default: 100k)
- Include backlinks (default: on)
- Journal section filtering

**Task Dispatch (deprecated):**
- Terminal app (iTerm2 or Terminal.app)
- tmux path (auto-detected or manual)
- Default working directory
- Repository path mappings
- Default agent CLI
- Max context characters (default: 200k)

**Recent Activity:**
- Days to look back (default: 7)
- Date header format
- Folder exclusions

---

## Requirements

- **OpenAI API key** — Required for AI processing (distill, publish, parse)
- **OpenAugi task watcher** — Required for the Augi agent-task commands ([openaugi](https://github.com/bitsofchris/openaugi), run `openaugi up`)
- **tmux** — Required for deprecated task dispatch (`brew install tmux`)
- **macOS** — Deprecated task dispatch terminal opening uses AppleScript (iTerm2 or Terminal.app)

---

## Get Involved

OpenAugi is about augmented intelligence — using AI to help you think faster and do more, not to think for you.

Open an [issue](https://github.com/bitsofchris/openaugi-obsidian-plugin/issues), join the [Discord](https://discord.gg/d26BVBrnRP), or check out [YouTube](https://www.youtube.com/@bitsofchris) for updates. Parent [repo](https://github.com/bitsofchris/openaugi).
