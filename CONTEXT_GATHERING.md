# Unified Context Gathering System

## Overview

OpenAugi's unified context gathering system is a powerful foundation that intelligently discovers, filters, and aggregates content from your notes before processing. Instead of having separate, rigid workflows for different commands, you now have **one flexible system** that lets you configure exactly what context to gather, review it before processing, and then choose how to process it.

Think of it as a three-stage pipeline:
1. **Gather**: Discover and collect notes based on your criteria
2. **Review**: Preview and refine your selection with checkboxes
3. **Process**: Choose to distill, publish, or just save the raw context

## Why This Matters

### The Problem It Solves

Previously, each command had its own way of gathering notes:
- "Distill linked notes" only looked at direct links (depth 1)
- "Distill recent activity" used time-based discovery
- No way to combine approaches or preview before processing
- No way to save raw context without AI processing

### The Solution

The unified system gives you:
- **Flexible discovery**: Link traversal up to 3 levels deep OR time-based discovery
- **Intelligent filtering**: Character limits, folder exclusions, journal section filtering
- **Checkbox review**: See exactly what will be included and toggle individual notes
- **Multiple outputs**: Distill to atomic notes, publish as blog post, or save raw context
- **Reusable architecture**: All commands use the same context gathering foundation

## Core Concepts

### Source Modes

**Linked Notes Mode**
- Starts from current note
- Follows links breadth-first up to 3 levels deep
- Includes: `[[wikilinks]]`, embeds, dataview queries, checked checkboxes
- Perfect for: Processing related content, topic deep-dives, project summaries

**Recent Activity Mode**
- Discovers notes by modification time or filename dates
- Supports "last N days" or specific date range
- Perfect for: Daily/weekly reviews, periodic summaries, time-based synthesis

### Link Depth Traversal

The system uses **Breadth-First Search (BFS)** to traverse links:

```
Depth 0: Root note (your starting point)
Depth 1: Direct links from root
Depth 2: Links from depth 1 notes
Depth 3: Links from depth 2 notes
```

**Example:**
```
You're on: [[Project Overview]]
  ├─ Depth 1: [[Meeting Notes]], [[Technical Specs]]
  │   ├─ Depth 2: [[Action Items]], [[Architecture Decisions]]
  │   │   └─ Depth 3: [[Implementation Details]], [[Risk Assessment]]
```

**Why BFS?**
- Captures breadth of related content first
- Prevents going too deep into narrow tangents
- More predictable and controllable than depth-first search

### Character Limits

Default: **100,000 characters** (~25,000 tokens)

**How it works:**
- System tracks total characters as it discovers notes
- When approaching limit, marks remaining notes as "discovered but not included"
- You can still manually include them via checkboxes (up to you!)
- Prevents token overflow and excessive API costs

### Journal Section Filtering

For journal-style notes with date headers (e.g., `### 2025-01-15`):
- **Enabled**: Only extracts sections within your time window
- **Disabled**: Includes entire note content
- Configurable date header format in settings

**Use case:** Your daily journal has 365 sections. You only want the last 7 days worth of entries, not the entire year.

## New Commands

### 1. OpenAugi: Process Notes

**Default behavior:**
- Source: Linked notes from current note
- Depth: 1 (direct links only)
- Shows processing type selector: Distill OR Publish

**Best for:**
- Processing a curated set of notes
- Topic-focused synthesis
- Creating blog posts from research notes

**Example workflow:**
1. Create note: `2025 Q1 Learning.md`
2. Add links: `[[Book Notes]]`, `[[Course Notes]]`, `[[Project Insights]]`
3. Run command → adjust depth to 2 → review checkboxes → publish as blog post

### 2. OpenAugi: Process Recent Activity

**Default behavior:**
- Source: Recent activity (last 7 days)
- Depth: N/A (time-based, not link-based)
- Shows processing type selector: Distill OR Publish

**Best for:**
- Weekly reviews
- Activity summaries
- Periodic reflection posts

**Example workflow:**
1. Run command
2. Change to "last 30 days" for monthly review
3. Exclude "Archive" and "Templates" folders
4. Select only the notes relevant to your review
5. Distill to atomic notes for your weekly review summary

### 3. OpenAugi: Save Context

**Default behavior:**
- Source: Linked notes from current note
- Depth: 1
- Skips AI processing, saves raw aggregated content

**Best for:**
- Gathering research before manual synthesis
- Creating reference documents
- Debugging context gathering
- Exporting collections for external tools

