#!/usr/bin/env node

import { Command } from 'commander';
import { ImportAnalyzer } from './analyzer.js';
import { JSONGenerator } from './output/json-generator.js';
import { TextGenerator } from './output/text-generator.js';
import type { DetectorOptions } from './types.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('imports-detector')
  .description('Detect and analyze imports in JavaScript/TypeScript applications')
  .version('0.1.0');

/**
 * Parse detector options from CLI flags
 */
function parseDetectorOptions(options: any): DetectorOptions {
  return {
    detectStatic: options.static !== false,
    detectDynamic: options.dynamic !== false,
    detectLazy: options.lazy !== false,
    detectRequire: options.require !== false,
    verbose: options.verbose || false,
    includeExtensions: options.include ? options.include.split(',') : undefined,
    excludePatterns: options.exclude ? options.exclude.split(',') : undefined,
    modulePath: options.modulePath,
    baseUrl: options.baseUrl,
    tsconfigPath: options.tsconfig,
  };
}

/**
 * Find command - Find files importing a specific module
 */
program
  .command('find')
  .description('Find all files that import a specific module')
  .argument('<module>', 'Name of the module to search for')
  .argument('[paths...]', 'Paths to search (default: current directory)')
  .option('-p, --path <path>', 'Root directory to search')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Output format: json or text (default: text)')
  .option('--module-path <path>', 'Specific module path to match (e.g., ./admin/Dashboard)')
  .option('--base-url <url>', 'Base URL for module resolution (overrides tsconfig)')
  .option('--tsconfig <path>', 'Path to tsconfig.json for automatic baseUrl detection')
  .option('--include <patterns>', 'File extensions to include (comma-separated)')
  .option('--exclude <patterns>', 'Patterns to exclude (comma-separated)')
  .option('--no-static', 'Exclude static imports')
  .option('--no-dynamic', 'Exclude dynamic imports')
  .option('--no-lazy', 'Exclude lazy imports')
  .option('--no-require', 'Exclude require calls')
  .option('-v, --verbose', 'Verbose output')
  .action(async (moduleName: string, paths: string[], options) => {
    try {
      const searchPath = options.path || paths[0] || process.cwd();
      const detectorOptions = parseDetectorOptions(options);
      const format = options.format || 'text';

      if (detectorOptions.verbose) {
        console.error(`Searching for "${moduleName}" in ${searchPath}...`);
      }

      const analyzer = new ImportAnalyzer(detectorOptions);
      const results = await analyzer.findFilesImporting(moduleName, searchPath);

      let output: string;

      if (format === 'json') {
        const generator = new JSONGenerator();
        output = generator.generateFromFindResults(results, moduleName);
      } else {
        const generator = new TextGenerator();
        output = generator.generateFromFindResults(results, moduleName);
      }

      if (options.output) {
        fs.writeFileSync(options.output, output, 'utf-8');
        console.log(`Output written to ${options.output}`);
      } else {
        console.log(output);
      }

      process.exit(results.length > 0 ? 0 : 1);
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });

/**
 * List command - List all imports in each file
 */
program
  .command('list')
  .description('List all imports in each file')
  .argument('[paths...]', 'Paths to analyze (default: current directory)')
  .option('-p, --path <path>', 'Root directory to analyze')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Output format: json or text (default: text)')
  .option('--base-url <url>', 'Base URL for module resolution (overrides tsconfig)')
  .option('--tsconfig <path>', 'Path to tsconfig.json for automatic baseUrl detection')
  .option('--include <patterns>', 'File extensions to include (comma-separated)')
  .option('--exclude <patterns>', 'Patterns to exclude (comma-separated)')
  .option('--no-static', 'Exclude static imports')
  .option('--no-dynamic', 'Exclude dynamic imports')
  .option('--no-lazy', 'Exclude lazy imports')
  .option('--no-require', 'Exclude require calls')
  .option('-v, --verbose', 'Verbose output')
  .action(async (paths: string[], options) => {
    try {
      const searchPath = options.path || paths[0] || process.cwd();
      const detectorOptions = parseDetectorOptions(options);
      const format = options.format || 'text';

      if (detectorOptions.verbose) {
        console.error(`Analyzing imports in ${searchPath}...`);
      }

      const analyzer = new ImportAnalyzer(detectorOptions);
      const analysis = await analyzer.analyzeProject(searchPath);

      let output: string;

      if (format === 'json') {
        const generator = new JSONGenerator();
        output = generator.generateFromAnalysis(analysis);
      } else {
        const generator = new TextGenerator();
        output = generator.generateFromAnalysis(analysis);
      }

      if (options.output) {
        fs.writeFileSync(options.output, output, 'utf-8');
        console.log(`Output written to ${options.output}`);
      } else {
        console.log(output);
      }

      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });

/**
 * Report command - Generate a detailed report
 */
program
  .command('report')
  .description('Generate a detailed import analysis report')
  .argument('[paths...]', 'Paths to analyze (default: current directory)')
  .option('-p, --path <path>', 'Root directory to analyze')
  .option('-o, --output <file>', 'Output file path (required)')
  .option('-f, --format <format>', 'Output format: json or text (default: text)')
  .option('--base-url <url>', 'Base URL for module resolution (overrides tsconfig)')
  .option('--tsconfig <path>', 'Path to tsconfig.json for automatic baseUrl detection')
  .option('--include <patterns>', 'File extensions to include (comma-separated)')
  .option('--exclude <patterns>', 'Patterns to exclude (comma-separated)')
  .option('--no-static', 'Exclude static imports')
  .option('--no-dynamic', 'Exclude dynamic imports')
  .option('--no-lazy', 'Exclude lazy imports')
  .option('--no-require', 'Exclude require calls')
  .option('-v, --verbose', 'Verbose output')
  .action(async (paths: string[], options) => {
    try {
      const searchPath = options.path || paths[0] || process.cwd();
      const detectorOptions = parseDetectorOptions(options);
      const format = options.format || 'text';

      if (!options.output) {
        console.error('Error: --output is required for report command');
        process.exit(1);
      }

      if (detectorOptions.verbose) {
        console.error(`Generating report for ${searchPath}...`);
      }

      const analyzer = new ImportAnalyzer(detectorOptions);
      const analysis = await analyzer.analyzeProject(searchPath);

      let output: string;

      if (format === 'json') {
        const generator = new JSONGenerator();
        output = generator.generateFromAnalysis(analysis);
      } else {
        const generator = new TextGenerator();
        output = generator.generateFromAnalysis(analysis);
      }

      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`Report written to ${options.output}`);

      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
