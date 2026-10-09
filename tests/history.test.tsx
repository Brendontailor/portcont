// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/Header', () => ({ default: () => <header /> }));
vi.mock('@/services/api', () => ({ api: { comparisons: { list: vi.fn(), delete: vi.fn() } } }));

import HistoricoPage from '../app/historico/page';
import { api } from '../services/api';
import type { Comparison } from '../types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const comparison = {
  id: 'comparison-to-delete',
  title: 'Conferência errada',
  fileAName: 'nossa.xlsx',
  fileBName: 'parceira.pdf',
  totalA: 2,
  totalB: 2,
  matchedCount: 1,
  onlyACount: 1,
  onlyBCount: 1,
  reviewCount: 0,
  declaredA: 2,
  declaredB: 2,
  incompleteA: false,
  incompleteB: false,
  createdAt: '2026-10-09T10:00:00Z',
  updatedAt: '2026-10-09T10:00:00Z',
  periodId: 'period-1',
  period: { id: 'period-1', month: 10, year: 2026, partner: { id: 'partner-1', name: 'Alltec', slug: 'alltec' } },
  entries: [],
  sourceFiles: [],
  clients: [],
} as Comparison;

describe('exclusão no histórico', () => {
  it('confirma, exclui a comparação errada e atualiza o histórico', async () => {
    vi.mocked(api.comparisons.list)
      .mockResolvedValueOnce({ items: [comparison], total: 1, page: 1, limit: 20, totalPages: 1 })
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    vi.mocked(api.comparisons.delete).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<HistoricoPage />);
    const deleteButton = await screen.findByRole('button', { name: 'Excluir comparação de Alltec, 10/2026' });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(api.comparisons.delete).toHaveBeenCalledWith(comparison.id));
    expect(screen.getByText('Nenhuma comparação encontrada')).toBeTruthy();
  });

  it('não exclui quando a confirmação é cancelada', async () => {
    vi.mocked(api.comparisons.list).mockResolvedValue({ items: [comparison], total: 1, page: 1, limit: 20, totalPages: 1 });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<HistoricoPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir comparação de Alltec, 10/2026' }));

    expect(api.comparisons.delete).not.toHaveBeenCalled();
  });
});
