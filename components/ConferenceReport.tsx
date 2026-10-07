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
export default function ConferenceReport({ comparison: c, onReview, reviewing, onExport }: {
  comparison: Comparison; onReview: (same: boolean, entry: ComparisonEntry) => Promise<void>;
  reviewing: boolean; onExport: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [different, setDifferent] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const rows = c.entries.filter(e => (status === 'ALL' || e.status === status)
    && (!different || (e.originalA != null && e.originalB != null && e.occurrencesA !== e.occurrencesB))
    && normalizeSearch(`${e.originalA || ''} ${e.originalB || ''}`).includes(normalizeSearch(query)));
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pages);
  const differences = c.entries.filter(e => e.originalA != null && e.originalB != null && e.occurrencesA !== e.occurrencesB).length;
  const comparisonClients = c.clients ?? [];
  const recordsA = comparisonClients.filter(client => client.side === 'A').reduce((total, client) => total + client.occurrences, 0);
  const recordsB = comparisonClients.filter(client => client.side === 'B').reduce((total, client) => total + client.occurrences, 0);
  return <section className={styles.report} aria-labelledby="report-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Relatório de conferência · {String(c.period.month).padStart(2, '0')}/{c.period.year}</p>
        <h1 id="report-title">{c.period.partner.name}</h1><p>{c.title || 'Conferência de clientes'} · {formatDateTime(c.createdAt)}</p></div>
      <div className={styles.actions}><a className="btn btn-secondary" href="/">Nova conferência</a>
        <button className="btn btn-primary" disabled={exporting || reviewing} onClick={async () => { setExporting(true); try { await onExport(); } finally { setExporting(false); } }}>{exporting ? 'Preparando Excel…' : 'Baixar relatório completo'}</button></div>
    </header>
    <div className={styles.sources}><div><strong>Base A · Nossa lista · {c.totalA.toLocaleString('pt-BR')} clientes únicos</strong><span>{recordsA.toLocaleString('pt-BR')} registros lidos · {c.fileAName}</span></div><div><strong>Base B · Lista informada pela parceira · {c.totalB.toLocaleString('pt-BR')} clientes únicos</strong><span>{recordsB.toLocaleString('pt-BR')} registros lidos · {c.fileBName}</span></div></div>
    {(c.incompleteA || c.incompleteB) && <p className={styles.warning} role="alert">Atenção: a extração da base {c.incompleteA && c.incompleteB ? 'A e da base B' : c.incompleteA ? 'A' : 'B'} pode estar incompleta. Confira os arquivos originais antes de concluir.</p>}
    <div className={styles.metrics}>
      {([['MATCHED', c.matchedCount], ['ONLY_A', c.onlyACount], ['ONLY_B', c.onlyBCount], ['REVIEW', c.reviewCount]] as const).map(([key, count]) => <button key={key} aria-pressed={status === key} onClick={() => { setStatus(key); setPage(1); }}><strong>{count.toLocaleString('pt-BR')}</strong><span>{labels[key]}</span></button>)}
    </div>
    <p className={styles.guidance}>A diferença mais importante para conferir cobrança é “Só na lista da parceira”: esses clientes foram informados pela parceira, mas não aparecem na nossa lista. {c.reviewCount ? `${c.reviewCount} pares de nomes parecidos precisam de revisão antes de concluir.` : 'Nenhuma revisão de nomes pendente.'} {differences > 0 && `${differences} pares têm quantidades de ocorrências diferentes.`}</p>
    <div className={styles.filters}>
      <label>Buscar cliente<input type="search" value={query} placeholder="Nome em qualquer uma das bases" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      <label>Situação<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="ALL">Todas as situações</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className={styles.checkbox}><input type="checkbox" checked={different} onChange={e => { setDifferent(e.target.checked); setPage(1); }} />Ocorrências diferentes entre as bases</label>
    </div>
    <p className={styles.hint}>Ocorrências = vezes que o nome aparece no arquivo. Similaridade compara a escrita dos nomes; não é uma garantia de identidade. O Excel inclui todos os registros, independentemente dos filtros.</p>
    <div className={styles.tableWrap}><table className="table"><caption className={styles.caption}>{rows.length} registros encontrados · página {current} de {pages}</caption><thead><tr><th scope="col">Situação</th><th scope="col">Cliente na nossa lista (A)</th><th scope="col">Cliente na lista da parceira (B)</th><th scope="col">Ocorrências A / B</th><th scope="col">Similaridade</th><th scope="col">Conferência</th></tr></thead><tbody>
      {rows.slice((current - 1) * 25, current * 25).map(e => <tr key={e.id}><td><span className={e.status === 'REVIEW' ? styles.pending : styles.status}>{labels[e.status]}</span></td><td>{e.originalA || '—'}</td><td>{e.originalB || '—'}</td><td className={styles.numeric}>{e.occurrencesA ?? '—'} / {e.occurrencesB ?? '—'}</td><td className={styles.numeric}>{e.similarity == null ? '—' : `${e.similarity}%`}</td><td>{e.status === 'REVIEW' ? <div className={styles.review}><button className="btn btn-secondary" disabled={reviewing} onClick={() => onReview(true, e)}>Mesmo cliente</button><button className="btn btn-secondary" disabled={reviewing} onClick={() => onReview(false, e)}>Clientes diferentes</button></div> : e.originalA && e.originalB && e.occurrencesA !== e.occurrencesB ? 'Ocorrências diferentes' : e.status === 'MATCHED' ? 'Correspondência registrada' : 'Ausente na outra base'}</td></tr>)}
      {!rows.length && <tr><td colSpan={6}><p>Nenhum registro para estes filtros.</p><button className="btn btn-secondary" onClick={() => { setQuery(''); setStatus('ALL'); setDifferent(false); setPage(1); }}>Limpar filtros</button></td></tr>}
    </tbody></table></div>
    <footer className={styles.footer}><span role="status">{reviewing ? 'Salvando revisão…' : `Exibindo ${rows.length ? (current - 1) * 25 + 1 : 0}–${Math.min(current * 25, rows.length)} de ${rows.length}`}</span><div className={styles.actions}><button className="btn btn-secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</button><button className="btn btn-secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Próxima</button></div></footer>
    <details className={styles.details}><summary>Detalhes dos arquivos e critérios</summary><p>Identificador: {c.id}</p><p>Base A é a nossa relação de clientes registrados na parceira. Base B é a relação que a parceira informa. Os números de clientes únicos deduplicam nomes repetidos; registros lidos contam todas as ocorrências encontradas no arquivo. Registros declarados no documento: A {c.declaredA ?? 'não informado'} · B {c.declaredB ?? 'não informado'}.</p><p>“Só na lista da parceira” destaca clientes que podem estar sendo cobrados sem constarem na nossa relação. Confirme cada diferença com os arquivos originais antes de concluir.</p></details>
  </section>;
}
