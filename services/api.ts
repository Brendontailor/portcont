export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = new Headers(options.headers);

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth/')) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new Error('Sua sessão expirou. Entre novamente para continuar.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new ApiError(error.error || `HTTP ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(path, { credentials: 'include' });
  if (res.status === 401 && typeof window !== 'undefined') {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new Error('Sua sessão expirou. Entre novamente para continuar.');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Não foi possível gerar o arquivo' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.blob();
}

export interface AuthUser {
  id: string;
  username: string;
}

export const api = {
  health: () => fetchApi<{ status: string; service: string }>('/api/health'),

  auth: {
    login: (username: string, password: string) =>
      fetchApi<{ authenticated: true; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    me: () => fetchApi<{ authenticated: true; user: AuthUser }>('/api/auth/me'),
    logout: () => fetchApi<void>('/api/auth/logout', { method: 'POST' }),
  },

  partners: {
    list: (activeOnly = true) => fetchApi<import('../types').Partner[]>(`/api/partners?active=${activeOnly}`),
    get: (id: string) => fetchApi<import('../types').Partner>(`/api/partners/${id}`),
    create: (name: string) => fetchApi<import('../types').Partner>('/api/partners', { method: 'POST', body: JSON.stringify({ name }) }),
    update: (id: string, data: { name?: string; active?: boolean }) => fetchApi<import('../types').Partner>(`/api/partners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi<void>(`/api/partners/${id}`, { method: 'DELETE' }),
  },

  periods: {
    list: (partnerId: string) => fetchApi<import('../types').PartnerPeriod[]>(`/api/periods/${partnerId}`),
    get: (partnerId: string, year: number, month: number) => fetchApi<import('../types').PartnerPeriod>(`/api/periods/${partnerId}/${year}/${month}`),
    create: (partnerId: string, year: number, month: number) => fetchApi<import('../types').PartnerPeriod>(`/api/periods/${partnerId}/${year}/${month}`, { method: 'POST' }),
  },

  comparisons: {
    list: (periodId?: string, page = 1, limit = 20) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (periodId) params.set('periodId', periodId);
      return fetchApi<import('../types').PaginatedComparisons>(`/api/comparisons?${params}`);
    },
    get: (id: string) => fetchApi<import('../types').Comparison>(`/api/comparisons/${id}`),
    create: (periodId: string, title: string | undefined, filesA: File[], filesB: File[]) => {
      const formData = new FormData();
      filesA.forEach(f => formData.append('fileA', f));
      filesB.forEach(f => formData.append('fileB', f));
      formData.append('periodId', periodId);
      if (title) formData.append('title', title);
      return fetchApi<{ comparison: import('../types').Comparison; warnings: string[] }>('/api/comparisons', {
        method: 'POST',
        body: formData,
      });
    },
    review: (comparisonId: string, entryId: string, samePerson: boolean) =>
      fetchApi<import('../types').Comparison>(`/api/comparisons/${comparisonId}/review/${entryId}`, {
        method: 'POST',
        body: JSON.stringify({ samePerson }),
      }),
    delete: (id: string) => fetchApi<void>(`/api/comparisons/${id}`, { method: 'DELETE' }),
    supportedFormats: () => fetchApi<{ mimeTypes: string[] }>('/api/comparisons/supported-formats'),
  },

  reports: {
    getComparison: (id: string) => fetchApi<{ comparison: import('../types').Comparison; clientsA: import('../types').ComparisonClient[]; clientsB: import('../types').ComparisonClient[] }>(`/api/reports/comparisons/${id}`),
    exportComparisonXLSX: (id: string) => fetchBlob(`/api/reports/comparisons/${id}/xlsx`),
    getMonthly: (partnerId: string, year: number, month: number) => fetchApi<unknown>(`/api/reports/monthly/${partnerId}/${year}/${month}`),
    exportMonthlyXLSX: (partnerId: string, year: number, month: number) => fetchBlob(`/api/reports/monthly/${partnerId}/${year}/${month}/xlsx`),
    getAnnual: (partnerId: string, year: number) => fetchApi<unknown>(`/api/reports/annual/${partnerId}/${year}`),
    exportAnnualXLSX: (partnerId: string, year: number) => fetchBlob(`/api/reports/annual/${partnerId}/${year}/xlsx`),
  },
};
