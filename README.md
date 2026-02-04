# Imports Detector

[![npm](https://img.shields.io/npm/v/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![npm dm](https://img.shields.io/npm/dm/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![npm dw](https://img.shields.io/npm/dw/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![npm](https://img.shields.io/npm/l/imports-detector)](https://www.npmjs.com/package/imports-detector)
[![GitHub stars](https://img.shields.io/github/stars/al-maqdi/imports-detector?style=social)](https://github.com/almaqdi/imports-detector)

A powerful package for detecting and analyzing imports in JavaScript/TypeScript applications. Find files importing specific modules, list all imports, and generate comprehensive dependency reports.

## Features

- 📦 **Multiple Import Type Detection**
  - Static ES6 imports (`import { x } from 'y'`)
  - Dynamic imports (`import('y')`)
  - Lazy imports (React.lazy, Next.js dynamic)
  - CommonJS require statements (`require('y')`)

- 🔍 **Find Importers** - Find all files that import a specific module
- 📋 **List All Imports** - Comprehensive import analysis for entire projects
- 📊 **Multiple Output Formats** - JSON, text, and more
- ⚡ **Fast** - Uses Babel parser for efficient AST traversal
- 🎯 **TypeScript Support** - First-class TypeScript support

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
imports-detector find Dashboard --module-path admin/Dashboard ./src

# Find files importing Test from components folder
imports-detector find Test --module-path components/Test ./src

# Find files importing Test using full path
imports-detector find Test --module-path src/components/Test ./src

# Find files importing Test from test fixtures
imports-detector find Test --module-path tests/fixtures/sample-project/src/components/Test ./src
```

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
# Using full path to the Test component
imports-detector find Test --module-path tests/fixtures/sample-project/src/components/Test ./src

# This will find:
# ✅ import { Test } from './components/Test'
# ✅ import { Test } from '../components/Test'
# ✅ import { Test } from '../../tests/fixtures/sample-project/src/components/Test'
# ❌ But NOT imports from './components/Button' or './utils/Test'
```

**Example 3: Deeply nested paths**

```bash
# Find imports from a deeply nested component
imports-detector find UserCard --module-path src/components/admin/users/UserCard ./src

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
imports-detector find Header --module-path src/admin/Header ./src

# Result: Only files importing from the admin/Header path
```

**Example 5: Test files**

```bash
# Find files importing a test utility
imports-detector find Test --module-path tests/fixtures/sample-project/src/components/Test ./src

# Or using relative path from search directory
imports-detector find Test --module-path components/Test ./src
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
   imports-detector find Header --module-path src/layouts/Header ./src

   # Less specific: May find too many results
   imports-detector find Header ./src
   ```

2. **Match the import path format used in your code:**

   ```bash
   # If your code imports like: import { X } from '@/components/Test'
   # Use: imports-detector find Test --module-path components/Test ./src

   # If your code imports like: import { X } from '../../src/components/Test'
   # Use: imports-detector find Test --module-path src/components/Test ./src
   ```

3. **Test with broader search first, then narrow down:**

   ```bash
   # Step 1: See all Test imports
   imports-detector find Test ./src

   # Step 2: Narrow to specific path
   imports-detector find Test --module-path components/Test ./src
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
- `--module-path <path>` - Specific module path to match (e.g., `admin/Dashboard`)
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

# Find files importing Dashboard from admin folder only
imports-detector find Dashboard --module-path admin/Dashboard --path ./src

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
import { X } from './components/X'
import { Y } from '../utils/Y'
```

✅ **Absolute imports with baseUrl** (auto-detected):
```typescript
import { X } from 'components/X'
import { Y } from 'utils/Y'
```

✅ **Bare modules** (always supported):
```typescript
import React from 'react'
import _ from 'lodash'
```

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

### Example 4: Find unused components

```typescript
import { analyzeProject } from 'imports-detector';

const analysis = await analyzeProject('./src');
const componentFiles = Object.keys(analysis.files).filter((f) =>
  f.includes('/components/'),
);

// Check if each component is imported elsewhere
for (const componentFile of componentFiles) {
  const componentName = componentFile
    .split('/')
    .pop()
    ?.replace(/\.(tsx|ts)$/, '');
  if (componentName) {
    const importers = await findFilesImporting(componentName, './src');
    if (importers.length === 0) {
      console.log(`Component ${componentName} is not used anywhere`);
    }
  }
}
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
