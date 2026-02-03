import type { ImporterResult, ProjectAnalysis, Import } from '../types.js';
import fs from 'fs';

/**
 * JSON Output Generator
 */
export class JSONGenerator {
  /**
   * Generate JSON output for findFilesImporting results
   */
  generateFromFindResults(results: ImporterResult[], moduleName: string): string {
    const output = {
      query: moduleName,
      totalFiles: results.length,
      files: results.map((result) => ({
        file: result.file,
        imports: result.imports.map((imp) => this.formatImport(imp)),
      })),
    };

    return JSON.stringify(output, null, 2);
  }

  /**
   * Generate JSON output for project analysis
   */
  generateFromAnalysis(analysis: ProjectAnalysis): string {
    const output = {
      summary: {
        totalFiles: analysis.totalFiles,
        totalImports: analysis.totalImports,
        breakdown: analysis.summary,
      },
      files: analysis.files,
    };

    return JSON.stringify(output, null, 2);
  }

  /**
   * Format import for JSON output
   */
  private formatImport(importData: Import): any {
    return {
      module: importData.module,
      type: importData.type,
      line: importData.line,
      column: importData.column,
      specifiers: importData.specifiers,
      kind: importData.kind,
      raw: importData.raw,
    };
  }

  /**
   * Write JSON to file
   */
  writeToFile(data: string, outputPath: string): void {
    fs.writeFileSync(outputPath, data, 'utf-8');
  }
}
