export interface ParsedClient {
  originalName: string;
  normalizedName: string;
  occurrences: number;
}

export interface MatchCandidate {
  clientA: ParsedClient;
  clientB: ParsedClient;
  similarity: number;
}

export type MatchStatus = 'MATCHED' | 'ONLY_A' | 'ONLY_B' | 'REVIEW';

export interface ComparisonEntry {
  id: string;
  originalA: string | null;
  normalizedA: string | null;
  originalB: string | null;
  normalizedB: string | null;
  occurrencesA: number | null;
  occurrencesB: number | null;
  similarity: number | null;
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SourceFile {
  id: string;
  side: 'A' | 'B';
  originalName: string;
  storageKey: string | null;
  storageUrl: string | null;
  mimeType: string;
  size: number;
  declaredRecords: number | null;
  extractedRecords: number | null;
  createdAt: string;
}

export interface ComparisonClient {
  id: string;
  side: 'A' | 'B';
  originalName: string;
  normalizedName: string;
  occurrences: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comparison {
  id: string;
  title: string | null;
  fileAName: string;
  fileBName: string;
  totalA: number;
  totalB: number;
  matchedCount: number;
  onlyACount: number;
  onlyBCount: number;
  reviewCount: number;
  declaredA: number | null;
  declaredB: number | null;
  incompleteA: boolean;
  incompleteB: boolean;
  createdAt: string;
  updatedAt: string;
  periodId: string;
  period: {
    id: string;
    year: number;
    month: number;
    partner: {
      id: string;
      name: string;
      slug: string;
    };
  };
  entries: ComparisonEntry[];
  sourceFiles: SourceFile[];
  clients: ComparisonClient[];
}

export interface Partner {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  periods: PartnerPeriod[];
}

export interface PartnerPeriod {
  id: string;
  partnerId: string;
  year: number;
  month: number;
  createdAt: string;
  updatedAt: string;
  _count?: { comparisons: number };
  comparisons?: Comparison[];
}

export interface PaginatedComparisons {
  items: Comparison[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}