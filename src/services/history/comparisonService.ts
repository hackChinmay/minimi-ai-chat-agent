import { randomUUID } from 'node:crypto';
import {
  ComparisonRequest,
  ComparisonResult,
  ComparisonVerdict,
  ComparisonObservation,
  SnapshotStorageAdapter,
} from './types';
import { HistoricalRetrievalService, historicalRetrievalService as defaultRetrieval } from './historicalRetrievalService';
import { snapshotStorage as defaultSnapshotStorage } from './snapshotStore';
import { TemporalResolver, temporalResolver as defaultResolver } from './temporalResolver';
import { SearchService, searchService as defaultSearchService } from '../search/searchService';
import { LLMProvider } from '../llm/types';
import { createLLMProvider } from '../llm/llmProviderFactory';
import { ConversationService, conversationService as defaultConvService } from '../memory/conversationService';
import { SearchResultItem } from '../../types';
import { BadRequestError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export interface ComparisonServiceOptions {
  retrievalService?: HistoricalRetrievalService;
  snapshotStore?: SnapshotStorageAdapter;
  temporalResolver?: TemporalResolver;
  searchService?: SearchService;
  llmProvider?: LLMProvider;
  convService?: ConversationService;
}

export class ComparisonService {
  private readonly retrievalService: HistoricalRetrievalService;
  private readonly snapshotStore: SnapshotStorageAdapter;
  private readonly temporalResolver: TemporalResolver;
  private readonly searchService: SearchService;
  private readonly llmProvider: LLMProvider;
  private readonly convService: ConversationService;

  constructor(options?: ComparisonServiceOptions) {
    this.retrievalService = options?.retrievalService ?? defaultRetrieval;
    this.snapshotStore = options?.snapshotStore ?? defaultSnapshotStorage;
    this.temporalResolver = options?.temporalResolver ?? defaultResolver;
    this.searchService = options?.searchService ?? defaultSearchService;
    this.llmProvider = options?.llmProvider ?? createLLMProvider();
    this.convService = options?.convService ?? defaultConvService;
  }

  /**
   * Executes an intelligent historical comparison between prior conversation assertions and live web evidence.
   */
  public async compare(
    conversationId: string,
    request: ComparisonRequest
  ): Promise<ComparisonResult> {
    const startTime = Date.now();

    if (!request.subject || typeof request.subject !== 'string' || request.subject.trim().length === 0) {
      throw new BadRequestError('Subject is required for historical comparison');
    }

    const entity = request.subject.trim();
    const attribute = request.attribute?.trim() || 'pricing';

    // 1. Verify conversation exists
    await this.convService.getConversation(conversationId);

    // 2. Retrieve historical baseline from prior snapshots or messages
    const historicalClaim = await this.retrievalService.findHistoricalClaim(
      conversationId,
      entity,
      attribute
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const currentYear = now.getUTCFullYear().toString();

    // If no prior historical claim exists in conversation
    if (!historicalClaim) {
      logger.info(`No historical baseline found for [${conversationId}]: ${entity}`);
      return {
        conversationId,
        entity,
        attribute,
        verdict: 'UNABLE_TO_VERIFY',
        confidence: 'low',
        historical: {
          value: 'Unknown / Not discussed earlier',
          timestamp: nowIso,
        },
        current: {
          value: 'Not evaluated',
          timestamp: nowIso,
        },
        deltaSummary: 'No prior observation recorded',
        delta: {
          summary: 'No prior observation recorded',
        },
        explanation: `No prior historical baseline was found in this conversation for "${entity}". Please discuss the baseline information first or specify a known historical value.`,
        citations: [],
        sources: [],
        metadata: {
          comparisonTimeMs: Date.now() - startTime,
          searchUsed: false,
          confidence: 'low',
        },
      };
    }

    // 3. Resolve target timeframe using TemporalResolver
    const targetPeriodStr = request.targetDate
      ? this.temporalResolver.resolve(request.targetDate, now).targetPeriod || currentYear
      : currentYear;

    // 4. Retrieve fresh web evidence
    let searchUsed = false;
    let searchResults: SearchResultItem[] = [];
    let searchError: string | undefined;

    const searchQuery = `${entity} ${attribute} ${targetPeriodStr}`;

    try {
      logger.debug(`Fetching current web data for comparison: "${searchQuery}"`);
      const searchRes = await this.searchService.search(searchQuery, { maxResults: 5 });
      searchResults = searchRes.results;
      searchUsed = true;
    } catch (err: unknown) {
      searchUsed = false;
      searchError = err instanceof Error ? err.message : String(err);
      logger.warn(`Search failed during comparison for ${entity}: ${searchError}`);
    }

    // 5. Handle empty or failed search results
    if (searchResults.length === 0) {
      return {
        conversationId,
        entity,
        attribute,
        verdict: 'UNABLE_TO_VERIFY',
        confidence: 'low',
        historical: historicalClaim,
        current: {
          value: 'Live verification unavailable',
          period: targetPeriodStr,
          timestamp: nowIso,
        },
        deltaSummary: 'Unable to verify current status',
        delta: {
          summary: 'Unable to verify current status',
        },
        explanation: searchError
          ? `Live web search was unavailable due to a network/service issue (${searchError}). Could not verify if "${entity}" ${attribute} has changed.`
          : `Live web search returned no reliable results for "${entity} ${attribute} ${targetPeriodStr}". Cannot confirm whether values changed.`,
        citations: [],
        sources: [],
        metadata: {
          comparisonTimeMs: Date.now() - startTime,
          searchUsed,
          confidence: 'low',
          searchError,
        },
      };
    }

    // 6. Extract Current Value from Search Evidence
    const currentObservation = this.extractCurrentValueFromSearchResults(
      searchResults,
      attribute,
      targetPeriodStr,
      nowIso
    );

    // 7. Determine Verdict & Delta Summary
    const { verdict, deltaSummary, confidence, numericDelta, percentageChange } = this.calculateDelta(
      historicalClaim.value,
      currentObservation.value
    );

    // 8. Generate Human-Readable Explanation via LLM
    let explanation: string;
    try {
      explanation = await this.generateExplanation({
        entity,
        attribute,
        historical: historicalClaim,
        current: currentObservation,
        verdict,
        deltaSummary,
        searchResults,
      });
    } catch {
      // Deterministic fallback if LLM synthesis throws
      explanation = this.generateFallbackExplanation(
        entity,
        attribute,
        historicalClaim,
        currentObservation,
        verdict,
        deltaSummary
      );
    }

    // 9. Save current observation as a new snapshot in memory
    try {
      await this.snapshotStore.saveSnapshot({
        id: randomUUID(),
        conversationId,
        entity,
        attribute,
        value: currentObservation.value,
        validPeriod: targetPeriodStr,
        observedAt: nowIso,
        retrievedAt: nowIso,
        sourceUrl: currentObservation.sourceUrl,
        sourceTitle: currentObservation.sourceTitle,
      });
    } catch (err) {
      logger.debug(`Failed to record post-comparison snapshot: ${err}`);
    }

    return {
      conversationId,
      entity,
      attribute,
      verdict,
      confidence,
      historical: historicalClaim,
      current: currentObservation,
      deltaSummary,
      delta: {
        summary: deltaSummary,
        numericDelta,
        percentageChange,
      },
      explanation,
      citations: searchResults,
      sources: searchResults,
      metadata: {
        comparisonTimeMs: Date.now() - startTime,
        searchUsed: true,
        confidence,
        searchError,
      },
    };
  }

  /**
   * Evaluates delta between historical and current values.
   */
  private calculateDelta(
    histVal: string,
    currVal: string
  ): {
    verdict: ComparisonVerdict;
    deltaSummary: string;
    confidence: 'high' | 'medium' | 'low';
    numericDelta?: number;
    percentageChange?: number;
  } {
    const cleanHist = histVal.trim().toLowerCase();
    const cleanCurr = currVal.trim().toLowerCase();

    // Check if values are identical
    if (cleanHist === cleanCurr) {
      return {
        verdict: 'NO_DETECTED_CHANGE',
        deltaSummary: 'Values remain identical',
        confidence: 'high',
        numericDelta: 0,
        percentageChange: 0,
      };
    }

    // Check numerical / price differences
    const histNum = this.parseNumericValue(histVal);
    const currNum = this.parseNumericValue(currVal);

    if (histNum !== null && currNum !== null) {
      if (histNum === currNum) {
        return {
          verdict: 'NO_DETECTED_CHANGE',
          deltaSummary: `No detected change ($${currNum} vs $${histNum})`,
          confidence: 'high',
          numericDelta: 0,
          percentageChange: 0,
        };
      }

      const diff = currNum - histNum;
      const pct = Math.round((diff / histNum) * 100);
      const direction = diff > 0 ? 'increased' : 'decreased';
      const sign = diff > 0 ? '+' : '';

      return {
        verdict: 'CONFIRMED_CHANGE',
        deltaSummary: `Price ${direction} by $${Math.abs(diff).toFixed(2)} (${sign}${pct}%)`,
        confidence: 'high',
        numericDelta: diff,
        percentageChange: pct,
      };
    }

    // String / version differences
    if (cleanHist !== cleanCurr) {
      return {
        verdict: 'CONFIRMED_CHANGE',
        deltaSummary: `Changed from "${histVal}" to "${currVal}"`,
        confidence: 'medium',
      };
    }

    return {
      verdict: 'UNABLE_TO_VERIFY',
      deltaSummary: 'Could not clearly determine difference',
      confidence: 'low',
    };
  }

  private parseNumericValue(val: string): number | null {
    const match = val.match(/\$?\s*(\d+(?:\.\d+)?)/);
    return match && match[1] ? parseFloat(match[1]) : null;
  }

  private extractCurrentValueFromSearchResults(
    results: SearchResultItem[],
    attribute: string,
    period: string,
    nowIso: string
  ): ComparisonObservation {
    const first = results[0];
    if (!first) {
      return {
        value: 'Unknown',
        period,
        timestamp: nowIso,
      };
    }

    // Scan snippet for pricing
    if (attribute.toLowerCase().includes('price') || attribute.toLowerCase().includes('cost')) {
      for (const res of results) {
        const priceMatch = res.content.match(/\$\d+(?:\.\d{2})?(?:\s*(?:\/|\s*per\s*)(?:mo|month|year|user))?/i);
        if (priceMatch) {
          return {
            value: priceMatch[0].trim(),
            period,
            timestamp: nowIso,
            sourceUrl: res.url,
            sourceTitle: res.title,
          };
        }
      }
    }

    // Scan snippet for versions
    if (attribute.toLowerCase().includes('version') || attribute.toLowerCase().includes('release')) {
      for (const res of results) {
        const verMatch = res.content.match(/\bv?\d+\.\d+(?:\.\d+)?\b/);
        if (verMatch) {
          return {
            value: verMatch[0].trim(),
            period,
            timestamp: nowIso,
            sourceUrl: res.url,
            sourceTitle: res.title,
          };
        }
      }
    }

    return {
      value: first.title,
      period,
      timestamp: nowIso,
      sourceUrl: first.url,
      sourceTitle: first.title,
    };
  }

  private async generateExplanation(params: {
    entity: string;
    attribute: string;
    historical: ComparisonObservation;
    current: ComparisonObservation;
    verdict: ComparisonVerdict;
    deltaSummary: string;
    searchResults: SearchResultItem[];
  }): Promise<string> {
    const prompt = `You are Minimi's historical comparison analyst.
Task: Explain the chronological change between past conversation data and current live evidence.

Entity: ${params.entity}
Attribute: ${params.attribute}
Historical Baseline: "${params.historical.value}" (observed: ${params.historical.timestamp})
Current Live Value: "${params.current.value}" (observed: ${params.current.timestamp})
Verdict: ${params.verdict}
Delta: ${params.deltaSummary}

Instructions:
1. Clearly state the baseline value and date.
2. State the current verified value and source.
3. State the delta or difference clearly.
4. Keep the explanation factual, concise, and cite sources as [source-1].`;

    const response = await this.llmProvider.chat([
      { role: 'system', content: prompt },
      { role: 'user', content: 'Generate comparison explanation' },
    ]);

    return response.content.trim();
  }

  private generateFallbackExplanation(
    entity: string,
    attribute: string,
    hist: ComparisonObservation,
    curr: ComparisonObservation,
    verdict: ComparisonVerdict,
    delta: string
  ): string {
    const histDate = hist.timestamp.split('T')[0];
    if (verdict === 'CONFIRMED_CHANGE') {
      return `Earlier in this conversation on ${histDate}, ${entity} ${attribute} was noted at ${hist.value}. Current verified information shows it is now ${curr.value} [source-1] (${delta}).`;
    }
    if (verdict === 'NO_DETECTED_CHANGE') {
      return `Earlier on ${histDate}, ${entity} ${attribute} was noted at ${hist.value}. Current live information confirms no change: it remains ${curr.value} [source-1].`;
    }
    return `Could not verify changes for ${entity} ${attribute}. Previous value was ${hist.value}.`;
  }
}

export const comparisonService = new ComparisonService();
