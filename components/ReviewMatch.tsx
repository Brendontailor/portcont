'use client';

import styles from './ReviewMatch.module.css';

interface ReviewMatchProps {
  originalA: string;
  originalB: string;
  similarity: number;
  onSame: () => void;
  onDifferent: () => void;
  loading?: boolean;
}

export default function ReviewMatch({ originalA, originalB, similarity, onSame, onDifferent, loading }: ReviewMatchProps) {
  return (
    <div className={styles.container} role="dialog" aria-label="Revisar correspondência" aria-modal="true">
      <div className={styles.header}>
        <h3 className={styles.title}>Possível correspondência</h3>
        <div className={styles.similarity}>
          Similaridade: <strong>{similarity}%</strong>
        </div>
      </div>

      <div className={styles.comparison}>
        <div className={styles.side}>
          <span className={styles.sideLabel}>BASE A</span>
          <div className={styles.name}>{originalA}</div>
        </div>
        <div className={styles.divider} aria-hidden="true">↔</div>
        <div className={styles.side}>
          <span className={styles.sideLabel}>BASE B</span>
          <div className={styles.name}>{originalB}</div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${styles.btnSame}`}
          onClick={onSame}
          disabled={loading}
          aria-label="Confirmar que são o mesmo cliente"
        >
          ✓ Mesmo cliente
        </button>
        <button
          className={`${styles.btn} ${styles.btnDifferent}`}
          onClick={onDifferent}
          disabled={loading}
          aria-label="Confirmar que são clientes diferentes"
        >
          ✕ São diferentes
        </button>
      </div>
    </div>
  );
}