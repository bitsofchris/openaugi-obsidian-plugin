# OpenAugi Obsidian Plugin - Technical Overview

## Project Purpose
OpenAugi is an Obsidian plugin that transforms voice notes and linked notes into organized, atomic notes using AI. It helps users process unstructured thoughts into a structured "second brain" by breaking down content into self-contained ideas.

The goal is to help humans process information faster.

Read the docs/CODEBASE_MAP.md to understand the project at a high level. Be sure to update this map as we make any siginficant changes.

## Architecture Overview

### Project Structure
```
/
├── src/
│   ├── main.ts                 # Plugin entry point, command registration
│   ├── services/
│   │   ├── openai.service.ts   # AI processing logic
│   │   ├── file.service.ts     # File operations, output management
│   │   └── distill.service.ts  # Linked note extraction, content aggregation
│   ├── ui/
│   │   └── settings.ts         # Settings tab UI component
│   └── utils/
│       └── filename.utils.ts   # Filename sanitization, backlink mapping
├── manifest.json               # Obsidian plugin metadata
├── package.json                # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── esbuild.config.mjs         # Build configuration
```

## Key Features

### 1. Voice Transcript Parsing
- Processes voice transcripts into atomic notes (one idea per note)
- Extracts actionable tasks and creates summaries
- Supports "auggie" voice commands for special behaviors
- Estimates token usage before processing

### 2. Linked Notes Distillation
- Analyzes a root note and all its linked notes
- Supports both standard Obsidian links and Dataview queries
- Deduplicates and merges overlapping ideas
- Creates comprehensive summaries with source attribution

### 3. Custom Context Instructions
- Users can add `context:` sections to notes for focused extraction
- Context instructions guide AI processing behavior

## Development Guidelines

### Build Commands
```bash
# Development build with hot reload
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

### Code Standards
- TypeScript with strict mode enabled
- ESLint configuration for code quality
- No external runtime dependencies (only Obsidian API)

### Testing
Currently no automated tests. Manual testing through Obsidian's developer console.

## API Integration

### OpenAI Service
- Model: GPT-4.1-2025-04-14
- Temperature: 0.7 for parsing, 0.3 for distilling
- Structured output using JSON schema
- Token estimation before API calls

### File Operations
- Creates atomic notes in configurable folders
- Generates summaries with backlinks
- Handles special characters in filenames
- Maintains backlink mappings for navigation

## Configuration

### User Settings
- `openaiApiKey`: Required for AI processing
- `summaryFolderPath`: Default "OpenAugi/Summaries"
- `notesFolderPath`: Default "OpenAugi/Notes"
- `useDataview`: Enable/disable Dataview integration

### Build Configuration
- Target: ES2018/ES6
- Platform: Browser (Electron)
- External: Obsidian modules
- Sourcemaps enabled for development

## Output Structure

### Summary Files
- Format: `[original-name] - summary.md` or `[original-name] - distilled.md`
- Contains: Summary, atomic note links, extracted tasks
- For distilled notes: Shows source note references

### Atomic Notes
- Self-contained ideas with context
- Includes relevant backlinks
- Organized by timestamp or topic

## Common Development Tasks

### Adding New Features
1. Extend services in `/src/services/`
2. Update command registration in `main.ts`
3. Add settings if needed in `settings.ts`

### Debugging
- Use Obsidian's developer console (Ctrl+Shift+I)
- Check console for error messages
- Enable verbose logging in development

### Publishing
1. Update version in `manifest.json` and `package.json`
2. Build production bundle: `npm run build`
3. Create release with `main.js`, `manifest.json`, and `styles.css`

##### Obsidian tagging
1. Create a tag that matches the version in the `manifest.json` file.
    
    ```bash
    git push # dont forget to push the code
    git tag -a 1.0.1 -m "1.0.1"
    git push origin 1.0.1
    ```
*** Be sure to update `manifest.json` version number as part of PR ***

## Important Considerations

- Always handle API errors gracefully
- Respect rate limits and token usage
- Sanitize filenames to prevent filesystem issues
- Maintain backwards compatibility with existing notes
- Test with various note structures and edge cases

# Testing

My local testing vault is in: /Users/chris/zk-for-testing

Add any notes to /Users/chris/Documents/DEV-TESTING/Test to capture edge cases when relevant.