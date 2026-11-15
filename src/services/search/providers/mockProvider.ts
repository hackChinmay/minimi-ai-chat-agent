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
  private customResults?: RawSearchResult[];
  private searchTimeMs: number;
  private shouldFail: boolean;
  private failureError?: Error;

  constructor(options?: MockProviderOptions) {
    this.customResults = options?.customResults;
    this.searchTimeMs = options?.searchTimeMs ?? 42;
    this.shouldFail = options?.shouldFail ?? false;
    this.failureError = options?.failureError;
  }

  public setResults(results: RawSearchResult[]): void {
    this.customResults = results;
  }

  public setShouldFail(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    this.failureError = error;
  }

  /**
   * Generates topic-specific simulated search fixtures labeled clearly as simulated test data.
   * Never returns placeholder domains like example.com or aws.example.com.
   */
  private getTopicSimulatedResults(query: string): RawSearchResult[] {
    const q = query.toLowerCase();

    // 1. AI Coding Agents (Codex, Claude Code, Copilot)
    if (
      q.includes('codex') ||
      q.includes('claude code') ||
      q.includes('copilot') ||
      q.includes('coding agent') ||
      q.includes('ai agent')
    ) {
      return [
        {
          title: '[SIMULATED] Comparative Analysis of AI Coding Agents 2026: OpenAI Codex, Claude Code, GitHub Copilot',
          url: 'https://simulated.ai/reports/ai-coding-agents-2026',
          content: 'Benchmark evaluation of AI coding agents in November 2026: Claude Code excels in agentic terminal workflows ($20/mo Pro tier); GitHub Copilot leads in IDE integration with free tier for verified students ($10/mo for Pro); OpenAI Codex powers background code synthesis and reasoning.',
          publishedDate: '2026-11-01T00:00:00Z',
          score: 0.98,
        },
        {
          title: '[SIMULATED] Developer Productivity and Coding Capabilities Review: Coding Agents Benchmark 2026',
          url: 'https://simulated.ai/benchmarks/coding-agents-productivity',
          content: 'Developer productivity study across 1,000 engineers: GitHub Copilot offers the lowest friction for students ($0 for students via GitHub Student Developer Pack), Claude Code delivers highest multi-file refactoring accuracy, and OpenAI Codex excels in specialized autonomous completions.',
          publishedDate: '2026-11-05T00:00:00Z',
          score: 0.92,
        },
      ];
    }

    // 2. PostgreSQL / Cloud Databases
    if (
      q.includes('postgres') ||
      q.includes('database') ||
      q.includes('aurora') ||
      q.includes('cloud sql')
    ) {
      return [
        {
          title: '[SIMULATED] PostgreSQL Cloud Hosting Benchmarks & Pricing 2026',
          url: 'https://cloud.google.com/sql/pricing/simulated-2026',
          content: 'Comprehensive analysis of modern managed PostgreSQL database providers and pricing tiers in 2026. Standard instances start at $0.05/hr with auto-scaling storage options.',
          publishedDate: '2026-02-15T00:00:00Z',
          score: 0.95,
        },
        {
          title: '[SIMULATED] AWS RDS vs Aurora PostgreSQL Cost Comparison 2026',
          url: 'https://supabase.com/pricing/simulated-2026',
          content: 'Detailed pricing breakdowns for multi-AZ PostgreSQL deployments on cloud infrastructure with serverless compute options.',
          publishedDate: '2026-01-10T00:00:00Z',
          score: 0.89,
        },
      ];
    }

    // 3. Unrecognized query topic: returns empty array to test empty search degradation
    return [];
  }

  public async search(query: string, options?: SearchOptions): Promise<RawSearchResponse> {
    if (this.shouldFail) {
      throw this.failureError ?? new Error('Mock provider simulated error');
    }

    const available =
      this.customResults !== undefined
        ? this.customResults
        : this.getTopicSimulatedResults(query);

    const limit = options?.maxResults ?? 5;
    return {
      results: available.slice(0, limit),
      searchTimeMs: this.searchTimeMs,
    };
  }
}
