// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ConferenceReport from '../components/ConferenceReport';
import type { Comparison } from '../types';

afterEach(cleanup);
const comparison = {
  id: 'test', title: 'Fechamento', createdAt: '2026-10-07T12:00:00Z',
  period: { month: 10, year: 2026, partner: { name: 'Parceira teste' } },
  fileAName: 'a.csv', fileBName: 'b.xlsx', totalA: 2, totalB: 1,
  matchedCount: 0, onlyACount: 1, onlyBCount: 0, reviewCount: 1,
  entries: [
    { id: '1', originalA: 'José Silva', originalB: 'Jose da Silva', occurrencesA: 2, occurrencesB: 1, similarity: 90, status: 'REVIEW' },
    { id: '2', originalA: 'Ana Costa', originalB: null, occurrencesA: 1, occurrencesB: null, similarity: null, status: 'ONLY_A' },
  ],
} as Comparison;
function setup() {
  const onReview = vi.fn().mockResolvedValue(undefined);
  const onExport = vi.fn().mockResolvedValue(undefined);
  render(<ConferenceReport comparison={comparison} onReview={onReview} reviewing={false} onExport={onExport} />);
  return { onReview, onExport };
}
describe('Relatório de conferência', () => {
  it('busca ignorando acentos e limpa filtros sem perder registros', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'JOSE' } });
    expect(screen.queryByText('Ana Costa')).toBeNull();
    expect(screen.getByText('José Silva')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'inexistente' } });
    fireEvent.click(screen.getByText('Limpar filtros'));
    expect(screen.getByText('Ana Costa')).toBeTruthy();
  });
  it('filtra diferenças de ocorrências somente para pares', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Ocorrências diferentes entre as bases'));
    expect(screen.queryByText('Ana Costa')).toBeNull();
    expect(screen.getByText('José Silva')).toBeTruthy();
  });
  it('envia a decisão e o registro correto para revisão', () => {
    const { onReview } = setup();
    fireEvent.click(screen.getByText('Mesmo cliente'));
    expect(onReview).toHaveBeenCalledWith(true, comparison.entries[0]);
    fireEvent.click(screen.getByText('Clientes diferentes'));
    expect(onReview).toHaveBeenCalledWith(false, comparison.entries[0]);
  });
});
