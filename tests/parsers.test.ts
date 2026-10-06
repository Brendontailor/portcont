import { describe, it, expect } from 'vitest';
import { parsePDF } from '../backend/src/modules/parsers/pdfParser.service.js';
import { parseExcel } from '../backend/src/modules/parsers/excelParser.service.js';
import * as XLSX from 'xlsx';

describe('PDF Parser', () => {
  it('should extract name from multi-line format', async () => {
    const pdfContent = `
Visualizar (/onu/view/2319)
ROSANGELA BARBOSA
DOS REIS
HWTCAE7D9AB4
`;
    const buffer = Buffer.from(pdfContent);
    const result = await parsePDF(buffer, { fileName: 'test.pdf', mimeType: 'application/pdf' });
    expect(result.clients.some(c => c.normalizedName === 'ROSANGELA BARBOSA DOS REIS')).toBe(true);
  });

  it('should extract name with RGSUL prefix', async () => {
    const pdfContent = `
Visualizar (/onu/view/11947)
RGSUL - ADRIANA DE
AVILA GONCALVES
HWTCC123456
`;
    const buffer = Buffer.from(pdfContent);
    const result = await parsePDF(buffer, { fileName: 'test.pdf', mimeType: 'application/pdf' });
    expect(result.clients.some(c => c.normalizedName === 'ADRIANA DE AVILA GONCALVES')).toBe(true);
  });

  it('should extract name with REDE RGSUL prefix', async () => {
    const pdfContent = `
REDE RGSUL - JULIO
ROSA PORTO
HWTC...
`;
    const buffer = Buffer.from(pdfContent);
    const result = await parsePDF(buffer, { fileName: 'test.pdf', mimeType: 'application/pdf' });
    expect(result.clients.some(c => c.normalizedName === 'JULIO ROSA PORTO')).toBe(true);
  });

  it('should detect incomplete PDF', async () => {
    const pdfContent = `
1-100 ONUs de 295 exibidas
JOAO SILVA
MARIA SANTOS
`;
    const buffer = Buffer.from(pdfContent);
    const result = await parsePDF(buffer, { fileName: 'test.pdf', mimeType: 'application/pdf' });
    expect(result.declaredRecords).toBe(295);
    expect(result.possiblyIncomplete).toBe(true);
    expect(result.warnings.some(w => w.includes('incompleto'))).toBe(true);
  });

  it('should ignore technical identifiers', async () => {
    const pdfContent = `
HWTCAE7D9AB4
FHTT09E6A920
ZTEGCCEBC343
ITBS5F446CCD
JOAO SILVA
`;
    const buffer = Buffer.from(pdfContent);
    const result = await parsePDF(buffer, { fileName: 'test.pdf', mimeType: 'application/pdf' });
    expect(result.clients.length).toBe(1);
    expect(result.clients[0].normalizedName).toBe('JOAO SILVA');
  });

  it('should deduplicate same name', async () => {
    const pdfContent = `
BRUNA MELLO ASSIS
HWTC111
BRUNA MELLO ASSIS
HWTC222
`;
    const buffer = Buffer.from(pdfContent);
    const result = await parsePDF(buffer, { fileName: 'test.pdf', mimeType: 'application/pdf' });
    const client = result.clients.find(c => c.normalizedName === 'BRUNA MELLO ASSIS');
    expect(client).toBeDefined();
    expect(client!.occurrences).toBe(2);
  });
});

describe('Excel Parser', () => {
  it('should detect name column by header', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'ONU', 'Status'],
      ['JOÃO SILVA', 'HWTC111', 'Ativo'],
      ['MARIA SANTOS', 'HWTC222', 'Ativo'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseExcel(buffer, { fileName: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(result.clients.length).toBe(2);
  });

  it('should detect name column by content when no header', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Col1', 'Col2', 'Col3'],
      ['HWTC111', 'JOÃO SILVA', 'Ativo'],
      ['HWTC222', 'MARIA SANTOS', 'Ativo'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseExcel(buffer, { fileName: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(result.clients.length).toBe(2);
  });
});