'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { api } from '@/services/api';
import type { Partner } from '@/types';
import { formatDateTime, getMonthName } from '@/utils/helpers';
import styles from './page.module.css';

export default function PartnerDetailPage() {
  const params = useParams();
  const partnerId = params.id as string;
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);

  const loadPartner = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.partners.get(partnerId);
      setPartner(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar parceira');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadPartner();
  }, [loadPartner]);

  const handleCreatePeriod = async () => {
    try {
      await api.periods.create(partnerId, newYear, newMonth);
      setShowCreatePeriod(false);
      await loadPartner();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar competência');
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.loading}>
              <div className="loading-spinner" />
              <p>Carregando parceira...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.error}>
              <h2>Parceira não encontrada</h2>
              <Link href="/parceiras" className={styles.backLink}>← Voltar</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div>
              <Link href="/parceiras" className={styles.backLink}>← Voltar</Link>
              <h1 className={styles.title}>{partner.name}</h1>
            </div>
            <div className={styles.headerActions}>
              <span className={`${styles.badge} ${partner.active ? styles.badgeActive : styles.badgeInactive}`}>
                {partner.active ? 'Ativa' : 'Inativa'}
              </span>
              <button className={styles.newPeriodBtn} onClick={() => setShowCreatePeriod(true)}>
                + Nova Competência
              </button>
            </div>
          </header>

          {error && (
            <div className={styles.error} role="alert">
              {error}
              <button onClick={() => setError(null)} className={styles.dismissBtn}>✕</button>
            </div>
          )}

          <section className={styles.summary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total de Competências</span>
              <span className={styles.summaryValue}>{partner.periods?.length || 0}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Criada em</span>
              <span className={styles.summaryValue}>{formatDateTime(partner.createdAt)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Última atualização</span>
              <span className={styles.summaryValue}>{formatDateTime(partner.updatedAt)}</span>
            </div>
          </section>

          <section className={styles.periodsSection}>
            <h2 className={styles.sectionTitle}>Competências</h2>

            {partner.periods?.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📅</div>
                <h3>Nenhuma competência cadastrada</h3>
                <p>Crie a primeira competência para começar a comparar.</p>
                <button className={styles.newPeriodBtn} onClick={() => setShowCreatePeriod(true)}>
                  + Criar Competência
                </button>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className="table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">Mês/Ano</th>
                      <th scope="col">Comparações</th>
                      <th scope="col">Última Comparação</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partner.periods?.map(period => (
                      <tr key={period.id}>
                        <td>
                          <Link href={`/parceiras/${partner.id}/${period.year}/${period.month}`} className={styles.periodLink}>
                            {getMonthName(period.month)} / {period.year}
                          </Link>
                        </td>
                        <td>{period._count?.comparisons || 0}</td>
                        <td>
                          {period.comparisons?.[0]
                            ? formatDateTime(period.comparisons[0].createdAt)
                            : '—'}
                        </td>
                        <td>
                          <Link href={`/parceiras/${partner.id}/${period.year}/${period.month}`} className={styles.actionBtn}>
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {showCreatePeriod && (
            <div className={styles.modalOverlay} onClick={() => setShowCreatePeriod(false)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h2>Nova Competência</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="year" className={styles.formLabel}>Ano</label>
                    <select
                      id="year"
                      value={newYear}
                      onChange={e => setNewYear(parseInt(e.target.value, 10))}
                      className={styles.formSelect}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="month" className={styles.formLabel}>Mês</label>
                    <select
                      id="month"
                      value={newMonth}
                      onChange={e => setNewMonth(parseInt(e.target.value, 10))}
                      className={styles.formSelect}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')} - {getMonthName(m)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowCreatePeriod(false)}>
                    Cancelar
                  </button>
                  <button type="button" className={styles.btnPrimary} onClick={handleCreatePeriod}>
                    Criar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}