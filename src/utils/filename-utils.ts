/**
 * Sanitizes a filename to remove characters that aren't allowed in filenames
 * @param filename The filename to sanitize
 * @returns The sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, ' - ');
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