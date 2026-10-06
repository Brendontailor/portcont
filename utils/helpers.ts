export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'MATCHED': return 'Correspondência';
    case 'ONLY_A': return 'Somente A';
    case 'ONLY_B': return 'Somente B';
    case 'REVIEW': return 'Revisar';
    default: return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'MATCHED': return 'var(--color-success)';
    case 'ONLY_A': return 'var(--color-warning)';
    case 'ONLY_B': return 'var(--color-info)';
    case 'REVIEW': return 'var(--color-danger)';
    default: return 'var(--color-text)';
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function matchesSearch(text: string, search: string): boolean {
  if (!search) return true;
  return normalizeSearch(text).includes(normalizeSearch(search));
}

export function getMonthName(month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || '';
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}