**Example workflow:**
1. Create note with links to all project documentation
2. Run "Save Context" → depth 3 → deselect irrelevant notes
3. Get single markdown file with all content aggregated
4. Use for offline reading, sharing, or manual analysis

## The Complete Flow

### Step 1: Context Gathering Configuration

**Modal: "Gather Context"**

Configure HOW to discover notes:

**Source:**
- `Linked notes from current note` (follows links)
- `Recently modified notes` (time-based)

**For Linked Notes:**
- `Root note`: Shows current note (auto-filled)
- `Link depth`: Slider 1-3 levels
- `Max characters`: Default 100,000 (adjustable)

**For Recent Activity:**
- `Time window`: "Last N days" OR "Specific date range"
- `Days back`: 1, 7, 30, etc.
- `From/To dates`: YYYY-MM-DD format

**Filtering:**
- `Exclude folders`: Comma-separated list (e.g., "Templates, Archive")
- `Recent sections only`: Toggle for journal filtering
- `Journal sections days back`: How many days for section filtering

**Estimate display:**
Shows estimated note count and character count before discovery

**Action:** Click "Discover Notes" →

### Step 2: Checkbox Selection

**Modal: "Select Notes to Include"**

Review ALL discovered notes with full control:

**Features:**
- ✅ Checkbox for each note (checked = include)
- Organized by depth level (for linked notes)
- Shows character count per note
- Shows discovery path ("root", "linked from [[X]]", "recent activity")
- `Select All` / `Deselect All` buttons
- Real-time summary: "Selected: 8 of 12 notes (24,532 characters, ~6,133 tokens)"

**Why this step matters:**
- You see exactly what was discovered
- Remove irrelevant notes before processing
- Verify the context makes sense
- Control costs by managing total size

**Action:** Click "Continue" →

### Step 3: Context Preview

**Modal: "Context Preview"**

Final review before processing:

**Displays:**
- 📊 Summary stats (notes, characters, tokens, source mode, link depth)
- 📝 List of all included notes
- 👁️ Preview of first 1000 characters of aggregated content

**Two paths:**

**Path A: Save Raw Context**
- Creates note: `Context YYYY-MM-DD HH-mm-ss.md`
- Saved to: `OpenAugi/` folder
- Contains: Metadata + full aggregated content
- No AI processing, no API cost
- Opens immediately for review

**Path B: Process with AI**
- Shows prompt selection modal →

### Step 4A: Save Raw Context (Path A)

**Output:**
```markdown
# Gathered Context

**Source**: linked-notes
**Notes**: 8
**Characters**: 24,532
**Timestamp**: 2025-10-13T14:30:00Z
**Link Depth**: 2

## Included Notes
- [[Root Note]]
- [[Note 1]]
- [[Note 2]]
...

---

[Full aggregated content here]
```

**Use cases:**
- Manual synthesis and writing
- Debugging context issues
- Sharing context with team
- Backup before AI processing

### Step 4B: Process with AI (Path B)

**Modal: "Process Context"**

Choose processing type and prompt:

**Output format:**
- `Distill to atomic notes` (default)
- `Publish as single post` (new!)

**Custom prompt (optional):**
- Dropdown of prompts from `OpenAugi/Prompts/` folder
- Or use default prompt

**Action:** Click "Process" →

### Step 5: AI Processing & Output

**If Distill:**
- Creates atomic notes (one concept per note)
- Creates summary with links to atomic notes
- Extracts tasks
- Saved to: `OpenAugi/Notes/Distill [Name] YYYY-MM-DD/`
- Summary: `OpenAugi/Summaries/[Name] - distilled.md`

**If Publish:**
- Creates single polished blog post
- Conversational, reader-friendly tone
- Preserves your voice and personality
- Saved to: `OpenAugi/Published/[Title] - Published YYYY-MM-DD.md`
- Includes frontmatter with metadata

## Processing Types Explained

### Distill to Atomic Notes

**What it does:**
- Analyzes content for distinct concepts and ideas
- Creates separate notes (one idea per note)
- Deduplicates and merges overlapping concepts
- Extracts actionable tasks
- Generates summary linking all atomic notes

**Output structure:**
```
OpenAugi/Notes/Distill MyProject 2025-10-13 14-30-52/
  ├─ Core Concept.md
  ├─ Key Decision.md
  ├─ Technical Approach.md
  └─ Risk Consideration.md

OpenAugi/Summaries/MyProject - distilled.md
  └─ [Summary with links to above notes + tasks]
```

