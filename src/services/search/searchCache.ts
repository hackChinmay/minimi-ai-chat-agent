import { env } from '../../config/env';
import { SearchResponseData } from '../../types';

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  accessSeq: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  size: number;
  maxEntries: number;
}

export interface SearchCacheOptions {
  enabled?: boolean;
  ttlMs?: number;
  maxEntries?: number;
}

export class SearchCache {
  private readonly store = new Map<string, CacheEntry<SearchResponseData>>();
  private readonly enabled: boolean;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  private hits = 0;
  private misses = 0;
  private accessCounter = 0;

  constructor(options?: SearchCacheOptions) {
    this.enabled = options?.enabled ?? env.SEARCH_CACHE_ENABLED;
    this.ttlMs = options?.ttlMs ?? env.SEARCH_CACHE_TTL_MS;
    this.maxEntries = options?.maxEntries ?? env.SEARCH_CACHE_MAX_ENTRIES;
  }

  /**
   * Generates a deterministic canonical cache key from normalized query and maxResults.
   */
  public generateKey(query: string, maxResults: number): string {
    const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
    return `${normalized}::${maxResults}`;
  }

  /**
   * Retrieves cached search results if present and not expired.
   */
  public get(query: string, maxResults: number): SearchResponseData | null {
    if (!this.enabled) {
      return null;
    }

    const key = this.generateKey(query, maxResults);
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry) {
      this.misses += 1;
      return null;
    }

    if (now > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }

    // Update LRU access timestamp and counter
    entry.lastAccessedAt = now;
    entry.accessSeq = ++this.accessCounter;
    this.hits += 1;

    // Return a deep copy or reconstructed object to prevent external mutation
    return {
      query: entry.value.query,
      results: entry.value.results.map((r) => ({ ...r })),
      metadata: {
        ...entry.value.metadata,
        cached: true,
        cachedAt: new Date(entry.createdAt).toISOString(),
        searchTimeMs: 0, // Cache hits resolve in 0ms (sub-millisecond)
      },
    };
  }

  /**
   * Stores search results with TTL and enforces max capacity eviction.
   */
  public set(query: string, maxResults: number, data: SearchResponseData): void {
    if (!this.enabled) {
      return;
    }

    const key = this.generateKey(query, maxResults);
    const now = Date.now();

    // Evict expired entries or oldest if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evict();
    }

    this.store.set(key, {
      key,
      value: {
        query: data.query,
        results: data.results.map((r) => ({ ...r })),
        metadata: { ...data.metadata },
      },
      createdAt: now,
      lastAccessedAt: now,
      accessSeq: ++this.accessCounter,
      expiresAt: now + this.ttlMs,
    });
  }

  /**
   * Evicts expired items or the least-recently-accessed entry.
   */
  private evict(): void {
    const now = Date.now();
    // 1. Clean expired entries first
    for (const [k, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(k);
      }
    }

    // 2. If still at or over capacity, remove least-recently-accessed by sequence
    if (this.store.size >= this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestSeq = Infinity;

      for (const [k, entry] of this.store.entries()) {
        if (entry.accessSeq < oldestSeq) {
          oldestSeq = entry.accessSeq;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }
  }

  /**
   * Clears all cached items and resets metrics.
   */
  public reset(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.accessCounter = 0;
  }

  /**
   * Returns current cache statistics.
   */
  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      totalRequests: total,
      hitRate: total > 0 ? Number(((this.hits / total) * 100).toFixed(2)) : 0,
      size: this.store.size,
      maxEntries: this.maxEntries,
    };
  }
}

export const searchCache = new SearchCache();
