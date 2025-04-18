# OpenAugi
## Voice to Self-Organizing Second Brain for Obsidian

Unlock the power of voice capture and go faster.

Open Augi ("auggie") is an open source augmented intelligence plugin for Obsidian. It's designed for people who like to think out loud (like me).

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

OpenAugi offers two primary commands:

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

### 2. Distill Linked Notes

This command analyzes a set of linked notes and synthesizes them into a coherent set of atomic notes.

**Usage:**
1. Create a root note that links to other notes you want to distill
   - Links can be regular Obsidian links like `[[Note Name]]`
   - You can also use dataview queries (if the dataview plugin is installed)
2. Open this root note
3. Hit `CMD+P` (or `CTRL+P` on Windows/Linux) to open the command palette
4. Run `OpenAugi: Distill Linked Notes`

The plugin will:
- Gather all linked notes
- Analyze their content together
- Create new atomic notes that synthesize and organize the information
- Generate a summary that connects the key concepts
- Extract any actionable tasks found across the notes

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

## Requirements
Note: this requires an OpenAI API key to work. 

Your content is sent directly to OpenAI for processing using the best model for this task. The cost to use this plugin depends on the API credits consumed. For me ~5 minutes of voice note is about 2-3 cents of processing.

## Output Structure

OpenAugi creates two types of files:
1. **Summary files** - Placed in your designated summary folder, containing:
   - A concise summary of the content
   - Links to all atomic notes
   - Tasks extracted from the content
   
2. **Atomic notes** - Placed in your designated notes folder, each containing:
   - A single, self-contained idea
   - Context and supporting details
   - Backlinks to related notes where relevant

# Get involved, let's build augmented intelligence

This plugin is meant to solve my own problems around using Obsidian as my second brain and AI for organizing my notes.

Augmented intelligence is using AI to help you think faster and do more. Not to write and think for you. But rather to support and augment what you are capable of.

Open an [issue](https://github.com/bitsofchris/openaugi-obsidian-plugin/issues), join the [Discord](https://discord.gg/d26BVBrnRP), and check out my [YouTube](https://www.youtube.com/@bitsofchris) to give feedback on how this works for you or what you'd like to see next. Read more at the [parent repo](https://github.com/bitsofchris/openaugi).