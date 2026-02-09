/**
 * Types of imports that can be detected
 */
export enum ImportType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  LAZY = 'lazy',
  REQUIRE = 'require',
}

/**
 * Represents a single import statement
 */
export interface Import {
  /** The module being imported (e.g., './Test', 'react') */
  module: string;
  /** Type of import */
  type: ImportType;
  /** Line number where import occurs */
  line: number;
  /** Column number where import occurs */
  column: number;
  /** Imported specifiers (e.g., ['useState', 'useEffect']) */
  specifiers?: string[];
  /** Import kind: 'named', 'default', or 'namespace' */
  kind?: 'named' | 'default' | 'namespace';
  /** Raw import statement for display */
  raw?: string;
  /** Resolved absolute path (computed during analysis) */
  resolvedPath?: string;
}

/**
 * All imports found in a single file
 */
export interface FileImports {
  /** File path */
  file: string;
  /** Static ES6 imports */
  static: Import[];
  /** Dynamic imports using import() */
  dynamic: Import[];
  /** Lazy imports (React.lazy, Next.js dynamic) */
  lazy: Import[];
  /** CommonJS require() calls */
  require: Import[];
}

/**
 * Result of finding files that import a specific module
 */
export interface ImporterResult {
  /** File that contains the import */
  file: string;
  /** The import that matches the search */
  imports: Import[];
}

/**
 * Analysis results for a project
 */
export interface ProjectAnalysis {
  /** Total files analyzed */
  totalFiles: number;
  /** Total imports found */
  totalImports: number;
  /** Imports by file */
  files: Record<string, FileImports>;
  /** Summary statistics */
  summary: {
    static: number;
    dynamic: number;
    lazy: number;
    require: number;
  };
}

/**
 * Configuration options for the detector
 */
export interface DetectorOptions {
  /** File extensions to include */
  includeExtensions?: string[];
  /** Patterns to exclude */
  excludePatterns?: string[];
  /** Detect static imports */
  detectStatic?: boolean;
  /** Detect dynamic imports */
  detectDynamic?: boolean;
  /** Detect lazy imports */
  detectLazy?: boolean;
  /** Detect require calls */
  detectRequire?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Specific module path to match (for path-specific filtering) */
  modulePath?: string;
  /** Base URL for module resolution (overrides tsconfig) */
  baseUrl?: string;
  /** Path to tsconfig.json for automatic baseUrl detection */
  tsconfigPath?: string;
}

/**
 * Output format options
 */
export type OutputFormat = 'json' | 'text' | 'html' | 'graph';

export interface OutputOptions {
  format: OutputFormat;
  output?: string;
  includeStats?: boolean;
  includeLocations?: boolean;
}

/**
 * Progress callback for reporting analysis progress
 */
export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

/**
 * Represents an export from a file
 */
export interface Export {
  /** Exported name */
  name: string;
  /** Local name in the file (for re-exports) */
  localName: string;
  /** Export kind: 'named' or 'default' */
  kind: 'named' | 'default';
}

/**
 * Import map showing bidirectional import relationships
 */
export interface ImportMap {
  /** Forward lookup: what each file imports */
  imports: {
    [filePath: string]: {
      static: Import[];
      dynamic: Import[];
      lazy: Import[];
      require: Import[];
    };
  };
  /** Reverse lookup: what imports each file */
  importedBy: {
    [filePath: string]: string[];
  };
  /** Statistics about the import map */
  stats: {
    totalFiles: number;
    totalImports: number;
    mostImportedFiles: Array<{ filePath: string; importCount: number }>;
    leastImportedFiles: Array<{ filePath: string; importCount: number }>;
  };
}

