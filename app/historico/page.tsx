'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
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
  const limit = 20;

  const loadComparisons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.comparisons.list(undefined, page, limit);
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

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>Histórico de Comparações</h1>
            <p className={styles.subtitle}>{total} comparação{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}</p>
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
              <div className={styles.emptyImage} aria-hidden="true">
                <Image
                  src="/images/portcont/portcont-historico-relatorios.png"
                  alt=""
                  width={280}
                  height={200}
                  className={styles.emptyImageEl}
                />
              </div>
              <h2>Nenhuma comparação encontrada</h2>
              <p>As comparações realizadas aparecerão aqui.</p>
              <Link href="/" className={styles.newBtn}>Nova Comparação</Link>
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
                      <th scope="col">Match</th>
                      <th scope="col">Somente A</th>
                      <th scope="col">Somente B</th>
                      <th scope="col">Revisar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map(comp => (
                      <tr key={comp.id}>
                        <td>{formatDateTime(comp.createdAt)}</td>
                        <td>{comp.period.partner.name}</td>
                        <td>{comp.period.month.toString().padStart(2, '0')}/{comp.period.year}</td>
                        <td>{comp.title || '—'}</td>
                        <td>{comp.fileAName}</td>
                        <td>{comp.fileBName}</td>
                        <td>{comp.totalA.toLocaleString('pt-BR')}</td>
                        <td>{comp.totalB.toLocaleString('pt-BR')}</td>
                        <td><span className={styles.badgeSuccess}>{comp.matchedCount.toLocaleString('pt-BR')}</span></td>
                        <td><span className={styles.badgeWarning}>{comp.onlyACount.toLocaleString('pt-BR')}</span></td>
                        <td><span className={styles.badgeInfo}>{comp.onlyBCount.toLocaleString('pt-BR')}</span></td>
                        <td><span className={styles.badgeDanger}>{comp.reviewCount.toLocaleString('pt-BR')}</span></td>
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