import fs from 'fs';
import { parse } from '@babel/parser';
import type { File } from '@babel/types';

/**
 * Parser options for different file types
 */
interface ParserOptions {
  /** Enable TypeScript parsing */
  isTypeScript?: boolean;
  /** Enable JSX parsing */
  isJSX?: boolean;
}

/**
 * Code Parser Module
 * Parses source code into AST using Babel
 */
export class CodeParser {
  /**
   * Get parser options based on file extension
   */
  private getParserOptions(filePath: string): ParserOptions {
    const ext = filePath.split('.').pop();

    return {
      isTypeScript: ext === 'ts' || ext === 'tsx',
      isJSX: ext === 'jsx' || ext === 'tsx',
    };
  }

  /**
   * Parse a file to AST
   */
  parseFile(filePath: string): File {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');
      return this.parseSource(sourceCode, filePath);
    } catch (error) {
      throw new Error(`Failed to parse file ${filePath}: ${error}`);
    }
  }

  /**
   * Parse source code string to AST
   */
  parseSource(sourceCode: string, filePath: string): File {
    const options = this.getParserOptions(filePath);

    try {
      const ast = parse(sourceCode, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        plugins: [
          options.isTypeScript && 'typescript',
          options.isJSX && 'jsx',
          'jsx',
        ].filter(Boolean) as any[],
        createImportExpressions: true, // Enable ImportExpression for dynamic imports
      });

      return ast;
    } catch (error) {
      throw new Error(`Failed to parse source code in ${filePath}: ${error}`);
    }
  }

  /**
   * Check if a file can be parsed
   */
  canParse(filePath: string): boolean {
    const ext = filePath.split('.').pop();
    const supportedExtensions = ['js', 'jsx', 'ts', 'tsx', 'mjs'];
    return supportedExtensions.includes(ext || '');
  }
}
