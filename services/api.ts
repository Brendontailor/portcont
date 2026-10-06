async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => fetchApi<{ status: string; service: string }>('/api/health'),

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
    create: (periodId: string, title: string | undefined, fileA: File, fileB: File) => {
      const formData = new FormData();
      formData.append('fileA', fileA);
      formData.append('fileB', fileB);
      formData.append('periodId', periodId);
      if (title) formData.append('title', title);
      return fetchApi<{ comparison: import('../types').Comparison; warnings: string[] }>('/api/comparisons', {
        method: 'POST',
        body: formData,
        headers: {},
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
    exportComparisonXLSX: (id: string) => fetch(`/api/reports/comparisons/${id}/xlsx`).then(r => r.blob()),
    getMonthly: (partnerId: string, year: number, month: number) => fetchApi<any>(`/api/reports/monthly/${partnerId}/${year}/${month}`),
    exportMonthlyXLSX: (partnerId: string, year: number, month: number) => fetch(`/api/reports/monthly/${partnerId}/${year}/${month}/xlsx`).then(r => r.blob()),
    getAnnual: (partnerId: string, year: number) => fetchApi<any>(`/api/reports/annual/${partnerId}/${year}`),
    exportAnnualXLSX: (partnerId: string, year: number) => fetch(`/api/reports/annual/${partnerId}/${year}/xlsx`).then(r => r.blob()),
  },
};