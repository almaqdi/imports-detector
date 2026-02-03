import path from 'path';
import { FileDiscovery } from './file-discovery.js';
import { CodeParser } from './parser.js';
import { ImportExtractor } from './extractor.js';
import { ModuleResolver } from './module-resolver.js';
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
 * Uses module resolution to match imports like IDEs do
 */
export class ImportAnalyzer {
  private fileDiscovery: FileDiscovery;
  private parser: CodeParser;
  private extractor: ImportExtractor;
  private resolver: ModuleResolver;
  private options: DetectorOptions;

  constructor(options: DetectorOptions = {}) {
    this.options = {
      detectStatic: options.detectStatic !== false,
      detectDynamic: options.detectDynamic !== false,
      detectLazy: options.detectLazy !== false,
      detectRequire: options.detectRequire !== false,
      verbose: options.verbose || false,
      modulePath: options.modulePath,
      baseUrl: options.baseUrl,
      tsconfigPath: options.tsconfigPath,
    };

    this.fileDiscovery = new FileDiscovery({
      includePatterns: options.includeExtensions
        ? options.includeExtensions.map((ext) => `**/*${ext}`)
        : undefined,
      excludePatterns: options.excludePatterns,
    });

    this.parser = new CodeParser();
    this.extractor = new ImportExtractor();
    // Create a default resolver - will be recreated with searchPath in findFilesImporting
    this.resolver = new ModuleResolver({
      extensions: options.includeExtensions,
    });
  }

  /**
   * Create a resolver with searchPath for baseUrl auto-detection
   */
  private createResolver(searchPath: string): ModuleResolver {
    return new ModuleResolver({
      extensions: this.options.includeExtensions,
      baseUrl: this.options.baseUrl,
      tsconfigPath: this.options.tsconfigPath,
      searchPath: searchPath,  // Auto-detect tsconfig from this path
    });
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

    // Create resolver with searchPath for baseUrl auto-detection
    const resolver = this.createResolver(searchPath);

    try {
      const files = await this.fileDiscovery.findFiles(searchPath);

      if (this.options.verbose) {
        console.log(`Found ${files.length} files to analyze`);
      }

      // Resolve the target module path if provided
      const targetPath = this.resolveTargetPath(searchPath, moduleName, resolver);

      for (const filePath of files) {
        try {
          const ast = this.parser.parseFile(filePath);
          const allImports = this.extractor.getAllImports(ast);

          // Resolve imports and filter by module name
          const matchingImports = this.filterImportsByModule(
            allImports,
            moduleName,
            filePath,
            targetPath,
            resolver
          );

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
   * Resolve the target path for module matching
   * If modulePath is specified, resolve it to an absolute path
   */
  private resolveTargetPath(searchPath: string, moduleName: string, resolver: ModuleResolver): string | null {
    if (!this.options.modulePath) {
      return null;
    }

    // Resolve the module path relative to search path
    const resolved = resolver.resolveImport(
      this.options.modulePath,
      searchPath + '/dummy.ts' // Dummy file for relative resolution
    );

    return resolved;
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
   * Filter imports by module name using proper module resolution
   * This mimics how IDEs resolve imports (like "command + click")
   * @param imports - All imports from a file
   * @param moduleName - Name of the module to match
   * @param filePath - Path of the file containing the imports
   * @param targetPath - Optional resolved target path for path-specific matching
   * @param resolver - Module resolver instance
   */
  private filterImportsByModule(
    imports: Import[],
    moduleName: string,
    filePath: string,
    targetPath: string | null,
    resolver: ModuleResolver
  ): Import[] {
    return imports.filter((imp) => {
      // Resolve the import to an absolute path
      const resolved = resolver.resolveImport(imp.module, filePath);

      if (!resolved) {
        return false;
      }

      // Store the resolved path for reference
      imp.resolvedPath = resolved;

      // If targetPath is provided, use exact path matching
      if (targetPath) {
        return resolver.pathsMatch(resolved, targetPath);
      }

      // Otherwise, match by module name (backward compatibility)
      // Check if module name matches exactly
      if (imp.module === moduleName) {
        return true;
      }

      // Check if the module is imported as a named specifier
      if (imp.specifiers && imp.specifiers.includes(moduleName)) {
        return true;
      }

      // Check if resolved path basename matches module name
      const resolvedBasename = path.basename(resolved).replace(/\.(js|jsx|ts|tsx)$/, '');
      if (resolvedBasename === moduleName) {
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
}
