# OpenAugi
## Voice to Self-Organizing Second Brain for Obsidian

Unlock the power of voice capture and go faster.

Open Augi ("auggie") is an open source augmented intelligence plugin for Obsidian. It's designed for people who like to think out loud (like me).

**✨ NEW: Unified Context Gathering System** - Intelligently discover notes (up to 3 levels deep), review with checkboxes, and choose to distill into atomic notes OR publish as a polished blog post. One flexible system, multiple outputs. [Read the full guide →](CONTEXT_GATHERING.md)

Just capture your voice note, drop hints to Augi, and let Open Augi's agentic workflow process your note into a self-organizing second brain for you.

This is designed to run in a separate folder within your vault. Any agentic actions taken on existing notes, not created by Augi, will be sent to you for review.

Let Open Augi process and organize your thoughts so you can go further, faster.

Join the [Discord](https://discord.gg/d26BVBrnRP).
Parent [repo](https://github.com/bitsofchris/openaugi).

## Setup

1. Install the plugin from the Obsidian Community Plugins or manually
2. Go to Settings → OpenAugi
3. Enter your OpenAI API key
4. Set your preferred folders for summaries and atomic notes
5. Save settings

## Main Commands

OpenAugi offers commands for different workflows - from voice transcripts to unified context gathering:

### 1. Parse Transcript

This command processes a voice transcript or any text and organizes it into atomic notes, tasks, and a summary.

**Usage:**
1. Import your voice transcript into Obsidian as a markdown file
2. Open the transcript file
3. Hit `CMD+P` (or `CTRL+P` on Windows/Linux) to open the command palette
4. Run `OpenAugi: Parse Transcript`

The plugin will:
- Break down your transcript into separate atomic notes (1 idea per note)
- Extract any tasks mentioned
- Create a summary note with links to the atomic notes
- Link related concepts automatically

**Special Commands in Transcripts:**
Using "auggie" as a special token during your voice note can improve accuracy of the agentic behaviors.

- Say "auggie this is a task" to explicitly mark something as a task
- Say "auggie make a new note about X" to create a specific note
- Say "auggie summarize this" to get a summary of recent thoughts
- Say "auggie this is a journal entry" to format text as a journal entry

---

## 🆕 Unified Context Gathering Commands

**NEW: Flexible, powerful context gathering with link traversal, checkboxes, and dual output modes (distill OR publish).**

These commands use OpenAugi's unified context gathering system - a three-stage pipeline that gives you full control:

1. **Configure** - Choose source (linked notes or recent activity), depth, filters
2. **Review** - See discovered notes in checkbox list, toggle individual notes on/off
3. **Process** - Choose to distill into atomic notes OR publish as a single blog post

[📖 Read the complete Context Gathering Guide](CONTEXT_GATHERING.md)

### Process Notes

**Best for:** Processing curated sets of linked notes, creating blog posts from research, topic-focused synthesis

**How it works:**
1. Open any note with links to content you want to process
2. Run `OpenAugi: Process notes`
3. Configure discovery:
   - **Link depth**: 1-3 levels (breadth-first traversal)
   - **Max characters**: Default 100k (prevents overflow)
   - **Folder exclusions**: Skip Templates, Archive, etc.
   - **Journal filtering**: Extract only recent sections from journal notes
4. Review discovered notes in checkbox list
5. See preview with stats (notes, characters, tokens)
6. Choose output: **Distill to atomic notes** OR **Publish as single post**
7. Optionally select custom prompt lens

**Outputs:**
- **Distill**: Atomic notes in `OpenAugi/Notes/`, summary in `OpenAugi/Summaries/`
- **Publish**: Single blog post in `OpenAugi/Published/` with frontmatter

**Example use case:**
```markdown
# Q4 2024 Learning.md

Links to process:
- [[Book: Building a Second Brain]]
- [[Course: Knowledge Management]]
- [[Project Insights]]

Run "Process notes" → Depth 2 → Publish as blog post
→ Get: "What I Learned About Knowledge Management - Published 2025-10-13.md"
```

### Process Recent Activity

**Best for:** Weekly reviews, activity summaries, periodic reflection posts

**How it works:**
1. Run `OpenAugi: Process recent activity`
2. Configure time window:
   - **Last N days** (quick: 1, 7, 30 days)
   - **Specific date range** (exact: 2025-01-01 to 2025-01-31)
3. Same review → preview → process flow as above

**Example use case:**
```
Weekly review every Sunday:
1. Run "Process recent activity"
2. Set to "Last 7 days"
3. Exclude "Archive", "Templates"
4. Enable "Recent sections only" for journal filtering
5. Uncheck meeting notes, keep insights
6. Publish as blog post
→ Get: Weekly reflection ready for blog
```

### Save Context

**Best for:** Gathering research without AI processing, creating reference documents, debugging context

**How it works:**
1. Same configuration and review flow
2. But skips AI processing entirely
3. Saves raw aggregated content to `OpenAugi/Context YYYY-MM-DD.md`

**Example use case:**
```
Gather all project documentation:
1. Create note with links to all specs, decisions, notes
2. Run "Save context" → Depth 3
3. Get single markdown file with everything aggregated
→ Use for offline reading, sharing, manual synthesis
```

### Key Features

✅ **Link depth traversal** - Go up to 3 levels deep (breadth-first search)
✅ **Checkbox review** - Toggle individual notes before processing
✅ **Character limits** - Prevents token overflow (default: 100k)
✅ **Dual output modes** - Distill (atomic notes) OR Publish (blog post)
✅ **Journal filtering** - Extract only recent sections from journal notes
✅ **Raw context saving** - Skip AI, just aggregate content
✅ **Custom prompts** - Use lenses for focused processing

---

## Legacy Commands

These commands still work but are now superseded by the unified context gathering system above.

### 2. Distill Linked Notes (Legacy)

This command analyzes a set of linked notes and synthesizes them into a coherent set of atomic notes.

**Usage:**
1. Create a root note that links to other notes you want to distill
   - Links can be regular Obsidian links like `[[Note Name]]`
   - You can also use dataview queries (if the dataview plugin is installed)
2. Open this root note
3. Hit `CMD+P` (or `CTRL+P` on Windows/Linux) to open the command palette
4. Run `OpenAugi: Distill Linked Notes`
5. **NEW**: Select a custom prompt "lens" or use the default prompt

The plugin will:
- Show a prompt selection modal where you can choose a processing lens
- Gather all linked notes
- Analyze their content together using your selected lens
- Create new atomic notes that synthesize and organize the information
- Generate a summary that connects the key concepts
- Extract any actionable tasks found across the notes

## Custom Prompt Lenses

**NEW**: OpenAugi now supports custom prompt templates that act as "lenses" to focus processing on specific aspects of your notes.

### How Custom Prompts Work

Custom prompts allow you to guide OpenAugi's AI processing with specific perspectives or focus areas. When you run distillation commands, you can select from your custom prompts to process notes through different "lenses" - extracting different types of insights from the same content.

### Using Custom Prompts

1. When you run "Distill Linked Notes", you'll see a prompt selection modal
2. Choose from any prompt in your prompts folder (default: `OpenAugi/Prompts`)
3. The selected prompt replaces the default processing instructions while keeping the structured output format
4. Or select "Use default prompt" for general-purpose processing

### Understanding the Prompt System

#### Default Prompt
When no custom prompt is selected, OpenAugi uses its built-in default prompt that:
- Acts as an "expert knowledge curator"
- Creates atomic notes focusing on distinct concepts and ideas
- Deduplicates and merges overlapping information
- Extracts genuinely actionable tasks
- Generates comprehensive summaries highlighting connections

#### How Custom Prompts Replace the Default
When you select a custom prompt:
1. **Your custom prompt replaces** the default instruction section
2. **The system always adds**:
   - Any custom context from your notes (if present)
   - JSON output structure requirements
   - The actual note content to process

This means your custom prompt changes HOW the content is analyzed, but not the OUTPUT format.

### Creating Your Own Prompts

To create a custom prompt:

1. Create a new markdown file in your prompts folder
2. Write your instructions following this structure:
   - Start with a brief description of the lens perspective
   - Include sections for:
     - Creating atomic notes (with your specific focus)
     - Extracting tasks (if relevant to your lens)
     - Creating a summary (with your desired emphasis)
3. Save the file with a descriptive name (e.g., "Technical Documentation.md")

#### Template Structure
```markdown
You are an expert [your role] helping users [your purpose].

# Instructions
[Your specific focus and approach]

### 1. Create Atomic Notes
- [Your specific criteria for what makes a good atomic note]
- [How to identify relevant concepts for your lens]
- [Any special formatting or emphasis]

### 2. Extract Tasks
- [What counts as a task in your context]
- [How to format and prioritize tasks]

### 3. Create a Summary
- [What to emphasize in the summary]
- [How to structure the summary for your use case]
```

### Example Prompts Included

- **Research Focus**: Extracts academic insights, methodologies, and research questions
- **Project Management**: Focuses on deliverables, timelines, and actionable tasks
- **Personal Reflection**: Captures personal insights, emotions, and growth moments

### Tips for Writing Effective Prompts

- Be specific about what types of information to extract
- Maintain the structure of atomic notes, tasks, and summary
- Use clear, directive language
- Keep the focus narrow for best results
- Remember that Obsidian backlinks should still be used to connect ideas
- Test your prompt with various content types to ensure consistency

### Important Notes

- The JSON output structure is always preserved regardless of the prompt
- Custom prompts only affect the instructional content, not the response format
- Test your prompts with different types of notes to ensure they work as expected
- Custom prompts work in addition to (not instead of) any custom context in your notes
- If no prompt files exist in your prompts folder, only the default option will be available

## Custom Context

You can guide how OpenAugi processes your content by adding a custom context section to your notes:

```context:
Only extract items related to project goals and key decisions.
Focus on extracting the "why" behind each decision.
```

**For Transcript Parsing:**
Add this section to your transcript file before processing.

**For Distillation:**
Add this section to your root note before running the distill command.

**Example Use Cases:**
- `Focus only on extracting research findings and methodology details`
- `Extract only content related to project risks and mitigation strategies`
- `Identify and highlight conflicting viewpoints across these notes`
- `Focus on extracting personal insights and reflections, ignoring factual content`

The custom context allows you to narrow the focus of processing to extract specific types of information relevant to your current needs.

## Use Cases

### Daily/Weekly Reviews
Use "Process Recent Activity" to automatically summarize your work:
- Set to 1 day for daily reviews
- Set to 7 days for weekly reviews
- Automatically captures all your recent thoughts and work
- Perfect for identifying patterns and progress

### Project Summaries
Use "Distill Linked Notes" with a project hub note:
- Create a note that links to all project-related notes
- Run distillation to get a comprehensive project overview
- Extract all tasks and decisions across the project

### Research Synthesis
Combine both commands for research workflows:
- Use "Process Recent Activity" to review recent research notes
- Use "Distill Linked Notes" on topic-specific collections
- Add custom context to focus on findings, methodologies, or insights

### Journal Processing
Take advantage of journal-style note support:
- Keep daily journal entries with date headers
- Use "Process Recent Activity" to extract recent insights
- Only relevant date sections are processed, keeping context focused

## Requirements
Note: this requires an OpenAI API key to work. 

Your content is sent directly to OpenAI for processing using the best model for this task. The cost to use this plugin depends on the API credits consumed. For me ~5 minutes of voice note is about 2-3 cents of processing.

## Configuration Settings

OpenAugi provides several configuration options in Settings → OpenAugi:

### Basic Settings
- **OpenAI API Key**: Your API key for processing (required)
- **Summaries Folder**: Where summary files are saved (default: `OpenAugi/Summaries`)
- **Notes Folder**: Where atomic notes are saved (default: `OpenAugi/Notes`)
- **Prompts Folder**: Where custom prompt templates are stored (default: `OpenAugi/Prompts`)
- **Published Folder**: Where published blog posts are saved (default: `OpenAugi/Published`)
- **Use Dataview**: Enable processing of dataview queries in distillation

### Context Gathering Settings
Configure defaults for the unified context gathering system:

- **Default Link Depth**: Initial depth for link traversal (1-3, default: 1)
- **Default Max Characters**: Character limit before stopping discovery (default: 100,000)
- **Filter Recent Sections by Default**: Automatically enable journal section filtering (default: On)

### Recent Activity Settings
Configure defaults for recent activity processing:

- **Default Days to Look Back**: How many days of activity to include by default (default: 7)
- **Filter Journal Sections**: When enabled, only includes recent sections from journal-style notes
- **Date Header Format**: Customize the format for date headers in journal notes (default: `### YYYY-MM-DD`)
  - Examples: `## DD/MM/YYYY`, `#### YYYY.MM.DD`, `### [YYYY-MM-DD]`
  - Must include YYYY (year), MM (month), and DD (day) placeholders
- **Exclude Folders**: Comma-separated list of folders to skip (default: `Templates, Archive, OpenAugi`)

### Advanced Settings
- **Enable Distill Logging**: Logs the full context sent to AI for debugging (saved to `OpenAugi/Logs`)

## Journal-Style Notes Support

OpenAugi has special support for journal-style notes that use date headers. When processing recent activity:

1. **Automatic Detection**: Notes with date headers matching your configured format are automatically detected
2. **Smart Filtering**: Only sections with dates within your specified time window are included
3. **Flexible Formats**: Configure your preferred date header format in settings

Example journal note:
```markdown
# My Journal

### 2024-01-20
Today's thoughts and activities...

### 2024-01-19
Yesterday's reflections...

### 2024-01-10
Older content that may be filtered out...
```

When using "Process Recent Activity" with a 7-day window, only the recent sections would be processed.

## Output Structure

OpenAugi creates organized outputs for better note management:

### Summary Files
Placed in your designated summary folder (`OpenAugi/Summaries` by default):
- **Transcript summaries**: `[original-name] - summary.md`
- **Distilled notes**: `[root-note-name] - distilled.md`
- **Recent activity**: `Recent Activity YYYY-MM-DD - [first-note-title].md`

Each summary contains:
- A concise overview of the processed content
- Links to all generated atomic notes
- Extracted tasks with context
- Source note references (for distillations)

### Atomic Notes
Organized in session-specific folders within your notes folder (`OpenAugi/Notes` by default):
- **Transcript sessions**: `Transcript YYYY-MM-DD HH-mm-ss/`
- **Distill sessions**: `Distill [RootNoteName] YYYY-MM-DD HH-mm-ss/`
- **Recent activity sessions**: `Recent Activity YYYY-MM-DD HH-mm-ss/`

Each atomic note contains:
- A single, self-contained idea
- Relevant context and supporting details
- Backlinks to related concepts
- Clear, descriptive titles

### Collection Notes
Saved note selections for future processing (`OpenAugi/Collections` by default):
- **Format**: `Recent Activity YYYY-MM-DD HH-mm-ss.md`
- Contains checkbox lists of selected notes
- Preserves selection criteria and configuration
- Can be processed later using "Distill Linked Notes"

## Advanced Features

### Checkbox-Based Collections
OpenAugi recognizes and processes checkbox-style note collections:
```markdown
- [x] [[Note to include]]
- [ ] [[Note to exclude]]
- [x] [[Another included note]]
```
When running "Distill Linked Notes" on such a collection, only checked items are processed.

### Session Folders
All atomic notes from a single processing session are kept together in timestamped folders, making it easy to:
- Review all outputs from a specific session
- Move or archive related notes together
- Track the evolution of your ideas over time
- Avoid mixing notes from different contexts

# Get involved, let's build augmented intelligence

This plugin is meant to solve my own problems around using Obsidian as my second brain and AI for organizing my notes.

Augmented intelligence is using AI to help you think faster and do more. Not to write and think for you. But rather to support and augment what you are capable of.

Open an [issue](https://github.com/bitsofchris/openaugi-obsidian-plugin/issues), join the [Discord](https://discord.gg/d26BVBrnRP), and check out my [YouTube](https://www.youtube.com/@bitsofchris) to give feedback on how this works for you or what you'd like to see next. Read more at the [parent repo](https://github.com/bitsofchris/openaugi).