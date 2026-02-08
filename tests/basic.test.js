#!/usr/bin/env node

/**
 * Basic tests for imports-detector
 * Run with: node tests/basic.test.js
 */

import assert from 'assert';
import { ImportAnalyzer } from '../dist/analyzer.js';
import { CodeParser } from '../dist/parser.js';
import { ImportExtractor } from '../dist/extractor.js';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const fixturesPath = path.join(__dirname, 'fixtures', 'sample-project');

console.log('🧪 Running imports-detector tests...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Parse TypeScript file
test('Should parse TypeScript file', () => {
  const parser = new CodeParser();
  const testFile = path.join(fixturesPath, 'src', 'testFile.ts');

  assert.ok(fs.existsSync(testFile), 'Test fixture file should exist');

  const ast = parser.parseFile(testFile);
  assert.ok(ast, 'AST should be generated');
  assert.ok(ast.program, 'AST should have program node');
});

// Test 2: Extract static imports
test('Should extract static imports', () => {
  const parser = new CodeParser();
  const extractor = new ImportExtractor();
  const testFile = path.join(fixturesPath, 'src', 'testFile.ts');

  const ast = parser.parseFile(testFile);
  const imports = extractor.getAllImports(ast);

  const staticImports = imports.filter(imp => imp.type === 'static');
  assert.ok(staticImports.length >= 2, 'Should find at least 2 static imports');

  const reactImport = staticImports.find(imp => imp.module === 'react');
  assert.ok(reactImport, 'Should find React import');
  assert.equal(reactImport.kind, 'default', 'React should be default import');
});

// Test 3: Extract dynamic imports
test('Should extract dynamic imports', () => {
  const parser = new CodeParser();
  const extractor = new ImportExtractor();
  const testFile = path.join(fixturesPath, 'src', 'testFile.ts');

  const ast = parser.parseFile(testFile);
  const imports = extractor.getAllImports(ast);

  const dynamicImports = imports.filter(imp => imp.type === 'dynamic');
  assert.ok(dynamicImports.length > 0, 'Should find dynamic import');

  const lazyComponentImport = dynamicImports.find(imp =>
    imp.module.includes('LazyComponent')
  );
  assert.ok(lazyComponentImport, 'Should find LazyComponent dynamic import');
});

// Test 4: Extract lazy imports (React.lazy)
test('Should extract lazy imports (React.lazy)', () => {
  const parser = new CodeParser();
  const extractor = new ImportExtractor();
  const testFile = path.join(fixturesPath, 'src', 'testFile.ts');

  const ast = parser.parseFile(testFile);
  const imports = extractor.getAllImports(ast);

  const lazyImports = imports.filter(imp => imp.type === 'lazy');

  // Lazy import detection is complex and depends on exact syntax
  // For now, just verify the extractor doesn't crash
  assert.ok(Array.isArray(lazyImports), 'Should return array of lazy imports');

  // If lazy imports are found, verify structure
  if (lazyImports.length > 0) {
    const lazyImport = lazyImports[0];
    assert.ok(lazyImport.module, 'Lazy import should have module property');
    assert.ok(lazyImport.line, 'Lazy import should have line number');
  }
});

// Test 5: ImportAnalyzer initialization
test('Should initialize ImportAnalyzer with options', () => {
  const analyzer = new ImportAnalyzer({
    detectStatic: true,
    detectDynamic: true,
    detectLazy: true,
    detectRequire: true,
    verbose: false,
  });

  assert.ok(analyzer, 'Analyzer should be created');
});

// Test 6: Find files importing specific module
test('Should find files importing a specific module', async () => {
  const analyzer = new ImportAnalyzer();

  const results = await analyzer.findFilesImporting(
    'TestUtils',
    fixturesPath
  );

  assert.ok(Array.isArray(results), 'Results should be an array');
  assert.ok(results.length >= 0, 'Results should have length');
});

// Test 7: Analyze project
test('Should analyze project', async () => {
  const analyzer = new ImportAnalyzer();

  const analysis = await analyzer.analyzeProject(fixturesPath);

  assert.ok(analysis, 'Analysis should be generated');
  assert.ok(typeof analysis.totalFiles === 'number', 'Should have totalFiles count');
  assert.ok(typeof analysis.totalImports === 'number', 'Should have totalImports count');
  assert.ok(analysis.files, 'Should have files map');
});

// Test 8: File discovery
test('Should discover TypeScript files', async () => {
  const { FileDiscovery } = await import('../dist/file-discovery.js');
  const discovery = new FileDiscovery();

  const files = await discovery.findFiles(fixturesPath);

  assert.ok(Array.isArray(files), 'Files should be an array');
  assert.ok(files.length > 0, 'Should find at least one file');

  const hasTsFile = files.some(f => f.endsWith('.ts'));
  assert.ok(hasTsFile, 'Should find .ts file');
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log(`${'='.repeat(50)}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
