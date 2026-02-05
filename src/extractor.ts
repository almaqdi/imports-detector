import * as babelTraverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { File } from '@babel/types';
import { Import, ImportType, FileImports, Export } from './types.js';

// @babel/traverse has nested default exports in ESM
const traverse = (babelTraverse as any).default?.default || (babelTraverse as any).default || babelTraverse;

/**
 * Import Extractor Module
 * Extracts all types of imports from AST
 */
export class ImportExtractor {
  private extractStaticImports(ast: File): Import[] {
    const imports: Import[] = [];

    traverse(ast, {
      ImportDeclaration(path: NodePath<any>) {
        const node = path.node;

        // Extract specifiers
        const specifiers: string[] = [];
        let kind: 'named' | 'default' | 'namespace' = 'default';

        for (const spec of node.specifiers) {
          if (t.isImportSpecifier(spec)) {
            // spec.imported can be Identifier or StringLiteral
            const importedName = t.isIdentifier(spec.imported)
              ? spec.imported.name
              : spec.imported.value;
            specifiers.push(importedName);
            kind = 'named';
          } else if (t.isImportDefaultSpecifier(spec)) {
            specifiers.push(spec.local.name);
            kind = 'default';
          } else if (t.isImportNamespaceSpecifier(spec)) {
            specifiers.push(spec.local.name);
            kind = 'namespace';
          }
        }

        imports.push({
          module: node.source.value,
          type: ImportType.STATIC,
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          specifiers,
          kind,
          raw: path.toString(),
        });
      },
    });

    return imports;
  }

  private extractDynamicImports(ast: File): Import[] {
    const imports: Import[] = [];

    traverse(ast, {
      // Handle import() expressions (ES2020+)
      ImportExpression(path: NodePath<any>) {
        const node = path.node;

        let module = '';
        if (t.isStringLiteral(node.source)) {
          module = node.source.value;
        }

        imports.push({
          module,
          type: ImportType.DYNAMIC,
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          raw: path.toString(),
        });
      },

      // Handle import() as CallExpression (older Babel versions)
      CallExpression(path: NodePath<any>) {
        if (t.isImport(path.node.callee)) {
          const node = path.node;

          let module = '';
          if (node.arguments.length > 0 && t.isStringLiteral(node.arguments[0])) {
            module = node.arguments[0].value;
          }

          imports.push({
            module,
            type: ImportType.DYNAMIC,
            line: node.loc?.start.line || 0,
            column: node.loc?.start.column || 0,
            raw: path.toString(),
          });
        }
      },
    });

    return imports;
  }

  private extractRequireCalls(ast: File): Import[] {
    const imports: Import[] = [];

    traverse(ast, {
      CallExpression(path: NodePath<any>) {
        const callee = path.node.callee;

        // Check for require('module')
        if (t.isIdentifier(callee) && callee.name === 'require') {
          const args = path.node.arguments;

          if (args.length > 0 && t.isStringLiteral(args[0])) {
            imports.push({
              module: args[0].value,
              type: ImportType.REQUIRE,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              raw: path.toString(),
            });
          }
        }
      },
    });

    return imports;
  }

  private extractLazyImports(ast: File): Import[] {
    const imports: Import[] = [];

    traverse(ast, {
      CallExpression(path: NodePath<any>) {
        const callee = path.node.callee;

        // Check for React.lazy(() => import(...))
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'React' }) &&
          t.isIdentifier(callee.property, { name: 'lazy' })
        ) {
          const args = path.node.arguments;
          if (args.length > 0) {
            // Try to extract the import from the callback
            const callback = args[0];

            if (t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback)) {
              // Check body for import() call
              let module = '';

              if (t.isCallExpression(callback.body) && t.isImport(callback.body.callee)) {
                const importArgs = callback.body.arguments;
                if (importArgs.length > 0 && t.isStringLiteral(importArgs[0])) {
                  module = importArgs[0].value;
                }
              } else if (t.isBlockStatement(callback.body)) {
                // Search for import() in block statement
                traverse(callback.body, {
                  CallExpression(innerPath: NodePath<any>) {
                    if (
                      t.isImport(innerPath.node.callee) &&
                      innerPath.node.arguments.length > 0 &&
                      t.isStringLiteral(innerPath.node.arguments[0])
                    ) {
                      module = innerPath.node.arguments[0].value;
                    }
                  },
                });
              }

              if (module) {
                imports.push({
                  module,
                  type: ImportType.LAZY,
                  line: path.node.loc?.start.line || 0,
                  column: path.node.loc?.start.column || 0,
                  raw: path.toString(),
                });
              }
            }
          }
        }

