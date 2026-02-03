import fg from 'fast-glob';
import path from 'path';
import fs from 'fs';

/**
 * Default file patterns to include
 */
const DEFAULT_INCLUDE_PATTERNS = ['**/*.{js,jsx,ts,tsx,mjs}'];

/**
 * Default patterns to exclude
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
];

/**
 * File Discovery Module
 * Finds all relevant files in a directory
 */
export class FileDiscovery {
  private includePatterns: string[];
  private excludePatterns: string[];

  constructor(options?: {
    includePatterns?: string[];
    excludePatterns?: string[];
  }) {
    this.includePatterns = options?.includePatterns || DEFAULT_INCLUDE_PATTERNS;
    this.excludePatterns = options?.excludePatterns || DEFAULT_EXCLUDE_PATTERNS;
  }

  /**
   * Find all files matching the patterns
   */
  async findFiles(searchPath: string): Promise<string[]> {
    // Check if path exists
    if (!fs.existsSync(searchPath)) {
      throw new Error(`Path does not exist: ${searchPath}`);
    }

    const cwd = searchPath;

    try {
      const files = await fg(this.includePatterns, {
        cwd,
        absolute: true,
        ignore: this.excludePatterns,
        onlyFiles: true,
        unique: true,
      });

      return files.sort();
    } catch (error) {
      throw new Error(`Failed to find files: ${error}`);
    }
  }

  /**
   * Check if a file should be included
   */
  isFileSupported(filePath: string): boolean {
    const ext = path.extname(filePath);
    const supportedExts = ['.js', '.jsx', '.ts', '.tsx', '.mjs'];
    return supportedExts.includes(ext);
  }

  /**
   * Filter files based on patterns
   */
  filterFiles(files: string[], includePattern?: string): string[] {
    if (!includePattern) {
      return files;
    }

    const regex = new RegExp(includePattern);
    return files.filter(file => regex.test(file));
  }

  /**
   * Get file stats for a file
   */
  getFileStats(filePath: string): { size: number; modified: Date } {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
    };
  }
}
