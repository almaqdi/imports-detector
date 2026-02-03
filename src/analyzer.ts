import path from 'path';
import { FileDiscovery } from './file-discovery.js';
import { CodeParser } from './parser.js';
import { ImportExtractor } from './extractor.js';
import type {
  DetectorOptions,
  FileImports,
  ImporterResult,
  ProjectAnalysis,
  Import,
} from './types.js';

/**
 * Main Analyzer Class
 * Orchestrates file discovery, parsing, and import extraction
 */
export class ImportAnalyzer {
  private fileDiscovery: FileDiscovery;
  private parser: CodeParser;
  private extractor: ImportExtractor;
  private options: DetectorOptions;

  constructor(options: DetectorOptions = {}) {
    this.options = {
      detectStatic: options.detectStatic !== false,
      detectDynamic: options.detectDynamic !== false,
      detectLazy: options.detectLazy !== false,
      detectRequire: options.detectRequire !== false,
      verbose: options.verbose || false,
      modulePath: options.modulePath,
    };

    this.fileDiscovery = new FileDiscovery({
      includePatterns: options.includeExtensions
        ? options.includeExtensions.map((ext) => `**/*${ext}`)
        : undefined,
      excludePatterns: options.excludePatterns,
    });

    this.parser = new CodeParser();
    this.extractor = new ImportExtractor();
  }

  /**
   * Find all files that import a specific module
   * @param moduleName - Name of the module to search for (e.g., 'Test', 'react')
   * @param searchPath - Root directory to search
   */
  async findFilesImporting(
    moduleName: string,
    searchPath: string
  ): Promise<ImporterResult[]> {
    const results: ImporterResult[] = [];

    try {
      const files = await this.fileDiscovery.findFiles(searchPath);

      if (this.options.verbose) {
        console.log(`Found ${files.length} files to analyze`);
      }

      for (const filePath of files) {
        try {
          const ast = this.parser.parseFile(filePath);
          const allImports = this.extractor.getAllImports(ast);

          // Filter imports that match the module name
          const matchingImports = this.filterImportsByModule(allImports, moduleName);

          if (matchingImports.length > 0) {
            results.push({
              file: filePath,
              imports: matchingImports,
            });
          }
        } catch (error) {
          if (this.options.verbose) {
            console.error(`Error parsing ${filePath}:`, error);
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to find files importing "${moduleName}": ${error}`);
    }
  }

  /**
   * Analyze all imports in a project
   * @param searchPath - Root directory to analyze
   */
  async analyzeProject(searchPath: string): Promise<ProjectAnalysis> {
    try {
      const files = await this.fileDiscovery.findFiles(searchPath);
      const filesMap: Record<string, FileImports> = {};

      let totalStatic = 0;
      let totalDynamic = 0;
      let totalLazy = 0;
      let totalRequire = 0;

      for (const filePath of files) {
        try {
          const ast = this.parser.parseFile(filePath);
          const fileImports = this.extractor.extractAll(ast, {
            static: this.options.detectStatic,
            dynamic: this.options.detectDynamic,
            lazy: this.options.detectLazy,
            require: this.options.detectRequire,
          });

          filesMap[filePath] = fileImports;

          totalStatic += fileImports.static.length;
          totalDynamic += fileImports.dynamic.length;
          totalLazy += fileImports.lazy.length;
          totalRequire += fileImports.require.length;
        } catch (error) {
          if (this.options.verbose) {
            console.error(`Error parsing ${filePath}:`, error);
          }
        }
      }

      const totalImports = totalStatic + totalDynamic + totalLazy + totalRequire;

      return {
        totalFiles: Object.keys(filesMap).length,
        totalImports,
        files: filesMap,
        summary: {
          static: totalStatic,
          dynamic: totalDynamic,
          lazy: totalLazy,
          require: totalRequire,
        },
      };
    } catch (error) {
      throw new Error(`Failed to analyze project: ${error}`);
    }
  }

  /**
   * Get all imports from a specific file
   */
  analyzeFile(filePath: string): FileImports {
    try {
      const ast = this.parser.parseFile(filePath);
      return this.extractor.extractAll(ast, {
        static: this.options.detectStatic,
        dynamic: this.options.detectDynamic,
        lazy: this.options.detectLazy,
        require: this.options.detectRequire,
      });
    } catch (error) {
      throw new Error(`Failed to analyze file ${filePath}: ${error}`);
    }
  }

  /**
   * Filter imports by module name
   * Handles both named imports and file paths
   * If modulePath is specified in options, also filters by import path
   */
  private filterImportsByModule(imports: Import[], moduleName: string): Import[] {
    return imports.filter((imp) => {
      // If modulePath is specified, check if the import module matches the path
      if (this.options.modulePath) {
        return this.doesImportMatchPath(imp.module, this.options.modulePath, moduleName);
      }

      // Check if module name matches exactly
      if (imp.module === moduleName) {
        return true;
      }

      // Check if the module is imported as a named specifier
      if (imp.specifiers && imp.specifiers.includes(moduleName)) {
        return true;
      }

      // Check if module path ends with the module name
      // This handles cases like './components/Test'
      const moduleBasename = path.basename(imp.module).replace(/\.(js|jsx|ts|tsx)$/, '');
      if (moduleBasename === moduleName) {
        return true;
      }

      return false;
    });
  }

  /**
   * Check if an import module matches a specific path
   * Supports both relative and absolute path matching
   */
  private doesImportMatchPath(importModule: string, targetPath: string, moduleName: string): boolean {
    // Normalize paths for comparison
    const normalizedImport = this.normalizeModulePath(importModule);
    const normalizedTarget = this.normalizeModulePath(targetPath);

    // Check if paths match (handle various path formats)
    const importPath = normalizedImport.toLowerCase();
    const targetPathLower = normalizedTarget.toLowerCase();

    // Direct match
    if (importPath === targetPathLower) {
      return true;
    }

    // Check if the target path is contained in the import path
    // This handles cases like:
    // - "admin/dashboard" matches "src/admin/dashboard"
    if (importPath.includes(targetPathLower)) {
      return true;
    }

    // Check if the import path is contained in the target path
    // This handles cases like:
    // - "../admin/dashboard" matches "admin/dashboard" (after normalization)
    if (targetPathLower.includes(importPath)) {
      return true;
    }

    // Check if path segments match (more strict comparison)
    const importSegments = importPath.split('/').filter(s => s);
    const targetSegments = targetPathLower.split('/').filter(s => s);

    // Must match at least the target path segments
    if (targetSegments.length > 0) {
      // Check if all target segments appear in order in the import path
      let targetIndex = 0;
      for (const importSegment of importSegments) {
        if (importSegment === targetSegments[targetIndex]) {
          targetIndex++;
          if (targetIndex === targetSegments.length) {
            // All target segments matched
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Normalize module path for comparison
   * Removes file extensions, leading ./ or ../, and normalizes separators
   */
  private normalizeModulePath(modulePath: string): string {
    return modulePath
      .replace(/^\.+\//g, '') // Remove leading ./, ../, etc.
      .replace(/\.(js|jsx|ts|tsx|json)$/, '') // Remove file extensions
      .replace(/\\/g, '/'); // Normalize path separators
  }
}
