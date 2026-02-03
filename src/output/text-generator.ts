import type { ImporterResult, ProjectAnalysis, Import } from '../types.js';
import fs from 'fs';

/**
 * Text Output Generator
 * Generates human-readable text output
 */
export class TextGenerator {
  /**
   * Generate text output for findFilesImporting results
   */
  generateFromFindResults(results: ImporterResult[], moduleName: string): string {
    if (results.length === 0) {
      return `No files found importing "${moduleName}"\n`;
    }

    let output = `🔍 Found ${results.length} file${results.length > 1 ? 's' : ''} importing "${moduleName}"\n\n`;

    for (const result of results) {
      output += `${this.formatFilePath(result.file)}\n`;

      for (const imp of result.imports) {
        output += `  ${this.formatImportType(imp.type)} ${imp.module}`;

        if (imp.specifiers && imp.specifiers.length > 0) {
          output += ` (${imp.kind || 'named'}): ${imp.specifiers.join(', ')}`;
        }

        output += ` (line ${imp.line})\n`;
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Generate text output for project analysis
   */
  generateFromAnalysis(analysis: ProjectAnalysis): string {
    let output = '📦 Import Analysis Report\n';
    output += '='.repeat(50) + '\n\n';

    output += 'Summary:\n';
    output += `  Total Files: ${analysis.totalFiles}\n`;
    output += `  Total Imports: ${analysis.totalImports}\n`;
    output += `  Static: ${analysis.summary.static} | `;
    output += `Dynamic: ${analysis.summary.dynamic} | `;
    output += `Lazy: ${analysis.summary.lazy} | `;
    output += `Require: ${analysis.summary.require}\n\n`;

    output += '-'.repeat(50) + '\n\n';

    for (const [filePath, fileImports] of Object.entries(analysis.files)) {
      output += `${this.formatFilePath(filePath)}\n`;

      const allImports = [
        ...fileImports.static.map((imp) => ({ ...imp, typeLabel: 'STATIC' })),
        ...fileImports.dynamic.map((imp) => ({ ...imp, typeLabel: 'DYNAMIC' })),
        ...fileImports.lazy.map((imp) => ({ ...imp, typeLabel: 'LAZY' })),
        ...fileImports.require.map((imp) => ({ ...imp, typeLabel: 'REQUIRE' })),
      ];

      if (allImports.length === 0) {
        output += '  No imports found\n';
      } else {
        for (const imp of allImports) {
          output += `  [${imp.typeLabel}]   ${imp.module}`;

          if (imp.specifiers && imp.specifiers.length > 0) {
            output += ` (${imp.kind || 'named'}): ${imp.specifiers.join(', ')}`;
          }

          output += ` (line ${imp.line})\n`;
        }
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Format file path for display
   */
  private formatFilePath(filePath: string): string {
    // Extract relative path if possible
    return filePath;
  }

  /**
   * Format import type with icon
   */
  private formatImportType(type: string): string {
    const icons: Record<string, string> = {
      static: '📦',
      dynamic: '⚡',
      lazy: '🔄',
      require: '📥',
    };

    return icons[type] || '📄';
  }

  /**
   * Write text to file
   */
  writeToFile(data: string, outputPath: string): void {
    fs.writeFileSync(outputPath, data, 'utf-8');
  }
}