**Best for:**
- Building knowledge base
- Organizing research
- Breaking down complex topics
- Creating reusable concept notes

### Publish as Single Post

**What it does:**
- Transforms raw notes into ONE cohesive blog post
- Preserves your unique voice and personality
- Adds narrative structure and transitions
- Formats for readability (headers, paragraphs, emphasis)
- Creates conversational, direct tone

**Output structure:**
```
OpenAugi/Published/Building Second Brains - Published 2025-10-13.md

---
type: published-post
published_date: 2025-10-13T14:30:00Z
prompt_used: default
status: draft
source_notes: [[Note 1]], [[Note 2]], [[Note 3]]
---

# Building a Second Brain That Actually Works

[Full polished blog post ready to copy-paste]

---
*Generated from notes using OpenAugi. Source notes: [[Note 1]], [[Note 2]]...*
```

**Best for:**
- Creating shareable content
- Blog posts and articles
- Discord/forum posts
- Documentation
- Turning notes into publishable writing

**Publishing prompt focus:**
- PRESERVE: Your voice, tone, creative phrases, core insights
- ADD: Context, transitions, narrative arc, why it matters
- FORMAT: Short paragraphs, headers, emphasis, conversational
- TONE: Direct, honest, friend-to-friend explanation

## Configuration Settings

**Settings → OpenAugi → Context Gathering Settings**

### Default Link Depth
- Slider: 1-3
- Default: 1 (direct links only)
- What it does: Sets initial depth when opening context gathering modal

### Default Max Characters
- Input: Number
- Default: 100,000
- What it does: Character limit before stopping discovery
- Recommended: 50k-150k depending on your vault size

### Filter Recent Sections by Default
- Toggle: On/Off
- Default: On
- What it does: Enables journal section filtering in recent activity mode
- When to disable: If you want full note content always

### Published Folder
- Input: Path
- Default: `OpenAugi/Published`
- What it does: Where published blog posts are saved

## How I Intend to Use This

### Weekly Review & Publishing

**Every Sunday:**
1. Run "Process Recent Activity"
2. Set to "last 7 days"
3. Exclude "Archive", "Templates", "OpenAugi"
4. Enable "Recent sections only" (my daily journal is huge)
5. Review checkboxes - uncheck meeting notes, keep insights
6. Choose "Publish as single post"
7. Get weekly reflection blog post ready for my blog

**Why this works:**
- Automated discovery of my week's work
- Filter out noise (meetings, templates)
- Only recent journal sections (not entire year)
- Direct path from notes → publishable post
- Preserves my voice without over-editing

### Deep Research Synthesis

**When finishing a research project:**
1. Create note: `Project X - Research Hub.md`
2. Add links to all research notes, papers, meeting notes
3. Run "Process Notes"
4. Set depth to 3 (capture transitively related notes)
5. Max characters: 150k (large project)
6. Review checkboxes, keep only relevant notes
7. Choose "Distill to atomic notes"
8. Get organized knowledge base of research insights

**Why this works:**
- Depth 3 captures comprehensive context
- Checkbox review removes tangential notes
- Distillation creates reusable concept notes
- Summary shows connections I might have missed

### Content Pipeline

**For creating blog content:**

**Stage 1: Gather context**
1. Create `Blog Ideas - October.md`
2. Link to rough notes: `[[Idea 1]]`, `[[Idea 2]]`, etc.
3. Run "Save Context" (depth 2)
4. Review raw aggregated content
5. Manually edit/refine the context note

**Stage 2: Publish**
1. Run "Process Notes" on the refined context note
2. Depth 1 (just the context itself)
3. Choose "Publish as single post"
4. Get polished blog post

**Why this works:**
- Save context first lets me review before AI processing
- Manual refinement adds my editorial eye
- Publishing step transforms refined notes to blog post
- Two-stage process: gather → refine → publish

### Project Documentation

**Creating comprehensive project docs:**
1. Run "Process Notes" on `Project Overview.md`
2. Depth 3, max 200k characters
3. Include all technical specs, decisions, meeting notes
4. Save raw context first (for reference)
5. Then process with custom "Technical Documentation" prompt
6. Get structured technical docs in atomic note format

**Why this works:**
- Raw context saved for completeness
- Deep traversal ensures nothing missed
- Custom prompt focuses on technical aspects
- Atomic notes create navigable documentation structure

## Advanced Tips

