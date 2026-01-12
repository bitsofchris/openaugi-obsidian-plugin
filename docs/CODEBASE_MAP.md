# OpenAugi Codebase Map

A comprehensive reference for navigating and extending this Obsidian plugin.

## Quick Reference

| What | Where |
|------|-------|
| Plugin entry point | [main.ts](../src/main.ts) |
| Settings types & defaults | [types/settings.ts](../src/types/settings.ts) |
| OpenAI API integration | [services/openai-service.ts](../src/services/openai-service.ts) |
| File I/O operations | [services/file-service.ts](../src/services/file-service.ts) |
| Link traversal & aggregation | [services/distill-service.ts](../src/services/distill-service.ts) |
| Unified context discovery | [services/context-gathering-service.ts](../src/services/context-gathering-service.ts) |
| Settings UI | [ui/settings-tab.ts](../src/ui/settings-tab.ts) |
| Context modals | [ui/context-gathering-modal.ts](../src/ui/context-gathering-modal.ts), [ui/context-selection-modal.ts](../src/ui/context-selection-modal.ts), [ui/context-preview-modal.ts](../src/ui/context-preview-modal.ts) |

---

## Project Structure

```
src/
├── main.ts                              # Plugin entry, command registration, service init
├── types/
│   ├── plugin.ts                        # Plugin interface
│   ├── settings.ts                      # Settings interfaces & defaults
│   ├── context.ts                       # Context gathering types
│   └── transcript.ts                    # API response types
├── services/
│   ├── openai-service.ts                # OpenAI API calls
│   ├── file-service.ts                  # File creation & output
│   ├── distill-service.ts               # Content aggregation, link traversal
│   └── context-gathering-service.ts     # Unified discovery orchestration
├── ui/
│   ├── settings-tab.ts                  # Settings panel
│   ├── loading-indicator.ts             # Status bar spinner
│   ├── context-gathering-modal.ts       # Stage 1: Discovery config
│   ├── context-selection-modal.ts       # Stage 2: Checkbox selection
│   ├── context-preview-modal.ts         # Stage 3: Preview & action
│   ├── prompt-selection-modal.ts        # Custom prompt picker
│   └── recent-activity-modal.ts         # (Legacy)
└── utils/
    └── filename-utils.ts                # Sanitization, backlink mapping
```

---

## Services Architecture

### OpenAIService (`openai-service.ts`)

Handles all AI interactions.

**Key Methods:**
- `parseTranscript(content)` - Voice transcript → atomic notes + tasks + summary
- `distillContent(content, customPrompt?)` - Multiple notes → atomic notes + summary
- `publishContent(content, customPrompt?)` - Notes → single polished blog post

**API Details:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: Configurable (GPT-5, GPT-5 Mini, GPT-5 Nano, or custom)
- Uses JSON Schema for structured outputs (distill/transcript)
- Free-form text for publishing

**Prompt Customization:**
- Extracts `context:` sections from notes to customize processing
- Supports custom prompt files from `OpenAugi/Prompts/`

---

### FileService (`file-service.ts`)

Manages all file output.

**Key Methods:**
- `writeTranscriptFiles(filename, data)` - Creates summary + atomic notes from transcript
- `writeDistilledFiles(rootFile, data)` - Creates distilled summary + atomic notes
- `writePublishedPost(content, sourceNotes, promptName)` - Creates published post with frontmatter

**Output Organization:**
```
OpenAugi/
├── Summaries/           # Summary files
│   ├── [name] - summary.md
│   └── [name] - distilled.md
├── Notes/               # Atomic notes in session folders
│   ├── Transcript YYYY-MM-DD HH-mm-ss/
│   └── Distill [Name] YYYY-MM-DD HH-mm-ss/
├── Published/           # Blog posts
│   └── [Title] - Published YYYY-MM-DD.md
└── Prompts/             # Custom prompt templates
```

