'use client';

import { useState, useCallback } from 'react';
import { formatFileSize, copyToClipboard, matchesSearch } from '../utils/helpers';
import styles from './ClientList.module.css';

interface ClientListProps {
  clients: Array<{
    originalName: string;
    normalizedName: string;
    occurrences: number;
    side: 'A' | 'B';
  }>;
  title: string;
  showOccurrences?: boolean;
  onCopyAll?: () => void;
  onExport?: () => void;
}

export default function ClientList({ clients, title, showOccurrences = true, onCopyAll, onExport }: ClientListProps) {
  const [search, setSearch] = useState('');

  const filteredClients = clients.filter(c => matchesSearch(c.originalName, search));

  const handleCopyAll = useCallback(() => {
    const text = filteredClients.map(c => c.originalName).join('\n');
    copyToClipboard(text).then(() => {
      alert('Lista copiada.');
    });
    onCopyAll?.();
  }, [filteredClients, onCopyAll]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.actions}>
          <div className={styles.searchWrapper}>
            <label htmlFor={`search-${title}`} className="sr-only">Pesquisar</label>
            <input
              id={`search-${title}`}
              type="search"
              placeholder="Pesquisar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
              aria-label={`Pesquisar em ${title}`}
            />
          </div>
          {onCopyAll && (
            <button className={styles.copyBtn} onClick={handleCopyAll} aria-label="Copiar todos os nomes">
              📋 Copiar nomes
            </button>
          )}
          {onExport && (
            <button className={styles.exportBtn} onClick={onExport} aria-label="Exportar para Excel">
              📊 Exportar
            </button>
          )}
        </div>
      </div>

      <div className={styles.counter}>
        {filteredClients.length} de {clients.length} cliente{clients.length !== 1 ? 's' : ''}
        {search && ` (filtrado)`}
      </div>

      {filteredClients.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>👥</div>
          <p>{search ? 'Nenhum cliente encontrado com esse termo.' : 'Nenhum cliente nesta lista.'}</p>
        </div>
      ) : (
        <table className={styles.table} role="table">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              {showOccurrences && <th scope="col" className={styles.occurrencesCol}>Ocorrências</th>}
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client, index) => (
              <tr key={`${client.side}-${client.normalizedName}-${index}`}>
                <td className={styles.nameCell}>{client.originalName}</td>
                {showOccurrences && (
                  <td className={styles.occurrencesCell}>
                    {client.occurrences > 1 && <span className={styles.occurrencesBadge}>{client.occurrences} ocorrências</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}