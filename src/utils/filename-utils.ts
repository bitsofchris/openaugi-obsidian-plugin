import { Vault } from 'obsidian';

/**
 * Sanitizes a filename to remove characters that aren't allowed in filenames
 * @param filename The filename to sanitize
 * @returns The sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, ' - ');
}

/**
 * Creates a file with collision handling - appends numbers if file exists
 * @param vault The Obsidian vault instance
 * @param basePath The desired file path
 * @param content The file content
 * @returns The actual path where the file was created
 */
export async function createFileWithCollisionHandling(
  vault: Vault,
  basePath: string,
  content: string
): Promise<string> {
  let finalPath = basePath;
  let counter = 1;
  
  // Try the original path first
  if (!await vault.adapter.exists(finalPath)) {
    await vault.create(finalPath, content);
    return finalPath;
  }
  
  // Extract base name and extension
  const pathMatch = basePath.match(/^(.*)(\.[^.]+)$/);
  const baseWithoutExt = pathMatch ? pathMatch[1] : basePath;
  const extension = pathMatch ? pathMatch[2] : '';
  
  // Try appending numbers
  while (counter < 100) { // Prevent infinite loop
    finalPath = `${baseWithoutExt}-${counter}${extension}`;
    if (!await vault.adapter.exists(finalPath)) {
      await vault.create(finalPath, content);
      return finalPath;
    }
    counter++;
  }
  
  // If still can't find unique name, use timestamp
  const timestamp = Date.now();
  finalPath = `${baseWithoutExt}-${timestamp}${extension}`;
  await vault.create(finalPath, content);
  return finalPath;
}

/**
 * Maps between note titles and their sanitized filenames
 * This helps ensure backlinks point to the correct files
 */
export class BacklinkMapper {
  private titleToFilenameMap: Map<string, string> = new Map();
  
  /**
   * Register a title and its sanitized filename
   */
  registerTitle(title: string, sanitizedFilename: string): void {
    this.titleToFilenameMap.set(title, sanitizedFilename);
  }
  
  /**
   * Process content to ensure backlinks use sanitized filenames
   * Replaces [[Original Title]] with [[Sanitized-Filename]]
   */
  processBacklinks(content: string): string {
    // Replace backlinks with their sanitized versions
    return content.replace(/\[\[(.*?)\]\]/g, (match, title) => {
      const sanitizedTitle = this.titleToFilenameMap.get(title) || sanitizeFilename(title);
      return `[[${sanitizedTitle}]]`;
    });
  }
} 