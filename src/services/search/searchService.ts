import { SearchProvider } from './types';
import { createSearchProvider } from './searchProviderFactory';
import { SearchOptions, SearchResponseData, SearchResultItem } from '../../types';
import { BadRequestError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { SearchCache, searchCache as defaultSearchCache, CacheStats } from './searchCache';

export class SearchService {
  private readonly provider: SearchProvider;
  private readonly cache: SearchCache;

  constructor(provider?: SearchProvider, cache?: SearchCache) {
    this.provider = provider ?? createSearchProvider();
    this.cache = cache ?? defaultSearchCache;
  }

  public get providerName(): string {
    return this.provider.name;
  }

  public getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  public clearCache(): void {
    this.cache.reset();
  }

  /**
   * Sanitizes and validates the incoming search query.
   */
  public sanitizeQuery(query: string): string {
    if (typeof query !== 'string') {
      throw new BadRequestError('Search query must be a string');
    }

    // Collapse multiple consecutive spaces/tabs/newlines into a single space
    const cleaned = query.replace(/\s+/g, ' ').trim();

    if (cleaned.length < 2) {
      throw new BadRequestError('Search query must be at least 2 characters long');
    }

    if (cleaned.length > 500) {
      throw new BadRequestError('Search query exceeds maximum allowed length of 500 characters');
    }

    return cleaned;
  }

  /**
   * Extracts clean domain hostname from a URL.
   */
  public extractDomain(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Executes search via configured provider (with LRU/TTL caching) and normalizes results.
   */
  public async search(rawQuery: string, options?: SearchOptions): Promise<SearchResponseData> {
    const query = this.sanitizeQuery(rawQuery);
    const maxResults = Math.min(Math.max(options?.maxResults ?? 5, 1), 20);

    // 1. Check in-memory search cache
    const cachedResponse = this.cache.get(query, maxResults);
    if (cachedResponse) {
      logger.debug(`Search cache HIT for query "${query}" [maxResults=${maxResults}]`);
      return cachedResponse;
    }

    logger.info(`Executing web search via [${this.provider.name}]`, { query, maxResults });

    // 2. Execute live search provider
    const rawResponse = await this.provider.search(query, {
      ...options,
      maxResults,
    });

    // 3. Result Normalization & Citation Indexing
    const normalizedResults: SearchResultItem[] = rawResponse.results.map((rawItem, idx) => {
      const index = idx + 1;
      const normalized: SearchResultItem = {
        id: `source-${index}`,
        index,
        title: rawItem.title || 'Untitled',
        url: rawItem.url,
        content: rawItem.content || '',
        source: this.extractDomain(rawItem.url),
      };

      if (rawItem.publishedDate) {
        normalized.publishedDate = rawItem.publishedDate;
      }

      if (typeof rawItem.score === 'number') {
        normalized.relevanceScore = rawItem.score;
      }

      return normalized;
    });

    const responseData: SearchResponseData = {
      query,
      results: normalizedResults,
      metadata: {
        totalResults: normalizedResults.length,
        searchTimeMs: rawResponse.searchTimeMs,
        provider: this.provider.name,
      },
    };

    // 4. Store in search cache
    this.cache.set(query, maxResults, responseData);

    return responseData;
  }
}

export const searchService = new SearchService();
