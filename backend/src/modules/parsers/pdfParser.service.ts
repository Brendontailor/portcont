import pdfParse from 'pdf-parse';
import type { Buffer } from 'node:buffer';
import type { ParseResult, ParsedClient, ParserOptions } from './parser.types.js';
import { normalizeName } from '../matching/normalizeName.service.js';

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

const IGNORE_LINES = [
  /^status$/i,
  /^status\s+visualizar\s+nome/i,
  /^sn\s*\/\s*mac$/i,
  /^sn,\s*ip,\s*nome/i,
  /^pesquisar$/i,
  /^mais\s*filtros$/i,
  /^importar\s*\/\s*exportar$/i,
  /^página\s+\d+\s+de\s+\d+/i,
  /^configured\s+onus?$/i,
  /^onus\s+configurados$/i,
  /^(?:\d+\s*[-–—]\s*)?olt[a-z0-9_-]*\b/i,
  /^(?:placa|porta|zona|cto|vlan|tipo\s+onu|perfil|tipo\s+pon|setor)\b/i,
  /^smartolt$/i,
  /^smartolt\s+v/i,
  /^\d+-\d+\s+onus?\s+de\s+\d+\s+exibidas?$/i,
  /^https?:\/\//i,
];

const PREFIXES_TO_REMOVE = [
  /^RGSUL\s*-\s*/i,
  /^REDE\s+RGSUL\s*-\s*/i,
  /^RGSUL\s*-/i,
  /^REDE\s+RGSUL\s*-/i,
];

function isTechnicalIdentifier(text: string): boolean {
  const trimmed = text.trim();
  return TECHNICAL_PATTERNS.some(pattern => pattern.test(trimmed));
}

function shouldIgnoreLine(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  const compact = trimmed.replace(/[^\p{L}\p{N}]/gu, '');
  if (compact.startsWith('maisfiltrosimportar') || compact.startsWith('statusvisualizarnomesnmac')) return true;
  return IGNORE_LINES.some(pattern => pattern.test(trimmed));
}

