import { SearchResultItem } from '../../types';

export interface HistoricalSnapshot {
  id: string;               // UUID v4
  conversationId: string;   // UUID v4
  messageId?: string;       // Optional associated message ID
  entity: string;           // Subject (e.g. "Figma", "Node.js", "Tesla Model 3")
  attribute: string;        // Metric (e.g. "pricing", "version", "ceo")
  value: string;            // Observed factual value (e.g. "$12/month", "v20.11.0")
  validPeriod?: string;     // Historical era or year the fact refers to (e.g. "2022", "2024")
  observedAt: string;       // ISO-8601 observation timestamp (when discussed in chat)
  retrievedAt: string;      // ISO-8601 retrieval timestamp (from search)
  sourceUrl?: string;       // Verified source URL
  sourceTitle?: string;     // Verified source page title
  metadata?: Record<string, unknown>;
}

export interface HistoricalQueryOptions {
  entity?: string;
  query?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export type ComparisonVerdict =
  | 'CONFIRMED_CHANGE'
  | 'NO_DETECTED_CHANGE'
  | 'UNABLE_TO_VERIFY';

export interface ComparisonObservation {
  value: string;
  period?: string;
  timestamp: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface ComparisonResult {
  conversationId: string;
  entity: string;
  attribute: string;
  verdict: ComparisonVerdict;
  confidence: 'high' | 'medium' | 'low';
  historical: ComparisonObservation;
  current: ComparisonObservation;
  deltaSummary: string;
  delta?: {
    summary: string;
    numericDelta?: number;
    percentageChange?: number;
  };
  explanation: string;
  citations: SearchResultItem[];
  sources: SearchResultItem[];
  metadata: {
    comparisonTimeMs: number;
    searchUsed: boolean;
    confidence: 'high' | 'medium' | 'low';
    searchError?: string;
  };
}

export interface ComparisonRequest {
  subject: string;
  attribute?: string;
  baselineDate?: string;
  targetDate?: string;
}

export interface SnapshotStorageAdapter {
  readonly name: string;
  saveSnapshot(snapshot: HistoricalSnapshot): Promise<HistoricalSnapshot>;
  getSnapshots(
    conversationId?: string,
    options?: HistoricalQueryOptions
  ): Promise<HistoricalSnapshot[]>;
  findLatestSnapshot(
    conversationId: string,
    entity: string,
    attribute?: string
  ): Promise<HistoricalSnapshot | null>;
  deleteSnapshots(conversationId: string): Promise<number>;
  clearAll?(): Promise<void>;
  close?(): Promise<void>;
}
