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

### 2. Task Dispatch

Write a task note, link your context, and launch an agent session directly from Obsidian.

- **tmux sessions** — Each task gets its own persistent terminal session
- **Context injection** — Task note body + all linked notes are assembled and passed to the agent
- **Named repo paths** — Map short names to directories so `working_dir: my-api` just works
- **Session management** — List, attach to, or kill running agent sessions
- **MCP integration** — Agents can search your vault and write results back to the task note

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
3. For task dispatch: install tmux (`brew install tmux`)

### Dispatch a Task

Create a task note:

```yaml
---
task_id: fix-auth-bug
working_dir: my-repo
---
```

```markdown
## Objective

Fix the authentication bug where sessions expire after 5 minutes.

## Context

The auth middleware is in `src/middleware/auth.ts`. [[API Design Doc]] has the spec.
```

Run **Task dispatch: Launch or attach** from the command palette. A terminal opens with your agent pre-loaded with context from the note and all linked notes.

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
| **Process notes** | Gather linked notes → review → distill / publish / save |
| **Process recent activity** | Same flow but discovers by recent modification date |
| **Save context** | Gather and save raw context (no AI processing) |
| **Task dispatch: Launch or attach** | Launch agent session from task note |
| **Task dispatch: Kill session** | Kill tmux session for current task note |
| **Task dispatch: List active sessions** | View and manage all running agent sessions |
| **Parse transcript** | Process voice transcript into atomic notes |
| **Distill linked notes** | Legacy command — use Process notes instead |

---

## Task Dispatch

Task dispatch is the agent harness. It reads a task note, assembles context from linked notes, creates a tmux session, and launches your agent CLI with everything pre-loaded.

See [Task Dispatch docs](docs/TASK_DISPATCH.md) for the full reference.

**Key concepts:**
- `task_id` in frontmatter identifies the task (required)
- `working_dir` sets where the agent runs — supports named repos, absolute paths, or vault-relative paths
- Linked notes (`[[Design Doc]]`, `[[API Spec]]`) are automatically included in context
- Sessions persist across Obsidian restarts — use "List active sessions" to reattach
- Agents can use the OpenAugi MCP to search your vault and write results back

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

**Task Dispatch:**
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
- **tmux** — Required for task dispatch (`brew install tmux`)
- **macOS** — Task dispatch terminal opening uses AppleScript (iTerm2 or Terminal.app)

---

## Get Involved

OpenAugi is about augmented intelligence — using AI to help you think faster and do more, not to think for you.

Open an [issue](https://github.com/bitsofchris/openaugi-obsidian-plugin/issues), join the [Discord](https://discord.gg/d26BVBrnRP), or check out [YouTube](https://www.youtube.com/@bitsofchris) for updates. Parent [repo](https://github.com/bitsofchris/openaugi).
