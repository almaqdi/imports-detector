import path from 'path';
import fs from 'fs';
import { FileDiscovery } from './file-discovery.js';
import { CodeParser } from './parser.js';
import { ImportExtractor } from './extractor.js';
import { ModuleResolver } from './module-resolver.js';
import { ImportType } from './types.js';
import type {
  DetectorOptions,
  FileImports,
  ImporterResult,
  ProjectAnalysis,
  Import,
  ImportMap,
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

      // Pre-parse all files once to avoid re-parsing in barrel detection
      const fileImportsMap = new Map<string, Import[]>();
      const failedFiles: string[] = [];

      // Process files in batches for better performance and smoother spinner animation
      const BATCH_SIZE = 20;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        // Process each file in the current batch
        for (const filePath of batch) {
          try {
            const ast = this.parser.parseFile(filePath);
            const allImports = this.extractor.getAllImports(ast);
            fileImportsMap.set(filePath, allImports);

            // Resolve imports and filter by module name
            const matchingImports = this.filterImportsByModule(
              allImports,
              moduleName,
              filePath,
              targetPath,
              resolver
            );

            // Filter by import type based on options
            const filteredImports = this.filterImportsByType(matchingImports);

            if (filteredImports.length > 0) {
              results.push({
                file: filePath,
                imports: filteredImports,
              });
            }
          } catch (error) {
            if (this.options.verbose) {
              console.error(`Error parsing ${filePath}:`, error);
            }
            failedFiles.push(filePath);
          }
        }

        // Report progress after each batch
        if (progressCallback) {
          progressCallback(Math.min(i + BATCH_SIZE, files.length), files.length);
        }

        // Yield to event loop after each batch
        await new Promise(resolve => setImmediate(resolve));
      }

      // Report any failed files
      if (failedFiles.length > 0 && this.options.verbose) {
        console.warn(`Failed to parse ${failedFiles.length} files. Use --verbose for details.`);
      }

      // Now check for barrel files using the pre-parsed imports
      if (targetPath) {
        for (const result of results) {
          const barrelCheck = this.isBarrelForModule(
            result.file,
            targetPath,
            moduleName,
            resolver
          );

          if (barrelCheck.isBarrel) {
            if (this.options.verbose) {
              console.log(`Found barrel file: ${result.file}`);
              console.log(`  Re-exports: ${barrelCheck.exportedNames.join(', ')}`);
            }

            // Find all files that import from this barrel using cached imports
            const barrelConsumers = this.findBarrelConsumers(
              result.file,
              barrelCheck.exportedNames,
              fileImportsMap,
              resolver,
              visitedBarrels
            );

            // Add barrel consumers to results
            for (const consumer of barrelConsumers) {
              // Filter barrel consumer imports by type before adding
              const filteredConsumerImports = this.filterImportsByType(consumer.imports);

              if (filteredConsumerImports.length === 0) {
                continue; // Skip if no imports match the type filter
              }

              // Check if this consumer is already in results
              const existing = results.find(r => r.file === consumer.file);
              if (existing) {
                // Merge imports, avoiding duplicates
                for (const imp of filteredConsumerImports) {
                  const isDuplicate = existing.imports.some(existingImp =>
                    existingImp.module === imp.module &&
                    existingImp.line === imp.line &&
                    existingImp.type === imp.type
                  );
                  if (!isDuplicate) {
                    existing.imports.push(imp);
                  }
                }
              } else {
                results.push({
                  file: consumer.file,
                  imports: filteredConsumerImports,
                });
              }
            }

            if (this.options.verbose) {
              console.log(`  Found ${barrelConsumers.length} files importing through this barrel`);
            }
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

      // Process files in batches for better performance and smoother spinner animation
      const BATCH_SIZE = 20;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        // Process each file in the current batch
        for (const filePath of batch) {
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

        // Report progress after each batch
        if (progressCallback) {
          progressCallback(Math.min(i + BATCH_SIZE, files.length), files.length);
        }

        // Yield to event loop after each batch
        await new Promise(resolve => setImmediate(resolve));
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
   * Find all files that are not imported anywhere in the project
   * This is MUCH more efficient than checking each file individually with findFilesImporting()
   * @param searchPath - Root directory to analyze
   * @param options - Options for filtering unused files
   * @returns Array of unused file paths with metadata
   */
  async findUnusedFiles(
    searchPath: string,
    options?: {
      /** Only check files matching this pattern (e.g., '/components/') */
      filePattern?: string;
      /** Progress callback for large projects */
      progressCallback?: ProgressCallback;
    }
  ): Promise<Array<{ filePath: string; reason: string }>> {
    // Single scan of all files
    const analysis = await this.analyzeProject(
      searchPath,
      options?.progressCallback
    );

    const resolver = this.createResolver(searchPath);
    const unusedFiles: Array<{ filePath: string; reason: string }> = [];

    // Build a set of all imported files (resolved paths)
    const importedFiles = new Set<string>();

    for (const [filePath, fileData] of Object.entries(analysis.files)) {
      const allImports = [
        ...fileData.static,
        ...fileData.dynamic,
        ...fileData.lazy,
        ...fileData.require,
      ];

      for (const imp of allImports) {
        const resolved = resolver.resolveImport(imp.module, filePath);
        if (resolved) {
          importedFiles.add(resolved);
        }
      }
    }

    // Build a map of barrel files and what they export
    // This is needed to detect files that are used through barrel re-exports
    const barrelExports = new Map<string, string[]>();
    for (const [filePath, fileData] of Object.entries(analysis.files)) {
      // Check if this file is a barrel (index.ts or index.js)
      const fileName = path.basename(filePath);
      if (fileName !== 'index.ts' && fileName !== 'index.js') {
        continue;
      }

      // Get exports from this barrel file
      const ast = this.parser.parseFile(filePath);
      const exports = this.extractor.extractExports(ast);

      // For each export, find what file it exports
      for (const exp of exports) {
        // For re-exports, use the source field
        const importPath = exp.source || exp.localName;
        const resolvedExport = resolver.resolveImport(importPath, filePath);

        if (resolvedExport && resolvedExport !== filePath) {
          // This barrel exports this file
          if (!barrelExports.has(filePath)) {
            barrelExports.set(filePath, []);
          }
          barrelExports.get(filePath)!.push(resolvedExport);
        }
      }
    }

    // Find files that are never imported
    for (const filePath of Object.keys(analysis.files)) {
      // Skip files that don't match the pattern
      if (options?.filePattern && !filePath.includes(options.filePattern)) {
        continue;
      }

      // Check if this file is imported anywhere
      let isUsed = importedFiles.has(filePath);

      // If not directly imported, check if it's exported by a used barrel
      if (!isUsed) {
        for (const [barrelPath, exportedFiles] of barrelExports.entries()) {
          if (exportedFiles.includes(filePath) && importedFiles.has(barrelPath)) {
            // File is used through this barrel
            isUsed = true;
            break;
          }
        }
      }

      if (!isUsed) {
        unusedFiles.push({
          filePath,
          reason: 'No imports found',
        });
      }
    }

    return unusedFiles;
  }

  /**
   * Build a comprehensive import map showing bidirectional import relationships
   * This is useful for advanced analysis, dependency graphs, and custom queries
   * @param searchPath - Root directory to analyze
   * @param progressCallback - Optional callback for progress updates
   * @returns Import map with forward/reverse lookups and statistics
   */
  async buildImportMap(
    searchPath: string,
    progressCallback?: ProgressCallback
  ): Promise<ImportMap> {
    // Single scan of all files
    const analysis = await this.analyzeProject(searchPath, progressCallback);
    const resolver = this.createResolver(searchPath);

    // Build forward and reverse lookup maps
    const imports: ImportMap['imports'] = {};
    const importedBy: ImportMap['importedBy'] = {};
    const importCounts = new Map<string, number>();

    // Initialize imports map
    for (const [filePath, fileData] of Object.entries(analysis.files)) {
      imports[filePath] = {
        static: fileData.static,
        dynamic: fileData.dynamic,
        lazy: fileData.lazy,
        require: fileData.require,
      };
    }

    // Build reverse lookup (importedBy) and count imports
    for (const [filePath, fileData] of Object.entries(analysis.files)) {
      const allImports = [
        ...fileData.static,
        ...fileData.dynamic,
        ...fileData.lazy,
        ...fileData.require,
      ];

      for (const imp of allImports) {
        const resolved = resolver.resolveImport(imp.module, filePath);
        if (resolved) {
          // Track what imports this file
          if (!importedBy[resolved]) {
            importedBy[resolved] = [];
          }
          if (!importedBy[resolved].includes(filePath)) {
            importedBy[resolved].push(filePath);
          }

          // Count imports for statistics
          importCounts.set(resolved, (importCounts.get(resolved) || 0) + 1);
        }
      }
    }

    // Build statistics
    const sortedByImportCount = Array.from(importCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    const mostImportedFiles = sortedByImportCount
      .slice(0, 10)
      .map(([filePath, importCount]) => ({ filePath, importCount }));

    const leastImportedFiles = sortedByImportCount
      .slice(-10)
      .reverse()
      .map(([filePath, importCount]) => ({ filePath, importCount }));

    return {
      imports,
      importedBy,
      stats: {
        totalFiles: Object.keys(imports).length,
        totalImports: Array.from(importCounts.values()).reduce((sum, count) => sum + count, 0),
        mostImportedFiles,
        leastImportedFiles,
      },
    };
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
        let matches = resolver.pathsMatch(resolved, targetPath);

        // If not a direct match, check if target has a sibling barrel file
        if (!matches) {
          const targetDir = path.dirname(targetPath);
          const targetName = path.basename(targetPath, path.extname(targetPath));
          const barrelPath = path.join(targetDir, 'index.ts');
          const barrelPathJs = path.join(targetDir, 'index.js');

          // Check if barrel file exists and if import matches it
          try {
            // Try TypeScript barrel first
            if (fs.existsSync(barrelPath) && fs.statSync(barrelPath).isFile()) {
              matches = resolver.pathsMatch(resolved, barrelPath);
            }
            // Fallback to JavaScript barrel
            if (!matches && fs.existsSync(barrelPathJs) && fs.statSync(barrelPathJs).isFile()) {
              matches = resolver.pathsMatch(resolved, barrelPathJs);
            }
          } catch {
            // Barrel doesn't exist, keep matches as false
          }
        }

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
   * Filter imports by type based on detector options
   * @param imports - Imports to filter
   * @returns Filtered imports based on detect options
   */
  private filterImportsByType(imports: Import[]): Import[] {
    return imports.filter((imp) => {
      switch (imp.type) {
        case ImportType.STATIC:
          return this.options.detectStatic !== false;
        case ImportType.DYNAMIC:
          return this.options.detectDynamic !== false;
        case ImportType.LAZY:
          return this.options.detectLazy !== false;
        case ImportType.REQUIRE:
          return this.options.detectRequire !== false;
        default:
          return true;
      }
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
   * @param fileImportsMap - Pre-parsed map of file → imports (to avoid re-scanning)
   * @param resolver - Module resolver instance
   * @param visited - Set of already visited barrels (to prevent infinite recursion)
   * @returns Files that import from the barrel
   */
  private findBarrelConsumers(
    barrelFilePath: string,
    exportedNames: string[],
    fileImportsMap: Map<string, Import[]>,
    resolver: ModuleResolver,
    visited: Set<string>
  ): ImporterResult[] {
    const results: ImporterResult[] = [];

    // Prevent infinite recursion
    if (visited.has(barrelFilePath)) {
      return results;
    }
    visited.add(barrelFilePath);

    try {
      // Use pre-parsed imports instead of re-scanning
      for (const [filePath, allImports] of fileImportsMap.entries()) {
        // Skip the barrel file itself
        if (filePath === barrelFilePath) {
          continue;
        }

        try {
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
            console.error(`Error processing ${filePath}:`, error);
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
