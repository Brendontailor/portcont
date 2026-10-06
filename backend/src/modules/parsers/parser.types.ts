export interface ParsedClient {
  originalName: string;
  normalizedName: string;
  occurrences: number;
}

export interface ParseResult {
  clients: ParsedClient[];
  declaredRecords?: number;
  extractedRecords: number;
  possiblyIncomplete: boolean;
  warnings: string[];
}

export interface ParserOptions {
  fileName: string;
  mimeType: string;
}

export interface ColumnCandidate {
  index: number;
  header: string;
  confidence: number;
  sampleValues: string[];
}