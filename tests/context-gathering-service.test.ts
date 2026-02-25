import { describe, it, expect, beforeEach } from 'vitest';
import { ContextGatheringService } from '../src/services/context-gathering-service';
import { DistillService } from '../src/services/distill-service';
import { OpenAIService } from '../src/services/openai-service';
import { DEFAULT_SETTINGS } from '../src/types/settings';
import { createMockApp, createTestTFile } from './mocks/obsidian-mock';
import * as path from 'path';

const VAULT_DIR = path.resolve(__dirname, 'vault');

describe('ContextGatheringService', () => {
  let app: ReturnType<typeof createMockApp>;
  let distillService: DistillService;
  let service: ContextGatheringService;

  beforeEach(() => {
    app = createMockApp(VAULT_DIR);
    const openAIService = new OpenAIService('test-key', 'gpt-5');
    distillService = new DistillService(app as any, openAIService, DEFAULT_SETTINGS);
    service = new ContextGatheringService(app as any, distillService, DEFAULT_SETTINGS);
  });

  describe('gatherContext - linked-notes mode', () => {
    it('discovers root note and its forward links at depth 1', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 1,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: false,
        backlinkContextLines: 0,
      });

      const names = result.notes.map(n => n.file.basename);
      expect(names).toContain('Root Note');
      expect(names).toContain('Linked Note A');
      expect(names).toContain('Linked Note B');
      expect(result.totalNotes).toBeGreaterThanOrEqual(3);
    });

    it('respects depth limit', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 1,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: false,
        backlinkContextLines: 0,
      });

      // At depth 1, we should NOT see "Deep Note" (which is depth 2: Root → A → Deep)
      const names = result.notes.map(n => n.file.basename);
      expect(names).not.toContain('Deep Note');
    });

    it('discovers deeper links at depth 2', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 2,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: false,
        backlinkContextLines: 0,
      });

      // At depth 2, "Deep Note" should be discovered (Root → Linked Note A → Deep Note)
      const names = result.notes.map(n => n.file.basename);
      expect(names).toContain('Deep Note');
    });

    it('includes backlinks when enabled', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 1,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: true,
        backlinkContextLines: 0,
      });

      const names = result.notes.map(n => n.file.basename);
      // "Backlink Source" links TO Root Note, so should be discovered
      expect(names).toContain('Backlink Source');

      // Verify the backlink note is marked as such
      const backlinkNote = result.notes.find(n => n.file.basename === 'Backlink Source');
      expect(backlinkNote?.isBacklink).toBe(true);
      expect(backlinkNote?.discoveredVia).toContain('backlink');
    });

    it('respects character limit', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      // Use a very small character limit
      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 2,
        maxCharacters: 200, // Very small — root note alone should exceed this
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: false,
        backlinkContextLines: 0,
      });

      // Some notes should be excluded due to size limit
      const excludedNotes = result.notes.filter(n => !n.included);
      expect(excludedNotes.length).toBeGreaterThan(0);
    });

    it('throws when root note is missing in linked-notes mode', async () => {
      await expect(
        service.gatherContext({
          sourceMode: 'linked-notes',
          linkDepth: 1,
          maxCharacters: 100000,
          excludeFolders: [],
          filterRecentSectionsOnly: false,
        })
      ).rejects.toThrow('Root note required');
    });
  });

  describe('folder exclusion', () => {
    it('excludes notes from specified folders', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 3,
        maxCharacters: 100000,
        excludeFolders: ['Excluded Folder'],
        filterRecentSectionsOnly: false,
        includeBacklinks: true,
        backlinkContextLines: 0,
      });

      const includedNames = result.notes
        .filter(n => n.included)
        .map(n => n.file.basename);
      expect(includedNames).not.toContain('Should Skip');
    });
  });

  describe('aggregateContent', () => {
    it('aggregates forward links and backlinks separately', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const gathered = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 1,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: true,
        backlinkContextLines: 0,
      });

      expect(gathered.aggregatedContent).toContain('# Note:');
      expect(gathered.totalCharacters).toBeGreaterThan(0);
    });

    it('includes backlink snippets in aggregated content', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const gathered = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 1,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: true,
        backlinkContextLines: 0,
      });

      // Backlink content should be in the aggregated output
      if (gathered.notes.some(n => n.isBacklink)) {
        expect(gathered.aggregatedContent).toContain('# Backlink:');
      }
    });
  });

  describe('gatherContext - recent-activity mode', () => {
    it('throws when time window is missing', async () => {
      await expect(
        service.gatherContext({
          sourceMode: 'recent-activity',
          linkDepth: 1,
          maxCharacters: 100000,
          excludeFolders: [],
          filterRecentSectionsOnly: false,
        })
      ).rejects.toThrow('Time window required');
    });
  });

  describe('note metadata', () => {
    it('assigns correct depth to discovered notes', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 2,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: false,
        backlinkContextLines: 0,
      });

      const rootEntry = result.notes.find(n => n.file.basename === 'Root Note');
      expect(rootEntry?.depth).toBe(0);

      const linkedA = result.notes.find(n => n.file.basename === 'Linked Note A');
      expect(linkedA?.depth).toBe(1);

      const deepNote = result.notes.find(n => n.file.basename === 'Deep Note');
      if (deepNote) {
        expect(deepNote.depth).toBe(2);
      }
    });

    it('includes discoveredVia metadata', async () => {
      const rootFile = createTestTFile(VAULT_DIR, 'Root Note.md');

      const result = await service.gatherContext({
        sourceMode: 'linked-notes',
        rootNote: rootFile,
        linkDepth: 1,
        maxCharacters: 100000,
        excludeFolders: [],
        filterRecentSectionsOnly: false,
        includeBacklinks: false,
        backlinkContextLines: 0,
      });

      const rootEntry = result.notes.find(n => n.file.basename === 'Root Note');
      expect(rootEntry?.discoveredVia).toBe('root');

      const linkedEntry = result.notes.find(n => n.file.basename === 'Linked Note A');
      expect(linkedEntry?.discoveredVia).toContain('linked from');
    });
  });
});
