import { SearchOptions } from '../../types';

export interface RawSearchResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  score?: number;
}

export interface RawSearchResponse {
  results: RawSearchResult[];
  searchTimeMs: number;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<RawSearchResponse>;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}
