import { describe, it, expect, beforeEach } from 'vitest';
import { FileService } from '../src/services/file-service';
import { MockApp } from './mocks/obsidian-mock';
import { TranscriptResponse, DistillResponse } from '../src/types/transcript';
import * as path from 'path';
import * as fs from 'fs';

const BASE_OUTPUT_DIR = path.resolve(__dirname, 'vault-output');
let testCounter = 0;

describe('FileService', () => {
  let app: MockApp;
  let service: FileService;
  let outputDir: string;

  beforeEach(() => {
    // Use unique subdirectory per test to avoid parallel cleanup races
    testCounter++;
    outputDir = path.join(BASE_OUTPUT_DIR, `run-${testCounter}-${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    app = new MockApp(outputDir);
    service = new FileService(
      app as any,
      'OpenAugi/Summaries',
      'OpenAugi/Notes',
      'OpenAugi/Published'
    );
  });

  describe('ensureDirectoriesExist', () => {
    it('creates all output directories', async () => {
      await service.ensureDirectoriesExist();

      expect(fs.existsSync(path.join(outputDir, 'OpenAugi/Summaries'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'OpenAugi/Notes'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'OpenAugi/Published'))).toBe(true);
    });

    it('is idempotent (safe to call multiple times)', async () => {
      await service.ensureDirectoriesExist();
      await service.ensureDirectoriesExist();

      expect(fs.existsSync(path.join(outputDir, 'OpenAugi/Summaries'))).toBe(true);
    });
  });

  describe('writeTranscriptFiles', () => {
    const mockTranscriptData: TranscriptResponse = {
      summary: 'This transcript discusses [[Atomic Notes]] and [[Knowledge Management]].',
      notes: [
        { title: 'Atomic Notes', content: 'Each note should contain one idea. See [[Knowledge Management]].' },
        { title: 'Knowledge Management', content: 'Systems for organizing knowledge. Related to [[Atomic Notes]].' },
      ],
      tasks: [
        '- [ ] Review [[Atomic Notes]] methodology',
        '- [ ] Set up Zettelkasten system',
      ],
    };

    it('creates summary file with backlinks', async () => {
      await service.writeTranscriptFiles('My Transcript', mockTranscriptData);

      const summaryPath = path.join(outputDir, 'OpenAugi/Summaries/My Transcript - summary.md');
      expect(fs.existsSync(summaryPath)).toBe(true);

      const content = fs.readFileSync(summaryPath, 'utf-8');
      expect(content).toContain('Atomic Notes');
      expect(content).toContain('Knowledge Management');
    });

    it('creates atomic note files in session folder', async () => {
      await service.writeTranscriptFiles('My Transcript', mockTranscriptData);

      const notesDir = path.join(outputDir, 'OpenAugi/Notes');
      const sessionFolders = fs.readdirSync(notesDir);
      expect(sessionFolders.length).toBe(1);
      expect(sessionFolders[0]).toMatch(/^Transcript \d{4}-\d{2}-\d{2}/);

      const sessionPath = path.join(notesDir, sessionFolders[0]);
      const noteFiles = fs.readdirSync(sessionPath);
      expect(noteFiles).toContain('Atomic Notes.md');
      expect(noteFiles).toContain('Knowledge Management.md');
    });

    it('includes tasks section in summary', async () => {
      await service.writeTranscriptFiles('My Transcript', mockTranscriptData);

      const summaryPath = path.join(outputDir, 'OpenAugi/Summaries/My Transcript - summary.md');
      const content = fs.readFileSync(summaryPath, 'utf-8');
      expect(content).toContain('## Tasks');
      expect(content).toContain('Review');
    });

    it('processes backlinks in note content', async () => {
      await service.writeTranscriptFiles('My Transcript', mockTranscriptData);

      const notesDir = path.join(outputDir, 'OpenAugi/Notes');
      const sessionFolders = fs.readdirSync(notesDir);
      const sessionPath = path.join(notesDir, sessionFolders[0]);

      const atomicContent = fs.readFileSync(path.join(sessionPath, 'Atomic Notes.md'), 'utf-8');
      // Backlinks should reference sanitized filenames
      expect(atomicContent).toContain('[[Knowledge Management]]');
    });

    it('sanitizes filenames with special characters', async () => {
      const dataWithSpecialChars: TranscriptResponse = {
        summary: 'Summary of [[Note: Special]]',
        notes: [
          { title: 'Note: Special', content: 'Content with special title' },
        ],
        tasks: [],
      };

      await service.writeTranscriptFiles('Test', dataWithSpecialChars);

      const notesDir = path.join(outputDir, 'OpenAugi/Notes');
      const sessionFolders = fs.readdirSync(notesDir);
      const sessionPath = path.join(notesDir, sessionFolders[0]);
      const noteFiles = fs.readdirSync(sessionPath);

      // Colon should be sanitized
      expect(noteFiles.some(f => f.includes(':'))).toBe(false);
      expect(noteFiles.some(f => f.includes('Note'))).toBe(true);
    });
  });

  describe('writeDistilledFiles', () => {
    const mockDistillData: DistillResponse = {
      summary: 'Distilled insights about [[Topic A]] and [[Topic B]].',
      notes: [
        { title: 'Topic A', content: 'Deep analysis of A' },
        { title: 'Topic B', content: 'Overview of B, see also [[Topic A]]' },
      ],
      tasks: ['- [ ] Follow up on Topic A'],
      sourceNotes: ['Root Note', 'Linked Note A'],
    };

    it('creates distilled summary file', async () => {
      // Create a mock TFile for the root
      const { createTestTFile } = await import('./mocks/obsidian-mock');
      // We need a file that exists in the output dir, so create it first
      fs.mkdirSync(path.join(outputDir, 'test'), { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'test/My Root.md'), 'root content');
      const rootFile = createTestTFile(outputDir, 'test/My Root.md');

      const summaryPath = await service.writeDistilledFiles(rootFile, mockDistillData);

      expect(summaryPath).toContain('My Root - distilled');
      expect(fs.existsSync(path.join(outputDir, summaryPath))).toBe(true);
    });

    it('creates atomic notes in session folder', async () => {
      const { createTestTFile } = await import('./mocks/obsidian-mock');
      fs.mkdirSync(path.join(outputDir, 'test'), { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'test/Root.md'), 'root');
      const rootFile = createTestTFile(outputDir, 'test/Root.md');

      await service.writeDistilledFiles(rootFile, mockDistillData);

      const notesDir = path.join(outputDir, 'OpenAugi/Notes');
      const sessionFolders = fs.readdirSync(notesDir);
      expect(sessionFolders.length).toBe(1);
      expect(sessionFolders[0]).toMatch(/^Distill Root/);

      const sessionPath = path.join(notesDir, sessionFolders[0]);
      const noteFiles = fs.readdirSync(sessionPath);
      expect(noteFiles).toContain('Topic A.md');
      expect(noteFiles).toContain('Topic B.md');
    });

    it('includes source notes in summary', async () => {
      const { createTestTFile } = await import('./mocks/obsidian-mock');
      fs.mkdirSync(path.join(outputDir, 'test'), { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'test/Root.md'), 'root');
      const rootFile = createTestTFile(outputDir, 'test/Root.md');

      const summaryPath = await service.writeDistilledFiles(rootFile, mockDistillData);
      const content = fs.readFileSync(path.join(outputDir, summaryPath), 'utf-8');

      expect(content).toContain('## Source Notes');
      expect(content).toContain('[[Root Note]]');
      expect(content).toContain('[[Linked Note A]]');
    });
  });

  describe('writePublishedPost', () => {
    it('creates published file with frontmatter', async () => {
      const content = '# My Great Post\n\nThis is the blog post content.';
      const filePath = await service.writePublishedPost(content, ['Source A', 'Source B'], 'default');

      expect(filePath).toContain('Published');
      const fullContent = fs.readFileSync(path.join(outputDir, filePath), 'utf-8');

      expect(fullContent).toContain('---');
      expect(fullContent).toContain('type: published-post');
      expect(fullContent).toContain('status: draft');
      expect(fullContent).toContain('[[Source A]]');
      expect(fullContent).toContain('# My Great Post');
    });

    it('extracts title from first heading', async () => {
      const content = '# Test Title\n\nContent here.';
      const filePath = await service.writePublishedPost(content, ['Source'], 'default');

      expect(filePath).toContain('Test Title');
    });

    it('falls back to source note name when no heading', async () => {
      const content = 'No heading, just content.';
      const filePath = await service.writePublishedPost(content, ['My Source Note'], 'default');

      expect(filePath).toContain('My Source Note');
    });
  });
});
