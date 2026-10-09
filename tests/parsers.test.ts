import { describe, it, expect } from 'vitest';
import { parsePDF, extractClientsFromPdfText } from '../backend/src/modules/parsers/pdfParser.service.js';
import { parseExcel } from '../backend/src/modules/parsers/excelParser.service.js';
import { parseCSV } from '../backend/src/modules/parsers/csvParser.service.js';
import * as XLSX from 'xlsx';

describe('PDF Parser — extração de texto', () => {
  it('should extract name from multi-line format', () => {
    const text = `
Visualizar (/onu/view/2319)
ROSANGELA BARBOSA
DOS REIS
HWTCAE7D9AB4
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.some(c => c.normalizedName === 'ROSANGELA BARBOSA DOS REIS')).toBe(true);
  });

  it('should extract name with RGSUL prefix', () => {
    const text = `
Visualizar (/onu/view/11947)
RGSUL - ADRIANA DE
AVILA GONCALVES
HWTCC123456
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.some(c => c.normalizedName === 'ADRIANA DE AVILA GONCALVES')).toBe(true);
  });

  it('should extract name with REDE RGSUL prefix', () => {
    const text = `
REDE RGSUL - JULIO
ROSA PORTO
HWTC12345678
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.some(c => c.normalizedName === 'JULIO ROSA PORTO')).toBe(true);
  });

  it('should extract SmartOLT names when SN/MAC is on the same line', () => {
    const text = `
ONUs Configurados
SN, IP, nome, endereço, nº telefone, usuário ppp
OLT 1 - OLT_ZTE…
Status Visualizar Nome SN / MAC
 ROSANGELA BARBOSA HWTCAE7D9AB4
Visualizar (/onu/view/2319)
DOS REIS
(/onu/view/2319)
 MARIA APARECIDA FHTT09473B52
Visualizar (/onu/view/671)
DEBLE PEREIRA
(/onu/view/671)
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.some(c => c.normalizedName === 'ROSANGELA BARBOSA DOS REIS')).toBe(true);
    expect(result.clients.some(c => c.normalizedName === 'MARIA APARECIDA DEBLE PEREIRA')).toBe(true);
    expect(result.clients.some(c => c.normalizedName.includes('HWTCAE7D9AB4'))).toBe(false);
  });

  it('should detect incomplete PDF', () => {
    const text = `
1-100 ONUs de 295 exibidas
JOAO SILVA
MARIA SANTOS
`;
    const result = extractClientsFromPdfText(text);
    expect(result.declaredRecords).toBe(295);
    expect(result.possiblyIncomplete).toBe(true);
    expect(result.warnings.some(w => w.includes('incompleto'))).toBe(true);
  });

  it('should ignore technical identifiers', () => {
    const text = `
HWTCAE7D9AB4
FHTT09E6A920
ZTEGCCEBC343
ITBS5F446CCD
JOAO SILVA
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.length).toBe(1);
    expect(result.clients[0].normalizedName).toBe('JOAO SILVA');
  });

  it('should deduplicate same name', () => {
    const text = `
BRUNA MELLO ASSIS
HWTC11111111
BRUNA MELLO ASSIS
HWTC22222222
`;
    const result = extractClientsFromPdfText(text);
    const client = result.clients.find(c => c.normalizedName === 'BRUNA MELLO ASSIS');
    expect(client).toBeDefined();
    expect(client!.occurrences).toBe(2);
    expect(result.extractedRecords).toBe(2);
  });

  it('should ignore UI headers and pagination', () => {
    const text = `
SmartOLT
Configured ONUs
Pesquisar
Mais filtros
Status
SN / MAC
Página 1 de 8
1-20 ONUs de 295 exibidas
JOAO SILVA
HWTC11111111
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.length).toBe(1);
    expect(result.clients[0].normalizedName).toBe('JOAO SILVA');
  });

  it('does not extract SmartOLT filters, toolbar text, or OLT labels as customers', () => {
    const text = `
Tipo ONU Qu…
Tipo PON Qu…
1 - OLTZTE...
Mais filtrosImportar Exportar StatusVisualizarNomeSN MAC
Status Visualizar Nome SN / MAC
JOAO DA SILVA
HWTCAE7D9AB4
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.map(client => client.normalizedName)).toEqual(['JOAO DA SILVA']);
  });

  it('preserves customer names printed on the same line as the SmartOLT view link', () => {
    const text = `
1-3 ONUs de 3 exibidas
Status Visualizar Nome SN / MAC

(/onu/view/2319)
Visualizar (/onu/view/2319) ROSANGELA BARBOSA
DOS REIS
HWTCAE7D9AB4

(/onu/view/2300)
Visualizar (/onu/view/2300) ARTUR COELHO
RODRIGUES
HWTC803CCFB3

(/onu/view/66)
Visualizar (/onu/view/66) eberson bierci ferraz FHTT04AB6CB8
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.map(client => client.normalizedName)).toEqual([
      'ROSANGELA BARBOSA DOS REIS',
      'ARTUR COELHO RODRIGUES',
      'EBERSON BIERCI FERRAZ',
    ]);
    expect(result.extractedRecords).toBe(3);
    expect(result.declaredRecords).toBe(3);
    expect(result.possiblyIncomplete).toBe(false);
  });

  it('separates SmartOLT records by ONU links and inline serials even without status icons', () => {
    const text = `
1-3 ONUs de 3 exibidas
Visualizar (/onu/view/1) ROSANGELA BARBOSA
DOS REIS
(/onu/view/1)
Visualizar (/onu/view/2) ARTUR COELHO HWTC803CCFB3
RODRIGUES
(/onu/view/2)
Visualizar (/onu/view/3) EBERSON BIERCI FERRAZ FHTT04AB6CB8
`;
    const result = extractClientsFromPdfText(text);
    expect(result.clients.map(client => client.normalizedName)).toEqual([
      'ROSANGELA BARBOSA DOS REIS',
      'ARTUR COELHO RODRIGUES',
      'EBERSON BIERCI FERRAZ',
    ]);
    expect(result.extractedRecords).toBe(3);
    expect(result.possiblyIncomplete).toBe(false);
  });

  it('uses each different SmartOLT ONU view ID as a row boundary', () => {
    const result = extractClientsFromPdfText(`
1-2 ONUs de 2 exibidas
Visualizar (/onu/view/100) ANA COSTA
(/onu/view/100)
Visualizar (/onu/view/101) MARIA SANTOS
(/onu/view/101)
`);
    expect(result.clients.map(client => client.normalizedName)).toEqual(['ANA COSTA', 'MARIA SANTOS']);
    expect(result.extractedRecords).toBe(2);
    expect(result.possiblyIncomplete).toBe(false);
  });

  it('should reject invalid PDF binary with friendly error', async () => {
    const buffer = Buffer.from('isto nao e um pdf valido');
    await expect(parsePDF(buffer, { fileName: 'test.pdf', mimeType: 'application/pdf' }))
      .rejects
      .toThrow('Não foi possível processar o arquivo');
  });
});