### Combining Source Modes

**Strategy: Recent notes as seed, then traverse links**
1. First, run "Process Recent" to discover recent work
2. Save the collection (checkbox selection)
3. Then run "Process Notes" on that collection with depth 2
4. Captures recent work PLUS related context

### Managing Character Limits

**For large vaults:**
- Start with 50k character limit
- Review what gets excluded in checkbox modal
- If needed, increase limit and re-run
- Or: Process in batches (multiple depth-1 runs)

### Journal Section Filtering

**Best practices:**
- Set date header format to match your journals
- Enable "Recent sections only" by default
- Adjust "Journal sections days back" to match time window
- Example: 30-day review → 30-day journal sections

### Custom Prompts for Publishing

**Create publishing prompt variants:**
- `Technical Blog Post.md` - Focus on explaining technical concepts
- `Personal Reflection.md` - Emphasis on insights and growth
- `Tutorial Style.md` - Step-by-step instructional tone

**Store in:** `OpenAugi/Prompts/`

### Iterative Refinement

**Process:**
1. Save raw context first (see what you're working with)
2. Review, identify gaps or noise
3. Adjust gathering config (depth, exclusions)
4. Re-run with refined config
5. Process with AI when context is clean

## Troubleshooting

### "No notes discovered"

**Check:**
- Is current note open? (for linked notes mode)
- Do links exist in current note?
- Are folders excluded that contain your notes?
- For recent activity: Is date range correct?

### "Character limit exceeded" warning

**Solutions:**
- Increase max characters in config
- Use folder exclusions to filter large notes
- Reduce link depth
- Process in smaller batches

### "Journal section filtering not working"

**Check:**
- Date header format matches your notes exactly
- Format includes YYYY, MM, DD placeholders
- Headers are markdown headers (##, ###, etc.)
- Enable "Recent sections only" toggle

### Processing takes too long

**Optimize:**
- Reduce character count (smaller context)
- Use folder exclusions aggressively
- Start with depth 1, increase if needed
- Check for very large linked notes

### Output not what expected

**Try:**
- Review raw context first (save context command)
- Verify checkbox selections
- Use custom prompt for specific focus
- Add custom context in notes for guidance

## Future Enhancements

Potential additions to the system:

**Section-level selection:**
- Checkbox specific headings within notes
- Include only relevant sections
- More granular control than note-level

**Smart filtering:**
- Auto-exclude based on tags
- Include only notes with specific properties
- Filter by note type or template

**Preset configurations:**
- Save gathering configs as presets
- Quick-select "Weekly Review" config
- Share configs between vaults

**Graph-based discovery:**
- Visual graph of discovered notes
- Click to toggle inclusion
- See relationships before processing

**Batch operations:**
- Process multiple root notes at once
- Merge contexts from different sources
- Parallel processing workflows

## Technical Details

### BFS Algorithm

The link traversal uses breadth-first search:

```typescript
Queue: [root]
Depth 0: Process root, add direct links to queue
Depth 1: Process direct links, add their links to queue
Depth 2: Process second-level links, add their links to queue
Depth 3: Process third-level links (stop, max depth reached)
```

**Properties:**
- Explores broadly before deeply
- Guarantees shortest path to any note
- Respects character limits during traversal
- Marks overflow notes as "discovered but excluded"

### Character Counting

Tracks cumulative characters during discovery:

```typescript
totalChars = 0
for each discovered note:
  contentSize = note.length
  if totalChars + contentSize > maxChars:
    mark note as excluded (overflow)
  else:
    include note
    totalChars += contentSize
```

User can manually override exclusions in checkbox modal.

### Aggregation Format

Content aggregated as:

```markdown
# Note: [Note 1 Title]

[Note 1 full content]

# Note: [Note 2 Title]

[Note 2 full content]
```

This format:
- Preserves note boundaries
- Maintains context for AI
- Easy to read in raw format
- Works well for both distill and publish

## Comparison with Previous System

| Feature | Before | Now |
|---------|--------|-----|
| Link depth | 1 only | 1-3 configurable |
| Preview before processing | No | Yes (checkbox modal) |
| Character limits | None | Configurable |
| Save raw context | No | Yes |
| Publishing support | No | Yes |
| Source flexibility | Fixed per command | Choose in modal |
| Manual selection | Only for recent activity | All modes |
| Reusable architecture | No | Yes |

The new system is a **superset** of the old functionality - everything that worked before still works, but with more control and flexibility.
