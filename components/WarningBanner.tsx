'use client';

import styles from './WarningBanner.module.css';

interface WarningBannerProps {
  message: string;
  type?: 'warning' | 'danger' | 'info';
  onDismiss?: () => void;
}

export default function WarningBanner({ message, type = 'warning', onDismiss }: WarningBannerProps) {
  const icons = {
    warning: '⚠',
    danger: '✕',
    info: 'ℹ',
  };

  const labels = {
    warning: 'Atenção',
    danger: 'Erro',
    info: 'Informação',
  };

  return (
    <div className={`${styles.banner} ${styles[type]}`} role="alert" aria-live="polite">
      <span className={styles.icon} aria-hidden="true">{icons[type]}</span>
      <div className={styles.content}>
        <strong className={styles.label}>{labels[type]}</strong>
        <p className={styles.message}>{message}</p>
      </div>
      {onDismiss && (
        <button
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label="Fechar aviso"
        >
          ✕
        </button>
      )}
    </div>
  );
}