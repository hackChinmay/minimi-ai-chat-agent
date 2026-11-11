import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';
import {
  SearchProviderError,
  SearchTimeoutError,
  SearchRateLimitError,
  SearchAuthenticationError,
  BadRequestError,
} from '../../../utils/errors';
import { SearchOptions } from '../../../types';
import { RawSearchResponse, RawSearchResult, SearchProvider, RetryConfig } from '../types';

export interface TavilyProviderOptions {
  apiKey?: string;
  timeoutMs?: number;
  baseUrl?: string;
  retryConfig?: Partial<RetryConfig>;
}

export class TavilySearchProvider implements SearchProvider {
  public readonly name = 'tavily';
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private readonly retryConfig: RetryConfig;

  constructor(options?: TavilyProviderOptions) {
    this.apiKey = options?.apiKey;
    this.timeoutMs = options?.timeoutMs ?? env.SEARCH_TIMEOUT_MS;
    this.baseUrl = options?.baseUrl ?? 'https://api.tavily.com/search';
    this.retryConfig = {
      maxRetries: options?.retryConfig?.maxRetries ?? 2,
      initialDelayMs: options?.retryConfig?.initialDelayMs ?? 300,
      backoffMultiplier: options?.retryConfig?.backoffMultiplier ?? 2,
      maxDelayMs: options?.retryConfig?.maxDelayMs ?? 2000,
    };
  }

  public async search(query: string, options?: SearchOptions): Promise<RawSearchResponse> {
    const effectiveKey =
      this.apiKey !== undefined
        ? this.apiKey
        : process.env.TAVILY_API_KEY || env.TAVILY_API_KEY;

    if (!effectiveKey || effectiveKey.trim().length === 0) {
      throw new SearchAuthenticationError('Tavily API key is missing or not configured. Set TAVILY_API_KEY in .env.');
    }

    const timeout = options?.timeoutMs ?? this.timeoutMs;
    const maxResults = options?.maxResults ?? 5;
    const startTime = Date.now();

    let attempt = 0;
    let currentDelay = this.retryConfig.initialDelayMs;

    while (attempt <= this.retryConfig.maxRetries) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeout);

