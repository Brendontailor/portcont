import type { ParseResult, ParserOptions } from './parser.types.js';
import { parsePDF } from './pdfParser.service.js';
import { parseExcel } from './excelParser.service.js';
import { parseCSV } from './csvParser.service.js';

export type { ParseResult, ParserOptions, ParsedClient, ColumnCandidate } from './parser.types.js';

export async function parseFile(buffer: Buffer, options: ParserOptions): Promise<ParseResult> {
  const mimeType = options.mimeType.toLowerCase();

  if (mimeType === 'application/pdf') {
    return parsePDF(buffer, options);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return parseExcel(buffer, options);
  }

  if (mimeType === 'text/csv' || mimeType === 'application/csv') {
    return parseCSV(buffer, options);
  }

  throw new Error(`Formato de arquivo não suportado: ${options.mimeType}`);
}

export function getSupportedMimeTypes(): string[] {
  return [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
  ];
}

export function getSupportedExtensions(): string[] {
  return ['.pdf', '.xlsx', '.xls', '.csv'];
}