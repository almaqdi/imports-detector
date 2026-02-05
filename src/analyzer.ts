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
  ProgressCallback,
  Export,
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
   * @param moduleName - Name of the module to search for (e.g., 'Test', 'react'), or null to match all imports from target path
   * @param searchPath - Root directory to search
   * @param progressCallback - Optional callback for progress updates
   */
  async findFilesImporting(
    moduleName: string | null,
    searchPath: string,
    progressCallback?: ProgressCallback
  ): Promise<ImporterResult[]> {
    const results: ImporterResult[] = [];
    const visitedBarrels = new Set<string>();

    // Create resolver with searchPath for baseUrl auto-detection
    const resolver = this.createResolver(searchPath);

    try {
      const files = await this.fileDiscovery.findFiles(searchPath);

      if (this.options.verbose) {
        console.log(`Found ${files.length} files to analyze`);
      }

      // Resolve the target module path if provided
      const targetPath = this.resolveTargetPath(searchPath, resolver);

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];

        // Report progress
        if (progressCallback) {
          progressCallback(i + 1, files.length);
        }

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

            // NEW: Check if this file is a barrel that re-exports the target
            // If so, find all files that import through this barrel
            if (targetPath) {
              const barrelCheck = this.isBarrelForModule(
                filePath,
                targetPath,
                moduleName,
                resolver
              );

              if (barrelCheck.isBarrel) {
                if (this.options.verbose) {
                  console.log(`Found barrel file: ${filePath}`);
                  console.log(`  Re-exports: ${barrelCheck.exportedNames.join(', ')}`);
                }

                // Find all files that import from this barrel
                const barrelConsumers = await this.findBarrelConsumers(
                  filePath,
                  barrelCheck.exportedNames,
                  searchPath,
                  resolver,
                  visitedBarrels
                );

                // Add barrel consumers to results
                for (const consumer of barrelConsumers) {
                  // Check if this consumer is already in results
                  const existing = results.find(r => r.file === consumer.file);
                  if (existing) {
                    // Merge imports
                    existing.imports.push(...consumer.imports);
                  } else {
                    results.push(consumer);
                  }
                }

                if (this.options.verbose) {
                  console.log(`  Found ${barrelConsumers.length} files importing through this barrel`);
                }
              }
            }
          }
        } catch (error) {
          if (this.options.verbose) {
            console.error(`Error parsing ${filePath}:`, error);
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to find files importing "${moduleName || 'module'}": ${error}`);
    }
  }

  /**
   * Resolve the target path for module matching
   * If modulePath is specified, resolve it to an absolute path
   */
  private resolveTargetPath(searchPath: string, resolver: ModuleResolver): string | null {
    if (!this.options.modulePath) {
      return null;
    }

    let modulePath = this.options.modulePath;

    // Convert to absolute path
    // If modulePath is already absolute, use it directly
    // Otherwise, resolve it relative to the current working directory (not searchPath)
    // to avoid double path issues like src/src/...
    const absolutePath = path.isAbsolute(modulePath)
      ? modulePath
      : path.resolve(process.cwd(), modulePath);

    // If it already has an extension, use it directly (no need to resolve through resolver)
    if (path.extname(absolutePath)) {
      return absolutePath;
    }

    // Otherwise, use the module resolver to find the file with extensions
    // We pass searchPath as the fromFile to avoid double path issues
    return resolver.resolveImport(absolutePath, searchPath);
  }

  /**
   * Analyze all imports in a project
   * @param searchPath - Root directory to analyze
   * @param progressCallback - Optional callback for progress updates
   */
  async analyzeProject(
    searchPath: string,
    progressCallback?: ProgressCallback
  ): Promise<ProjectAnalysis> {
    try {
      const files = await this.fileDiscovery.findFiles(searchPath);
      const filesMap: Record<string, FileImports> = {};

      let totalStatic = 0;
      let totalDynamic = 0;
      let totalLazy = 0;
      let totalRequire = 0;

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];

        // Report progress
        if (progressCallback) {
          progressCallback(i + 1, files.length);
        }

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
   * @param moduleName - Name of the module to match, or null to match only by path
   * @param filePath - Path of the file containing the imports
   * @param targetPath - Optional resolved target path for path-specific matching
   * @param resolver - Module resolver instance
   */
  private filterImportsByModule(
    imports: Import[],
    moduleName: string | null,
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
        const matches = resolver.pathsMatch(resolved, targetPath);
        if (this.options.verbose && !matches) {
          console.error(`  [DEBUG] Path mismatch: import "${imp.module}" -> resolved: "${resolved}" != target: "${targetPath}"`);
        }
        return matches;
      }

      // If moduleName is null and no targetPath, include all imports
      if (!moduleName) {
        return true;
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

  /**
   * Check if a file is a barrel that re-exports a specific module
   * @param barrelFilePath - Path to the potential barrel file
   * @param targetModulePath - Path to the target module we're looking for
   * @param targetModuleName - Optional name of the target module
   * @returns Object with isBarrel flag and exported names
   */
  private isBarrelForModule(
    barrelFilePath: string,
    targetModulePath: string,
    targetModuleName: string | null,
    resolver: ModuleResolver
  ): { isBarrel: boolean; exportedNames: string[] } {
    try {
      const ast = this.parser.parseFile(barrelFilePath);
      const imports = this.extractor.getAllImports(ast);
      const exports = this.extractor.extractExports(ast);

      // Check if this file imports the target module
      const targetImport = imports.find((imp) => {
        const resolved = resolver.resolveImport(imp.module, barrelFilePath);
        return resolved && resolver.pathsMatch(resolved, targetModulePath);
      });

      if (!targetImport) {
        return { isBarrel: false, exportedNames: [] };
      }

      // Find what names are used to re-export this module
      const exportedNames: string[] = [];

      for (const exp of exports) {
        // Check if this export re-exports the imported module
        if (targetImport.kind === 'default' && exp.name === 'default') {
          // Default import is re-exported as default
          exportedNames.push('default');
        } else if (targetImport.specifiers && targetImport.specifiers.includes(exp.localName)) {
          // Named import is re-exported
          exportedNames.push(exp.name);
        } else if (targetImport.kind === 'default' && exp.localName === targetImport.specifiers?.[0]) {
          // Default import is re-exported as named export
          exportedNames.push(exp.name);
        }
      }

      return {
        isBarrel: exportedNames.length > 0,
        exportedNames,
      };
    } catch (error) {
      if (this.options.verbose) {
        console.error(`Error checking barrel ${barrelFilePath}:`, error);
      }
      return { isBarrel: false, exportedNames: [] };
    }
  }

  /**
   * Find all files that import from a barrel (transitive import detection)
   * @param barrelFilePath - Path to the barrel file
   * @param exportedNames - Names that are re-exported from the barrel
   * @param searchPath - Root directory to search
   * @param resolver - Module resolver instance
   * @param visited - Set of already visited barrels (to prevent infinite recursion)
   * @returns Files that import from the barrel
   */
  private async findBarrelConsumers(
    barrelFilePath: string,
    exportedNames: string[],
    searchPath: string,
    resolver: ModuleResolver,
    visited: Set<string>
  ): Promise<ImporterResult[]> {
    const results: ImporterResult[] = [];

    // Prevent infinite recursion
    if (visited.has(barrelFilePath)) {
      return results;
    }
    visited.add(barrelFilePath);

    try {
      const files = await this.fileDiscovery.findFiles(searchPath);
      const barrelDir = path.dirname(barrelFilePath);

      // Find files that import from this barrel
      for (const filePath of files) {
        // Skip the barrel file itself
        if (filePath === barrelFilePath) {
          continue;
        }

        try {
          const ast = this.parser.parseFile(filePath);
          const allImports = this.extractor.getAllImports(ast);

          // Check if this file imports from the barrel
          const barrelImports = allImports.filter((imp) => {
            const resolved = resolver.resolveImport(imp.module, filePath);
            return resolved && resolver.pathsMatch(resolved, barrelFilePath);
          });

          if (barrelImports.length > 0) {
            // Check if any of the imported names match what we're looking for
            const matchingImports = barrelImports.filter((imp) => {
              if (!imp.specifiers) {
                // Default or namespace import - might include the target
                return true;
              }
              // Check if any of the exported names are imported
              return exportedNames.some((name) =>
                imp.specifiers?.includes(name) ||
                (name === 'default' && imp.kind === 'default')
              );
            });

            if (matchingImports.length > 0) {
              results.push({
                file: filePath,
                imports: matchingImports,
              });
            }
          }
        } catch (error) {
          if (this.options.verbose) {
            console.error(`Error parsing ${filePath}:`, error);
          }
        }
      }

      return results;
    } catch (error) {
      if (this.options.verbose) {
        console.error(`Error finding barrel consumers for ${barrelFilePath}:`, error);
      }
      return results;
    }
  }
}
