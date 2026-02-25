import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Mock the obsidian module globally so imports don't fail
      'obsidian': path.resolve(__dirname, 'tests/mocks/obsidian-module.ts'),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
