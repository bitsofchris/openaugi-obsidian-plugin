/**
 * Filesystem-backed mock of the Obsidian API.
 * Reads/writes real markdown files from a test vault directory so we can
 * test DistillService, FileService, ContextGatheringService, etc. without
 * running Obsidian.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TFile } from './obsidian-module';

// ─── Link Parsing ────────────────────────────────────────────────────────────

interface ParsedLink {
  link: string;       // The raw link text (e.g., "Note A" or "Note A|alias")
  original: string;   // The full match including brackets
  position: { start: { line: number; col: number }; end: { line: number; col: number } };
}

/** Parse [[wikilinks]] from markdown content */
function parseWikilinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const regex = /\[\[(.*?)\]\]/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const rawLink = match[1];
      // Strip alias: [[path|alias]] → path
      const linkPath = rawLink.includes('|') ? rawLink.split('|')[0] : rawLink;
      links.push({
        link: linkPath,
        original: match[0],
        position: {
          start: { line: lineNum, col: match.index },
          end: { line: lineNum, col: match.index + match[0].length },
        },
      });
    }
  }

  return links;
}

// ─── MockTFile helpers ───────────────────────────────────────────────────────

/** Create a TFile from a real filesystem path relative to vault root */
function createMockTFile(vaultRoot: string, relativePath: string): TFile {
  const absPath = path.join(vaultRoot, relativePath);
  let mtime = Date.now();
  try {
    const stat = fs.statSync(absPath);
    mtime = stat.mtimeMs;
  } catch { /* file may not exist yet for output tests */ }
  const file = new TFile(relativePath, mtime);
  file.stat.size = (() => {
    try { return fs.statSync(absPath).size; } catch { return 0; }
  })();
  return file;
}

// ─── MockVaultAdapter ────────────────────────────────────────────────────────

class MockVaultAdapter {
  constructor(private vaultRoot: string) {}

  async exists(filePath: string): Promise<boolean> {
    return fs.existsSync(path.join(this.vaultRoot, filePath));
  }

  async stat(filePath: string): Promise<{ mtime: number; ctime: number; size: number } | null> {
    const absPath = path.join(this.vaultRoot, filePath);
    try {
      const stat = fs.statSync(absPath);
      return { mtime: stat.mtimeMs, ctime: stat.ctimeMs, size: stat.size };
    } catch {
      return null;
    }
  }
}

// ─── MockVault ───────────────────────────────────────────────────────────────

export class MockVault {
  adapter: MockVaultAdapter;
  private vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot;
    this.adapter = new MockVaultAdapter(vaultRoot);
  }

  /** Read a file's content */
  async read(file: TFile): Promise<string> {
    const absPath = path.join(this.vaultRoot, file.path);
    return fs.readFileSync(absPath, 'utf-8');
  }

  /** Create a file */
  async create(filePath: string, content: string): Promise<TFile> {
    const absPath = path.join(this.vaultRoot, filePath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absPath, content, 'utf-8');
    return createMockTFile(this.vaultRoot, filePath);
  }

  /** Create a folder */
  async createFolder(folderPath: string): Promise<void> {
    const absPath = path.join(this.vaultRoot, folderPath);
    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(absPath, { recursive: true });
    }
  }

  /** Get all markdown files in the vault */
  getMarkdownFiles(): TFile[] {
    const files: TFile[] = [];
    const walk = (dir: string, relative: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), relPath);
        } else if (entry.name.endsWith('.md')) {
          files.push(createMockTFile(this.vaultRoot, relPath));
        }
      }
    };
    walk(this.vaultRoot, '');
    return files;
  }

  /** Get a file by its exact path */
  getAbstractFileByPath(filePath: string): TFile | null {
    const absPath = path.join(this.vaultRoot, filePath);
    if (fs.existsSync(absPath)) {
      return createMockTFile(this.vaultRoot, filePath);
    }
    return null;
  }
}

// ─── MockMetadataCache ───────────────────────────────────────────────────────

export class MockMetadataCache {
  /** resolvedLinks[sourcePath][targetPath] = linkCount */
  resolvedLinks: Record<string, Record<string, number>> = {};
  private vaultRoot: string;
  private vault: MockVault;

  constructor(vaultRoot: string, vault: MockVault) {
    this.vaultRoot = vaultRoot;
    this.vault = vault;
    this.buildLinkGraph();
  }

