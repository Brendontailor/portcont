'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { api } from '@/services/api';
import type { PaginatedComparisons, Comparison } from '@/types';
import { formatDateTime, formatFileSize } from '@/utils/helpers';
import styles from './page.module.css';

export default function HistoricoPage() {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const limit = 20;

  const loadComparisons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const periodId = new URLSearchParams(window.location.search).get('periodId') || undefined;
      const data = await api.comparisons.list(periodId, page, limit);
      setComparisons(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadComparisons();
  }, [loadComparisons]);

  const handleDelete = async (comparison: Comparison) => {
    const period = `${comparison.period.month.toString().padStart(2, '0')}/${comparison.period.year}`;
    const description = `${comparison.period.partner.name} · ${period} · ${comparison.title || 'Conferência de clientes'}`;
    if (!window.confirm(`Excluir esta comparação?\n${description}\n\nEsta ação não pode ser desfeita.`)) return;

    setDeletingId(comparison.id);
    setError(null);
    try {
      await api.comparisons.delete(comparison.id);
      if (comparisons.length === 1 && page > 1) {
        setPage(currentPage => currentPage - 1);
      } else {
        await loadComparisons();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir comparação');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Histórico de comparações</h1>
              <p className={styles.subtitle}>{total} {total === 1 ? 'comparação encontrada' : 'comparações encontradas'}</p>
            </div>
            <Link href="/" className={styles.newBtn}>Nova comparação</Link>
          </header>

          {error && (
            <div className={styles.error} role="alert">
              {error}
              <button onClick={loadComparisons} className={styles.retryBtn}>Tentar novamente</button>
            </div>
          )}

          {loading ? (
            <div className={styles.loading}>
              <div className="loading-spinner" />
              <p>Carregando histórico...</p>
            </div>
          ) : comparisons.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 3.5V6M16 3.5V6M4 9.5h16M8 13.5h5M8 16.5h8" />
                </svg>
              </span>
              <h2>Nenhuma comparação encontrada</h2>
              <p>As comparações realizadas aparecerão aqui.</p>
              <Link href="/" className={styles.newBtn}>Nova comparação</Link>
            </div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className="table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">Data</th>
                      <th scope="col">Parceira</th>
                      <th scope="col">Competência</th>
                      <th scope="col">Título</th>
                      <th scope="col">Arquivo A</th>
                      <th scope="col">Arquivo B</th>
                      <th scope="col">Base A</th>
                      <th scope="col">Base B</th>
                      <th scope="col">Correspondências</th>
                      <th scope="col">Somente A</th>
                      <th scope="col">Somente B</th>
                      <th scope="col">Revisar</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map(comp => (
                      <tr key={comp.id}>
                        <td>{formatDateTime(comp.createdAt)}</td>
                        <td>{comp.period.partner.name}</td>
                        <td>{comp.period.month.toString().padStart(2, '0')}/{comp.period.year}</td>
                        <td><Link href={`/?comparison=${comp.id}`}>{comp.title || 'Abrir comparação'}</Link></td>
                        <td>{comp.fileAName}</td>
                        <td>{comp.fileBName}</td>
                        <td>{comp.totalA.toLocaleString('pt-BR')}</td>
                        <td>{comp.totalB.toLocaleString('pt-BR')}</td>
                        <td><span className={`${styles.badge} ${styles.badgeSuccess}`}>{comp.matchedCount.toLocaleString('pt-BR')}</span></td>
                        <td><span className={`${styles.badge} ${styles.badgeWarning}`}>{comp.onlyACount.toLocaleString('pt-BR')}</span></td>
                        <td><span className={`${styles.badge} ${styles.badgeInfo}`}>{comp.onlyBCount.toLocaleString('pt-BR')}</span></td>
                        <td><span className={`${styles.badge} ${styles.badgeDanger}`}>{comp.reviewCount.toLocaleString('pt-BR')}</span></td>
                        <td>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(comp)}
                            disabled={deletingId !== null}
                            aria-label={`Excluir comparação de ${comp.period.partner.name}, ${comp.period.month.toString().padStart(2, '0')}/${comp.period.year}`}
                            title="Excluir comparação"
                          >
                            {deletingId === comp.id ? 'Excluindo…' : <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <nav className={styles.pagination} aria-label="Paginação">
                  <button
                    className={styles.pageBtn}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Página anterior"
                  >
                    ‹ Anterior
                  </button>
                  <span className={styles.pageInfo}>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Próxima página"
                  >
                    Próxima ›
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
