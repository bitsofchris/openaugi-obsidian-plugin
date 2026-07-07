---
name: Agent Tasks (Augi commands)
description: Plugin commands that queue work for the OpenAugi task watcher by writing pending task files to OpenAugi/Tasks/ via the vault API.
---

# Agent Tasks (Augi commands)

**When to use:** You want an agent to run the review pass, process the
Dashboard, or distill a chunk of your writing — triggered from inside
Obsidian, on desktop or mobile.

**How it works:** The vault filesystem is the API. Each command writes a
markdown task file with `status: pending` frontmatter into
`OpenAugi/Tasks/`. The [OpenAugi task watcher](https://github.com/bitsofchris/openaugi)
(`openaugi up`) polls that folder and launches a Claude agent session for
each pending task. The plugin never shells out and never makes an HTTP
call — it only writes a file, so the same commands work on Obsidian
Mobile against a synced vault.

The `openaugi review` CLI, the `zzz:` capture grammar, and these commands
all converge on the same task-file contract, defined authoritatively in
the parent repo at `src/openaugi/templates/task-template.md`.

## Requirements

- The [OpenAugi](https://github.com/bitsofchris/openaugi) Python package
  running its task watcher (`openaugi up`) against your vault. Without it,
  task files sit in `OpenAugi/Tasks/` as pending until a watcher picks
  them up.
- Agent skill files in your vault under `OpenAugi/AGENT/` (created by
  `openaugi init`): `review-pass.md` for the review commands,
  `distill-lens.md` for distill.

## Commands

| Command | Instruction queued | Scope |
|---------|--------------------|-------|
| **Augi: Run review pass** | `run the review pass` | Full loop: route new blocks → refresh views → Dashboard nominations |
| **Augi: Process dashboard** | `process the dashboard` | Execute Dashboard nomination answers only, no new-block routing |
| **Augi: Distill selection** | `distill this per OpenAugi/AGENT/distill-lens.md` | Current selection, or the active note's body when nothing is selected |

For **Distill selection**, the selected text (or note body, frontmatter
stripped) is copied verbatim into the task file's `## Context` section —
the plugin acts purely as a scope selector; the agent distills exactly
that content and nothing else.

## The task file

Example produced by **Augi: Run review pass**:

```markdown
---
status: pending
source_block_id: obsidian-plugin
source_note: "[[OpenAugi plugin]]"
---

# run the review pass

## Context

Triggered via the OpenAugi plugin command "Augi: Run review pass" at 20260707-143000.

## User instruction

> run the review pass

## Task

Read OpenAugi/AGENT/review-pass.md and execute: run the review pass.

## Human Todo

## Results
```

The watcher hydrates the file (adds `task_id`, `created`,
`tmux_session`, flips `status: active`, renames to `TASK-*.md`) and
launches the agent. When the agent finishes it fills in `## Results` and
sets `status: done` — the task file doubles as the record of what
happened.

No `repo`/`working_dir` key is written, so the watcher defaults the
agent's working directory to the vault — correct for review and distill
work.

## Relationship to Task Dispatch (deprecated)

The older [Task Dispatch](TASK_DISPATCH.md) feature launches tmux
sessions directly from the plugin. That is a parallel execution path
that drifts from the watcher (different session names, duplicate repo
settings) and requires desktop + tmux + macOS. It is deprecated and will
be removed over a release or two; use the Augi commands with the task
watcher instead.
