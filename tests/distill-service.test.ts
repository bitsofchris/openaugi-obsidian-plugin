import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistillService } from '../src/services/distill-service';
import { OpenAIService } from '../src/services/openai-service';
import { DEFAULT_SETTINGS } from '../src/types/settings';
import { createMockApp, createTestTFile } from './mocks/obsidian-mock';
import * as path from 'path';

const VAULT_DIR = path.resolve(__dirname, 'vault');

describe('DistillService', () => {
  let app: ReturnType<typeof createMockApp>;
  let openAIService: OpenAIService;
  let service: DistillService;

  beforeEach(() => {
    app = createMockApp(VAULT_DIR);
    openAIService = new OpenAIService('test-key', 'gpt-5');
    service = new DistillService(app as any, openAIService, DEFAULT_SETTINGS);
  });

  describe('getLinkedNotes', () => {
    it('extracts forward links from a note', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');
      const linked = await service.getLinkedNotes(rootFile);

      const basenames = linked.map(f => f.basename);
      expect(basenames).toContain('Linked Note A');
      expect(basenames).toContain('Linked Note B');
    });

    it('does not include the root file itself', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');
      const linked = await service.getLinkedNotes(rootFile);

      const paths = linked.map(f => f.path);
      expect(paths).not.toContain('Root Note.md');
    });

    it('deduplicates linked files', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');
      const linked = await service.getLinkedNotes(rootFile);

      const paths = linked.map(f => f.path);
      const uniquePaths = [...new Set(paths)];
      expect(paths.length).toBe(uniquePaths.length);
    });

    it('extracts only checked items from collection notes', async () => {
      const collectionFile = createTestTFile(VAULT_DIR, 'Collection Note.md');
      const linked = await service.getLinkedNotes(collectionFile);

      const basenames = linked.map(f => f.basename);
      // Only [x] items should be included
      expect(basenames).toContain('Linked Note A');
      expect(basenames).toContain('Journal Note');
      // Unchecked items should NOT be included
      expect(basenames).not.toContain('Linked Note B');
      expect(basenames).not.toContain('Backlink Source');
    });

    it('handles notes with no links', async () => {
      const deepNote = createTestTFile(VAULT_DIR, 'Deeply Linked/Deep Note.md');
      const linked = await service.getLinkedNotes(deepNote);
      expect(linked).toHaveLength(0);
    });
  });

  describe('getBacklinksForFile', () => {
    it('finds notes that link TO the target file', () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');
      const backlinks = service.getBacklinksForFile(rootFile);

      const basenames = backlinks.map(f => f.basename);
      expect(basenames).toContain('Backlink Source');
      expect(basenames).toContain('Special Characters!');
    });

    it('returns empty array for notes with no backlinks', () => {
      const excludedFile = createTestTFile(VAULT_DIR, 'Excluded Folder/Should Skip.md');
      const backlinks = service.getBacklinksForFile(excludedFile);
      expect(backlinks).toHaveLength(0);
    });
  });

  describe('getBacklinkSnippets', () => {
    it('extracts context around backlink references', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');
      const backlinkSource = createTestTFile(VAULT_DIR, 'Backlink Source.md');

      const snippets = await service.getBacklinkSnippets(rootFile, backlinkSource, 0);

      expect(snippets.length).toBeGreaterThan(0);
      // Header section mode (0) should include the section header
      expect(snippets[0].snippet).toContain('Section About Root');
      expect(snippets[0].snippet).toContain('Root Note');
    });

    it('returns empty for files with no links to target', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');
      const deepNote = createTestTFile(VAULT_DIR, 'Deeply Linked/Deep Note.md');

      const snippets = await service.getBacklinkSnippets(rootFile, deepNote, 0);
      expect(snippets).toHaveLength(0);
    });
  });

  describe('aggregateContent', () => {
    it('combines content from multiple files', async () => {
      const files = [
        createTestTFile(VAULT_DIR, 'Linked Note A.md'),
        createTestTFile(VAULT_DIR, 'Linked Note B.md'),
      ];

      const result = await service.aggregateContent(files);

      expect(result.content).toContain('# Note: Linked Note A');
      expect(result.content).toContain('# Note: Linked Note B');
      expect(result.content).toContain('atomic note-taking');
      expect(result.content).toContain('Zettelkasten');
      expect(result.sourceNotes).toContain('Linked Note A');
      expect(result.sourceNotes).toContain('Linked Note B');
    });

    it('deduplicates files by path', async () => {
      const fileA = createTestTFile(VAULT_DIR, 'Linked Note A.md');
      const fileDuplicate = createTestTFile(VAULT_DIR, 'Linked Note A.md');

      const result = await service.aggregateContent([fileA, fileDuplicate]);

      // Should only appear once
      const occurrences = (result.content.match(/# Note: Linked Note A/g) || []).length;
      expect(occurrences).toBe(1);
    });

    it('strips dataview queries from output', async () => {
      const files = [createTestTFile(VAULT_DIR, 'Dataview Note.md')];
      const result = await service.aggregateContent(files);

      expect(result.content).not.toContain('```dataview');
      expect(result.content).not.toContain('TABLE file.mtime');
      expect(result.content).toContain('Regular content after the dataview block');
    });
  });

  describe('journal date filtering', () => {
    it('identifies journal-style notes with date headers', () => {
      // Access private method via any cast
      const content = '# Daily\n\n### 2026-02-25\nToday entry\n\n### 2026-02-20\nOlder entry';
      const result = (service as any).isJournalStyleNote(content);
      expect(result).toBe(true);
    });

    it('rejects non-journal notes', () => {
      const content = '# Regular Note\n\nJust some content without date headers.';
      const result = (service as any).isJournalStyleNote(content);
      expect(result).toBe(false);
    });

    it('extracts date sections correctly', () => {
      const content = '# Header\n\n### 2026-02-25\nRecent\n\n### 2026-01-15\nOlder';
      const sections = (service as any).getDateSections(content);

      expect(sections.length).toBe(3); // header + 2 dated sections
      expect(sections[0].date).toBeNull(); // undated header
      expect(sections[1].date).toBeInstanceOf(Date);
      expect(sections[2].date).toBeInstanceOf(Date);
    });

    it('filters content by date range', () => {
      const content = '# Daily Journal\n\n### 2026-02-25\nRecent entry\n\n### 2025-01-01\nVery old entry';
      const filtered = (service as any).extractContentByDateRange(content, 30);

      expect(filtered).toContain('Recent entry');
      expect(filtered).not.toContain('Very old entry');
    });
  });

  describe('extractDateFromFilename', () => {
    it('extracts date from YYYY-MM-DD prefix', () => {
      const date = (service as any).extractDateFromFilename('2026-02-25 My Note');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(1); // 0-indexed
      expect(date.getDate()).toBe(25);
    });

    it('returns null for non-date filenames', () => {
      const date = (service as any).extractDateFromFilename('My Regular Note');
      expect(date).toBeNull();
    });
  });

  describe('dataview query handling', () => {
    it('detects dataview queries in content', () => {
      const content = 'Some text\n\n```dataview\nLIST FROM #tag\n```\n\nMore text';
      expect((service as any).containsDataviewQuery(content)).toBe(true);
    });

    it('returns false for content without dataview', () => {
      const content = 'Regular markdown content\n\n```javascript\nconsole.log("hi")\n```';
      expect((service as any).containsDataviewQuery(content)).toBe(false);
    });

    it('extracts dataview query strings', () => {
      const content = 'Text\n\n```dataview\nLIST FROM #tag\n```\n\n```dataview\nTABLE file.name\n```';
      const queries = (service as any).extractDataviewQueries(content);
      expect(queries).toHaveLength(2);
      expect(queries[0]).toContain('LIST FROM #tag');
      expect(queries[1]).toContain('TABLE file.name');
    });

    it('strips dataview queries from content', () => {
      const content = 'Before\n\n```dataview\nLIST\n```\nAfter';
      const stripped = (service as any).stripDataviewQueries(content);
      expect(stripped).not.toContain('```dataview');
      expect(stripped).toContain('Before');
      expect(stripped).toContain('After');
    });
  });

  describe('tag stripping', () => {
    it('strips simple tags', () => {
      const result = (service as any).stripTags('Some text #tag more text');
      expect(result).not.toContain('#tag');
      expect(result).toContain('Some text');
      expect(result).toContain('more text');
    });

    it('strips nested tags', () => {
      const result = (service as any).stripTags('Content #nested/tag here');
      expect(result).not.toContain('#nested/tag');
    });

    it('preserves markdown headers', () => {
      const result = (service as any).stripTags('## Header\n\nContent #tag');
      expect(result).toContain('## Header');
      expect(result).not.toContain('#tag');
    });
  });
});
