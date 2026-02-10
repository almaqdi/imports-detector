# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

imports-detector is a TypeScript/JavaScript static analysis tool that detects and analyzes imports in codebases. It can find files importing specific modules, list all imports, generate dependency reports, find unused files, and build import maps. The package works as both a CLI tool and a library API.

## Development Commands

### Build
```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode for development
```

### Testing
```bash
npm test               # Run basic tests
npm run test:watch     # Watch mode for testing
```

### CLI Usage (Testing the CLI locally)
```bash
# Use node to run the CLI directly from source
node bin/cli.js find React ./src
node bin/cli.js list ./src
node bin/cli.js report ./src --output report.json
```

### Publishing
```bash
npm run build          # Build first (runs via prepublishOnly)
npm publish            # Publish to npm
```

## Architecture

The codebase follows a pipeline architecture with clear separation of concerns:

### Core Pipeline Flow
```
FileDiscovery → CodeParser → ImportExtractor → ModuleResolver → ImportAnalyzer → Output
```

### Key Components

1. **FileDiscovery** (`src/file-discovery.ts`)
   - Uses `fast-glob` for efficient file system scanning
   - Applies include/exclude patterns
   - Returns absolute file paths for analysis

2. **CodeParser** (`src/parser.ts`)
   - Uses `@babel/parser` to parse JS/TS into AST
   - Handles different file types and syntax variations
   - Returns AST nodes for traversal

3. **ImportExtractor** (`src/extractor.ts`)
   - Uses `@babel/traverse` to walk the AST
   - Extracts four types of imports:
     - Static ES6 imports (`import { x } from 'y'`)
     - Dynamic imports (`import('y')`)
     - Lazy imports (React.lazy, Next.js dynamic) - **detects renamed components**
     - CommonJS require (`require('y')`)
   - Also extracts exports (for barrel file detection)

4. **ModuleResolver** (`src/module-resolver.ts`)
   - Critical component that mimics TypeScript/Node.js module resolution
   - Resolves import specifiers to absolute file paths (like IDE "command + click")
   - Handles:
     - Relative imports (`./components/Test`)
     - Absolute imports (`src/components/Test`) with baseUrl from tsconfig.json
     - Bare imports (`react`, `lodash`)
   - Auto-detects baseUrl from tsconfig.json using `get-tsconfig` package

5. **ImportAnalyzer** (`src/analyzer.ts`)
   - Main orchestrator that coordinates all components
   - Public API methods:
     - `findFilesImporting()` - Find files importing a specific module
     - `analyzeProject()` - Scan entire project and return all imports
     - `findUnusedFiles()` - Identify files not imported anywhere (with barrel file support)
     - `buildImportMap()` - Build bidirectional dependency graphs
   - Implements **barrel file detection** to trace imports through index.ts/index.js re-exports

6. **Output Generators** (`src/output/`)
   - `TextGenerator` - Human-readable console output with emojis
   - `JSONGenerator` - Machine-readable JSON for programmatic use

### Important Architecture Details

#### Barrel File Detection
The tool has sophisticated barrel file (index.ts/index.js) detection in two places:

1. **`findFilesImporting()`** (lines 514-544): When searching for a file with `--module-path`, it checks if the target has a sibling barrel file. If an import goes through the barrel path (resolves to `index.ts`), it still matches the target file.

2. **`findUnusedFiles()`** (lines 388-445): Builds a `barrelExports` map to track which files are exported through barrel files, then checks if a file is used indirectly via a used barrel before marking it as unused.

This requires:
- Extended `Export` interface with `source` field for re-exports
- Extractor capturing source module paths
- Resolver to trace the full import chain

#### Module Resolution Strategy
The resolver follows TypeScript's resolution algorithm:
1. Check relative imports first
2. Check absolute imports against baseUrl (from tsconfig.json)
3. Return bare imports as-is (node_modules)

This enables the tool to distinguish between files with the same name in different directories.

#### Single-Scan Architecture
For performance, the tool uses a single-scan approach:
- Pre-parses all files once into a Map
- Reuses parsed data for multiple operations
- Avoids re-reading or re-parsing files

This makes `findUnusedFiles()` ~1000x faster than checking each file individually.

## Type System

Key types in `src/types.ts`:
- `DetectorOptions` - Configuration for what import types to detect
- `FileImports` - All imports found in a single file
- `Import` - Individual import with type, module, name, line number
- `ProjectAnalysis` - Complete analysis with all files and imports
- `ImportMap` - Bidirectional dependency graph with statistics
- `Export` - Export declaration with optional source field for re-exports

## Testing Strategy

The package is tested against the `jisr-frontend` repository (8000+ files) to verify:
- Performance on large codebases
- Barrel file detection accuracy
- TypeScript baseUrl resolution
- Lazy import with renamed component detection
- Real-world import patterns

When adding features, test them on jisr-frontend to ensure they work at scale.

## Common Issues & Solutions

### Barrel Files Not Detected
If imports through barrel files aren't detected:
1. Check if `Export` type has `source` field
2. Verify extractor captures source in re-exports
3. Ensure resolver is used to trace barrel exports
4. Check barrel export map is built in `findUnusedFiles()`

### Module Resolution Failing
If imports aren't resolved correctly:
1. Verify baseUrl is loaded from tsconfig.json
2. Check resolver extension order (.ts before .js)
3. Test with `--verbose` flag to see debug output
4. Ensure paths are normalized (handle ../ and ./)

### Performance Issues
If analysis is slow on large projects:
1. Ensure single-scan architecture is used (no nested loops)
2. Check that files are only parsed once
3. Use Map/Set for O(1) lookups
4. Minimize AST traversals

## Version Management

Update version in two places:
- `package.json` version field
- `src/cli.ts` `.version()` call

Always run `npm run build` after version changes to update the dist folder.
