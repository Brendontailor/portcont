import * as XLSX from 'xlsx';
import type { Buffer } from 'node:buffer';
import type { ParseResult, ParsedClient, ParserOptions, ColumnCandidate } from './parser.types.js';
import { normalizeName } from '../matching/normalizeName.service.js';

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

function findNameColumn(worksheet: XLSX.WorkSheet): ColumnCandidate | null {
  const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });
  if (jsonData.length < 2) return null;

  const headers = jsonData[0] as string[];
  const dataRows = jsonData.slice(1);
  const numCols = headers.length;

  const candidates: ColumnCandidate[] = [];

  for (let col = 0; col < numCols; col++) {
    const header = headers[col] ? normalizeHeader(String(headers[col])) : `col_${col}`;
    const columnValues = dataRows.map(row => row[col] ? String(row[col]) : '').filter(v => v);

    const normalizedHeader = header.toLowerCase();
    let matchedKeyword = false;

    for (const keyword of NAME_HEADER_KEYWORDS) {
      if (normalizedHeader.includes(keyword)) {
        matchedKeyword = true;
        break;
      }
    }

    const contentConfidence = calculateColumnConfidence(columnValues);
    const confidence = matchedKeyword ? 80 + contentConfidence * 0.5 : contentConfidence;

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
  if (best && best.confidence >= 40) {
    return best;
  }

  return null;
}

function cleanCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  return str.replace(/\s+/g, ' ');
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

export async function parseExcel(buffer: Buffer, options: ParserOptions): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      warnings.push('Planilha vazia.');
      return { clients: [], extractedRecords: 0, possiblyIncomplete: false, warnings };
    }

    const column = findNameColumn(worksheet);

    if (!column) {
      warnings.push('Não foi possível identificar a coluna de clientes automaticamente.');
      return { clients: [], extractedRecords: 0, possiblyIncomplete: false, warnings };
    }

    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    const clientsMap = new Map<string, ParsedClient>();

    for (const row of jsonData) {
      const keys = Object.keys(row);
      const value = row[keys[column.index]];
      const cleaned = cleanCellValue(value);

      if (!cleaned || !isLikelyName(cleaned)) continue;

      const normalized = normalizeName(cleaned);
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
    throw new Error(`Erro ao processar planilha: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}