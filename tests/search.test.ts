import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { TavilySearchProvider } from '../src/services/search/providers/tavilyProvider';
import { SearchService } from '../src/services/search/searchService';
import { MockSearchProvider } from '../src/services/search/providers/mockProvider';
import {
  SearchAuthenticationError,
  SearchRateLimitError,
  SearchTimeoutError,
  SearchProviderError,
  BadRequestError,
} from '../src/utils/errors';

describe('Web Search Integration (Phase 3)', () => {
  const originalFetch = global.fetch;
  const originalTavilyKey = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TAVILY_API_KEY = 'tvly-test-suite-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalTavilyKey !== undefined) {
      process.env.TAVILY_API_KEY = originalTavilyKey;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  // ==========================================================================
  // 1. Tavily Provider Reliability & Unit Tests
  // ==========================================================================

  describe('TavilySearchProvider', () => {
    it('should throw SearchAuthenticationError if API key is not configured', async () => {
      const provider = new TavilySearchProvider({ apiKey: '' });
      await expect(provider.search('test query')).rejects.toThrow(SearchAuthenticationError);
    });

    it('should parse successful Tavily response with snippet, score, and publication date', async () => {
      const mockApiResponse = {
        query: 'PostgreSQL hosting pricing',
        results: [
          {
            title: 'Cloud SQL for PostgreSQL Pricing',
            url: 'https://cloud.google.com/sql/pricing',
            content: 'Detailed pricing for high-availability managed PostgreSQL instances.',
            published_date: '2026-03-01T00:00:00Z',
            score: 0.98234,
          },
          {
            title: 'Supabase Database Pricing',
            url: 'https://supabase.com/pricing',
            content: 'Free and Pro tiers for PostgreSQL cloud database hosting.',
            published_date: '',
            score: null,
          },
        ],
        response_time: 0.35,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as unknown as Response);

      const provider = new TavilySearchProvider({ apiKey: 'tvly-test-key' });
      const response = await provider.search('PostgreSQL hosting pricing', { maxResults: 5 });

      expect(response.results).toHaveLength(2);
      expect(response.results[0]?.title).toBe('Cloud SQL for PostgreSQL Pricing');
      expect(response.results[0]?.url).toBe('https://cloud.google.com/sql/pricing');
      expect(response.results[0]?.publishedDate).toBe('2026-03-01T00:00:00Z');
      expect(response.results[0]?.score).toBe(0.9823);

      // Score and publishedDate omitted when empty/null
      expect(response.results[1]?.publishedDate).toBeUndefined();
      expect(response.results[1]?.score).toBeUndefined();
    });

    it('should handle empty search results gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ query: 'empty', results: [], response_time: 0.1 }),
      } as unknown as Response);

      const provider = new TavilySearchProvider({ apiKey: 'tvly-test-key' });
      const response = await provider.search('query with no matches');

      expect(response.results).toEqual([]);
      expect(response.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw SearchAuthenticationError and NOT retry on HTTP 401', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: { error: 'Invalid API Key' } }),
      } as unknown as Response);

      global.fetch = fetchSpy;

      const provider = new TavilySearchProvider({
        apiKey: 'tvly-invalid-key',
        retryConfig: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1.5, maxDelayMs: 50 },
      });

      await expect(provider.search('test query')).rejects.toThrow(SearchAuthenticationError);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Crucial: did not retry 401
    });

    it('should throw BadRequestError and NOT retry on HTTP 400', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: { error: 'Query exceeds character length limit' } }),
      } as unknown as Response);

      global.fetch = fetchSpy;

      const provider = new TavilySearchProvider({
        apiKey: 'tvly-valid-key',
        retryConfig: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1.5, maxDelayMs: 50 },
      });

      await expect(provider.search('too long query')).rejects.toThrow(BadRequestError);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Crucial: did not retry 400
    });

    it('should retry on HTTP 429 and throw SearchRateLimitError when retries exhausted', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ detail: { error: 'Rate limit exceeded' } }),
      } as unknown as Response);

      global.fetch = fetchSpy;

      const provider = new TavilySearchProvider({
        apiKey: 'tvly-valid-key',
        retryConfig: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1.5, maxDelayMs: 30 },
      });

      await expect(provider.search('rate limited query')).rejects.toThrow(SearchRateLimitError);
      expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should retry on HTTP 500 and succeed if transient failure resolves', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ message: 'Service Temporarily Unavailable' }),
          } as unknown as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            query: 'recovered',
            results: [{ title: 'Success', url: 'https://example.com', content: 'Recovered data' }],
          }),
        } as unknown as Response);
      });

      const provider = new TavilySearchProvider({
        apiKey: 'tvly-valid-key',
        retryConfig: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1.5, maxDelayMs: 30 },
      });

      const response = await provider.search('recovering query');
      expect(callCount).toBe(2);
      expect(response.results).toHaveLength(1);
    });

    it('should throw SearchTimeoutError when request is aborted by timeout', async () => {
      global.fetch = vi.fn().mockImplementation(
        (_url, options) =>
          new Promise((_, reject) => {
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                const abortErr = new Error('The operation was aborted');
                abortErr.name = 'AbortError';
                reject(abortErr);
              });
            }
          })
      );

      const provider = new TavilySearchProvider({
        apiKey: 'tvly-valid-key',
        timeoutMs: 50, // Short timeout for test
      });

      await expect(provider.search('timeout query')).rejects.toThrow(SearchTimeoutError);
    });

    it('should throw SearchProviderError on malformed provider response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ unexpected: 'no results array' }),
      } as unknown as Response);

      const provider = new TavilySearchProvider({ apiKey: 'tvly-valid-key' });
      await expect(provider.search('malformed payload query')).rejects.toThrow(SearchProviderError);
    });
  });

  // ==========================================================================
  // 2. SearchService Normalization & Citation Indexing
  // ==========================================================================

  describe('SearchService', () => {
    it('should sanitize input query and extract canonical domains', async () => {
      const mockProvider = new MockSearchProvider({
        customResults: [
          {
            title: 'Example',
            url: 'https://subdomain.example.co.uk/path/to/page',
            content: 'Snippet',
          },
        ],
      });

      const service = new SearchService(mockProvider);
      const res = await service.search('   What    is     PostgreSQL?   ');

      expect(res.query).toBe('What is PostgreSQL?');
      expect(res.results[0]?.source).toBe('subdomain.example.co.uk');
      expect(res.results[0]?.id).toBe('source-1');
      expect(res.results[0]?.index).toBe(1);
    });

    it('should throw BadRequestError on empty or single-character query', async () => {
      const service = new SearchService(new MockSearchProvider());
      await expect(service.search('')).rejects.toThrow(BadRequestError);
      await expect(service.search('   ')).rejects.toThrow(BadRequestError);
      await expect(service.search('a')).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError on query exceeding 500 characters', async () => {
      const service = new SearchService(new MockSearchProvider());
      const hugeQuery = 'a'.repeat(501);
      await expect(service.search(hugeQuery)).rejects.toThrow(BadRequestError);
    });
  });

  // ==========================================================================
  // 3. Search API Route (POST /api/search) Integration Tests
  // ==========================================================================

  describe('POST /api/search Endpoint', () => {
    it('should return 200 with structured search results and metadata', async () => {
      const mockApiResponse = {
        query: 'PostgreSQL vs MySQL',
        results: [
          {
            title: 'PostgreSQL vs MySQL Comparison',
            url: 'https://aws.amazon.com/compare/spec/postgresql-vs-mysql/',
            content: 'Deep dive into feature sets, JSON performance, and concurrency models.',
            published_date: '2026-01-20T00:00:00Z',
            score: 0.94,
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as unknown as Response);

      const res = await request(app)
        .post('/api/search')
        .send({ query: 'PostgreSQL vs MySQL', maxResults: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('query', 'PostgreSQL vs MySQL');
      expect(res.body.data).toHaveProperty('results');
      expect(res.body.data.results).toHaveLength(1);

      const item = res.body.data.results[0];
      expect(item.id).toBe('source-1');
      expect(item.index).toBe(1);
      expect(item.title).toBe('PostgreSQL vs MySQL Comparison');
      expect(item.url).toBe('https://aws.amazon.com/compare/spec/postgresql-vs-mysql/');
      expect(item.source).toBe('aws.amazon.com');
      expect(item.publishedDate).toBe('2026-01-20T00:00:00Z');
      expect(item.relevanceScore).toBe(0.94);

      expect(res.body.data.metadata).toHaveProperty('totalResults', 1);
      expect(res.body.data.metadata).toHaveProperty('searchTimeMs');
      expect(res.body.data.metadata).toHaveProperty('provider', 'tavily');
    });

    it('should return 400 VALIDATION_ERROR when query is missing', async () => {
      const res = await request(app).post('/api/search').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR when maxResults is less than 1 or exceeds 20', async () => {
      const resLow = await request(app)
        .post('/api/search')
        .send({ query: 'Valid query', maxResults: 0 });

      expect(resLow.status).toBe(400);
      expect(resLow.body.error.code).toBe('VALIDATION_ERROR');

      const resHigh = await request(app)
        .post('/api/search')
        .send({ query: 'Valid query', maxResults: 25 });

      expect(resHigh.status).toBe(400);
      expect(resHigh.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR when query exceeds 500 characters', async () => {
      const res = await request(app)
        .post('/api/search')
        .send({ query: 'q'.repeat(501) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
