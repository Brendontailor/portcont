'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import FileUploader from '@/components/FileUploader';
import ComparisonSummary from '@/components/ComparisonSummary';
import ComparisonTabs from '@/components/ComparisonTabs';
import ClientList from '@/components/ClientList';
import ReviewMatch from '@/components/ReviewMatch';
import LoadingSteps from '@/components/LoadingSteps';
import WarningBanner from '@/components/WarningBanner';
import EmptyState from '@/components/EmptyState';
import { api } from '@/services/api';
import type { Comparison, ComparisonEntry, ParsedClient } from '@/types';
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

interface TabConfig {
  id: string;
  label: string;
  getClients?: (c: Comparison) => Array<{ originalName: string; normalizedName: string; occurrences: number; side: 'A' | 'B' }>;
  getEntries?: (c: Comparison) => ComparisonEntry[];
}

const TABS: TabConfig[] = [
  { id: 'baseA', label: 'Base A', getClients: (c: Comparison) => c.clients.filter(x => x.side === 'A') },
  { id: 'baseB', label: 'Base B', getClients: (c: Comparison) => c.clients.filter(x => x.side === 'B') },
  { id: 'onlyA', label: 'Somente A', getClients: (c: Comparison) => c.entries.filter(e => e.status === 'ONLY_A').map(e => ({ originalName: e.originalA!, normalizedName: e.normalizedA!, occurrences: e.occurrencesA || 1, side: 'A' as const })) },
  { id: 'onlyB', label: 'Somente B', getClients: (c: Comparison) => c.entries.filter(e => e.status === 'ONLY_B').map(e => ({ originalName: e.originalB!, normalizedName: e.normalizedB!, occurrences: e.occurrencesB || 1, side: 'B' as const })) },
  { id: 'matched', label: 'Correspondências', getEntries: (c: Comparison) => c.entries.filter(e => e.status === 'MATCHED') },
  { id: 'review', label: 'Revisar', getEntries: (c: Comparison) => c.entries.filter(e => e.status === 'REVIEW') },
];

