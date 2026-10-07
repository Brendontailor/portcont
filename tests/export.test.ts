import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
vi.mock('../backend/src/lib/prisma.js', () => ({ prisma: { comparison: { findUnique: vi.fn() } } }));
import { prisma } from '../backend/src/lib/prisma.js';
import { generateComparisonXLSX } from '../backend/src/modules/export/export.service';
describe('Exportação detalhada', () => {
  it('inclui parceira, competência, ocorrências e filtros no Excel', async () => {
    vi.mocked(prisma.comparison.findUnique).mockResolvedValue({
      id: 'report', title: 'Fechamento', createdAt: new Date('2026-10-07T12:00:00Z'),
      period: { year: 2026, month: 10, partner: { name: 'Parceira exemplo' } },
      entries: [{ originalA: 'João', originalB: 'Joao', normalizedA: 'JOAO', normalizedB: 'JOAO', occurrencesA: 3, occurrencesB: 1, similarity: 100, status: 'MATCHED' }],
      clients: [], totalA: 1, totalB: 1, matchedCount: 1, onlyACount: 0, onlyBCount: 0, reviewCount: 0,
    } as never);
    const buffer = await generateComparisonXLSX('report');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const summary = XLSX.utils.sheet_to_json(wb.Sheets.Resumo, { header: 1 });
    expect(summary).toContainEqual(['Parceira', 'Parceira exemplo']);
    expect(summary).toContainEqual(['Competência', '10/2026']);
    const detail = wb.Sheets['Conferência detalhada'];
    expect(XLSX.utils.sheet_to_json(detail, { header: 1 })).toContainEqual(['Nas duas bases', 'João', 'Joao', 3, 1, 2, 100, 'JOAO', 'JOAO', 'Ocorrências diferentes']);
    expect(detail['!autofilter']).toBeTruthy();
    expect(wb.SheetNames).toContain('Como interpretar');
  });
  it('não exporta comparação inexistente', async () => {
    vi.mocked(prisma.comparison.findUnique).mockResolvedValue(null);
    expect(await generateComparisonXLSX('missing')).toBeNull();
  });
});
