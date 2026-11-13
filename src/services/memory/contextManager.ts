import { env } from '../../config/env';
import { ConversationMessage, ConversationContext, ContextWindowOptions, ContextSummarizer } from './types';

export class ContextManager {
  private readonly defaultMaxMessages: number;
  private readonly summarizer?: ContextSummarizer;

  constructor(options?: { defaultMaxMessages?: number; summarizer?: ContextSummarizer }) {
    this.defaultMaxMessages = options?.defaultMaxMessages ?? env.MAX_CONTEXT_MESSAGES;
    this.summarizer = options?.summarizer;
  }

  /**
   * Builds a token-efficient sliding context window from raw conversation history.
   * Preserves any initial system prompt, and slices the most recent N messages.
   */
  public buildContextWindow(
    conversationId: string,
    allMessages: ConversationMessage[],
    options?: ContextWindowOptions
  ): ConversationContext {
    const maxMessages = options?.maxMessages ?? this.defaultMaxMessages;
    const maxChars = options?.maxCharacters;

    if (allMessages.length === 0) {
      return {
        conversationId,
        messages: [],
        totalStoredMessages: 0,
        windowSize: 0,
        hasTruncatedHistory: false,
      };
    }

    // Separate system messages (anchor) from conversational turns
    const systemMessages = allMessages.filter((m) => m.role === 'system');
    const nonSystemMessages = allMessages.filter((m) => m.role !== 'system');

    // Slice recent non-system messages
    let selectedTurns = nonSystemMessages.slice(-maxMessages);

    // Apply character budget if specified
    if (maxChars && maxChars > 0) {
      selectedTurns = this.applyCharacterBudget(selectedTurns, maxChars);
    }

    // Combined context preserves system instructions first, followed by recent turns
    const contextMessages = [...systemMessages, ...selectedTurns];
    const hasTruncated = allMessages.length > contextMessages.length;

    return {
      conversationId,
      messages: contextMessages,
      totalStoredMessages: allMessages.length,
      windowSize: contextMessages.length,
      hasTruncatedHistory: hasTruncated,
    };
  }

  /**
   * Trims messages from the beginning of the selection until the total character length
   * is within budget.
   */
  private applyCharacterBudget(
    messages: ConversationMessage[],
    maxCharacters: number
  ): ConversationMessage[] {
    const result: ConversationMessage[] = [];
    let currentLength = 0;

    // Traverse from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;

      const msgLength = msg.content.length;
      if (currentLength + msgLength <= maxCharacters || result.length === 0) {
        result.unshift(msg);
        currentLength += msgLength;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Hook for future Phase 5 summarization.
   */
  public async generateSummary(olderMessages: ConversationMessage[]): Promise<string | null> {
    if (!this.summarizer || olderMessages.length === 0) {
      return null;
    }
    return this.summarizer.summarize(olderMessages);
  }
}

export const contextManager = new ContextManager();
