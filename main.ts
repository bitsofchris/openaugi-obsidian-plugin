import { Plugin, TFile, Notice, PluginSettingTab, App, Setting } from 'obsidian';

interface TranscriptParserSettings {
  apiKey: string;
}

const DEFAULT_SETTINGS: TranscriptParserSettings = {
  apiKey: ''
};

export default class TranscriptParserPlugin extends Plugin {
  settings: TranscriptParserSettings;

  async onload() {
    await this.loadSettings();
    
    // Ensure output directories exist
    await this.ensureDirectoriesExist();
    
    this.watchFolder("transcripts");
    
    // Add a command to manually parse a transcript file
    this.addCommand({
      id: 'parse-transcript',
      name: 'Parse Transcript',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          try {
            const content = await this.app.vault.read(activeFile);
            await this.parseAndOutput(activeFile.basename, content);
            new Notice(`Successfully parsed transcript: ${activeFile.basename}`);
          } catch (error) {
            console.error('Failed to parse transcript:', error);
            new Notice('Failed to parse transcript. Check console for details.');
          }
        } else {
          new Notice('Please open a markdown transcript file first');
        }
      }
    });

    // Add settings tab
    this.addSettingTab(new TranscriptParserSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async ensureDirectoriesExist() {
    const dirs = [
      "Parsed_Notes",
      "Parsed_Notes/summaries",
      "Parsed_Notes/notes"
    ];
    
    for (const dir of dirs) {
      const exists = await this.app.vault.adapter.exists(dir);
      if (!exists) {
        await this.app.vault.createFolder(dir);
      }
    }
  }

  watchFolder(folderPath: string) {
    this.registerEvent(this.app.vault.on('create', async (file: TFile) => {
      if (file.path.startsWith(folderPath)) {
        const content = await this.app.vault.read(file);
        await this.parseAndOutput(file.basename, content);
      }
    }));
  }

  async parseAndOutput(filename: string, content: string) {
    // Ensure output directories exist
    await this.ensureDirectoriesExist();
    
    if (!this.settings.apiKey) {
      new Notice('Please set your OpenAI API key in the plugin settings');
      throw new Error('OpenAI API key not set');
    }
    
    const prompt = `You are an expert parser of voice notes acting as an Obsidian agent. Your task is to parse raw transcripts from voice notes and extract the following:

**Parsing Instructions:**
First, generate atomic notes, then create summaries and tasks based on these notes.

1. **Atomic Notes**:
   - Create atomic notes (one key idea per note).
   - Include detailed, nuanced supporting information concisely.
   - Avoid repetition and ensure each note is self-contained.
   - Use Obsidian syntax for backlinks (\`[[Atomic Note Title]]\`) to reference other relevant atomic notes you've just created, only when genuinely relevant.

2. **Tasks**:
   - Identify clear actions or tasks to perform.
   - Include Obsidian links (\`[[Atomic Note Title]]\`) to relevant atomic notes you've just created, but only when genuinely relevant.
   - Not every note should have a task, only when relevant. Pay special attention to when the author gives explicit instructions to create tasks.

3. **Summary**:
   - Generate a short summary (1-3 sentences) distilling the key discussion points.
   - Include Obsidian links (\`[[Atomic Note Title]]\`) to relevant atomic notes you've just created, but only when relevant.
   - Links likely should be used here since the summary is pointing to the atomic notes you just created.

**Special Parsing Instructions**:
- Any explicit instructions given by the voice note's author will be indicated by the token "AUGI" or variants like "auggie", or "augi".
- Commands starting with "AUGI" should trigger explicit parsing actions:

Example Commands:
- "AUGI create note titled XYZ": Create a note with title "XYZ" and relevant context.
- "AUGI summarize this": Summarize preceding context.
- "AUGI add task ABC": Add task "ABC" to task list.

- Create explicit "Insight Blocks" for notable quotes or points only when relevant:
> Insight: "Explicit notable point or quote."

Return output strictly formatted as JSON:

{
  "summary": "Short summary (ignoring commands)",
  "notes": [
    {"title": "Note Title", "content": "Detailed content of the atomic note."}
  ],
  "tasks": ["- [ ] Task with optional link to atomic note if relevant"]
}

Transcript:
${content}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini-2025-04-14',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      const responseData = await response.json();
      const messageContent = responseData.choices[0].message.content;
      
      if (!messageContent) {
        throw new Error('No response content received from OpenAI');
      }
      
      // Clean up the response content in case it contains markdown formatting
      let cleanedContent = messageContent;
      
      // Remove markdown code blocks if present (```json or just ```)
      const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1].trim();
      }
      
      // Parse the JSON
      let structuredData;
      try {
        structuredData = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', cleanedContent);
        throw new Error(`Failed to parse JSON response: ${parseError.message}`);
      }

      // Output Summary
      await this.app.vault.create(`Parsed_Notes/summaries/${filename}_summary.md`, structuredData.summary);

      // Output Notes
      for (const note of structuredData.notes) {
        await this.app.vault.create(`Parsed_Notes/notes/${note.title}.md`, note.content);
      }

      // Append Tasks
      const tasksFile = this.app.vault.getAbstractFileByPath("Parsed_Notes/tasks.md");
      if (tasksFile instanceof TFile) {
        let existingTasks = await this.app.vault.read(tasksFile);
        existingTasks += '\n' + structuredData.tasks.map((task: string) => `- [ ] ${task}`).join('\n');
        await this.app.vault.modify(tasksFile, existingTasks);
      } else {
        await this.app.vault.create("Parsed_Notes/tasks.md", structuredData.tasks.map((task: string) => `- [ ] ${task}`).join('\n'));
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
}

class TranscriptParserSettingTab extends PluginSettingTab {
  plugin: TranscriptParserPlugin;

  constructor(app: App, plugin: TranscriptParserPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();

    containerEl.createEl('h2', {text: 'OpenAugi Settings'});

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Your OpenAI API key')
      .addText(text => text
        .setPlaceholder('sk-...')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        })
      );
  }
}