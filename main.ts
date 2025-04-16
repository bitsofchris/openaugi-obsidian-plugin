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

  async parseAndOutput(filename: string, content: string) {
    console.log("Parsing and outputting transcript:", filename);
    // Ensure output directories exist
    await this.ensureDirectoriesExist();
    
    if (!this.settings.apiKey) {
      new Notice('Please set your OpenAI API key in the plugin settings');
      throw new Error('OpenAI API key not set');
    }
    
// Begin Prompt
    const prompt = `
    You are an expert agent helping users process their voice notes into structured, useful Obsidian notes. Your mission is to capture the user's ideas, actions, and reflections in clean, atomic form. You act like a smart second brain, formatting output as Obsidian-ready markdown inside structured JSON.
    
    # Special Command Handling
    - Commands will be marked with the special keyword **AUGI** or close variants ("augie", "auggie", "augi").
    - These are **explicit commands** and should override default behavior.
    - Commands apply only to preceding or surrounding content, not the entire transcript.
    - If the speaker gives an unclear command, do your best to interpret faithfully using recent context.
    
    # Default Behavior (use the Augie commands to guide your behavior)
    Follow these steps **in order** to parse the transcript:
    
    ### 1. Atomic Notes
    - Break down ideas into **self-contained, atomic notes** (1 idea per note).
    - Include **supporting details**, context, or reasoning. Be concise but rich in insight.
    - Use \`[[Obsidian backlinks]]\` between notes *only when meaningful* and relevant.
    - Avoid repetition across notes. Think of each as a unique mental building block.
    
    ### 2. Tasks
    - Extract clear, actionable tasks or to-dos.
    - Format as: \`- [ ] Description of task [[Linked Atomic Note]]\` (if relevant).
    - Tasks should only be added if they are genuinely actionable, not vague thoughts.
    - If the author **explicitly says** to add a task (e.g., via AUGI), always include it.
    
    ### 3. Summary
    - Write a 1–3 sentence summary of **what was said**, not how it was said.
    - Highlight key concepts, questions raised, or insights.
    - Use \`[[Backlinks]]\` to connect to relevant atomic notes mentioned formatted as a list.
    
    ### 4. Journal Entry (Optional)
    - Only create if explicitly asked (e.g. via: “augie this is a journal entry”).
    - Use **first-person**, preserve author's words as much as possible.
    - Clean up repetitions or filler, but stay true to original tone.
    - Add tag \`#journal\` at the end.
    
    # Example AUGI Commands
    - **“Auggie create note titled XYZ”** → Create a note titled “XYZ”.
    - **“augie summarize this”** → Summarize recent thoughts.
    - **“augi add task ABC”** → Add task “ABC”.
    - **“auggie the above is a journal entry”** → Capture verbatim reflection in journal format.
    
    # Reasoning Strategy
    1. **Plan first**: Before writing, identify structure in the speaker’s thoughts.
    2. **Group context**: Organize ideas around coherent units.
    3. **Respect ambiguity**: When unsure, err on the side of creating a thoughtful atomic note.
    4. **Don’t repeat**: Avoid redundancy across notes, tasks, or summary.
    
    # Output Format (STRICT)
    Return a single JSON object formatted like this:
    
    
    {
      "summary": "Short 1–3 sentence summary (no commands included).",
      "notes": [
        {
          "title": "Title of Atomic Note",
          "content": "Markdown-formatted, self-contained idea with backlinks if relevant."
        }
      ],
      "tasks": [
        "- [ ] Do something important [[Related Atomic Note Title]]"
      ]
    }
      
Transcript:
${content}`;
// End Prompt
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          // model: 'gpt-4.1-mini-2025-04-14',
          model: 'gpt-4.1-2025-04-14',
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
        existingTasks += '\n' + structuredData.tasks.map((task: string) => `${task}`).join('\n');
        await this.app.vault.modify(tasksFile, existingTasks);
      } else {
        await this.app.vault.create("Parsed_Notes/tasks.md", structuredData.tasks.map((task: string) => `${task}`).join('\n'));
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