describe('Excel Parser', () => {
  it('should detect name column by header', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'ONU', 'Status'],
      ['JOÃO SILVA', 'HWTCAE7D9AB4', 'Ativo'],
      ['MARIA SANTOS', 'FHTT09E6A920', 'Ativo'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseExcel(buffer, { fileName: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(result.clients.length).toBe(2);
    expect(result.clients.some(c => c.normalizedName === 'JOAO SILVA')).toBe(true);
  });

  it('should detect name column by content when no header', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Col1', 'Col2', 'Col3'],
      ['HWTC11111111', 'JOÃO SILVA', 'Ativo'],
      ['HWTC22222222', 'MARIA SANTOS', 'Ativo'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseExcel(buffer, { fileName: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(result.clients.length).toBe(2);
    expect(result.clients.some(c => c.normalizedName === 'JOAO SILVA')).toBe(true);
  });

  it('should return warning when no column looks like names', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Serial', 'Porta'],
      ['HWTC11111111', '1'],
      ['HWTC22222222', '2'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseExcel(buffer, { fileName: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(result.clients.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('CSV Parser', () => {
  it('should parse CSV and deduplicate names', async () => {
    const csv = `Cliente,Serial
"ITEST JOÃO DA SILVA",HWTC111
"ITEST JOÃO DA SILVA",HWTC112
"ITEST MARIA SANTOS",HWTC113
`;
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer, { fileName: 'test.csv', mimeType: 'text/csv' });
    expect(result.clients.length).toBe(2);
    const joao = result.clients.find(c => c.normalizedName === 'ITEST JOAO DA SILVA');
    expect(joao!.occurrences).toBe(2);
  });

  it('should detect name column by content when no header keyword', async () => {
    const csv = `X,Y
"HWTC11111111","JOÃO SILVA"
"HWTC22222222","MARIA SANTOS"
`;
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer, { fileName: 'test.csv', mimeType: 'text/csv' });
    expect(result.clients.length).toBe(2);
  });
});
