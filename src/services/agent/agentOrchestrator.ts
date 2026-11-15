import { ConversationService, conversationService as defaultConvService } from '../memory/conversationService';
import { SearchService, searchService as defaultSearchService } from '../search/searchService';
import { LLMProvider, LLMChatMessage } from '../llm/types';
import { createLLMProvider } from '../llm/llmProviderFactory';
import { SearchDecisionEngine, searchDecisionEngine as defaultDecisionEngine } from './searchDecisionEngine';
import { QueryRewriter, queryRewriter as defaultQueryRewriter } from './queryRewriter';
import { CitationManager, citationManager as defaultCitationManager } from './citationManager';
import { buildSystemPrompt, HistoricalBaselineOption } from './prompts/systemPrompt';
import { HistoricalRetrievalService, historicalRetrievalService as defaultRetrievalService } from '../history/historicalRetrievalService';
import { FactExtractor, factExtractor as defaultFactExtractor } from '../history/factExtractor';
import { AgentChatInput, AgentChatResult, SearchStatus } from './types';
import { SearchResultItem } from '../../types';
import { BadRequestError, ConflictError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

export interface AgentOrchestratorOptions {
  conversationService?: ConversationService;
  searchService?: SearchService;
  llmProvider?: LLMProvider;
  decisionEngine?: SearchDecisionEngine;
  queryRewriter?: QueryRewriter;
  citationManager?: CitationManager;
  retrievalService?: HistoricalRetrievalService;
  factExtractor?: FactExtractor;
}

export class AgentOrchestrator {
  private readonly conversationService: ConversationService;
  private readonly searchService: SearchService;
  private readonly llmProvider: LLMProvider;
  private readonly decisionEngine: SearchDecisionEngine;
  private readonly queryRewriter: QueryRewriter;
  private readonly citationManager: CitationManager;
  private readonly retrievalService: HistoricalRetrievalService;
  private readonly factExtractor: FactExtractor;

  // In-flight request lock & duplicate protection
  private readonly inFlightConversations = new Set<string>();
  private readonly recentRequests = new Map<string, { content: string; timestamp: number }>();

  constructor(options?: AgentOrchestratorOptions) {
    this.conversationService = options?.conversationService ?? defaultConvService;
    this.searchService = options?.searchService ?? defaultSearchService;
    this.llmProvider = options?.llmProvider ?? createLLMProvider();
    this.decisionEngine = options?.decisionEngine ?? defaultDecisionEngine;
    this.queryRewriter = options?.queryRewriter ?? defaultQueryRewriter;
    this.citationManager = options?.citationManager ?? defaultCitationManager;
    this.retrievalService = options?.retrievalService ?? defaultRetrievalService;
    this.factExtractor = options?.factExtractor ?? defaultFactExtractor;
  }

  /**
   * Processes an incoming user message through the full conversational agent lifecycle.
   */
  public async processUserMessage(input: AgentChatInput): Promise<AgentChatResult> {
    const startTime = Date.now();
    const { conversationId, message } = input;

    if (!message || typeof message !== 'string') {
      throw new BadRequestError('Message is required and must be a string');
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      throw new BadRequestError('Message cannot be empty or whitespace only');
    }

    if (trimmedMessage.length > env.MAX_MESSAGE_LENGTH) {
      throw new BadRequestError(
        `Message length exceeds maximum allowed limit of ${env.MAX_MESSAGE_LENGTH} characters`
      );
    }

    // 1. Verify conversation exists
    await this.conversationService.getConversation(conversationId);

    // 2. Duplicate request & concurrent turn protection
    if (this.inFlightConversations.has(conversationId)) {
      throw new ConflictError(
        'A request is already actively processing for this conversation. Please wait for it to complete.'
      );
    }

    const lastRecent = this.recentRequests.get(conversationId);
    if (lastRecent && lastRecent.content === trimmedMessage && Date.now() - lastRecent.timestamp < 1500) {
      throw new ConflictError(
        'Duplicate message detected in short interval. Please wait a moment before resending.'
      );
    }

    this.inFlightConversations.add(conversationId);
    this.recentRequests.set(conversationId, { content: trimmedMessage, timestamp: Date.now() });

    try {
      // 3. Retrieve conversation context before appending current turn
      const context = await this.conversationService.getContextWindow(conversationId, {
        maxMessages: env.MAX_CONTEXT_MESSAGES,
      });

      // 4. Persist user turn in memory
      await this.conversationService.appendMessage(conversationId, {
        role: 'user',
        content: trimmedMessage,
      });

      // 5. Intelligent Search Decision
      const now = new Date();
      const decision = this.decisionEngine.evaluate(trimmedMessage, context.messages);
      logger.debug(`Search decision for [${conversationId}]: ${decision.category} (search=${decision.shouldSearch})`);

      let searchStatus: SearchStatus = 'not_needed';
      let searchUsed = false;
      let searchQueries: string[] = [];
      let searchResults: SearchResultItem[] = [];
      let searchTimeMs = 0;
      let searchError: string | undefined;

      // 6. Execute Web Search if indicated
      if (decision.shouldSearch) {
        searchStatus = 'attempted';
        const rewrittenQuery = this.queryRewriter.rewrite(trimmedMessage, context.messages, {
          currentDate: now,
        });
        searchQueries.push(rewrittenQuery);

        try {
          const searchStartTime = Date.now();
          const searchResponse = await this.searchService.search(rewrittenQuery, {
            maxResults: 5,
          });
          searchTimeMs = Date.now() - searchStartTime;
          searchResults = searchResponse.results;
          searchUsed = true;
          searchStatus = 'success';
          logger.debug(
            `Search completed for [${conversationId}] via query: "${rewrittenQuery}" with ${searchResults.length} results in ${searchTimeMs}ms`
          );
        } catch (err: unknown) {
          // Graceful search failure degradation: do not crash the agent turn
          searchUsed = false;
          searchStatus = 'failed';
          searchError = err instanceof Error ? err.message : String(err);
          logger.warn(
            `Web search failed for query "${rewrittenQuery}" in conversation [${conversationId}]. Proceeding with model knowledge: ${searchError}`
          );
        }
      }

      // 7. Historical Context Grounding (if temporal comparison)
      let historicalBaseline: HistoricalBaselineOption | undefined;
      if (decision.category === 'TEMPORAL_COMPARISON') {
        try {
          const historyResults = await this.retrievalService.retrieveContextualHistory(conversationId, trimmedMessage, { limit: 1 });
          const snap = historyResults.snapshots[0];
          if (snap) {
            historicalBaseline = {
              entity: snap.entity,
              attribute: snap.attribute,
              value: snap.value,
              observedAt: snap.observedAt,
              sourceUrl: snap.sourceUrl,
            };
          }
        } catch (err: unknown) {
          logger.warn(`Failed to retrieve historical baseline for [${conversationId}]: ${err}`);
        }
      }

      // 8. Build Grounded Prompts and History
      const systemPromptContent = buildSystemPrompt({
        currentTime: now,
        searchResults: searchUsed ? searchResults : undefined,
        historicalBaseline,
      });

      const llmMessages: LLMChatMessage[] = [
        { role: 'system', content: systemPromptContent },
      ];

      // Append prior conversational messages (omitting any prior raw system prompts)
      for (const msg of context.messages) {
        if (msg.role !== 'system') {
          llmMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Append the current user message
      llmMessages.push({
        role: 'user',
        content: trimmedMessage,
      });

      // 9. Invoke LLM Provider
      logger.debug(`Invoking LLM [${this.llmProvider.name}] for conversation [${conversationId}]`);
      const llmResponse = await this.llmProvider.chat(llmMessages, {
        temperature: env.LLM_TEMPERATURE,
        maxTokens: env.LLM_MAX_TOKENS,
      });

      // 10. Source Attribution & Citation Validation
      const attribution = this.citationManager.extractAndValidate(
        llmResponse.content,
        searchResults
      );

      const totalLatencyMs = Date.now() - startTime;

      // Only validated sources actually cited in the LLM response are certified as finalSources.
      // Raw search results are preserved separately in metadata.rawSearchResults for internal diagnostics.
      const finalSources = attribution.citedSources;
      const rawSearchResults = searchUsed ? searchResults : undefined;
      const providerDiagnostics = {
        llmProvider: this.llmProvider.name,
        searchProvider: this.searchService.providerName,
        rawSearchCount: searchResults.length,
        citedCount: finalSources.length,
      };

      // 11. Persist Assistant Response in Memory
      const assistantMetadata = {
        citations: attribution.citedSources.map((s) => ({
          id: s.id,
          url: s.url,
          title: s.title,
        })),
        sources: finalSources,
        rawSearchResults,
        searchUsed,
        searchStatus,
        searchQueries,
        searchError,
        category: decision.category,
        tokens: llmResponse.usage?.totalTokens,
        latencyMs: totalLatencyMs,
        providerDiagnostics,
      };

      const assistantMsg = await this.conversationService.appendMessage(conversationId, {
        role: 'assistant',
        content: attribution.cleanContent,
        metadata: assistantMetadata,
      });

      // 12. Extract facts and record snapshots for future temporal comparison
      try {
        await this.factExtractor.extractAndRecord({
          conversationId,
          messageId: assistantMsg.id,
          userQuery: trimmedMessage,
          assistantResponse: attribution.cleanContent,
          sources: finalSources,
          observedAt: now.toISOString(),
        });
      } catch (err: unknown) {
        logger.warn(`Fact extraction failed non-critically for conversation [${conversationId}]: ${err}`);
      }

      // 13. Return Structured Result
      return {
        conversationId,
        message: attribution.cleanContent,
        role: 'assistant',
        sources: finalSources,
        searchUsed,
        searchStatus,
        searchQueries,
        metadata: {
          category: decision.category,
          latencyMs: totalLatencyMs,
          tokens: llmResponse.usage?.totalTokens,
          searchTimeMs: searchTimeMs > 0 ? searchTimeMs : undefined,
          searchError,
          rawSearchResults,
          providerDiagnostics,
        },
      };
    } catch (err) {
      // If the turn failed, clear the recent request fingerprint so the user can immediately retry
      this.recentRequests.delete(conversationId);
      throw err;
    } finally {
      this.inFlightConversations.delete(conversationId);
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();
