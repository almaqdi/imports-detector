#!/usr/bin/env node

import { Command } from 'commander';
import { ImportAnalyzer } from './analyzer.js';
import { JSONGenerator } from './output/json-generator.js';
import { TextGenerator } from './output/text-generator.js';
import type { DetectorOptions } from './types.js';
import fs from 'fs';
import path from 'path';
import ora from 'ora';

const program = new Command();

program
  .name('imports-detector')
  .description(
    'Detect and analyze imports in JavaScript/TypeScript applications',
  )
  .version('0.2.11');

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
  .argument(
    '[module]',
    'Name of the module to search for (optional when --module-path is used)',
  )
  .argument('[paths...]', 'Paths to search (default: current directory)')
  .option('-p, --path <path>', 'Root directory to search')
  .option('-o, --output <file>', 'Output file path')
  .option(
    '-f, --format <format>',
    'Output format: json or text (default: text)',
  )
  .option(
    '--module-path <path>',
    'Specific module path to match (e.g., ./admin/Dashboard.tsx). When used without module name, finds all imports from this file.',
  )
  .option(
    '--base-url <url>',
    'Base URL for module resolution (overrides tsconfig)',
  )
  .option(
    '--tsconfig <path>',
    'Path to tsconfig.json for automatic baseUrl detection',
  )
  .option(
    '--include <patterns>',
    'File extensions to include (comma-separated)',
  )
  .option('--exclude <patterns>', 'Patterns to exclude (comma-separated)')
  .option('--no-static', 'Exclude static imports')
  .option('--no-dynamic', 'Exclude dynamic imports')
  .option('--no-lazy', 'Exclude lazy imports')
  .option('--no-require', 'Exclude require calls')
  .option('-v, --verbose', 'Verbose output')
  .action(async (moduleName: string | undefined, paths: string[], options) => {
    try {
      // Validate that either moduleName or modulePath is provided
      if (!moduleName && !options.modulePath) {
        console.error(
          'Error: Either <module> name or --module-path must be provided',
        );
        console.error('Example: imports-detector find React ./src');
        console.error(
          'Example: imports-detector find --module-path src/components/Header.tsx ./src',
        );
        process.exit(1);
      }

      const searchPath = options.path || paths[0] || process.cwd();
      const detectorOptions = parseDetectorOptions(options);
      const format = options.format || 'text';

      // Determine if we should show spinner (not for JSON output or file output)
      const shouldShowSpinner =
        format !== 'json' && !options.output && !detectorOptions.verbose;

      const spinner = shouldShowSpinner
        ? ora('Searching for files...').start()
        : null;

      const analyzer = new ImportAnalyzer(detectorOptions);

      // Create progress callback
      const progressCallback =
        shouldShowSpinner && spinner
          ? (current: number, total: number) => {
              spinner.text = `Analyzing files... (${current}/${total})`;
            }
          : undefined;

      const results = await analyzer.findFilesImporting(
        moduleName || null,
        searchPath,
        progressCallback,
      );

      const displayModule = moduleName || options.modulePath || 'module';

      if (spinner) {
        spinner.succeed(
          `Found ${results.length} file${
            results.length !== 1 ? 's' : ''
          } importing "${displayModule}"`,
        );
      }

      let output: string;

      if (format === 'json') {
        const generator = new JSONGenerator();
        output = generator.generateFromFindResults(results, displayModule);
      } else {
        const generator = new TextGenerator();
        output = generator.generateFromFindResults(results, displayModule);
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
  .option(
    '-f, --format <format>',
    'Output format: json or text (default: text)',
  )
  .option(
    '--base-url <url>',
    'Base URL for module resolution (overrides tsconfig)',
  )
  .option(
    '--tsconfig <path>',
    'Path to tsconfig.json for automatic baseUrl detection',
  )
  .option(
    '--include <patterns>',
    'File extensions to include (comma-separated)',
  )
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

      // Determine if we should show spinner (not for JSON output or file output)
      const shouldShowSpinner =
        format !== 'json' && !options.output && !detectorOptions.verbose;

      const spinner = shouldShowSpinner
        ? ora('Scanning files...').start()
        : null;

      const analyzer = new ImportAnalyzer(detectorOptions);

      // Create progress callback
      const progressCallback =
        shouldShowSpinner && spinner
          ? (current: number, total: number) => {
              spinner.text = `Analyzing files... (${current}/${total})`;
            }
          : undefined;

      const analysis = await analyzer.analyzeProject(
        searchPath,
        progressCallback,
      );

      if (spinner) {
        spinner.succeed(
          `Analyzed ${analysis.totalFiles} file${
            analysis.totalFiles !== 1 ? 's' : ''
          }, found ${analysis.totalImports} import${
            analysis.totalImports !== 1 ? 's' : ''
          }`,
        );
      }

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
  .option(
    '-f, --format <format>',
    'Output format: json or text (default: text)',
  )
  .option(
    '--base-url <url>',
    'Base URL for module resolution (overrides tsconfig)',
  )
  .option(
    '--tsconfig <path>',
    'Path to tsconfig.json for automatic baseUrl detection',
  )
  .option(
    '--include <patterns>',
    'File extensions to include (comma-separated)',
  )
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

      // Determine if we should show spinner (not in verbose mode)
      const shouldShowSpinner = !detectorOptions.verbose;

      const spinner = shouldShowSpinner
        ? ora('Scanning files...').start()
        : null;

      const analyzer = new ImportAnalyzer(detectorOptions);

      // Create progress callback
      const progressCallback =
        shouldShowSpinner && spinner
          ? (current: number, total: number) => {
              spinner.text = `Analyzing files... (${current}/${total})`;
            }
          : undefined;

      const analysis = await analyzer.analyzeProject(
        searchPath,
        progressCallback,
      );

      if (spinner) {
        spinner.succeed(
          `Analyzed ${analysis.totalFiles} file${
            analysis.totalFiles !== 1 ? 's' : ''
          }`,
        );
      }

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
