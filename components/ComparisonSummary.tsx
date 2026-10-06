'use client';

import styles from './ComparisonSummary.module.css';

interface ComparisonSummaryProps {
  totalA: number;
  totalB: number;
  matched: number;
  onlyA: number;
  onlyB: number;
  review: number;
  declaredA?: number | null;
  declaredB?: number | null;
  incompleteA?: boolean;
  incompleteB?: boolean;
  fileAName: string;
  fileBName: string;
}

export default function ComparisonSummary({
  totalA,
  totalB,
  matched,
  onlyA,
  onlyB,
  review,
  declaredA,
  declaredB,
  incompleteA,
  incompleteB,
  fileAName,
  fileBName,
}: ComparisonSummaryProps) {
  const cards = [
    { label: 'Base A', value: totalA, sublabel: fileAName, color: 'primary', declared: declaredA, incomplete: incompleteA },
    { label: 'Base B', value: totalB, sublabel: fileBName, color: 'info', declared: declaredB, incomplete: incompleteB },
    { label: 'Encontrados nas duas', value: matched, color: 'success' },
    { label: 'Somente A', value: onlyA, color: 'warning' },
    { label: 'Somente B', value: onlyB, color: 'info' },
    { label: 'Revisar', value: review, color: 'danger' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {cards.map((card, index) => (
          <div key={index} className={`${styles.card} ${styles[card.color]}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>{card.label}</span>
              {card.sublabel && <span className={styles.cardSublabel}>{card.sublabel}</span>}
            </div>
            <div className={styles.cardValue}>{card.value.toLocaleString('pt-BR')}</div>
            {(card.declared !== undefined && card.declared !== null) && (
              <div className={styles.cardDeclared}>
                Declarados: {card.declared.toLocaleString('pt-BR')}
                {card.incomplete && <span className={styles.incompleteBadge}>Incompleto</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}