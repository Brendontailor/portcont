import { parse } from 'csv-parse/sync';
import type { Buffer } from 'node:buffer';
import type { ParseResult, ParsedClient, ParserOptions, ColumnCandidate } from './parser.types.js';

const NAME_HEADER_KEYWORDS = [
  'nome',
  'cliente',
  'nome cliente',
  'nome do cliente',
  'assinante',
  'subscriber',
  'customer',
  'razão social',
  'razao social',
];

const TECHNICAL_PATTERNS = [
  /^HWTC[A-Z0-9]{8,}$/i,
  /^FHTT[A-Z0-9]{8,}$/i,
  /^ZTEG[A-Z0-9]{8,}$/i,
  /^ITBS[A-Z0-9]{8,}$/i,
  /^DD18[A-Z0-9]{8,}$/i,
  /^MONU[A-Z0-9]{8,}$/i,
  /^UBNT[A-Z0-9]{8,}$/i,
  /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i,
  /^(\d{1,3}\.){3}\d{1,3}$/,
  /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i,
  /^https?:\/\//i,
  /^\d+$/,
  /^[A-Z0-9]{12,}$/i,
];

function isTechnicalIdentifier(text: string): boolean {
  const trimmed = text.trim();
  return TECHNICAL_PATTERNS.some(pattern => pattern.test(trimmed));
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function calculateColumnConfidence(values: string[]): number {
  if (values.length === 0) return 0;

  let score = 0;
  let stringCount = 0;
  let multiWordCount = 0;
  let technicalCount = 0;
  let numericCount = 0;

  for (const val of values) {
    const trimmed = val.trim();
    if (!trimmed) continue;

    if (isTechnicalIdentifier(trimmed)) {
      technicalCount++;
      continue;
    }

    if (/^\d+$/.test(trimmed)) {
      numericCount++;
      continue;
    }

    stringCount++;
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) multiWordCount++;
  }

  const total = values.length;
  const stringRatio = stringCount / total;
  const multiWordRatio = multiWordCount / Math.max(stringCount, 1);
  const technicalRatio = technicalCount / total;
  const numericRatio = numericCount / total;

  if (stringRatio > 0.7) score += 40;
  else if (stringRatio > 0.5) score += 20;

  if (multiWordRatio > 0.6) score += 30;
  else if (multiWordRatio > 0.3) score += 15;

  if (technicalRatio > 0.3) score -= 40;
  if (numericRatio > 0.5) score -= 30;

  return Math.max(0, Math.min(100, score));
}

function findNameColumn(headers: string[], rows: string[][]): ColumnCandidate | null {
  const numCols = headers.length;
  const candidates: ColumnCandidate[] = [];

  for (let col = 0; col < numCols; col++) {
    const header = headers[col] ? normalizeHeader(headers[col]) : `col_${col}`;
    const columnValues = rows.map(row => row[col] ? String(row[col]) : '').filter(v => v);

    const normalizedHeader = header.toLowerCase();
    let confidence = 0;

    for (const keyword of NAME_HEADER_KEYWORDS) {
      if (normalizedHeader.includes(keyword)) {
        confidence += 80;
        break;
      }
    }

    const contentConfidence = calculateColumnConfidence(columnValues);
    confidence += contentConfidence * 0.5;

    const sampleValues = columnValues.slice(0, 5);

    candidates.push({
      index: col,
      header: headers[col] ? String(headers[col]) : `Coluna ${col + 1}`,
      confidence,
      sampleValues,
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  const best = candidates[0];
  if (best && best.confidence > 40) {
    return best;
  }

  return null;
}

function cleanCellValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isLikelyName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isTechnicalIdentifier(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return false;
  if (words.length > 10) return false;
  const hasLetters = /[\p{L}]/u.test(trimmed);
  const hasOnlyNumbers = /^[\d\s\-\.]+$/.test(trimmed);
  return hasLetters && !hasOnlyNumbers;
}

export async function parseCSV(buffer: Buffer, options: ParserOptions): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    const text = buffer.toString('utf-8');
    const records = parse(text, {
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as string[][];

    if (records.length < 2) {
      warnings.push('CSV vazio ou apenas cabeçalho.');
      return { clients: [], extractedRecords: 0, possiblyIncomplete: false, warnings };
    }

    const headers = records[0];
    const dataRows = records.slice(1);

    const column = findNameColumn(headers, dataRows);

    if (!column) {
      warnings.push('Não foi possível identificar a coluna de clientes automaticamente.');
      return { clients: [], extractedRecords: 0, possiblyIncomplete: false, warnings };
    }

    const clientsMap = new Map<string, ParsedClient>();

    for (const row of dataRows) {
      const value = row[column.index];
      if (!value) continue;

      const cleaned = cleanCellValue(value);
      if (!cleaned || !isLikelyName(cleaned)) continue;

      const normalized = cleaned.toUpperCase();
      const existing = clientsMap.get(normalized);
      if (existing) {
        existing.occurrences++;
      } else {
        clientsMap.set(normalized, {
          originalName: cleaned,
          normalizedName: normalized,
          occurrences: 1,
        });
      }
    }

    const clients = Array.from(clientsMap.values());
    const extractedRecords = clients.length;

    if (clients.length === 0) {
      warnings.push('Nenhum cliente válido encontrado na coluna identificada.');
    }

    return {
      clients,
      extractedRecords,
      possiblyIncomplete: false,
      warnings,
    };
  } catch (error) {
    throw new Error(`Erro ao processar CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}