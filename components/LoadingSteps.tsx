'use client';

import styles from './LoadingSteps.module.css';

interface LoadingStepsProps {
  currentStep: number;
}

const steps = [
  { id: 1, label: 'Arquivo A recebido' },
  { id: 2, label: 'Arquivo B recebido' },
  { id: 3, label: 'Clientes da Base A identificados' },
  { id: 4, label: 'Clientes da Base B identificados' },
  { id: 5, label: 'Comparando nomes...' },
  { id: 6, label: 'Finalizando resultado...' },
];

export default function LoadingSteps({ currentStep }: LoadingStepsProps) {
  return (
    <div className={styles.container} role="status" aria-live="polite" aria-label="Progresso do processamento">
      <div className={styles.steps}>
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          return (
            <div key={step.id} className={`${styles.step} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}>
              <div className={styles.stepIcon} aria-hidden="true">
                {isCompleted ? '✓' : isActive ? (
                  <span className={styles.spinner} />
                ) : step.id}
              </div>
              <span className={styles.stepLabel}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}