function removePrefixes(name: string): string {
  let result = name;
  for (const prefix of PREFIXES_TO_REMOVE) {
    result = result.replace(prefix, '');
  }
  return result.trim();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractDeclaredRecords(text: string): number | undefined {
  const match = text.match(/(\d+)\s*-\s*(\d+)\s+onus?\s+de\s+(\d+)\s+exibidas?/i);
  if (match) {
    return parseInt(match[3], 10);
  }
  return undefined;
}

function cleanLine(line: string): string {
  let cleaned = line;
  // SmartOLT's PDF text often puts the action label and ONU path directly
  // before the customer's name. Remove only that UI fragment, preserving the
  // actual name which follows it on the same line.
  cleaned = cleaned.replace(/visualizar\s*\(\s*\/onu\/view\/\d+\s*\)/gi, ' ');
  cleaned = cleaned.replace(/\(?\/onu\/view\/\d+\)?/gi, ' ');
  for (const pattern of TECHNICAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  cleaned = cleaned.replace(/\b(?:HWTC|FHTT|ZTEG|ITBS|DD18|MONU|UBNT)[A-Z0-9]{6,}\b/gi, ' ');
  // PDFs from SmartOLT can concatenate toolbar labels into one text line.
  cleaned = cleaned.replace(/\b(?:mais\s*filtros|importar\s*\/\s*exportar|exportar|pesquisar|status|visualizar|nome|sn\s*\/\s*mac|sn\s+mac|tipo\s+onu|tipo\s+pon|perfil|setor|porta|placa|zona|cto|vlan)\b/gi, ' ');
  cleaned = cleaned.replace(/\b\d+\s*[-–—]\s*olt[a-z0-9_-]*\b/gi, ' ');
  cleaned = cleaned.replace(/\b(?:qu\.{2,}|qualquer)\b/gi, ' ');
  return normalizeWhitespace(cleaned.replace(/[^\p{L}\p{N}\s\-'.]/gu, '').trim());
}

function isLikelyName(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (words.length === 2 && words.every(word => /^[\p{L}]$/u.test(word))) return false;
  if (words.length > 10) return false;
  const hasLetters = /[\p{L}]/u.test(text);
  const hasOnlyNumbers = /^[\d\s\-\.]+$/.test(text);
  const tokens = words.map(word => word.toLocaleLowerCase('pt-BR'));
  const uiTokens = new Set(['tipo', 'onu', 'pon', 'perfil', 'qualquer', 'setor', 'porta', 'placa', 'zona', 'cto', 'vlan', 'olt', 'status', 'visualizar', 'nome', 'sn', 'mac', 'filtros', 'importar', 'exportar', 'pesquisar']);
  if (tokens.some(token => uiTokens.has(token))) return false;
  return hasLetters && !hasOnlyNumbers && !isTechnicalIdentifier(text);
}

function registerClient(clientsMap: Map<string, ParsedClient>, fullName: string) {
  const cleaned = removePrefixes(normalizeWhitespace(fullName));
  if (!isLikelyName(cleaned)) return;
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

export function extractClientsFromPdfText(fullText: string): ParseResult {
  const warnings: string[] = [];
  const declaredRecords = extractDeclaredRecords(fullText);

  const lines = fullText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const nameBuffers: string[] = [];
  const clientsMap = new Map<string, ParsedClient>();
  let currentRowHasViewLink = false;
  let currentViewId: string | null = null;

  const flushBuffer = () => {
    if (nameBuffers.length > 0) {
      registerClient(clientsMap, nameBuffers.join(' '));
      nameBuffers.length = 0;
    }
    currentRowHasViewLink = false;
  };

  for (const sourceLine of lines) {
    const firstCodePoint = sourceLine.codePointAt(0) ?? 0;
    const hasRowIcon = firstCodePoint >= 0xe000 && firstCodePoint <= 0xf8ff;
    const hasInlineSerial = /\b(?:HWTC|FHTT|ZTEG|ITBS|DD18|MONU|UBNT)[A-Z0-9]{6,}\b/i.test(sourceLine);
    const hasViewLink = /\/onu\/view\/\d+/i.test(sourceLine);
    let iconPrefixLength = 0;
    if (hasRowIcon) {
      for (const char of sourceLine) {
        const codePoint = char.codePointAt(0) ?? 0;
        if ((codePoint >= 0xe000 && codePoint <= 0xf8ff) || /\s/u.test(char)) iconPrefixLength += char.length;
        else break;
      }
    }
    const line = hasRowIcon ? sourceLine.slice(iconPrefixLength) : sourceLine;
    if (hasRowIcon) {
      flushBuffer();
      currentViewId = null;
    }
    const viewId = sourceLine.match(/\/onu\/view\/(\d+)/i)?.[1] ?? null;
    if (viewId && currentViewId && viewId !== currentViewId) flushBuffer();
    if (viewId) currentViewId = viewId;
    if (hasInlineSerial && currentRowHasViewLink && nameBuffers.length > 0) flushBuffer();
    if (hasViewLink) currentRowHasViewLink = true;
    if (!line) continue;
    // SmartOLT emits a connection/status glyph at the beginning of every ONU
    // row. It is the most reliable row boundary for names wrapped around the
    // view link in PDFs.
    if (line.length <= 12 && !/[\p{L}\p{N}]/u.test(line)) {
      flushBuffer();
      continue;
    }
    // The visualizer action can be a standalone row between two lines of one
    // wrapped customer name. Ignore the action-only line, but keep any name
    // text extracted after its link when PDF text has merged the columns.
    if (/^visualizar\s*\(/i.test(line) && !cleanLine(line)) continue;
    if (shouldIgnoreLine(line)) continue;

    if (isTechnicalIdentifier(line)) {
      flushBuffer();
      continue;
    }

    const cleaned = cleanLine(line);
    if (!cleaned) continue;

    const isSingleWordContinuation = nameBuffers.length > 0 && /^[\p{L}'-]+$/u.test(cleaned);
    if (isLikelyName(cleaned) || isSingleWordContinuation) {
      nameBuffers.push(cleaned);
    } else {
      flushBuffer();
    }
  }
  flushBuffer();

  const clients = Array.from(clientsMap.values());
  const extractedRecords = clients.reduce((total, client) => total + client.occurrences, 0);
  const possiblyIncomplete = declaredRecords !== undefined && extractedRecords < declaredRecords;

  if (possiblyIncomplete) {
    warnings.push(
      `ATENÇÃO: este arquivo pode estar incompleto. O documento informa ${declaredRecords} registros, mas apenas ${extractedRecords} foram encontrados no arquivo enviado.`
    );
  }

  if (clients.length === 0) {
    warnings.push('Não foi possível identificar clientes neste arquivo.');
  }

  return {
    clients,
    declaredRecords,
    extractedRecords,
    possiblyIncomplete,
    warnings,
  };
}

export async function parsePDF(buffer: Buffer, _options: ParserOptions): Promise<ParseResult> {
  try {
    const data = await pdfParse(buffer);
    return extractClientsFromPdfText(data.text);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid PDF structure')) {
      throw new Error('Não foi possível processar o arquivo. O PDF parece estar corrompido ou protegido.');
    }
    throw new Error(`Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}