**Features:**
- Automatic collision handling (appends -1, -2, etc.)
- Backlink mapping (original titles → sanitized filenames)
- Session-based folders for organization

---

### DistillService (`distill-service.ts`)

Content discovery and aggregation.

**Discovery Methods:**
- `getLinkedNotes(file)` - Get all linked notes from a file
- `getRecentlyModifiedNotes(daysBack, excludeFolders, fromDate?, toDate?)` - Time-based discovery

**Aggregation:**
- `aggregateContent(files, timeWindowDays?)` - Combine notes into single content string

**Link Discovery Supports:**
- `[[wikilinks]]` and embeds
- Dataview queries (if plugin available)
- Checkbox collections: only `[x]` checked items

**Journal Filtering:**
- Detects date headers (e.g., `### YYYY-MM-DD`)
- Extracts only sections within time window
- Configurable date format

---

### ContextGatheringService (`context-gathering-service.ts`)

Orchestrates the unified discovery system.

**Main Method:**
```typescript
gatherContext(config: ContextGatheringConfig): Promise<GatheredContext>
```

**Discovery Modes:**
1. **Linked Notes (BFS)** - Breadth-first traversal up to 3 levels
2. **Recent Activity** - Time-based discovery

**Features:**
- Character limit enforcement
- Folder exclusion filtering
- Returns discovered notes with metadata (depth, source, size)

---

## Types Reference

### Settings (`types/settings.ts`)

```typescript
interface OpenAugiSettings {
  apiKey: string
  defaultModel: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano'
  customModelOverride: string
  summaryFolder: string           // Default: 'OpenAugi/Summaries'
  notesFolder: string             // Default: 'OpenAugi/Notes'
  promptsFolder: string           // Default: 'OpenAugi/Prompts'
  publishedFolder: string         // Default: 'OpenAugi/Published'
  useDataviewIfAvailable: boolean
  enableDistillLogging: boolean
  recentActivityDefaults: {
    daysBack: number              // Default: 7
    excludeFolders: string[]      // Default: ['Templates', 'Archive', 'OpenAugi']
    filterJournalSections: boolean
    dateHeaderFormat: string      // Default: '### YYYY-MM-DD'
  }
  contextGatheringDefaults: {
    linkDepth: 1 | 2 | 3          // Default: 1
    maxCharacters: number         // Default: 100000
    filterRecentSectionsOnly: boolean
  }
}
```

### Context Types (`types/context.ts`)

```typescript
interface ContextGatheringConfig {
  sourceMode: 'linked-notes' | 'recent-activity'
  rootNote?: TFile
  linkDepth: 1 | 2 | 3
  maxCharacters: number
  timeWindow?: {
    mode: 'days-back' | 'date-range'
    daysBack?: number
    fromDate?: string
    toDate?: string
  }
  excludeFolders: string[]
  filterRecentSectionsOnly: boolean
  journalSectionDays?: number
}

interface DiscoveredNote {
  file: TFile
  depth: number                   // 0 = root, 1-3 = linked depth
  discoveredVia: string           // "root" | "linked from [[X]]" | "recent activity"
  estimatedChars: number
  included: boolean               // false if exceeded character limit
}

interface GatheredContext {
  notes: DiscoveredNote[]
  aggregatedContent: string
  totalCharacters: number
  totalNotes: number
  config: ContextGatheringConfig
  timestamp: string
}
```

### Response Types (`types/transcript.ts`)

```typescript
interface TranscriptResponse {
  summary: string
  notes: Array<{ title: string; content: string }>
  tasks: string[]
}

interface DistillResponse extends TranscriptResponse {
  sourceNotes: string[]
}
```

---

## Command Registration

Commands are registered in `main.ts`:

| Command ID | Name | Purpose |
|------------|------|---------|
| `parse-transcript` | Parse transcript | Process voice transcript (legacy) |
| `distill-notes` | Distill linked notes | Distill with prompt selection (legacy) |
| `openaugi-process-notes` | Process notes | Unified flow: linked notes |
| `openaugi-process-recent` | Process recent activity | Unified flow: recent activity |
| `openaugi-save-context` | Save context | Save raw aggregated content |

