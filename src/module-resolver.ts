import path from 'path';
import fs from 'fs';

/**
 * Module Resolver
 * Mimics TypeScript/Node.js module resolution to properly resolve import paths
 * to absolute file paths, just like IDEs do when you "command + click"
 */
export class ModuleResolver {
  private extensions: string[];

  constructor(extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
    this.extensions = extensions;
  }

  /**
   * Resolve an import specifier to an absolute file path
   * @param specifier - The import specifier (e.g., './components/Test')
   * @param fromFile - The absolute path of the file containing the import
   * @returns Resolved absolute path, or null if not found
   */
  resolveImport(specifier: string, fromFile: string): string | null {
    try {
      // Normalize the specifier
      const normalized = this.normalizePath(specifier);

      // Handle relative imports
      if (normalized.startsWith('./') || normalized.startsWith('../')) {
        return this.resolveRelative(normalized, fromFile);
      }

      // Handle absolute imports (src/components/Test)
      if (path.isAbsolute(normalized)) {
        return this.resolveAbsolute(normalized);
      }

      // Handle bare imports (react, lodash) - return as-is
      if (!normalized.includes('/') && !normalized.startsWith('.')) {
        return normalized;
      }

      // Try to resolve relative to current file as fallback
      return this.resolveRelative(normalized, fromFile);
    } catch (error) {
      return null;
    }
  }

  /**
   * Resolve relative import paths
   * e.g., './components/Test' from '/src/App.tsx' → '/src/components/Test.ts'
   */
  private resolveRelative(specifier: string, fromFile: string): string | null {
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, specifier);

    return this.tryExtensions(resolved) || this.tryIndex(resolved);
  }

  /**
   * Resolve absolute import paths
   * e.g., '/src/components/Test' or 'src/components/Test'
   */
  private resolveAbsolute(specifier: string): string | null {
    const absolute = path.isAbsolute(specifier) ? specifier : path.resolve(specifier);
    return this.tryExtensions(absolute) || this.tryIndex(absolute);
  }

  /**
   * Try different file extensions
   * e.g., '/path/to/Test' → '/path/to/Test.ts', '/path/to/Test.tsx', etc.
   */
  private tryExtensions(filePath: string): string | null {
    // First, check if file already has an extension
    const ext = path.extname(filePath);
    if (ext && this.extensions.includes(ext)) {
      if (this.fileExists(filePath)) {
        return filePath;
      }
    }

    // Try adding each extension
    for (const ext of this.extensions) {
      const withExt = filePath + ext;
      if (this.fileExists(withExt)) {
        return withExt;
      }
    }

    return null;
  }

  /**
   * Try to find an index file
   * e.g., '/path/to/components' → '/path/to/components/index.ts'
   */
  private tryIndex(dirPath: string): string | null {
    // Remove trailing slash if present
    const normalized = dirPath.replace(/\/$/, '');

    // Try index files with different extensions
    for (const ext of this.extensions) {
      const indexPath = path.join(normalized, `index${ext}`);
      if (this.fileExists(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Normalize path for comparison
   * - Convert backslashes to forward slashes
   * - Remove duplicate slashes
   * - Remove leading ./
   */
  normalizePath(filePath: string): string {
    return filePath
      .replace(/\\/g, '/') // Windows → Unix separators
      .replace(/\/+/g, '/') // Multiple slashes → single
      .replace(/^\.\//, ''); // Remove leading ./
  }

  /**
   * Check if a file exists
   */
  private fileExists(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Compare two paths for equality, handling:
   * - Different separators (\ vs /)
   * - Extension variations (.ts vs .js)
   * - Case sensitivity (platform-dependent)
   */
  pathsMatch(path1: string, path2: string): boolean {
    const normalized1 = this.normalizePath(path1);
    const normalized2 = this.normalizePath(path2);

    // On Windows, use case-insensitive comparison
    const compare1 = process.platform === 'win32' ? normalized1.toLowerCase() : normalized1;
    const compare2 = process.platform === 'win32' ? normalized2.toLowerCase() : normalized2;

    // Remove extensions for comparison (.ts should match .js)
    const base1 = this.removeExtension(compare1);
    const base2 = this.removeExtension(compare2);

    return base1 === base2;
  }

  /**
   * Remove file extension from path
   */
  private removeExtension(filePath: string): string {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    for (const ext of extensions) {
      if (filePath.endsWith(ext)) {
        return filePath.slice(0, -ext.length);
      }
    }
    return filePath;
  }
}
