import { SearchOptions } from '../../../types';
import { RawSearchResponse, RawSearchResult, SearchProvider } from '../types';

export interface MockProviderOptions {
  customResults?: RawSearchResult[];
  searchTimeMs?: number;
  shouldFail?: boolean;
  failureError?: Error;
}

export class MockSearchProvider implements SearchProvider {
  public readonly name = 'mock';
  private results: RawSearchResult[];
  private searchTimeMs: number;
  private shouldFail: boolean;
  private failureError?: Error;

  constructor(options?: MockProviderOptions) {
    this.results = options?.customResults ?? [
      {
        title: 'PostgreSQL Cloud Hosting Benchmarks & Pricing 2026',
        url: 'https://example.com/postgres-hosting-pricing',
        content: 'Comprehensive analysis of modern managed PostgreSQL database providers and pricing tiers.',
        publishedDate: '2026-02-15T00:00:00Z',
        score: 0.95,
      },
      {
        title: 'AWS RDS vs Aurora PostgreSQL Cost Comparison',
        url: 'https://aws.example.com/database-pricing',
        content: 'Detailed pricing breakdowns for multi-AZ PostgreSQL deployments on cloud infrastructure.',
        publishedDate: '2026-01-10T00:00:00Z',
        score: 0.89,
      },
    ];
    this.searchTimeMs = options?.searchTimeMs ?? 42;
    this.shouldFail = options?.shouldFail ?? false;
    this.failureError = options?.failureError;
  }

  public setResults(results: RawSearchResult[]): void {
    this.results = results;
  }

  public setShouldFail(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    this.failureError = error;
  }

  public async search(_query: string, options?: SearchOptions): Promise<RawSearchResponse> {
    if (this.shouldFail) {
      throw this.failureError ?? new Error('Mock provider simulated error');
    }

    const limit = options?.maxResults ?? 5;
    return {
      results: this.results.slice(0, limit),
      searchTimeMs: this.searchTimeMs,
    };
  }
}
