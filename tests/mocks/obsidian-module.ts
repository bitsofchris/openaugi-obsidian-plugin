/**
 * Stub module that replaces `import { ... } from 'obsidian'` in tests.
 * Provides minimal class/type stubs so service code can import without error.
 * The real mock implementations (MockVault, MockApp, etc.) are in obsidian-mock.ts.
 */

export class TFile {
  path: string;
  basename: string;
  extension: string;
  stat: { mtime: number; ctime: number; size: number };

  constructor(path: string, mtime?: number) {
    this.path = path;
    this.extension = path.split('.').pop() || '';
    this.basename = path.split('/').pop()?.replace(`.${this.extension}`, '') || '';
    this.stat = { mtime: mtime || Date.now(), ctime: mtime || Date.now(), size: 0 };
  }
}

export class TAbstractFile {
  path: string = '';
}

export class Vault {}

export class MetadataCache {}

export class App {}

export class Plugin {}

export class Component {}

export class Modal {
  app: any;
  constructor(app: any) { this.app = app; }
  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  constructor(app: any, plugin: any) { this.app = app; this.plugin = plugin; }
  display() {}
  hide() {}
}

export class Setting {
  constructor(_el: any) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addText(_cb: any) { return this; }
  addToggle(_cb: any) { return this; }
  addDropdown(_cb: any) { return this; }
  addButton(_cb: any) { return this; }
}

export class Notice {
  constructor(message: string, _timeout?: number) {
    // Silent in tests — uncomment for debugging:
    // console.log('[Notice]', message);
  }
}

export class FileSystemAdapter {
  private basePath: string;
  constructor(basePath?: string) { this.basePath = basePath || ''; }
  getBasePath(): string { return this.basePath; }
}

export class MarkdownView {}
export class WorkspaceLeaf {}
