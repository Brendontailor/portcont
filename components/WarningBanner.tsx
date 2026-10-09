'use client';

import styles from './WarningBanner.module.css';

interface WarningBannerProps {
  message: string;
  type?: 'warning' | 'danger' | 'info';
  onDismiss?: () => void;
}

const icons = {
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4 2.8 19.2h18.4z" /><path d="M12 10v4M12 17.2h.01" />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.8h.01" />
    </svg>
  ),
};

const labels = {
  warning: 'Atenção',
  danger: 'Erro',
  info: 'Informação',
};

export default function WarningBanner({ message, type = 'warning', onDismiss }: WarningBannerProps) {
  return (
    <div className={`${styles.banner} ${styles[type]}`} role="alert" aria-live="polite">
      <span className={styles.icon}>{icons[type]}</span>
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
