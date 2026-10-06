import pdfParse from 'pdf-parse';
import type { Buffer } from 'node:buffer';
import type { ParseResult, ParsedClient, ParserOptions } from './parser.types.js';

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
  /^visualizar\s*\(/i,
  /^status$/i,
  /^sn\s*\/\s*mac$/i,
  /^pesquisar$/i,
  /^mais\s*filtros$/i,
  /^importar\s*\/\s*exportar$/i,
  /^página\s+\d+\s+de\s+\d+/i,
  /^configured\s+onus?$/i,
  /^smartolt$/i,
  /^\d+-\d+\s+onus?\s+de\s+\d+\s+exibidas?$/i,
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
  return normalizeWhitespace(line.replace(/[^\p{L}\p{N}\s\-'.]/gu, '').trim());
}

function isLikelyName(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (words.length > 10) return false;
  const hasLetters = /[\p{L}]/u.test(text);
  const hasOnlyNumbers = /^[\d\s\-\.]+$/.test(text);
  return hasLetters && !hasOnlyNumbers && !isTechnicalIdentifier(text);
}

export async function parsePDF(buffer: Buffer, options: ParserOptions): Promise<ParseResult> {
  const warnings: string[] = [];
  let declaredRecords: number | undefined;

  try {
    const data = await pdfParse(buffer);
    const fullText = data.text;
    declaredRecords = extractDeclaredRecords(fullText);

    const lines = fullText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const nameBuffers: string[] = [];
    const clientsMap = new Map<string, ParsedClient>();

    for (const line of lines) {
      if (shouldIgnoreLine(line)) continue;

      if (isTechnicalIdentifier(line)) {
        if (nameBuffers.length > 0) {
          const fullName = nameBuffers.join(' ').trim();
          const cleaned = removePrefixes(fullName);
          if (isLikelyName(cleaned)) {
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
          nameBuffers.length = 0;
        }
        continue;
      }

      const cleaned = cleanLine(line);
      if (!cleaned) continue;

      if (isLikelyName(cleaned)) {
        nameBuffers.push(cleaned);
      }
    }

    if (nameBuffers.length > 0) {
      const fullName = nameBuffers.join(' ').trim();
      const cleaned = removePrefixes(fullName);
      if (isLikelyName(cleaned)) {
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
    }

    const clients = Array.from(clientsMap.values());
    const extractedRecords = clients.length;
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
  } catch (error) {
    throw new Error(`Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}