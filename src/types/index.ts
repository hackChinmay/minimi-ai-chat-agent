export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  meta?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface HealthCheckData {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
}

// ============================================================================
// Search Domain Types & Citation Foundation
// ============================================================================

export interface SearchResultItem {
  id: string;              // Stable citation identifier (e.g., "source-1")
  index: number;           // 1-based sequence index
  title: string;
  url: string;             // Original verified URL
  content: string;         // Text snippet / content
  source: string;          // Canonical domain (e.g., "aws.amazon.com")
  publishedDate?: string;  // ISO or provider date string (only if available)
  relevanceScore?: number; // Score between 0 and 1 (only if available)
}

export interface SearchMetadata {
  totalResults: number;
  searchTimeMs: number;
  provider: string;
}

export interface SearchResponseData {
  query: string;
  results: SearchResultItem[];
  metadata: SearchMetadata;
}

export interface SearchOptions {
  maxResults?: number;
  timeoutMs?: number;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}
