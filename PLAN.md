# Plan: Automated Testing for OpenAugi Plugin

## Problem

Currently all testing is manual: open Obsidian, create notes, run commands, inspect output. This means:
- Claude Code can't verify changes without you manually testing
- No regression safety net
- Slow iteration cycle

## Analysis: Obsidian API Coupling

After reviewing every service, here's the coupling breakdown:

| Layer | Services | Obsidian APIs Used |
|-------|----------|--------------------|
| **Pure logic** (no Obsidian) | `OpenAIService`, `sanitizeFilename`, `BacklinkMapper`, `estimateTokens` | None - just `fetch` and string ops |
| **Light coupling** | `FileService` | `Vault.adapter.exists`, `Vault.createFolder`, `Vault.create` |
| **Heavy coupling** | `DistillService`, `ContextGatheringService` | `MetadataCache`, `vault.read`, `vault.getMarkdownFiles`, link resolution, Dataview API |

## Strategy: Mock Obsidian, Test Against Real Files

We create a **mock Obsidian API** backed by Node.js `fs`, pointed at a **test vault** with fixture markdown files. This lets us test ~80% of logic without Obsidian running.

No E2E/Electron testing for now — that's complex, fragile, and low-value compared to service-level testing.

## What We'll Build

### 1. Add Vitest (test framework)

- Install `vitest` as dev dependency
- Add `npm test` and `npm run test:watch` scripts
- Configure to handle TypeScript, mock the `obsidian` module globally

### 2. Create mock Obsidian API (`tests/mocks/obsidian-mock.ts`)

A filesystem-backed mock that simulates:
- **`TFile`** — wraps real files with `path`, `basename`, `extension`, `stat`
- **`Vault`** — `read()`, `create()`, `getMarkdownFiles()`, `adapter.exists()`, `createFolder()`, `getAbstractFileByPath()` — all backed by Node.js `fs`
- **`MetadataCache`** — parses `[[wikilinks]]` from markdown files to build `resolvedLinks`, `getFileCache()`, and `getFirstLinkpathDest()`
- **`App`** — ties vault + metadataCache together
- **`Notice`** — no-op (just logs)

This is ~150 lines of code and gives us the ability to test DistillService, ContextGatheringService, and FileService against real markdown files.

### 3. Create test vault with fixtures (`tests/vault/`)

A small set of markdown files committed to the repo that cover key scenarios:

```
tests/vault/
├── Root Note.md              # Has [[links]] to other notes
├── Linked Note A.md          # Forward-linked from root
├── Linked Note B.md          # Forward-linked from root
├── Backlink Source.md        # Links back to Root Note
├── Journal Note.md           # Has ### 2026-02-20 date headers
├── Dataview Note.md          # Has ```dataview blocks
├── Collection Note.md        # Has - [x] [[checked]] checkboxes
├── Context Note.md           # Has context: section
├── Special Characters!.md    # Tests filename sanitization
├── Deeply Linked/
│   └── Deep Note.md          # Tests depth traversal
└── Excluded Folder/
    └── Should Skip.md        # Tests folder exclusion
```

### 4. Write tests

**Pure unit tests** (no mocks needed):
- `filename-utils.test.ts` — `sanitizeFilename`, `BacklinkMapper.processBacklinks`
- `openai-service.test.ts` — prompt construction, `extractCustomContext`, response parsing (mock `fetch`)

**Integration tests** (with mock Obsidian):
- `distill-service.test.ts` — link extraction, backlink discovery, content aggregation, journal filtering, date parsing
- `context-gathering-service.test.ts` — BFS traversal, character limits, folder exclusion, backlink snippets
- `file-service.test.ts` — file creation, collision handling, session folders, backlink mapping

### 5. npm scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## What This Enables

After setup, Claude Code can:
1. Make a code change
2. Run `npm test`
3. See if anything broke
4. Add new test cases for edge cases discovered during development

You can also add test notes to `tests/vault/` to capture edge cases you find during manual testing — they become permanent regression tests.

## File Changes Summary

| Action | File |
|--------|------|
| Install | `vitest` dev dependency |
| Create | `vitest.config.ts` — test config |
| Create | `tests/mocks/obsidian-mock.ts` — mock Obsidian API |
| Create | `tests/vault/*.md` — ~10 fixture notes |
| Create | `tests/filename-utils.test.ts` |
| Create | `tests/openai-service.test.ts` |
| Create | `tests/distill-service.test.ts` |
| Create | `tests/file-service.test.ts` |
| Create | `tests/context-gathering-service.test.ts` |
| Update | `package.json` — add test scripts + vitest dep |
| Update | `tsconfig.json` — exclude tests from build |
| Update | `.gitignore` — add `tests/vault-output/` for test artifacts |

## Not in Scope (for now)

- **E2E testing with real Obsidian** — requires Playwright + Electron orchestration, fragile
- **OpenAI API integration tests** — would cost real API credits; we mock `fetch` instead
- **UI modal testing** — Obsidian modals are tightly coupled to the DOM
- **Task dispatch testing** — requires tmux, hard to automate in CI
