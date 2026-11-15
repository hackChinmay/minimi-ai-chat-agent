import { ConversationService, conversationService as defaultConvService } from '../memory/conversationService';
import { SnapshotStorageAdapter } from './types';
import { snapshotStorage as defaultSnapshotStorage } from './snapshotStore';
import { HistoricalSnapshot, HistoricalQueryOptions, ComparisonObservation } from './types';
import { ConversationMessage } from '../../types';
import { logger } from '../../utils/logger';

export interface HistoricalRetrievalResult {
  conversationId: string;
  snapshots: HistoricalSnapshot[];
  relevantMessages: ConversationMessage[];
  totalSnapshots: number;
}

export class HistoricalRetrievalService {
  private readonly convService: ConversationService;
  private readonly snapshotStore: SnapshotStorageAdapter;

  constructor(convService?: ConversationService, snapshotStore?: SnapshotStorageAdapter) {
    this.convService = convService ?? defaultConvService;
    this.snapshotStore = snapshotStore ?? defaultSnapshotStorage;
  }

  /**
   * Retrieves historical snapshots and contextual messages for a specific conversation.
   */
  public async getHistory(
    conversationId: string,
    options?: HistoricalQueryOptions
  ): Promise<HistoricalRetrievalResult> {
    // 1. Verify conversation exists (ensures 404 if missing)
    await this.convService.getConversation(conversationId);

    // 2. Fetch structured snapshots
    const snapshots = await this.snapshotStore.getSnapshots(conversationId, options);

    // 3. Fetch conversation messages matching entity/keyword
    const allMessages = await this.convService.getMessages(conversationId, {
      limit: options?.limit ?? 50,
    });

    let relevantMessages = allMessages;
    if (options?.entity || options?.query) {
      const term = (options.entity || options.query)!.toLowerCase();
      relevantMessages = allMessages.filter((m) =>
        m.content.toLowerCase().includes(term)
      );
    }

    if (options?.since) {
      const sinceMs = new Date(options.since).getTime();
      if (!isNaN(sinceMs)) {
        relevantMessages = relevantMessages.filter(
          (m) => new Date(m.createdAt).getTime() >= sinceMs
        );
      }
    }

    if (options?.until) {
      const untilMs = new Date(options.until).getTime();
      if (!isNaN(untilMs)) {
        relevantMessages = relevantMessages.filter(
          (m) => new Date(m.createdAt).getTime() <= untilMs
        );
      }
    }

    logger.debug(
      `Retrieved history for [${conversationId}]: ${snapshots.length} snapshots, ${relevantMessages.length} relevant messages`
    );

    return {
      conversationId,
      snapshots,
      relevantMessages,
      totalSnapshots: snapshots.length,
    };
  }

  /**
   * Retrieves contextual history matching query terms and optional filters.
   */
  public async retrieveContextualHistory(
    conversationId: string,
    query?: string,
    options?: HistoricalQueryOptions
  ): Promise<HistoricalRetrievalResult> {
    return this.getHistory(conversationId, {
      ...options,
      query: query ?? options?.query,
    });
  }

  /**
   * Finds the best historical baseline claim for an entity and attribute in a conversation.
   * Priority:
   * 1. Structured historical snapshot in snapshot store.
   * 2. Mined factual claim from previous assistant messages.
   */
  public async findHistoricalClaim(
    conversationId: string,
    entity: string,
    attribute?: string
  ): Promise<ComparisonObservation | null> {
    // 1. Check snapshot store
    const latestSnapshot = await this.snapshotStore.findLatestSnapshot(
      conversationId,
      entity,
      attribute
    );

    if (latestSnapshot) {
      return {
        value: latestSnapshot.value,
        period: latestSnapshot.validPeriod,
        timestamp: latestSnapshot.observedAt,
        sourceUrl: latestSnapshot.sourceUrl,
        sourceTitle: latestSnapshot.sourceTitle,
      };
    }

    // 2. Mine prior assistant messages
    const messages = await this.convService.getMessages(conversationId, { limit: 20 });
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    const entLower = entity.toLowerCase();

    for (let i = assistantMessages.length - 1; i >= 0; i--) {
      const msg = assistantMessages[i];
      if (!msg) continue;
      if (msg.content.toLowerCase().includes(entLower)) {
        // Extract currency or version or key phrase
        const priceMatch = msg.content.match(/\$\d+(?:\.\d{2})?(?:\s*(?:\/|\s*per\s*)(?:mo|month|year|user))?/i);
        const versionMatch = msg.content.match(/\bv?\d+\.\d+(?:\.\d+)?\b/);

        let value = priceMatch ? priceMatch[0] : versionMatch ? versionMatch[0] : '';
        if (!value) {
          // Take sentence containing entity
          const sentences = msg.content.split(/[.!?]\s+/);
          const relevantSentence = sentences.find((s) => s.toLowerCase().includes(entLower));
          if (relevantSentence) {
            value = relevantSentence.trim().slice(0, 100);
          }
        }

        if (value) {
          const citations = msg.metadata?.citations as Array<{ url?: string; title?: string }> | undefined;
          const firstSource = citations && citations.length > 0 ? citations[0] : undefined;
          return {
            value,
            timestamp: msg.createdAt,
            sourceUrl: firstSource?.url,
            sourceTitle: firstSource?.title,
          };
        }
      }
    }

    return null;
  }
}

export const historicalRetrievalService = new HistoricalRetrievalService();