        // Check for Next.js dynamic import
        if (
          t.isIdentifier(callee) &&
          (callee.name === 'dynamic' || callee.name === 'loadable')
        ) {
          const args = path.node.arguments;
          if (args.length > 0) {
            let module = '';

            // dynamic(() => import(...))
            if (
              t.isArrowFunctionExpression(args[0]) ||
              t.isFunctionExpression(args[0])
            ) {
              const callback = args[0];

              if (t.isCallExpression(callback.body) && t.isImport(callback.body.callee)) {
                const importArgs = callback.body.arguments;
                if (importArgs.length > 0 && t.isStringLiteral(importArgs[0])) {
                  module = importArgs[0].value;
                }
              }
            }
            // dynamic(import(...))
            else if (
              t.isCallExpression(args[0]) &&
              t.isImport(args[0].callee) &&
              args[0].arguments.length > 0 &&
              t.isStringLiteral(args[0].arguments[0])
            ) {
              module = args[0].arguments[0].value;
            }

            if (module) {
              imports.push({
                module,
                type: ImportType.LAZY,
                line: path.node.loc?.start.line || 0,
                column: path.node.loc?.start.column || 0,
                raw: path.toString(),
              });
            }
          }
        }
      },
    });

    return imports;
  }

  /**
   * Extract all imports from AST
   */
  extractAll(ast: File, options?: {
    static?: boolean;
    dynamic?: boolean;
    lazy?: boolean;
    require?: boolean;
  }): FileImports {
    const fileImports: FileImports = {
      file: ast.program.loc?.filename || 'unknown',
      static: [],
      dynamic: [],
      lazy: [],
      require: [],
    };

    const opts = {
      static: options?.static !== false,
      dynamic: options?.dynamic !== false,
      lazy: options?.lazy !== false,
      require: options?.require !== false,
    };

    if (opts.static) {
      fileImports.static = this.extractStaticImports(ast);
    }

    if (opts.dynamic) {
      fileImports.dynamic = this.extractDynamicImports(ast);
    }

    if (opts.lazy) {
      fileImports.lazy = this.extractLazyImports(ast);
    }

    if (opts.require) {
      fileImports.require = this.extractRequireCalls(ast);
    }

    return fileImports;
  }

  /**
   * Get all imports from a file (flattened)
   */
  getAllImports(ast: File): Import[] {
    const fileImports = this.extractAll(ast);
    return [
      ...fileImports.static,
      ...fileImports.dynamic,
      ...fileImports.lazy,
      ...fileImports.require,
    ];
  }

  /**
   * Extract all exports from a file
   * Returns information about what the file exports (for barrel file detection)
   */
  extractExports(ast: File): Export[] {
    const exports: Export[] = [];

    traverse(ast, {
      // Handle named exports: export { name1, name2 }
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
        const node = path.node;

        // export { foo, bar } from './module'
        if (node.source) {
          // Re-export from another module
          if (node.specifiers) {
            for (const spec of node.specifiers) {
              if (t.isExportSpecifier(spec)) {
                const exportedName = t.isIdentifier(spec.exported)
                  ? spec.exported.name
                  : spec.exported.value;
                const localName = spec.local.name;

                exports.push({
                  name: exportedName,
                  localName,
                  kind: 'named',
                });
              }
            }
          }
        } else {
          // export { foo, bar } (local exports)
          if (node.specifiers) {
            for (const spec of node.specifiers) {
              if (t.isExportSpecifier(spec)) {
                const exportedName = t.isIdentifier(spec.exported)
                  ? spec.exported.name
                  : spec.exported.value;
                const localName = spec.local.name;

                exports.push({
                  name: exportedName,
                  localName,
                  kind: 'named',
                });
              }
            }
          }
        }
      },

      // Handle export declarations
      ExportDeclaration(path: NodePath<any>) {
        const node = path.node;

        // export const foo = ...
        if (t.isVariableDeclaration(node.declaration)) {
          for (const declarator of node.declaration.declarations) {
            if (t.isIdentifier(declarator.id)) {
              exports.push({
                name: declarator.id.name,
                localName: declarator.id.name,
                kind: 'named',
              });
            }
          }
        }

        // export function foo() {}
        if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
          exports.push({
            name: node.declaration.id.name,
            localName: node.declaration.id.name,
            kind: 'named',
          });
        }

        // export class Foo {}
        if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
          exports.push({
            name: node.declaration.id.name,
            localName: node.declaration.id.name,
            kind: 'named',
          });
        }
      },

      // Handle default exports
      ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
        const node = path.node;

        let localName = 'default';

        // export default foo
        if (t.isIdentifier(node.declaration)) {
          localName = node.declaration.name;
        }
        // export default function foo() {}
        else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
          localName = node.declaration.id.name;
        }
        // export default class Foo {}
        else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
          localName = node.declaration.id.name;
        }

        exports.push({
          name: 'default',
          localName,
          kind: 'default',
        });
      },
    });

    return exports;
  }
}
