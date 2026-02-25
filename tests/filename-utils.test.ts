import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeFilename, BacklinkMapper, createFileWithCollisionHandling } from '../src/utils/filename-utils';
import { MockVault } from './mocks/obsidian-mock';
import * as path from 'path';
import * as fs from 'fs';

const BASE_OUTPUT_DIR = path.resolve(__dirname, 'vault-output');
let collisionTestDir: string;
let collisionTestCounter = 0;

describe('sanitizeFilename', () => {
  it('passes through clean filenames unchanged', () => {
    expect(sanitizeFilename('My Note')).toBe('My Note');
    expect(sanitizeFilename('simple-name')).toBe('simple-name');
  });

  it('replaces backslash', () => {
    expect(sanitizeFilename('path\\to\\file')).toBe('path - to - file');
  });

  it('replaces forward slash', () => {
    expect(sanitizeFilename('path/to/file')).toBe('path - to - file');
  });

  it('replaces colon', () => {
    expect(sanitizeFilename('Note: Important')).toBe('Note -  Important');
  });

  it('replaces asterisk', () => {
    expect(sanitizeFilename('Note*star')).toBe('Note - star');
  });

  it('replaces question mark', () => {
    expect(sanitizeFilename('Is this a note?')).toBe('Is this a note - ');
  });

  it('replaces double quotes', () => {
    expect(sanitizeFilename('He said "hello"')).toBe('He said  - hello - ');
  });

  it('replaces angle brackets', () => {
    expect(sanitizeFilename('<tag>')).toBe(' - tag - ');
  });

  it('replaces pipe', () => {
    expect(sanitizeFilename('A | B')).toBe('A  -  B');
  });

  it('handles multiple special characters', () => {
    const result = sanitizeFilename('Note: "Important" <test> | value');
    expect(result).not.toMatch(/[\\/:*?"<>|]/);
  });
});

describe('BacklinkMapper', () => {
  let mapper: BacklinkMapper;

  beforeEach(() => {
    mapper = new BacklinkMapper();
  });

  it('maps registered titles to sanitized filenames in backlinks', () => {
    mapper.registerTitle('My Important Note', 'My Important Note');
    mapper.registerTitle('Note: Special', 'Note -  Special');

    const result = mapper.processBacklinks('See [[Note: Special]] and [[My Important Note]]');
    expect(result).toBe('See [[Note -  Special]] and [[My Important Note]]');
  });

  it('falls back to sanitizeFilename for unregistered titles', () => {
    const result = mapper.processBacklinks('See [[Unregistered: Note]]');
    expect(result).toBe('See [[Unregistered -  Note]]');
  });

  it('handles content with no backlinks', () => {
    const result = mapper.processBacklinks('Plain text with no links');
    expect(result).toBe('Plain text with no links');
  });

  it('handles multiple backlinks in same line', () => {
    mapper.registerTitle('A', 'a-sanitized');
    mapper.registerTitle('B', 'b-sanitized');

    const result = mapper.processBacklinks('Links: [[A]] and [[B]]');
    expect(result).toBe('Links: [[a-sanitized]] and [[b-sanitized]]');
  });
});

describe('createFileWithCollisionHandling', () => {
  beforeEach(() => {
    collisionTestCounter++;
    collisionTestDir = path.join(BASE_OUTPUT_DIR, `collision-${collisionTestCounter}-${Date.now()}`);
    fs.mkdirSync(collisionTestDir, { recursive: true });
  });

  it('creates file at original path when no collision', async () => {
    const vault = new MockVault(collisionTestDir);
    const result = await createFileWithCollisionHandling(vault as any, 'test-note.md', 'Hello');
    expect(result).toBe('test-note.md');

    const content = fs.readFileSync(path.join(collisionTestDir, 'test-note.md'), 'utf-8');
    expect(content).toBe('Hello');
  });

  it('appends -1 when file already exists', async () => {
    const vault = new MockVault(collisionTestDir);
    fs.writeFileSync(path.join(collisionTestDir, 'note.md'), 'existing');

    const result = await createFileWithCollisionHandling(vault as any, 'note.md', 'New content');
    expect(result).toBe('note-1.md');

    const content = fs.readFileSync(path.join(collisionTestDir, 'note-1.md'), 'utf-8');
    expect(content).toBe('New content');
  });

  it('increments counter for multiple collisions', async () => {
    const vault = new MockVault(collisionTestDir);
    fs.writeFileSync(path.join(collisionTestDir, 'note.md'), 'v1');
    fs.writeFileSync(path.join(collisionTestDir, 'note-1.md'), 'v2');
    fs.writeFileSync(path.join(collisionTestDir, 'note-2.md'), 'v3');

    const result = await createFileWithCollisionHandling(vault as any, 'note.md', 'v4');
    expect(result).toBe('note-3.md');
  });
});