---

## Unified Three-Stage Pipeline

The new commands use a consistent flow:

```
┌─────────────────────────────────────┐
│  Stage 1: ContextGatheringModal     │
│  - Choose source mode               │
│  - Set depth, limits, filters       │
│  - Click "Discover Notes"           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  Stage 2: ContextSelectionModal     │
│  - Checkbox list of discovered notes│
│  - Toggle individual notes          │
│  - See character/token counts       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  Stage 3: ContextPreviewModal       │
│  - Final preview of context         │
│  - Path A: Save raw (no AI)         │
│  - Path B: Process with AI          │
│     → PromptSelectionModal          │
│     → Choose: Distill or Publish    │
└─────────────────────────────────────┘
```

---

## Key Algorithms

### BFS Link Traversal

Used by `ContextGatheringService.discoverLinkedNotes()`:

```
Queue = [RootNote at depth 0]

while Queue not empty:
  note = Queue.dequeue()

  if totalChars + note.size > maxChars:
    mark note as excluded (overflow)
    continue

  mark note as included
  totalChars += note.size

  if depth < maxDepth:
    for each link in note:
      if not already discovered:
        Queue.enqueue(linkedNote at depth + 1)
```

### Content Aggregation Format

Notes are combined with clear boundaries:

```markdown
# Note: [Note Title 1]

[Full content of note 1]

# Note: [Note Title 2]

[Full content of note 2]
```

### Backlink Mapping

During file creation:
1. Register mapping: `"Original Title"` → `"sanitized-filename"`
2. When writing content, replace all `[[Original Title]]` with `[[sanitized-filename]]`
3. Ensures backlinks work despite filename sanitization

---

## Extending the Plugin

### Adding a New Command

1. Define command handler in `main.ts`
2. Register with `addCommand({ id, name, callback })`
3. Use existing services or create new ones

### Adding a New Service

1. Create file in `src/services/`
2. Export class with constructor accepting `App` and dependencies
3. Initialize in `main.ts` `initializeServices()`
4. Add to plugin class properties

### Adding Settings

1. Add property to `OpenAugiSettings` in `types/settings.ts`
2. Add default value to `DEFAULT_SETTINGS`
3. Add UI control in `ui/settings-tab.ts` `display()` method

### Adding a New Modal

1. Create file in `src/ui/`
2. Extend `Modal` from Obsidian
3. Implement `onOpen()` and `onClose()`
4. Use callback pattern for returning results

---

## Build & Development

```bash
npm run dev      # Development build with watch
npm run build    # Production build
npm run typecheck # TypeScript checking
```

### Publishing

See [PUBLISHING.md](PUBLISHING.md) for the complete release process.

---

## Output Folders

| Folder | Purpose | Example Files |
|--------|---------|---------------|
| `OpenAugi/Summaries/` | Summary/distilled files | `MyNote - distilled.md` |
| `OpenAugi/Notes/` | Atomic note sessions | `Distill MyNote 2025-01-12 14-30-00/` |
| `OpenAugi/Published/` | Blog posts | `My Post - Published 2025-01-12.md` |
| `OpenAugi/Prompts/` | Custom prompt templates | `Technical Focus.md` |
| `OpenAugi/Logs/` | Debug logs (if enabled) | Distill context logs |

---

## Obsidian APIs Used

- `Plugin` - Base plugin class
- `App` - Vault and workspace access
- `TFile` - File abstraction
- `Modal` - Dialog windows
- `Notice` - Toast notifications
- `PluginSettingTab` - Settings panel
- `MetadataCache` - Link resolution
- `Vault` - File read/write operations

---

## External Dependencies

- **OpenAI API** - Chat completions endpoint
- **Dataview Plugin** (optional) - Query execution for advanced link discovery
