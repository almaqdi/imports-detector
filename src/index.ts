/**
 * Imports Detector
 *
 * A package for detecting and analyzing imports in JavaScript/TypeScript applications
 */

import { ImportAnalyzer } from './analyzer.js';

export { ImportAnalyzer } from './analyzer.js';
export { FileDiscovery } from './file-discovery.js';
export { CodeParser } from './parser.js';
export { ImportExtractor } from './extractor.js';
export { JSONGenerator } from './output/json-generator.js';
export { TextGenerator } from './output/text-generator.js';

export type {
  DetectorOptions,
  FileImports,
  Import,
  ImportMap,
  ImporterResult,
  OutputFormat,
  OutputOptions,
  ProjectAnalysis,
} from './types.js';

export { ImportType } from './types.js';

/**
 * Convenience function to find files importing a specific module
 */
export async function findFilesImporting(
  moduleName: string,
  searchPath: string,
  options?: import('./types.js').DetectorOptions
) {
  const analyzer = new ImportAnalyzer(options);
  return analyzer.findFilesImporting(moduleName, searchPath);
}

/**
 * Convenience function to analyze a project
 */
export async function analyzeProject(
  searchPath: string,
  options?: import('./types.js').DetectorOptions
) {
  const analyzer = new ImportAnalyzer(options);
  return analyzer.analyzeProject(searchPath);
}

/**
 * Convenience function to find unused files in a project
 * This is much more efficient than calling findFilesImporting() for each file
 */
export async function findUnusedFiles(
  searchPath: string,
  options?: {
    filePattern?: string;
    progressCallback?: import('./types.js').ProgressCallback;
  } & import('./types.js').DetectorOptions
) {
  const analyzer = new ImportAnalyzer(options);
  return analyzer.findUnusedFiles(searchPath, options);
}

/**
 * Convenience function to build a comprehensive import map
 * Useful for advanced analysis, dependency graphs, and custom queries
 */
export async function buildImportMap(
  searchPath: string,
  options?: import('./types.js').DetectorOptions
) {
  const analyzer = new ImportAnalyzer(options);
  return analyzer.buildImportMap(searchPath);
}
