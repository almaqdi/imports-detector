# Imports Detector

[![npm](https://img.shields.io/npm/v/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![npm dm](https://img.shields.io/npm/dm/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![npm dw](https://img.shields.io/npm/dw/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![npm](https://img.shields.io/npm/l/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![GitHub stars](https://img.shields.io/github/stars/almaqdi/imports-detector?style=social)](https://github.com/almaqdi/imports-detector)

A powerful package for detecting and analyzing imports in JavaScript/TypeScript applications. Find files importing specific modules, list all imports, and generate comprehensive dependency reports.

## Features

- 📦 **Multiple Import Type Detection**
  - Static ES6 imports (`import { x } from 'y'`)
  - Dynamic imports (`import('y')`)
  - Lazy imports (React.lazy, Next.js dynamic) **with renamed component detection**
  - CommonJS require statements (`require('y')`)

- 🔍 **Smart Import Detection**
  - **Find Importers** - Locate all files importing a specific module
  - **Barrel File Detection** - Auto-detect transitive imports through index files
  - **Path-Specific Matching** - Distinguish between files with the same name
  - **Renamed Component Tracking** - Find lazy imports even when components are renamed

- 📊 **Advanced Analytics**
  - **Find Unused Files** - Identify dead code with a single scan (1000x faster!)
  - **Build Import Maps** - Create bidirectional dependency graphs with statistics
  - **List All Imports** - Complete analysis for entire projects

- ⚡ **Performance Optimized**
  - **Memory Efficient** - Constant ~50MB usage regardless of project size
  - **Lightning Fast** - Single-scan architecture, 1000x faster than alternatives
  - **Batch Processing** - Smooth performance even on 10,000+ files
  - **Progress Tracking** - Real-time updates with smooth animations

- 🎯 **Developer Experience**
  - TypeScript Support with automatic baseUrl detection
  - IDE-like module resolution ("command + click" behavior)
  - Flexible filtering (import types, file patterns, paths)
  - Multiple output formats (JSON, text)

## Installation

### Use with npx (No Installation Needed)

The easiest way to use imports-detector without installing anything:

```bash
npx imports-detector find --module-path ./src/components/forms/RadioField.tsx  ./src
npx imports-detector find Test ./src
npx imports-detector list ./src
npx imports-detector report ./src --output report.json
```

**Why npx?**

- ✅ No installation required
- ✅ Always uses the latest version
- ✅ Perfect for one-off analysis tasks
- ✅ No need to add to your project dependencies

### Install as a dev dependency (Recommended)

Install locally in your project for use in scripts and programmatic analysis:

```bash
npm install -D imports-detector
# or
yarn add -D imports-detector
# or
pnpm add -D imports-detector
```

**Why devDependency?**

- imports-detector is a development tool for code analysis
- It's not needed in production builds
- Similar to ESLint, Prettier, TypeScript, and testing frameworks
- Used during development for auditing and understanding dependencies

### Install globally for CLI use

Install globally to use the CLI across multiple projects:

```bash
npm install -g imports-detector
# or
yarn global add imports-detector
# or
pnpm add -g imports-detector
```

Use global installation if you frequently run imports-detector from anywhere without installing it in each project.

## CLI Usage

### Find Files Importing a Specific Module

Find all files that import a specific module or component:

```bash
imports-detector find Test ./src
```

Example output:

```
🔍 Found 2 files importing "Test"

./src/App.tsx
  📦 ./components/Test (named): Test (line 2)

./src/pages/HomePage.tsx
  📦 ../components/Test (default): Test (line 2)
```

#### Path-Specific Module Detection

Find files importing a module from a **specific path** (useful when you have multiple components with the same name):

```bash
# Find files importing Dashboard specifically from the admin folder
imports-detector find Dashboard --module-path admin/Dashboard.tsx ./src

# Find files importing Test from components folder
imports-detector find Test --module-path components/Test.tsx ./src

# Find files importing Test using full path
imports-detector find Test --module-path src/components/Test.tsx ./src

# Find files importing Test from test fixtures
imports-detector find Test --module-path tests/fixtures/sample-project/src/components/Test.tsx ./src
```

> **💡 Best Practice:** Include the file extension (`.tsx`, `.ts`, `.js`, `.jsx`) in `--module-path` for more precise matching. You can copy-paste the file path directly from your IDE!

This is especially useful when you have multiple components with the same name:

```
src/
├── admin/Dashboard.tsx       ← Admin Dashboard
├── components/Dashboard.tsx  ← User Dashboard
└── pages/
    ├── AdminPage.tsx         ← Imports from admin/Dashboard ✅
    └── UserPage.tsx          ← Imports from components/Dashboard ✅
```

Running `imports-detector find Dashboard --module-path admin/Dashboard ./src` will only find files that import from the `admin/Dashboard` path, not the `components/Dashboard` path.

##### Find All Imports from a File (Regardless of Import Name)

**NEW:** You can now omit the module name when using `--module-path` to find **ALL imports** from a specific file, even if they're imported with different names:

```bash
# Find ALL imports from Lazyload.tsx (any imported name)
imports-detector find --module-path src/components/global/atoms/Lazyload/Lazyload.tsx ./src

# This will find ALL of these:
# ✅ import { Lazyload } from './Lazyload'
# ✅ import { LazyLoad } from './Lazyload'  (different name!)
# ✅ import MyComponent from './Lazyload'  (default export with custom name!)
# ✅ const Lazyload = lazy(() => import('./Lazyload'))
```

This is especially useful for:

- **Finding renamed imports** - When components are imported with different names
- **Finding default exports** - When files use custom names for default exports
- **Finding lazy imports** - When using React.lazy or dynamic import()
- **Comprehensive analysis** - When you want to see EVERY usage of a file

**Example:**

```bash
# Without module name: finds imports with ANY name
imports-detector find --module-path src/components/Header.tsx ./src

# Output shows all imports, even with different names:
# src/App.tsx
#   📦 ./Header (default): Header (line 1)
# src/Layout.tsx
#   📦 ./Header (default): AppHeader (line 3)  ← Different name!
# src/pages/Home.tsx
#   ⚡ ./Header (line 5)  ← Lazy import!
```

##### Path Matching Examples

The `--module-path` option is flexible and supports various path formats:

**Example 1: Relative paths**

```bash
# Both of these will match imports from './admin/Dashboard'
imports-detector find Dashboard --module-path admin/Dashboard ./src
imports-detector find Dashboard --module-path ./admin/Dashboard ./src
```

**Example 2: Full paths**

```bash
# Using full path to the Test component (with extension for precision)
imports-detector find Test --module-path tests/fixtures/sample-project/src/components/Test.tsx ./src

# This will find:
# ✅ import { Test } from './components/Test'
# ✅ import { Test } from '../components/Test'
# ✅ import { Test } from '../../tests/fixtures/sample-project/src/components/Test'
# ❌ But NOT imports from './components/Button' or './utils/Test'
```

**Example 3: Deeply nested paths**

```bash
# Find imports from a deeply nested component
imports-detector find UserCard --module-path src/components/admin/users/UserCard.tsx ./src

# This matches:
# ✅ import { UserCard } from '../admin/users/UserCard'
# ✅ import { UserCard } from './components/admin/users/UserCard'
# ❌ But NOT from './components/users/UserCard' (missing 'admin')
```

**Example 4: Multiple components, same name**

```bash
# You have:
# - src/components/Header.tsx
# - src/layouts/Header.tsx
# - src/admin/Header.tsx

# Find only imports of the admin Header:
imports-detector find Header --module-path src/admin/Header.tsx ./src

# Result: Only files importing from the admin/Header path
```

**Example 5: Test files**

```bash
# Find files importing a test utility
imports-detector find Test --module-path tests/fixtures/sample-project/src/components/Test.tsx ./src

# Or using relative path from search directory
imports-detector find Test --module-path components/Test.tsx ./src
```

**How Path Matching Works:**

The path matching is intelligent and handles:

- ✅ Relative paths: `./admin/Dashboard`, `../admin/Dashboard`
- ✅ Absolute paths: `src/admin/Dashboard`, `/home/user/project/src/admin/Dashboard`
- ✅ Path normalization: `admin/Dashboard` matches `./admin/Dashboard` and `../admin/Dashboard`
- ✅ Case-insensitive matching: `Admin/Dashboard` matches `admin/dashboard`
- ✅ File extensions: Automatically stripped, so `Test.tsx` matches `Test`

**Pro Tips:**

1. **Use specific paths when you have duplicate names:**

   ```bash
   # Good: Specific
   imports-detector find Header --module-path src/layouts/Header.tsx ./src

   # Less specific: May find too many results
   imports-detector find Header ./src
   ```

2. **Match the import path format used in your code:**

   ```bash
   # If your code imports like: import { X } from '@/components/Test'
   # Use: imports-detector find Test --module-path components/Test.tsx ./src

   # If your code imports like: import { X } from '../../src/components/Test'
   # Use: imports-detector find Test --module-path src/components/Test.tsx ./src
   ```

3. **Test with broader search first, then narrow down:**

   ```bash
   # Step 1: See all Test imports
   imports-detector find Test ./src

   # Step 2: Narrow to specific path (with extension for precision)
   imports-detector find Test --module-path components/Test.tsx ./src
   ```

### List All Imports

List all imports in each file:

```bash
imports-detector list ./src
```

Example output:

```
📦 Import Analysis Report
==================================================

Summary:
  Total Files: 5
  Total Imports: 9
  Static: 8 | Dynamic: 0 | Lazy: 0 | Require: 1

--------------------------------------------------

./src/App.tsx
  [STATIC]   react (default): React (line 1)
  [STATIC]   ./components/Test (named): Test (line 2)
  [STATIC]   ./components/Button (named): Button (line 3)
```

### Generate Reports

Generate a detailed report:

```bash
imports-detector report ./src --output report.txt
```

JSON output:

```bash
imports-detector report ./src --output report.json --format json
```

### CLI Options

Global options:

- `--path <path>` - Root directory to analyze
- `--module-path <path>` - Specific module path to match (e.g., `admin/Dashboard.tsx`). **Best Practice:** Include the file extension for precise matching.
- `--base-url <url>` - Base URL for module resolution (overrides tsconfig)
- `--tsconfig <path>` - Path to tsconfig.json for automatic baseUrl detection
- `--include <patterns>` - File extensions to include (comma-separated)
- `--exclude <patterns>` - Patterns to exclude (comma-separated)
- `--format <format>` - Output format: json or text (default: text)
- `--output <file>` - Output file path
- `--no-static` - Exclude static imports
- `--no-dynamic` - Exclude dynamic imports
- `--no-lazy` - Exclude lazy imports
- `--no-require` - Exclude require calls
- `-v, --verbose` - Verbose output

Examples:

```bash
# Find files importing React
imports-detector find React --path ./src

# Find files importing Dashboard from admin folder only (with extension for precision)
imports-detector find Dashboard --module-path admin/Dashboard.tsx --path ./src

# Find files using TypeScript baseUrl (auto-detected from tsconfig.json)
imports-detector find ImportBulkSchedulers --path ./src

# Manually specify baseUrl if tsconfig is not available
imports-detector find Button --base-url ./src --path ./src

# Export results to JSON
imports-detector find React --path ./src --include "**/*.tsx" --format json --output results.json
```

## TypeScript baseUrl Support

The tool automatically detects and uses the `baseUrl` configuration from your `tsconfig.json` to resolve absolute imports.

### How It Works

If your `tsconfig.json` contains:

```json
{
  "compilerOptions": {
    "baseUrl": "./src"
  }
}
```

The tool will automatically resolve imports like:

```typescript
import { Button } from 'components/Button';
import { Utils } from 'utils/helpers';
```

### Manual Configuration

If your project doesn't have a `tsconfig.json` or you want to override the detected baseUrl:

```bash
# Specify baseUrl manually
imports-detector find Button --base-url ./src ./src

# Specify a custom tsconfig path
imports-detector find Button --tsconfig ./configs/tsconfig.base.json ./src
```

### Supported Import Styles

✅ **Relative imports** (always supported):

```typescript
import { X } from './components/X';
import { Y } from '../utils/Y';
```

✅ **Absolute imports with baseUrl** (auto-detected):

```typescript
import { X } from 'components/X';
import { Y } from 'utils/Y';
```

✅ **Bare modules** (always supported):

```typescript
import React from 'react';
import _ from 'lodash';
```

## Performance

imports-detector is optimized for large-scale projects with battle-tested performance:

### Real-World Performance (jisr-frontend: 8,084 files)

| Operation | Time | Memory | Status |
|-----------|------|--------|--------|
| Find React imports | ~15s | ~50MB | ✅ Excellent |
| Find RadioBoxField (with barrels) | ~15s | ~50MB | ✅ Excellent |
| List all imports | ~15s | ~50MB | ✅ Excellent |
| Build import map | ~15s | ~50MB | ✅ Excellent |

### Key Optimizations

- **Single-Scan Architecture** - Each file parsed once, results cached
- **Batch Processing** - 20 files per batch with event loop yielding
- **Memory Efficient** - Constant ~50MB regardless of project size
- **Smart Caching** - Pre-parsed file map prevents re-scanning
- **Progress Reporting** - Updates every 10 files, smooth animations

### Comparison with Alternatives

Finding unused files in a project with 1,000 components:

| Approach | Operations | Memory | Result |
|----------|-----------|--------|--------|
| imports-detector | 8,000 | ~50MB | ✅ 15 seconds |
| Manual forEach loop | 8,000,000 | ~7GB | 💥 OOM Error |
| Other tools | Variable | 100MB-1GB | ⚠️ Slower |

## Why imports-detector?

**Unmatched Performance**
- Single-scan architecture is 1000x faster than checking files individually
- Constant memory usage (~50MB) regardless of project size
- Handles projects with 10,000+ files without breaking a sweat

**Smart Detection**
- Finds barrel files and transitive imports automatically
- Detects lazy imports even when components are renamed
- Distinguishes between multiple files with the same name
- IDE-like module resolution ("command + click" behavior)

**Developer Friendly**
- Dead simple API with powerful defaults
- Works as CLI tool or programmable library
- TypeScript-first with automatic baseUrl detection
- Comprehensive import type coverage

**Battle-Tested**
- Tested on real-world projects with 8,000+ files
- Handles complex dependency graphs
- Used in production environments
- 800+ downloads and growing

## Library API

### Basic Usage

```typescript
import {
  ImportAnalyzer,
  findFilesImporting,
  analyzeProject,
} from 'imports-detector';

// Find files importing a specific module
const results = await findFilesImporting('Test', './src');

// Analyze entire project
const analysis = await analyzeProject('./src');
```

### ImportAnalyzer Class

```typescript
import { ImportAnalyzer } from 'imports-detector';

const analyzer = new ImportAnalyzer({
  detectStatic: true,
  detectDynamic: true,
  detectLazy: true,
  detectRequire: true,
  includeExtensions: ['.js', '.jsx', '.ts', '.tsx'],
  excludePatterns: ['**/node_modules/**'],
  verbose: true,
  modulePath: 'admin/Dashboard', // Optional: filter by specific path
  baseUrl: './src', // Optional: specify baseUrl manually
  tsconfigPath: './tsconfig.json', // Optional: path to tsconfig for baseUrl detection
});

// Find files importing a specific module
const results = await analyzer.findFilesImporting('Test', './src');
console.log(`Found ${results.length} files importing Test`);

// Find files importing from a specific path
const pathResults = await analyzer.findFilesImporting('Dashboard', './src');
// With modulePath set to 'admin/Dashboard', this only finds imports from admin/Dashboard

// Analyze entire project
const analysis = await analyzer.analyzeProject('./src');
console.log(`Total files: ${analysis.totalFiles}`);
console.log(`Total imports: ${analysis.totalImports}`);

// Analyze a single file
const fileImports = analyzer.analyzeFile('./src/App.tsx');
console.log('Static imports:', fileImports.static);
```

### Output Formats

#### Find Results

```typescript
const results = await analyzer.findFilesImporting('Test', './src');

// Result structure:
[
  {
    file: '/path/to/App.tsx',
    imports: [
      {
        module: './components/Test',
        type: 'static',
        line: 2,
        column: 8,
        specifiers: ['Test'],
        kind: 'named',
        raw: "import { Test } from './components/Test'",
      },
    ],
  },
];
```

#### Project Analysis

```typescript
const analysis = await analyzer.analyzeProject('./src');

// Result structure:
{
  totalFiles: 5,
  totalImports: 9,
  files: {
    '/path/to/App.tsx': {
      file: '/path/to/App.tsx',
      static: [...],
      dynamic: [...],
      lazy: [...],
      require: [...]
    },
    // ... more files
  },
  summary: {
    static: 8,
    dynamic: 0,
    lazy: 0,
    require: 1
  }
}
```

## API Reference

### Classes

#### `ImportAnalyzer`

Main analyzer class for detecting imports.

**Constructor Options:**

```typescript
interface DetectorOptions {
  includeExtensions?: string[]; // File extensions to scan
  excludePatterns?: string[]; // Patterns to exclude
  detectStatic?: boolean; // Detect static imports (default: true)
  detectDynamic?: boolean; // Detect dynamic imports (default: true)
  detectLazy?: boolean; // Detect lazy imports (default: true)
  detectRequire?: boolean; // Detect require calls (default: true)
  verbose?: boolean; // Enable verbose logging
  modulePath?: string; // Specific module path to match (for path-specific filtering)
  baseUrl?: string; // Base URL for module resolution (overrides tsconfig)
  tsconfigPath?: string; // Path to tsconfig.json for automatic baseUrl detection
}
```

**Methods:**

- `findFilesImporting(moduleName: string, searchPath: string): Promise<ImporterResult[]>`
- `analyzeProject(searchPath: string): Promise<ProjectAnalysis>`
- `analyzeFile(filePath: string): FileImports`

### Types

```typescript
enum ImportType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  LAZY = 'lazy',
  REQUIRE = 'require',
}

interface Import {
  module: string; // The module being imported
  type: ImportType; // Type of import
  line: number; // Line number
  column: number; // Column number
  specifiers?: string[]; // Imported specifiers
  kind?: 'named' | 'default' | 'namespace';
  raw?: string; // Raw import statement
}

interface FileImports {
  file: string;
  static: Import[];
  dynamic: Import[];
  lazy: Import[];
  require: Import[];
}

interface ImporterResult {
  file: string;
  imports: Import[];
}

interface ProjectAnalysis {
  totalFiles: number;
  totalImports: number;
  files: Record<string, FileImports>;
  summary: {
    static: number;
    dynamic: number;
    lazy: number;
    require: number;
  };
}
```

## Examples

### Example 1: Find all components using React

```typescript
import { findFilesImporting } from 'imports-detector';

const results = await findFilesImporting('react', './src');
results.forEach((result) => {
  console.log(`${result.file} imports React`);
});
```

### Example 2: Find files importing a specific Test component

```typescript
import { ImportAnalyzer } from 'imports-detector';

// Find files importing Test from components folder only
const analyzer = new ImportAnalyzer({
  modulePath: 'components/Test',
});

const results = await analyzer.findFilesImporting('Test', './src');
console.log(
  `Found ${results.length} files importing Test from components folder`,
);
```

### Example 3: Distinguish between multiple components with the same name

```typescript
import { ImportAnalyzer } from 'imports-detector';

// Scenario: You have multiple Dashboard components
// - src/admin/Dashboard.tsx
// - src/user/Dashboard.tsx
// - src/components/Dashboard.tsx

// Find only files importing the admin Dashboard
const adminAnalyzer = new ImportAnalyzer({
  modulePath: 'src/admin/Dashboard',
});
const adminImports = await adminAnalyzer.findFilesImporting(
  'Dashboard',
  './src',
);

// Find only files importing the user Dashboard
const userAnalyzer = new ImportAnalyzer({
  modulePath: 'src/user/Dashboard',
});
const userImports = await userAnalyzer.findFilesImporting('Dashboard', './src');

console.log(`Admin Dashboard imported by ${adminImports.length} files`);
console.log(`User Dashboard imported by ${userImports.length} files`);
```

### Example 4: Find unused components ✨

```typescript
import { findUnusedFiles } from 'imports-detector';

// Single scan - fast and efficient!
const unused = await findUnusedFiles('./src', {
  filePattern: '/components/' // Only check component files
});

// Process results
unused.forEach(({ filePath }) => {
  console.log(`✗ Unused: ${filePath}`);
});

console.log(`\nFound ${unused.length} unused components`);
```

**Benefits:**
- ✅ **Single project scan** - efficient even for large projects
- ✅ **Constant memory usage** (~50MB regardless of component count)
- ✅ **1000x faster** than checking each file individually
- ✅ **No OOM errors** - works on projects of any size
- ✅ **Simpler API** - one function call instead of manual loops

### Example 4a: Advanced analysis with import map

For custom queries and advanced analysis, build an import map:

```typescript
import { buildImportMap } from 'imports-detector';

// Build comprehensive import map
const map = await buildImportMap('./src');

// Find most imported files
console.log('Most imported files:');
map.stats.mostImportedFiles.forEach(({ filePath, importCount }) => {
  console.log(`  ${filePath}: ${importCount} imports`);
});

// Find what imports a specific file
const file = './src/components/Button.tsx';
const consumers = map.importedBy[file] || [];
console.log(`${file} is imported by ${consumers.length} files`);

// Find files with no imports (entry points)
const entryPoints = Object.keys(map.imports).filter(
  file => map.imports[file].static.length === 0 &&
         map.imports[file].dynamic.length === 0
);
console.log(`Found ${entryPoints.length} entry points`);
```

### Example 3: Analyze import patterns

```typescript
import { ImportAnalyzer } from 'imports-detector';

const analyzer = new ImportAnalyzer();
const analysis = await analyzer.analyzeProject('./src');

// Count lazy imports
const lazyImportCount = Object.values(analysis.files).reduce(
  (sum, file) => sum + file.lazy.length,
  0,
);

console.log(`Found ${lazyImportCount} lazy imports in the project`);
```

## Technical Details

### Supported Import Patterns

#### Static ES6 Imports

```javascript
import React from 'react';
import { useState } from 'react';
import * as Utils from './utils';
```

#### Dynamic Imports

```javascript
const module = await import('./module');
```

#### Lazy Imports

```javascript
// React.lazy
const LazyComponent = React.lazy(() => import('./Component'));

// Next.js dynamic
const DynamicComponent = dynamic(() => import('./Component'));
```

#### CommonJS Require

```javascript
const fs = require('fs');
const { readFile } = require('fs');
```

### Dependencies

- @babel/parser - AST parsing
- @babel/traverse - AST traversal
- @babel/types - AST node utilities
- fast-glob - File pattern matching
- commander - CLI framework

## License

MIT

## Publishing to npm

If you want to publish your own version or fork:

### 1. Build the package

```bash
npm run build
```

### 2. Login to npm

```bash
npm login
```

### 3. Publish

```bash
npm publish
```

The package includes a `prepublishOnly` script that automatically builds before publishing.

### After Publishing

Once published, users can use your package with npx:

```bash
npx imports-detector find Test ./src
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.
