# Testing Guide

Automated tests for the OpenAugi plugin. Run these before every release and when developing new features.

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch
```

Tests run in under 1 second. No Obsidian app, no API keys, no manual setup needed.

## How It Works

The plugin runs inside Obsidian's Electron environment, but our tests don't need Obsidian at all. Instead:

1. **Mock Obsidian API** (`tests/mocks/`) — A filesystem-backed mock that simulates `Vault`, `MetadataCache`, `App`, and `TFile` by reading real markdown files and parsing `[[wikilinks]]` to build link graphs.

2. **Test vault** (`tests/vault/`) — A small set of markdown files committed to the repo that represent various note structures (links, backlinks, journal dates, dataview blocks, checkboxes, etc.).

3. **Vitest** — Fast TypeScript test runner. Config in `vitest.config.ts`.

## Test Files

| File | What it tests |
|------|--------------|
| `tests/filename-utils.test.ts` | `sanitizeFilename`, `BacklinkMapper`, file collision handling |
| `tests/openai-service.test.ts` | Prompt construction, context extraction, API response parsing |
| `tests/distill-service.test.ts` | Link extraction, backlinks, content aggregation, journal filtering, dataview stripping |
| `tests/file-service.test.ts` | File/folder creation, session folders, summaries, published posts |
| `tests/context-gathering-service.test.ts` | BFS link traversal, depth limits, backlink discovery, character limits, folder exclusion |

## Adding Tests for a New Feature

### 1. Decide which test file

Match your feature to the service it lives in:

| If you changed... | Add tests to... |
|-------------------|-----------------|
| `src/utils/filename-utils.ts` | `tests/filename-utils.test.ts` |
| `src/services/openai-service.ts` | `tests/openai-service.test.ts` |
| `src/services/distill-service.ts` | `tests/distill-service.test.ts` |
| `src/services/file-service.ts` | `tests/file-service.test.ts` |
| `src/services/context-gathering-service.ts` | `tests/context-gathering-service.test.ts` |
| New service | Create `tests/your-service.test.ts` |

### 2. Add test vault fixtures (if needed)

If your feature needs specific note content to test against, add markdown files to `tests/vault/`:

```
tests/vault/
├── Root Note.md              # Forward links to A and B
├── Linked Note A.md          # Links to Deep Note
├── Linked Note B.md          # Links back to A
├── Backlink Source.md        # Links TO Root Note
├── Journal Note.md           # Date headers (### YYYY-MM-DD)
├── Dataview Note.md          # ```dataview blocks
├── Collection Note.md        # Checkbox links [x] / [ ]
├── Context Note.md           # context: section
├── Special Characters!.md    # Filename sanitization edge case
├── Deeply Linked/
│   └── Deep Note.md          # Depth-2 traversal
└── Excluded Folder/
    └── Should Skip.md        # Folder exclusion
```

After adding a new fixture file, the mock `MetadataCache` automatically picks it up — it scans all `.md` files and parses their `[[links]]` on initialization.

### 3. Write the test

Pattern for **pure unit tests** (no Obsidian needed):

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils/my-utils';

describe('myFunction', () => {
  it('does the expected thing', () => {
    expect(myFunction('input')).toBe('output');
  });
});
```

Pattern for **integration tests** (using mock Obsidian API):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyService } from '../src/services/my-service';
import { createMockApp, createTestTFile } from './mocks/obsidian-mock';
import * as path from 'path';

const VAULT_DIR = path.resolve(__dirname, 'vault');

describe('MyService', () => {
  let app: ReturnType<typeof createMockApp>;
  let service: MyService;

  beforeEach(() => {
    app = createMockApp(VAULT_DIR);
    service = new MyService(app as any, /* other deps */);
  });

  it('discovers linked notes', async () => {
    const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');
    const result = await service.someMethod(rootFile);
    expect(result).toContain('expected');
  });
});
```

Pattern for **testing OpenAI calls** (mock `fetch`):

```typescript
import { vi } from 'vitest';

it('calls API correctly', async () => {
  const mockResponse = {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"summary":"test"}', refusal: null } }]
    })
  };
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);

  const result = await service.someApiCall('input');
  expect(result.summary).toBe('test');

  fetchSpy.mockRestore();
});
```

Pattern for **file output tests** (uses temp directories):

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { MockApp } from './mocks/obsidian-mock';

const BASE_OUTPUT_DIR = path.resolve(__dirname, 'vault-output');
let outputDir: string;
let counter = 0;

beforeEach(() => {
  counter++;
  outputDir = path.join(BASE_OUTPUT_DIR, `run-${counter}-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  // Point MockApp at the output dir, not the fixture vault
  app = new MockApp(outputDir);
});
```

### 4. Run and verify

```bash
npm test
```

## What's NOT Tested (and why)

| Area | Reason |
|------|--------|
| UI modals | Tightly coupled to Obsidian DOM — test manually |
| Task dispatch (tmux) | Requires system-level tmux — test manually |
| Dataview plugin queries | Requires running Dataview plugin — mock returns empty |
| Real OpenAI API calls | Costs money — we mock `fetch` instead |

## Mock Obsidian API Reference

The mock (`tests/mocks/obsidian-mock.ts`) supports:

| Obsidian API | Mock behavior |
|-------------|---------------|
| `vault.read(file)` | Reads from filesystem |
| `vault.create(path, content)` | Writes to filesystem |
| `vault.createFolder(path)` | `mkdir -p` |
| `vault.getMarkdownFiles()` | Walks directory tree |
| `vault.getAbstractFileByPath(path)` | `fs.existsSync` lookup |
| `vault.adapter.exists(path)` | `fs.existsSync` |
| `vault.adapter.stat(path)` | `fs.statSync` |
| `metadataCache.getFileCache(file)` | Parses `[[links]]` from file content |
| `metadataCache.getFirstLinkpathDest(link, source)` | Resolves links by basename matching |
| `metadataCache.resolvedLinks` | Pre-built link graph from all vault files |

If a test needs an API that isn't mocked, add it to `tests/mocks/obsidian-mock.ts`.
