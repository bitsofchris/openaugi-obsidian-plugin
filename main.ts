import { Plugin, TFile, Notice } from 'obsidian';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

export default class TranscriptParserPlugin extends Plugin {
  async onload() {
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
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `You will receive a raw transcript from voice notes. Identify all commands that start with the special token "AUGI" and parse them clearly.

Example commands:
- "AUGI create note titled XYZ" → Create a new note with title XYZ.
- "AUGI summarize this" → Summarize preceding context.
- "AUGI add task ABC" → Create a new task item.

Return strictly JSON:
{
  "summary": "Short summary (ignoring commands)",
  "notes": [{"title": "Note Title", "content": "Content"}],
  "tasks": ["task 1", "task 2"]
}

Transcript:\n${content}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: 'user', content: prompt }]
    });

    const messageContent = response.choices[0].message.content;
    if (!messageContent) {
      throw new Error('No response content received from OpenAI');
    }
    const structuredData = JSON.parse(messageContent);

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
  }
}