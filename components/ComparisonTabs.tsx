'use client';

import styles from './ComparisonTabs.module.css';

interface ComparisonTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: {
    baseA: number;
    baseB: number;
    onlyA: number;
    onlyB: number;
    matched: number;
    review: number;
  };
}

const tabs = [
  { id: 'baseA', label: 'Base A', countKey: 'baseA' as const },
  { id: 'baseB', label: 'Base B', countKey: 'baseB' as const },
  { id: 'onlyA', label: 'Somente A', countKey: 'onlyA' as const },
  { id: 'onlyB', label: 'Somente B', countKey: 'onlyB' as const },
  { id: 'matched', label: 'Correspondências', countKey: 'matched' as const },
  { id: 'review', label: 'Revisar', countKey: 'review' as const },
];

export default function ComparisonTabs({ activeTab, onTabChange, counts }: ComparisonTabsProps) {
  return (
    <div className={styles.container} role="tablist" aria-label="Abas de resultado">
      {tabs.map(tab => {
        const count = counts[tab.countKey];
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className={styles.tabLabel}>{tab.label}</span>
            <span className={styles.tabCount}>{count.toLocaleString('pt-BR')}</span>
          </button>
        );
      })}
    </div>
  );
}