      try {
        logger.debug(`Dispatching Tavily search request (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1})`, {
          query,
          maxResults,
          timeout,
        });

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: effectiveKey,
            query,
            max_results: maxResults,
            search_depth: 'basic',
            include_answer: false,
            include_raw_content: false,
            include_images: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        // 1. Success response
        if (response.ok) {
          const rawData = await response.json();
          const elapsed = Date.now() - startTime;
          return this.parseTavilyResponse(rawData, elapsed);
        }

        // 2. Authentication failure (HTTP 401 / 403) - DO NOT RETRY
        if (response.status === 401 || response.status === 403) {
          logger.warn(`Tavily authentication failure [${response.status}]`);
          throw new SearchAuthenticationError(
            'Tavily search provider authentication failed. Please verify that your TAVILY_API_KEY is valid.'
          );
        }

        // 3. Client error (HTTP 400 / 422) - DO NOT RETRY
        if (response.status === 400 || response.status === 422) {
          let errorDetail = 'Invalid search query';
          try {
            const errorJson = await response.json();
            if (errorJson && typeof errorJson === 'object') {
              const obj = errorJson as Record<string, unknown>;
              const detailObj = obj.detail as Record<string, unknown> | undefined;
              if (detailObj && typeof detailObj === 'object' && typeof detailObj.error === 'string') {
                errorDetail = detailObj.error;
              } else if (typeof obj.message === 'string') {
                errorDetail = obj.message;
              } else {
                errorDetail = JSON.stringify(obj);
              }
            }
          } catch {
            // ignore JSON parse error on error body
          }
          logger.warn(`Tavily client error [${response.status}]: ${errorDetail}`);
          throw new BadRequestError(`Tavily search provider rejected query: ${errorDetail}`);
        }

        // 4. Rate Limiting (HTTP 429) - Retry with backoff if attempts remaining
        if (response.status === 429) {
          logger.warn(`Tavily rate limited [429] (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1})`);
          if (attempt < this.retryConfig.maxRetries) {
            await this.sleepWithJitter(currentDelay);
            currentDelay = Math.min(currentDelay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
            attempt++;
            continue;
          }
          throw new SearchRateLimitError('Tavily search provider rate limit exceeded. Please try again later.');
        }

        // 5. Upstream Server Error (HTTP 500, 502, 503, 504) - Retry if attempts remaining
        if (response.status >= 500) {
          logger.warn(`Tavily server error [${response.status}] (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1})`);
          if (attempt < this.retryConfig.maxRetries) {
            await this.sleepWithJitter(currentDelay);
            currentDelay = Math.min(currentDelay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
            attempt++;
            continue;
          }
          throw new SearchProviderError(`Tavily search provider returned HTTP status ${response.status}`);
        }

        // Unknown status fallback
        throw new SearchProviderError(`Unexpected HTTP response ${response.status} from Tavily search provider`);
      } catch (err: unknown) {
        clearTimeout(timeoutHandle);

        // Do not catch and retry our own domain errors that were intentionally thrown
        if (
          err instanceof SearchAuthenticationError ||
          err instanceof BadRequestError ||
          err instanceof SearchRateLimitError
        ) {
          throw err;
        }

        // Handle timeouts explicitly - Do not retry timeouts
        if (err instanceof Error && (err.name === 'AbortError' || controller.signal.aborted)) {
          logger.warn(`Tavily search timed out after ${timeout}ms`);
          throw new SearchTimeoutError(`Web search request timed out after ${timeout}ms`);
        }

        // Handle network connection failures (transient) - Retry if attempts remaining
        if (attempt < this.retryConfig.maxRetries) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn(
            `Transient network error while contacting Tavily (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}): ${errMsg}`
          );
          await this.sleepWithJitter(currentDelay);
          currentDelay = Math.min(currentDelay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
          attempt++;
          continue;
        }

        // Exhausted retries on unexpected or network error
        if (err instanceof SearchProviderError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : 'Unknown network failure';
        throw new SearchProviderError(`Failed to reach Tavily search service: ${message}`, { originalError: message });
      }
    }

    throw new SearchProviderError('Tavily search provider retry attempts exhausted');
  }

  private parseTavilyResponse(rawData: unknown, searchTimeMs: number): RawSearchResponse {
    if (!rawData || typeof rawData !== 'object') {
      throw new SearchProviderError('Malformed response from Tavily API: Expected JSON object');
    }

    const dataObj = rawData as Record<string, unknown>;

    if (!Array.isArray(dataObj.results)) {
      throw new SearchProviderError('Malformed response from Tavily API: Missing results array');
    }

    const results: RawSearchResult[] = [];

    for (const item of dataObj.results) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const itemObj = item as Record<string, unknown>;

      const title = typeof itemObj.title === 'string' ? itemObj.title.trim() : '';
      const url = typeof itemObj.url === 'string' ? itemObj.url.trim() : '';
      const content = typeof itemObj.content === 'string' ? itemObj.content.trim() : '';

      // Skip invalid items lacking basic URL
      if (!url) {
        continue;
      }

      const result: RawSearchResult = {
        title: title || 'Untitled',
        url,
        content,
      };

      if (typeof itemObj.published_date === 'string' && itemObj.published_date.trim().length > 0) {
        result.publishedDate = itemObj.published_date.trim();
      }

      if (typeof itemObj.score === 'number' && !isNaN(itemObj.score)) {
        result.score = Number(itemObj.score.toFixed(4));
      }

      results.push(result);
    }

    return {
      results,
      searchTimeMs,
    };
  }

  private sleepWithJitter(delayMs: number): Promise<void> {
    const jitter = Math.random() * (delayMs * 0.3); // up to 30% jitter
    return new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
  }
}
