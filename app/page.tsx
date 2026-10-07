'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import ConferenceReport from '@/components/ConferenceReport';
import Header from '@/components/Header';
import FileUploader from '@/components/FileUploader';
import WarningBanner from '@/components/WarningBanner';
import { api } from '@/services/api';
import type { Comparison, ComparisonEntry } from '@/types';
import { formatDateTime, downloadBlob } from '@/utils/helpers';
import styles from './page.module.css';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  '.pdf',
  '.xlsx',
  '.xls',
  '.csv',
];

const MAX_SIZE_MB = 15;

export default function HomePage() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [partners, setPartners] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<{ year: number; month: number; id?: string } | null>(null);
  const [periods, setPeriods] = useState<Array<{ id: string; year: number; month: number }>>([]);
  const periodRequest = useRef(0);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [comparisonTitle, setComparisonTitle] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reviewEntry, setReviewEntry] = useState<ComparisonEntry | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    try {
      const data = await api.partners.list(true);
      setPartners(data);
      const params = new URLSearchParams(window.location.search);
      const requestedPartner = params.get('partner');
      const year = Number(params.get('year'));
      const month = Number(params.get('month'));

      if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
        setSelectedPeriod({ year, month });
      }

      setSelectedPartnerId(current => {
        if (current) return current;
        return data.some(item => item.id === requestedPartner) ? requestedPartner! : data[0]?.id || '';
      });
    } catch {
      setError('Erro ao carregar parceiras');
    }
  }, []);

  const loadPeriods = useCallback(async (partnerId: string) => {
    const request = ++periodRequest.current;
    setLoadingPeriods(true);
    try {
      const data = await api.periods.list(partnerId);
      if (request !== periodRequest.current) return;
      setPeriods(data);
      setSelectedPeriod(current => {
        if (current) {
          const existing = data.find(item => item.year === current.year && item.month === current.month);
          return { ...current, id: existing?.id };
        }

        const latest = data[0];
        return latest
          ? { year: latest.year, month: latest.month, id: latest.id }
          : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
      });
    } catch {
      if (request === periodRequest.current) setError('Erro ao carregar competências');
    } finally {
      if (request === periodRequest.current) setLoadingPeriods(false);
    }
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    if (selectedPartnerId) {
      loadPeriods(selectedPartnerId);
    }
  }, [selectedPartnerId, loadPeriods]);

  useEffect(() => {
    const comparisonId = new URLSearchParams(window.location.search).get('comparison');
    if (!comparisonId) return;

    setLoading(true);
    api.comparisons.get(comparisonId)
      .then(setComparison)
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar comparação'))
      .finally(() => setLoading(false));
  }, []);

  const updatePeriod = (values: { year?: number; month?: number }) => {
    setSelectedPeriod(current => {
      const year = values.year ?? current?.year ?? new Date().getFullYear();
      const month = values.month ?? current?.month ?? new Date().getMonth() + 1;
      const existing = periods.find(item => item.year === year && item.month === month);
      return { year, month, id: existing?.id };
    });
  };

  const handleCompare = async () => {
    if (loading || loadingPeriods || !fileA || !fileB || !selectedPartnerId || !selectedPeriod) {
      setError('Selecione a parceira, competência e ambos os arquivos');
      return;
    }

    setLoading(true);
    setError(null);
    setWarnings([]);
    setComparison(null);

    try {
      const periodId = selectedPeriod.id
        ?? (await api.periods.create(selectedPartnerId, selectedPeriod.year, selectedPeriod.month)).id;


      const result = await api.comparisons.create(
        periodId,
        comparisonTitle || undefined,
        fileA,
        fileB
      );

      setWarnings(result.warnings);
        setComparison(result.comparison);
      window.history.replaceState(null, '', `/?comparison=${result.comparison.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar comparação');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (samePerson: boolean, entry = reviewEntry) => {
    if (!entry || !comparison || reviewing) return;
    setReviewEntry(entry);
    setReviewing(true);
    try {
      const updated = await api.comparisons.review(comparison.id, entry.id, samePerson);
      setComparison(updated);
      setReviewEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao revisar');
    } finally {
      setReviewing(false);
    }
  };

  const handleExportComparison = async () => {
    if (!comparison) return;
    try {
      const blob = await api.reports.exportComparisonXLSX(comparison.id);
      downloadBlob(blob, `portcont-comparacao-${formatDateTime(comparison.createdAt).replace(/[/:]/g, '-')}.xlsx`);
    } catch {
      setError('Erro ao exportar');
    }
  };


  if (!comparison) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <section aria-labelledby="hero-title" style={{ marginBottom: 24 }}>
              <h1 id="hero-title">Conferência de clientes</h1>
              <p>Selecione a parceira e os arquivos. Depois, revise as diferenças e baixe o relatório completo.</p>
            </section>

            <section className={styles.formSection} aria-labelledby="form-title">
              <h2 id="form-title" className={styles.sectionTitle}>1. Prepare sua conferência</h2>

              {error && <WarningBanner message={error} type="danger" onDismiss={() => setError(null)} />}
              {warnings.map((w, i) => (
                <WarningBanner key={i} message={w} type="warning" onDismiss={() => setWarnings(prev => prev.filter((_, idx) => idx !== i))} />
              ))}

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="partner" className={styles.formLabel}>Parceira</label>
                  <select
                    id="partner"
                    value={selectedPartnerId}
                    onChange={e => {
                      const id = e.target.value;
                      ++periodRequest.current;
                      setLoadingPeriods(Boolean(id));
                      setSelectedPartnerId(id);
                      setSelectedPeriod(null);
                      setPeriods([]);
                    }}
                    className={styles.formSelect}
                    disabled={loading}
                    required
                  >
                    <option value="">Selecione uma parceira</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Competência</label>
                  <div className={styles.periodSelects}>
                    <select
                      value={selectedPeriod?.month || ''}
                      onChange={e => updatePeriod({ month: parseInt(e.target.value, 10) })}
                      className={styles.formSelect}
                      disabled={loading || !selectedPartnerId}
                      required
                      aria-label="Mês da competência"
                    >
                      <option value="">Mês</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')} - {new Date(2000, m - 1).toLocaleString('pt-BR', { month: 'long' })}</option>
                      ))}
                    </select>
                    <select
                      value={selectedPeriod?.year || ''}
                      onChange={e => updatePeriod({ year: parseInt(e.target.value, 10) })}
                      className={styles.formSelect}
                      disabled={loading || !selectedPartnerId}
                      required
                      aria-label="Ano da competência"
                    >
                      <option value="">Ano</option>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.uploadGrid}>
                <FileUploader
                  label="NOSSA LISTA · BASE A"
                  side="A"
                  onFileSelect={(_, file) => setFileA(file)}
                  acceptedTypes={ACCEPTED_TYPES}
                  maxSizeMB={MAX_SIZE_MB}
                  disabled={loading}
                  illustration="/images/portcont/portcont-upload-arquivos.png"
                />
                <FileUploader
                  label="LISTA DA PARCEIRA · BASE B"
                  side="B"
                  onFileSelect={(_, file) => setFileB(file)}
                  acceptedTypes={ACCEPTED_TYPES}
                  maxSizeMB={MAX_SIZE_MB}
                  disabled={loading}
                  illustration="/images/portcont/portcont-upload-arquivos.png"
                />
              </div>

              <div className={styles.titleInput}>
                <label htmlFor="title" className={styles.formLabel}>Título da comparação (opcional)</label>
                <input
                  id="title"
                  type="text"
                  value={comparisonTitle}
                  onChange={e => setComparisonTitle(e.target.value)}
                  placeholder="Ex: Comparação inicial, Revisão, Fechamento"
                  className={styles.formInput}
                  disabled={loading}
                />
              </div>

              <button
                className={`${styles.compareBtn} btn btn-primary`}
                onClick={handleCompare}
                disabled={loading || loadingPeriods || !fileA || !fileB || !selectedPartnerId || !selectedPeriod}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner" />
                    Processando...
                  </>
                ) : (
                  'Comparar e abrir relatório'
                )}
              </button>

              {loading && <p role="status">Processando os arquivos e preparando a conferência. Aguarde…</p>}
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}><div className={styles.container}>
        {error && <WarningBanner message={error} type="danger" onDismiss={() => setError(null)} />}
        {warnings.map((message, i) => <WarningBanner key={i} message={message} type="warning" />)}
        <ConferenceReport comparison={comparison} onReview={handleReview} reviewing={reviewing} onExport={handleExportComparison} />
      </div></main>
    </div>
  );
}
