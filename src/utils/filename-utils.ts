/**
 * Sanitizes a filename to remove characters that aren't allowed in filenames
 * @param filename The filename to sanitize
 * @returns The sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, ' - ');
} 