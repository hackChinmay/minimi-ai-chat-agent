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

    // 1. AI Coding Agents (Codex, Claude Code, Copilot, Cursor, Windsurf)
    if (
      q.includes('codex') ||
      q.includes('claude code') ||
      q.includes('copilot') ||
      q.includes('coding agent') ||
      q.includes('ai agent') ||
      q.includes('cursor') ||
      q.includes('windsurf')
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

    // 2. PostgreSQL / Cloud Databases / Aurora
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

    // 3. Node.js / WASI
    if (q.includes('node') || q.includes('wasi') || q.includes('webassembly')) {
      return [
        {
          title: '[SIMULATED] Node.js 22 LTS Release Notes & Architecture Guide',
          url: 'https://nodejs.org/en/blog/release/v22-lts',
          content: 'Node.js 22 LTS introduces V8 12.4, Maglev compiler enabled by default, built-in WebSocket client stabilization, and default ESM graph execution improvements.',
          publishedDate: '2026-04-20T00:00:00Z',
          score: 0.96,
        },
        {
          title: '[SIMULATED] WASI 0.2 Preview 2 Specification & Component Model',
          url: 'https://wasi.dev/specs/preview-2',
          content: 'WASI Preview 2 specifies standard component model interfaces for HTTP proxying, socket IO, and cross-language capability isolation.',
          publishedDate: '2026-03-15T00:00:00Z',
          score: 0.91,
        },
      ];
    }

    // 4. Python
    if (q.includes('python')) {
      return [
        {
          title: '[SIMULATED] What Is New In Python 3.13 Overview',
          url: 'https://docs.python.org/3/whatsnew/3.13.html',
          content: 'Python 3.13 features an experimental free-threaded build (PEP 703) disabling the Global Interpreter Lock (GIL), JIT compiler preview, and improved interactive shell.',
          publishedDate: '2026-10-01T00:00:00Z',
          score: 0.97,
        },
      ];
    }

    // 5. TypeScript
    if (q.includes('typescript')) {
      return [
        {
          title: '[SIMULATED] TypeScript Releases and Feature Roadmap',
          url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-5-6',
          content: 'TypeScript 5.6 brings iterator helper methods, strict built-in type guards, and fast project reference builds.',
          publishedDate: '2026-09-12T00:00:00Z',
          score: 0.95,
        },
      ];
    }

    // 6. Security Advisories / OpenSSL CVEs
    if (q.includes('openssl') || q.includes('cve') || q.includes('security')) {
      return [
        {
          title: '[SIMULATED] OpenSSL Security Advisories and Vulnerability Tracker 2026',
          url: 'https://www.openssl.org/news/vulnerabilities.html',
          content: 'OpenSSL releases security update fixing timing side-channel vulnerabilities in AES-GCM decryption across TLS 1.3 handshakes.',
          publishedDate: '2026-10-22T00:00:00Z',
          score: 0.94,
        },
      ];
    }

    // 7. Model Context Protocol (MCP)
    if (q.includes('mcp') || q.includes('model context protocol')) {
      return [
        {
          title: '[SIMULATED] Anthropic Model Context Protocol (MCP) Specification',
          url: 'https://docs.anthropic.com/en/docs/agents-and-tools/mcp',
          content: 'The Model Context Protocol (MCP) standardizes how AI applications connect to external data sources and developer tools via JSON-RPC over stdio and SSE transports.',
          publishedDate: '2026-11-01T00:00:00Z',
          score: 0.97,
        },
      ];
    }

    // 8. Microservices / Architecture
    if (q.includes('microservice') || q.includes('distributed')) {
      return [
        {
          title: '[SIMULATED] Modern Microservices Architecture Best Practices',
          url: 'https://martinfowler.com/articles/microservices.html',
          content: 'Core principles of microservices: decentralized data management, domain-driven boundaries, automated testing, and observable distributed tracing.',
          publishedDate: '2026-01-15T00:00:00Z',
          score: 0.93,
        },
      ];
    }

    // 9. Claude pricing follow-up
    if (q.includes('claude') && (q.includes('cost') || q.includes('price') || q.includes('pricing'))) {
      return [
        {
          title: '[SIMULATED] Anthropic Claude Pro & API Pricing Details',
          url: 'https://docs.anthropic.com/en/pricing',
          content: 'Claude Pro subscription is priced at $20/month + applicable taxes, offering priority bandwidth and early access to research models.',
          publishedDate: '2026-11-01T00:00:00Z',
          score: 0.99,
        },
      ];
    }

    // 10. Unrecognized query topic: returns empty array to test empty search degradation
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