  /** Build the resolved links graph by scanning all markdown files */
  private buildLinkGraph(): void {
    const files = this.vault.getMarkdownFiles();
    for (const file of files) {
      const absPath = path.join(this.vaultRoot, file.path);
      const content = fs.readFileSync(absPath, 'utf-8');
      const links = parseWikilinks(content);

      if (!this.resolvedLinks[file.path]) {
        this.resolvedLinks[file.path] = {};
      }

      for (const link of links) {
        const resolved = this.resolveLink(link.link, file.path);
        if (resolved) {
          this.resolvedLinks[file.path][resolved.path] =
            (this.resolvedLinks[file.path][resolved.path] || 0) + 1;
        }
      }
    }
  }

  /** Resolve a link path to a TFile (mimics Obsidian's shortest-path resolution) */
  private resolveLink(linkPath: string, sourcePath: string): TFile | null {
    // Add .md extension if not present
    let searchPath = linkPath;
    if (!searchPath.endsWith('.md')) {
      searchPath += '.md';
    }

    // Try exact path first
    const exactFile = this.vault.getAbstractFileByPath(searchPath);
    if (exactFile) return exactFile;

    // Try relative to source file's directory
    const sourceDir = path.dirname(sourcePath);
    const relativePath = sourceDir === '.' ? searchPath : `${sourceDir}/${searchPath}`;
    const relativeFile = this.vault.getAbstractFileByPath(relativePath);
    if (relativeFile) return relativeFile;

    // Obsidian-style: search all files for basename match
    const baseName = searchPath.split('/').pop();
    if (baseName) {
      const allFiles = this.vault.getMarkdownFiles();
      const match = allFiles.find(f => f.path.endsWith(baseName) || f.path.endsWith(`/${baseName}`));
      if (match) return match;
    }

    return null;
  }

  /** Get cached metadata for a file (links extracted from content) */
  getFileCache(file: TFile): { links?: ParsedLink[]; embeds?: ParsedLink[] } | null {
    const absPath = path.join(this.vaultRoot, file.path);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const links = parseWikilinks(content);
      // For simplicity, embeds use the same format as links (Obsidian uses ![[embed]])
      const embedRegex = /!\[\[(.*?)\]\]/g;
      const embeds: ParsedLink[] = [];
      const lines = content.split('\n');
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        let match;
        while ((match = embedRegex.exec(lines[lineNum])) !== null) {
          const rawLink = match[1];
          const linkPath = rawLink.includes('|') ? rawLink.split('|')[0] : rawLink;
          embeds.push({
            link: linkPath,
            original: match[0],
            position: {
              start: { line: lineNum, col: match.index },
              end: { line: lineNum, col: match.index + match[0].length },
            },
          });
        }
      }
      return { links, embeds: embeds.length > 0 ? embeds : undefined };
    } catch {
      return null;
    }
  }

  /** Resolve a link path to a TFile (public API matching Obsidian's) */
  getFirstLinkpathDest(linkPath: string, sourcePath: string): TFile | null {
    return this.resolveLink(linkPath, sourcePath);
  }
}

// ─── MockApp ─────────────────────────────────────────────────────────────────

export class MockApp {
  vault: MockVault;
  metadataCache: MockMetadataCache;
  workspace: { onLayoutReady: (cb: () => void) => void; getActiveFile: () => null; getLeaf: () => any };
  plugins: { plugins: Record<string, any> };
  fileManager: { processFrontMatter: () => Promise<void> };

  constructor(vaultRoot: string) {
    this.vault = new MockVault(vaultRoot);
    this.metadataCache = new MockMetadataCache(vaultRoot, this.vault);
    this.workspace = {
      onLayoutReady: (cb) => cb(),
      getActiveFile: () => null,
      getLeaf: () => ({ openFile: async () => {} }),
    };
    this.plugins = { plugins: {} };
    this.fileManager = { processFrontMatter: async () => {} };
  }
}

// ─── Helper to create a fresh test vault ─────────────────────────────────────

/**
 * Create a MockApp pointed at a vault directory.
 * Use for tests that need the full Obsidian API mock.
 */
export function createMockApp(vaultRoot: string): MockApp {
  return new MockApp(vaultRoot);
}

/**
 * Create a TFile from a vault-relative path (for use in test assertions).
 */
export function createTestTFile(vaultRoot: string, relativePath: string): TFile {
  return createMockTFile(vaultRoot, relativePath);
}
