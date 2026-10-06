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

export interface ComparisonResult {
  matched: MatchCandidate[];
  onlyA: ParsedClient[];
  onlyB: ParsedClient[];
  review: MatchCandidate[];
  stats: {
    totalA: number;
    totalB: number;
    matchedCount: number;
    onlyACount: number;
    onlyBCount: number;
    reviewCount: number;
  };
}

export interface NormalizedName {
  original: string;
  normalized: string;
  tokens: string[];
  firstName: string;
  lastName: string;
}