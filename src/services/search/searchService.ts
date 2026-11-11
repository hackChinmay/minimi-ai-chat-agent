import { SearchProvider } from './types';
import { createSearchProvider } from './searchProviderFactory';
import { SearchOptions, SearchResponseData, SearchResultItem } from '../../types';
import { BadRequestError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class SearchService {
  private readonly provider: SearchProvider;

  constructor(provider?: SearchProvider) {
    this.provider = provider ?? createSearchProvider();
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
   * Executes search via configured provider and normalizes results.
   */
  public async search(rawQuery: string, options?: SearchOptions): Promise<SearchResponseData> {
    const query = this.sanitizeQuery(rawQuery);
    const maxResults = Math.min(Math.max(options?.maxResults ?? 5, 1), 20);

    logger.info(`Executing web search via [${this.provider.name}]`, { query, maxResults });

    const rawResponse = await this.provider.search(query, {
      ...options,
      maxResults,
    });

    // Result Normalization & Citation Indexing
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

    return {
      query,
      results: normalizedResults,
      metadata: {
        totalResults: normalizedResults.length,
        searchTimeMs: rawResponse.searchTimeMs,
        provider: this.provider.name,
      },
    };
  }
}

export const searchService = new SearchService();
