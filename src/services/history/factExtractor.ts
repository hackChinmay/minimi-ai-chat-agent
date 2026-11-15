import { randomUUID } from 'node:crypto';
import { SnapshotStorageAdapter, HistoricalSnapshot } from './types';
import { snapshotStorage as defaultSnapshotStorage } from './snapshotStore';
import { SearchResultItem } from '../../types';
import { logger } from '../../utils/logger';

export class FactExtractor {
  private readonly snapshotStore: SnapshotStorageAdapter;

  constructor(snapshotStore?: SnapshotStorageAdapter) {
    this.snapshotStore = snapshotStore ?? defaultSnapshotStorage;
  }

  /**
   * Automatically extracts and records factual snapshots from an assistant response turn.
   */
  public async extractAndRecord(options: {
    conversationId: string;
    messageId?: string;
    userQuery: string;
    assistantResponse: string;
    sources?: SearchResultItem[];
    observedAt?: string;
  }): Promise<HistoricalSnapshot | null> {
    try {
      const { conversationId, messageId, userQuery, assistantResponse, sources } = options;
      const now = options.observedAt ?? new Date().toISOString();

      // Detect entity from query or response
      const entity = this.detectEntity(userQuery, assistantResponse);
      if (!entity) return null;

      // Detect attribute and value
      const fact = this.detectAttributeAndValue(userQuery, assistantResponse);
      if (!fact) return null;

      const firstSource = sources && sources.length > 0 ? sources[0] : undefined;

      const snapshot = await this.snapshotStore.saveSnapshot({
        id: randomUUID(),
        conversationId,
        messageId,
        entity,
        attribute: fact.attribute,
        value: fact.value,
        validPeriod: new Date(now).getUTCFullYear().toString(),
        observedAt: now,
        retrievedAt: now,
        sourceUrl: firstSource?.url,
        sourceTitle: firstSource?.title,
      });

      logger.debug(
        `Recorded historical snapshot for [${conversationId}]: ${entity} (${fact.attribute} = ${fact.value})`
      );

      return snapshot;
    } catch (err: unknown) {
      // Non-fatal: do not crash conversation flow if background extraction fails
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`Background fact extraction skipped: ${msg}`);
      return null;
    }
  }

  private detectEntity(query: string, content: string): string | null {
    // 1. Check for bolded entities in content (e.g., **Figma**, **PostgreSQL**)
    const boldMatch = content.match(/\*\*([A-Za-z0-9\s._-]{2,30})\*\*/);
    if (boldMatch && boldMatch[1]) {
      return boldMatch[1].trim();
    }

    // 2. Extract from query: "price of X", "tell me about X", "how much is X", "how much does X cost"
    const queryMatch = query.match(
      /(?:price\s+of|cost\s+of|about|how\s+much\s+(?:is|does))\s+([A-Za-z0-9\s._-]{2,35})/i
    );
    if (queryMatch && queryMatch[1]) {
      return queryMatch[1]
        .replace(/\s+(cost|costs|pricing|price|charge)\b/i, '')
        .replace(/[?!.,;:]+$/, '')
        .trim();
    }

    // 3. Short capitalized subject
    const words = query.trim().split(/\s+/);
    if (words.length <= 4 && !/^(hi|hello|thanks|ok|help)\b/i.test(query)) {
      return query.replace(/[?!.]+$/, '').trim();
    }

    return null;
  }

  private detectAttributeAndValue(
    query: string,
    content: string
  ): { attribute: string; value: string } | null {
    const isPricing = /\b(price|pricing|cost|subscription|fee|tier)\b/i.test(query) || /\$\d+/.test(content);
    if (isPricing) {
      const priceMatch = content.match(/\$\d+(?:\.\d{2})?(?:\s*(?:\/|\s*per\s*)(?:mo|month|year|user))?/i);
      if (priceMatch) {
        return { attribute: 'price', value: priceMatch[0].trim() };
      }
    }

    const isVersion = /\b(version|release|lts)\b/i.test(query);
    if (isVersion) {
      const versionMatch = content.match(/\bv?\d+\.\d+(?:\.\d+)?\b/);
      if (versionMatch) {
        return { attribute: 'version', value: versionMatch[0].trim() };
      }
    }

    return null;
  }
}

export const factExtractor = new FactExtractor();
