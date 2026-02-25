# Task Dispatch

Task Dispatch lets you launch AI coding agents directly from Obsidian task notes. Each task gets its own tmux session with full context from your vault — the task note body, all linked notes, and access to the OpenAugi MCP server for searching your vault.

## Prerequisites

- **tmux** — Install with `brew install tmux`. The plugin auto-detects the binary, or you can set the path manually in settings.
- **An agent CLI** — Claude Code (`claude`) is the default. Any CLI agent that accepts a system prompt flag works.
- **macOS** — Terminal opening uses AppleScript (iTerm2 or Terminal.app).

## Quick Start

1. Create a task note with `task_id` in frontmatter:

```yaml
---
task_id: fix-auth-bug
working_dir: my-repo
---

## Objective

Fix the authentication bug where sessions expire after 5 minutes.

## Context

The auth middleware is in `src/middleware/auth.ts`. The JWT expiry is hardcoded.
```

2. Run the command **Task dispatch: Launch or attach** (from the command palette).
3. A terminal window opens with the agent already running, pre-loaded with context from your note and all linked notes.

## How It Works

When you launch a task:

1. **Context assembly** — The plugin reads the task note body (stripped of frontmatter), then gathers all linked notes via the same link traversal used by Distill. Everything is concatenated into a single context bundle.
2. **Temp file** — The context is written to a temp file (default: `/tmp/openaugi/task-{id}-context.md`).
3. **tmux session** — A new tmux session named `task-{id}` is created in the configured working directory.
4. **Agent launch** — The agent CLI is invoked with the context file, e.g.:
   ```
   cd '/path/to/repo' && claude --append-system-prompt-file '/tmp/openaugi/task-fix-auth-bug-context.md' "..."
   ```
5. **Terminal opens** — iTerm2 or Terminal.app opens attached to the session.

If the session already exists, the plugin just attaches to it (no duplicate sessions).

## Task Note Frontmatter

| Field | Required | Description |
|-------|----------|-------------|
| `task_id` | Yes | Unique identifier for the task. Also accepts `task-id`. |
| `working_dir` | No | Where the agent starts. Can be a **repo name** (mapped in settings), an **absolute path**, or a **vault-relative path**. Falls back to the default working directory setting. |

### Working Directory Resolution

The `working_dir` value is resolved in this order:

1. **Named repo** — If it matches a name in your configured Repository Paths, the mapped absolute path is used. Case-insensitive.
2. **Absolute path** — If it starts with `/`, used as-is.
3. **Vault-relative path** — Otherwise, resolved against the vault root.
4. **Default** — If `working_dir` is absent, the Default Working Directory setting is used.
5. **Fallback** — If nothing is configured, falls back to `$HOME`.

The directory is created automatically if it doesn't exist.

### Example: Using Repo Names

After configuring repository paths in settings:

| Name | Path |
|------|------|
| my-app | /Users/chris/repos/my-app |
| api-server | /Users/chris/repos/api-server |
| infra | /Users/chris/repos/infrastructure |

Your frontmatter just needs the short name:

```yaml
---
task_id: add-caching
working_dir: api-server
---
```

## Commands

| Command | What it does |
|---------|-------------|
| **Task dispatch: Launch or attach** | Creates a new session or attaches to an existing one for the current task note. |
| **Task dispatch: Kill session** | Kills the tmux session for the current task note and cleans up the temp context file. |
| **Task dispatch: List active sessions** | Opens a modal showing all active `task-*` tmux sessions with options to attach or kill each. |

## Settings

All settings are under **Settings > OpenAugi > Task Dispatch**.

### Terminal Application

Which app opens when attaching to a session.

- **iTerm2** (default)
- **Terminal.app**

### tmux Path

Absolute path to the tmux binary. Leave blank to auto-detect (checks `/opt/homebrew/bin/tmux`, `/usr/local/bin/tmux`, `/usr/bin/tmux`, then `which tmux`). Use the **Detect** button to find it automatically.

### Default Working Directory

The directory the agent starts in when a task note doesn't specify `working_dir`. Can be vault-relative (e.g., `OpenAugi/Tasks`) or absolute. Default: `OpenAugi/Tasks`.

### Repository Paths

Map short names to absolute folder paths. Each entry has:

- **Name** — The short name you'll use in frontmatter `working_dir` (e.g., `my-repo`).
- **Path** — The absolute filesystem path (e.g., `/Users/chris/repos/my-repo`).
- **Browse** — Opens the native folder picker to select a directory. Auto-fills the name from the folder basename if empty.

### Default Agent

Which agent CLI to use. Default: Claude Code (`claude`).

### Max Context Characters

Upper limit on the context bundle size. Content beyond this is truncated. Default: `200,000`.

### Context Temp Directory

Where temporary context files are written. Default: `/tmp/openaugi`. Files are cleaned up when sessions are killed.

## Agent Configuration

The default agent is Claude Code with `--append-system-prompt` as the context flag. The agent config has four fields:

| Field | Default | Description |
|-------|---------|-------------|
| `id` | `claude-code` | Internal identifier. |
| `name` | `Claude Code` | Display name in settings. |
| `command` | `claude` | The CLI command to run. |
| `contextFlag` | `--append-system-prompt` | The CLI flag for injecting context. If the flag ends with `-file` (e.g., `--append-system-prompt-file`), the temp file path is passed directly. Otherwise, the file content is expanded inline via `$(cat ...)`. |

## Tips

- **Link related context** — Any notes linked from your task note (`[[Design Doc]]`, `[[API Spec]]`) are automatically included in the context bundle. Structure your task notes with relevant links.
- **Keep task IDs unique** — The tmux session name is derived from `task_id`. Duplicates will collide.
- **Session persistence** — tmux sessions survive Obsidian restarts. Use "List active sessions" to find and reattach to running agents.
- **MCP access** — The agent's context includes a note that the OpenAugi MCP server is available for vault searches, so agents can look up additional information beyond what's in the initial context.
