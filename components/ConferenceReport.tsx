'use client';

import { useState } from 'react';
import type { Comparison, ComparisonEntry } from '@/types';
import { formatDateTime, normalizeSearch } from '@/utils/helpers';
import styles from './ConferenceReport.module.css';

const labels = {
  MATCHED: 'Nas duas listas',
  ONLY_A: 'Só na nossa lista · não consta na parceira',
  ONLY_B: 'Só na lista da parceira · possível cobrança a mais',
  REVIEW: 'Revisão pendente',
};

const metricLabels = {
  MATCHED: 'Em ambas',
  ONLY_A: 'Somente Base A',
  ONLY_B: 'Somente Base B',
  REVIEW: 'Revisar',
} as const;

export default function ConferenceReport({ comparison: c, onReview, reviewing, onExport }: {
  comparison: Comparison; onReview: (same: boolean, entry: ComparisonEntry) => Promise<void>;
  reviewing: boolean; onExport: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [different, setDifferent] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const comparisonClients = c.clients ?? [];
  const recordsA = comparisonClients.filter(client => client.side === 'A').reduce((total, client) => total + client.occurrences, 0);
  const recordsB = comparisonClients.filter(client => client.side === 'B').reduce((total, client) => total + client.occurrences, 0);
  const distinctNamesA = comparisonClients.filter(client => client.side === 'A').length;
  const distinctNamesB = comparisonClients.filter(client => client.side === 'B').length;
  const displayEntries = c.entries.flatMap((entry): ComparisonEntry[] => {
    if (entry.status !== 'MATCHED' || !entry.originalA || !entry.originalB) return [entry];
    const countA = entry.occurrencesA ?? 1;
    const countB = entry.occurrencesB ?? 1;
    const matchedOccurrences = Math.min(countA, countB);
    const result: ComparisonEntry[] = [{ ...entry, occurrencesA: matchedOccurrences, occurrencesB: matchedOccurrences }];
    if (countA > matchedOccurrences) result.push({
      ...entry,
      id: `${entry.id}-excess-a`,
      originalB: null,
      normalizedB: null,
      occurrencesA: countA - matchedOccurrences,
      occurrencesB: null,
      similarity: null,
      status: 'ONLY_A',
    });
    if (countB > matchedOccurrences) result.push({
      ...entry,
      id: `${entry.id}-excess-b`,
      originalA: null,
      normalizedA: null,
      occurrencesA: null,
      occurrencesB: countB - matchedOccurrences,
      similarity: null,
      status: 'ONLY_B',
    });
    return result;
  });
  const countStatus = (matchStatus: ComparisonEntry['status']) => displayEntries.reduce((total, entry) => {
    if (entry.status !== matchStatus) return total;
    if (matchStatus === 'REVIEW' || matchStatus === 'MATCHED') {
      return total + Math.min(entry.occurrencesA ?? 1, entry.occurrencesB ?? 1);
    }
    return total + (matchStatus === 'ONLY_A' ? entry.occurrencesA ?? 1 : entry.occurrencesB ?? 1);
  }, 0);
  const matchedCount = countStatus('MATCHED');
  const onlyACount = countStatus('ONLY_A');
  const onlyBCount = countStatus('ONLY_B');
  const reviewCount = countStatus('REVIEW');
  const rows = displayEntries.filter(e => (status === 'ALL' || e.status === status)
    && (!different || (e.originalA != null && e.originalB != null && e.occurrencesA !== e.occurrencesB))
    && normalizeSearch(`${e.originalA || ''} ${e.originalB || ''}`).includes(normalizeSearch(query)));
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pages);
  const differences = c.entries.filter(e => e.originalA != null && e.originalB != null && e.occurrencesA !== e.occurrencesB).length;

  const totalA = recordsA || c.totalA;
  const totalB = recordsB || c.totalB;

  return <section className={styles.report} aria-labelledby="report-title">
    <header className={styles.header}>
      <div className={styles.headerMeta}>
        <p className={styles.eyebrow}>Relatório de conferência · {String(c.period.month).padStart(2, '0')}/{c.period.year}</p>
        <h1 id="report-title">{c.period.partner.name}</h1>
        <p>{c.title || 'Conferência de clientes'} · {formatDateTime(c.createdAt)}</p>
      </div>
      <div className={styles.actions}>
        <a className="btn btn-secondary" href="/">Nova conferência</a>
        <button className="btn btn-primary" disabled={exporting || reviewing} onClick={async () => { setExporting(true); try { await onExport(); } finally { setExporting(false); } }}>{exporting ? 'Preparando Excel…' : 'Baixar relatório completo'}</button>
      </div>
    </header>

    <div className={styles.summaryGrid}>
      <div className={`${styles.summaryCard} ${styles.summaryNeutralA}`}>
        <span className={styles.summaryLabel}>Total Base A</span>
        <strong className={styles.summaryValue}>{totalA.toLocaleString('pt-BR')}</strong>
        <span className={styles.summarySub}>{distinctNamesA.toLocaleString('pt-BR')} nomes distintos · {c.fileAName}</span>
      </div>
      <div className={`${styles.summaryCard} ${styles.summaryNeutralB}`}>
        <span className={styles.summaryLabel}>Total Base B</span>
        <strong className={styles.summaryValue}>{totalB.toLocaleString('pt-BR')}</strong>
        <span className={styles.summarySub}>{distinctNamesB.toLocaleString('pt-BR')} nomes distintos · {c.fileBName}</span>
      </div>
      {([['MATCHED', matchedCount], ['ONLY_A', onlyACount], ['ONLY_B', onlyBCount], ['REVIEW', reviewCount]] as const).map(([key, count]) => (
        <button
          key={key}
          type="button"
          aria-pressed={status === key}
          className={`${styles.summaryCard} ${styles.summaryAction} ${styles[`summary${key === 'MATCHED' ? 'Matched' : key === 'ONLY_A' ? 'OnlyA' : key === 'ONLY_B' ? 'OnlyB' : 'Review'}`]}`}
          onClick={() => { setStatus(key); setPage(1); }}
        >
          <span className={styles.summaryLabel}>{metricLabels[key]}</span>
          <strong className={styles.summaryValue}>{count.toLocaleString('pt-BR')}</strong>
          <span className={styles.summarySub}>{labels[key]}</span>
        </button>
      ))}
    </div>

    {(c.incompleteA || c.incompleteB) && <p className={styles.warning} role="alert">Atenção: a extração da base {c.incompleteA && c.incompleteB ? 'A e da base B' : c.incompleteA ? 'A' : 'B'} pode estar incompleta. Confira os arquivos originais antes de concluir.</p>}

    <p className={styles.guidance}>A diferença mais importante para conferir cobrança é “Só na lista da parceira”: esses clientes foram informados pela parceira, mas não aparecem na nossa lista. A contagem inclui todas as ocorrências, inclusive nomes repetidos; nomes distintos aparecem à parte. {reviewCount ? `${reviewCount} ocorrências em pares de nomes parecidos precisam de revisão antes de concluir.` : 'Nenhuma revisão de nomes pendente.'} {differences > 0 && `${differences} pares têm quantidades de ocorrências diferentes.`}</p>

    <div className={styles.filters}>
      <label>Buscar cliente<input type="search" value={query} placeholder="Nome em qualquer uma das bases" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      <label>Situação<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="ALL">Todas as situações</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className={styles.checkbox}><input type="checkbox" checked={different} onChange={e => { setDifferent(e.target.checked); setPage(1); }} />Ocorrências diferentes entre as bases</label>
    </div>
    <p className={styles.hint}>As contagens incluem cada ocorrência, mesmo quando o nome se repete. A tabela agrupa nomes iguais e mostra a quantidade na coluna de ocorrências. Similaridade compara a escrita; não garante identidade. O Excel inclui todos os registros, independentemente dos filtros.</p>

    <div className={styles.tableWrap}><table className="table"><caption className={styles.caption}>{rows.length} grupos de nomes encontrados · página {current} de {pages}</caption><thead><tr><th scope="col">Situação</th><th scope="col">Cliente na nossa lista (A)</th><th scope="col">Cliente na lista da parceira (B)</th><th scope="col">Ocorrências A / B</th><th scope="col">Similaridade</th><th scope="col">Conferência</th></tr></thead><tbody>
      {rows.slice((current - 1) * 25, current * 25).map(e => <tr key={e.id}><td><span className={e.status === 'REVIEW' ? styles.pending : styles.status}>{labels[e.status]}</span></td><td>{e.originalA || '—'}</td><td>{e.originalB || '—'}</td><td className={styles.numeric}>{e.occurrencesA ?? '—'} / {e.occurrencesB ?? '—'}</td><td className={styles.numeric}>{e.similarity == null ? '—' : `${e.similarity}%`}</td><td>{e.status === 'REVIEW' ? <div className={styles.review}><button className="btn btn-secondary btn-sm" disabled={reviewing} onClick={() => onReview(true, e)}>Mesmo cliente</button><button className="btn btn-secondary btn-sm" disabled={reviewing} onClick={() => onReview(false, e)}>Clientes diferentes</button></div> : e.originalA && e.originalB && e.occurrencesA !== e.occurrencesB ? 'Ocorrências diferentes' : e.status === 'MATCHED' ? 'Correspondência registrada' : 'Ausente na outra base'}</td></tr>)}
      {!rows.length && <tr><td colSpan={6}><div className={styles.emptyTable}><p>Nenhum registro para estes filtros.</p><button className="btn btn-secondary" onClick={() => { setQuery(''); setStatus('ALL'); setDifferent(false); setPage(1); }}>Limpar filtros</button></div></td></tr>}
    </tbody></table></div>

    <footer className={styles.footer}><span role="status">{reviewing ? 'Salvando revisão…' : `Exibindo ${rows.length ? (current - 1) * 25 + 1 : 0}–${Math.min(current * 25, rows.length)} de ${rows.length}`}</span><div className={styles.actions}><button className="btn btn-secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</button><button className="btn btn-secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Próxima</button></div></footer>

    <details className={styles.details}><summary>Detalhes dos arquivos e critérios</summary><p>Identificador: {c.id}</p><p>Base A é a nossa relação de clientes registrados na parceira. Base B é a relação que a parceira informa. A contagem total inclui todas as linhas/ocorrências, mesmo quando nomes se repetem. O total de nomes distintos aparece como informação complementar. Registros declarados no documento: A {c.declaredA ?? 'não informado'} · B {c.declaredB ?? 'não informado'}.</p><p>“Só na lista da parceira” destaca clientes que podem estar sendo cobrados sem constarem na nossa relação. Confirme cada diferença com os arquivos originais antes de concluir.</p></details>
  </section>;
}