export default function HomePage() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [partners, setPartners] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<{ year: number; month: number; id: string } | null>(null);
  const [periods, setPeriods] = useState<Array<{ id: string; year: number; month: number }>>([]);
  const [comparisonTitle, setComparisonTitle] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [activeTab, setActiveTab] = useState('baseA');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(1);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reviewEntry, setReviewEntry] = useState<ComparisonEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    try {
      const data = await api.partners.list(true);
      setPartners(data);
      if (data.length > 0 && !selectedPartnerId) {
        setSelectedPartnerId(data[0].id);
      }
    } catch {
      setError('Erro ao carregar parceiras');
    }
  }, [selectedPartnerId]);

  const loadPeriods = useCallback(async (partnerId: string) => {
    try {
      const data = await api.periods.list(partnerId);
      setPeriods(data);
      if (data.length > 0 && !selectedPeriod) {
        const latest = data[0];
        setSelectedPeriod({ year: latest.year, month: latest.month, id: latest.id });
      }
    } catch {
      setError('Erro ao carregar competências');
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    if (selectedPartnerId) {
      loadPeriods(selectedPartnerId);
    }
  }, [selectedPartnerId, loadPeriods]);

  const handleCompare = async () => {
    if (!fileA || !fileB || !selectedPartnerId || !selectedPeriod) {
      setError('Selecione a parceira, competência e ambos os arquivos');
      return;
    }

    setLoading(true);
    setLoadingStep(1);
    setError(null);
    setWarnings([]);
    setComparison(null);
    setActiveTab('baseA');

    try {
      setLoadingStep(2);
      setLoadingStep(3);
      setLoadingStep(4);
      setLoadingStep(5);
      setLoadingStep(6);

      const result = await api.comparisons.create(
        selectedPeriod.id,
        comparisonTitle || undefined,
        fileA,
        fileB
      );

      setWarnings(result.warnings);
      const comp = await api.comparisons.get(result.comparison.id);
      setComparison(comp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar comparação');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (samePerson: boolean) => {
    if (!reviewEntry || !comparison) return;
    try {
      const updated = await api.comparisons.review(comparison.id, reviewEntry.id, samePerson);
      setComparison(updated);
      setReviewEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao revisar');
    }
  };

  const getTabClients = (tabId: string) => {
    if (!comparison) return [];
    const tab = TABS.find(t => t.id === tabId);
    if (!tab || !tab.getClients) return [];
    return tab.getClients(comparison);
  };

  const getTabEntries = (tabId: string) => {
    if (!comparison) return [];
    const tab = TABS.find(t => t.id === tabId);
    if (!tab || !tab.getEntries) return [];
    return tab.getEntries(comparison);
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

  const handleExportTab = async (tabId: string) => {
    handleExportComparison();
  };

  if (!comparison) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero} aria-labelledby="hero-title">
              <div className={styles.heroContent}>
                <h1 id="hero-title" className={styles.heroTitle}>PORTCONT</h1>
                <p className={styles.heroSubtitle}>Comparação inteligente de clientes</p>
                <p className={styles.heroDescription}>
                  Compare duas bases de clientes e encontre diferenças automaticamente,
                  mesmo quando os nomes possuem pequenas divergências de escrita.
                </p>
              </div>
              <div className={styles.heroImage} aria-hidden="true">
                <Image
                  src="/images/portcont/portcont-hero-comparacao.png"
                  alt=""
                  width={520}
                  height={340}
                  priority
                  className={styles.heroImageEl}
                />
              </div>
            </section>

            <section className={styles.formSection} aria-labelledby="form-title">
              <h2 id="form-title" className={styles.sectionTitle}>Nova Comparação</h2>

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
                      setSelectedPartnerId(id);
                      setSelectedPeriod(null);
                      loadPeriods(id);
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
                      onChange={e => setSelectedPeriod(prev => prev ? { ...prev, month: parseInt(e.target.value, 10) } : null)}
                      className={styles.formSelect}
                      disabled={loading || !selectedPartnerId}
                      required
                    >
                      <option value="">Mês</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')} - {new Date(2000, m - 1).toLocaleString('pt-BR', { month: 'long' })}</option>
                      ))}
                    </select>
                    <select
                      value={selectedPeriod?.year || ''}
                      onChange={e => setSelectedPeriod(prev => prev ? { ...prev, year: parseInt(e.target.value, 10) } : null)}
                      className={styles.formSelect}
                      disabled={loading || !selectedPartnerId}
                      required
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
                  label="BASE A"
                  side="A"
                  onFileSelect={(_, file) => setFileA(file)}
                  acceptedTypes={ACCEPTED_TYPES}
                  maxSizeMB={MAX_SIZE_MB}
                  disabled={loading}
                  illustration="/images/portcont/portcont-upload-arquivos.png"
                />
                <FileUploader
                  label="BASE B"
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
                className={`${styles.compareBtn} ${styles.btnPrimary}`}
                onClick={handleCompare}
                disabled={loading || !fileA || !fileB || !selectedPartnerId || !selectedPeriod}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner" />
                    Processando...
                  </>
                ) : (
                  'COMPARAR CLIENTES'
                )}
              </button>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab);
  const isReviewTab = activeTab === 'review';
  const isMatchedTab = activeTab === 'matched';

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {loading && (
            <LoadingSteps currentStep={loadingStep} />
          )}

          {warnings.map((w, i) => (
            <WarningBanner key={i} message={w} type="warning" onDismiss={() => setWarnings(prev => prev.filter((_, idx) => idx !== i))} />
          ))}

          <section className={styles.resultHeader}>
            <div className={styles.resultMeta}>
              <h2 className={styles.resultTitle}>
                {comparison.period.partner.name} - {comparison.period.month.toString().padStart(2, '0')}/{comparison.period.year}
              </h2>
              <p className={styles.resultSubtitle}>
                {comparison.title ? `${comparison.title} • ` : ''}
                {comparison.fileAName} vs {comparison.fileBName}
              </p>
              <p className={styles.resultDate}>Criado em {formatDateTime(comparison.createdAt)}</p>
            </div>
            <div className={styles.resultActions}>
              <button className={styles.exportBtn} onClick={handleExportComparison}>
                📊 Exportar Excel
              </button>
            </div>
          </section>

          <ComparisonSummary
            totalA={comparison.totalA}
            totalB={comparison.totalB}
            matched={comparison.matchedCount}
            onlyA={comparison.onlyACount}
            onlyB={comparison.onlyBCount}
            review={comparison.reviewCount}
            declaredA={comparison.declaredA}
            declaredB={comparison.declaredB}
            incompleteA={comparison.incompleteA}
            incompleteB={comparison.incompleteB}
            fileAName={comparison.fileAName}
            fileBName={comparison.fileBName}
          />

          <ComparisonTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={{
              baseA: comparison.totalA,
              baseB: comparison.totalB,
              onlyA: comparison.onlyACount,
              onlyB: comparison.onlyBCount,
              matched: comparison.matchedCount,
              review: comparison.reviewCount,
            }}
          />

          {isReviewTab ? (
            <div className={styles.reviewList}>
              {getTabEntries('review').map((entry, index) => (
                <ReviewMatch
                  key={`${entry.id}-${index}`}
                  originalA={entry.originalA || ''}
                  originalB={entry.originalB || ''}
                  similarity={entry.similarity || 0}
                  onSame={() => setReviewEntry(entry)}
                  onDifferent={() => setReviewEntry(entry)}
                  loading={false}
                />
              ))}
              {getTabEntries('review').length === 0 && (
                <EmptyState icon="✅" title="Nenhuma revisão pendente" description="Todas as correspondências foram classificadas automaticamente." />
              )}
            </div>
          ) : isMatchedTab ? (
            <div className={styles.matchedTable}>
              <table className="table" role="table">
                <thead>
                  <tr>
                    <th scope="col">Base A</th>
                    <th scope="col">Base B</th>
                    <th scope="col" style={{ width: '120px', textAlign: 'right' }}>Similaridade</th>
                  </tr>
                </thead>
                <tbody>
                  {getTabEntries('matched').map((entry, index) => (
                    <tr key={`${entry.id}-${index}`}>
                      <td>{entry.originalA}</td>
                      <td>{entry.originalB}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--color-success)' }}>
                        {entry.similarity === 100 ? '100%' : `${entry.similarity}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {getTabEntries('matched').length === 0 && (
                <EmptyState icon="🔗" title="Nenhuma correspondência" description="Não foram encontradas correspondências automáticas entre as bases." />
              )}
            </div>
          ) : (
            <ClientList
              clients={getTabClients(activeTab)}
              title={currentTab?.label || ''}
              showOccurrences={!['onlyA', 'onlyB'].includes(activeTab)}
              onCopyAll={() => {}}
              onExport={() => handleExportTab(activeTab)}
            />
          )}

          {reviewEntry && (
            <div className={styles.reviewModal} role="dialog" aria-modal="true" aria-labelledby="review-title">
              <div className={styles.modalOverlay} onClick={() => setReviewEntry(null)} />
              <ReviewMatch
                originalA={reviewEntry.originalA || ''}
                originalB={reviewEntry.originalB || ''}
                similarity={reviewEntry.similarity || 0}
                onSame={() => handleReview(true)}
                onDifferent={() => handleReview(false)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}