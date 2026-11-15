import { Request, Response } from 'express';
import { snapshotStorage } from '../services/history/snapshotStore';
import { SnapshotStorageAdapter } from '../services/history/types';
import { temporalResolver, TemporalResolver } from '../services/history/temporalResolver';
import { comparisonService, ComparisonService } from '../services/history/comparisonService';
import { historicalRetrievalService, HistoricalRetrievalService } from '../services/history/historicalRetrievalService';
import { searchService, SearchService } from '../services/search/searchService';
import { conversationService, ConversationService } from '../services/memory/conversationService';
import { ApiResponse, ComparisonResult, HistoricalSnapshot, SearchResultItem } from '../types';

export class HistoricalController {
  private readonly snapshotStore: SnapshotStorageAdapter;
  private readonly temporalResolver: TemporalResolver;
  private readonly comparisonService: ComparisonService;
  private readonly retrievalService: HistoricalRetrievalService;
  private readonly searchService: SearchService;
  private readonly convService: ConversationService;

  constructor(options?: {
    snapshotStore?: SnapshotStorageAdapter;
    temporalResolver?: TemporalResolver;
    comparisonService?: ComparisonService;
    retrievalService?: HistoricalRetrievalService;
    searchService?: SearchService;
    convService?: ConversationService;
  }) {
    this.snapshotStore = options?.snapshotStore ?? snapshotStorage;
    this.temporalResolver = options?.temporalResolver ?? temporalResolver;
    this.comparisonService = options?.comparisonService ?? comparisonService;
    this.retrievalService = options?.retrievalService ?? historicalRetrievalService;
    this.searchService = options?.searchService ?? searchService;
    this.convService = options?.convService ?? conversationService;
  }

  public search = async (req: Request, res: Response): Promise<void> => {
    const { query, conversationId, date, maxResults } = req.body as {
      query: string;
      conversationId?: string;
      date?: string;
      maxResults?: number;
    };

    const resolvedTemporal = this.temporalResolver.resolve(date || query);
    const searchTarget = date ? `${query} ${resolvedTemporal.targetPeriod || date}` : query;

    let searchResults: SearchResultItem[] = [];
    let providerName = 'unavailable';

    try {
      const searchResponse = await this.searchService.search(searchTarget, {
        maxResults: maxResults ?? 5,
      });
      searchResults = searchResponse.results;
      providerName = searchResponse.metadata.provider;
    } catch {
      // Graceful fallback when search fails or offline
    }

    let existingSnapshots: HistoricalSnapshot[] = [];
    if (conversationId) {
      const history = await this.retrievalService.retrieveContextualHistory(conversationId, query, {
        limit: 10,
      });
      existingSnapshots = history.snapshots;
    }

    const response: ApiResponse<{
      query: string;
      temporalInfo: typeof resolvedTemporal;
      snapshots: HistoricalSnapshot[];
      results: SearchResultItem[];
    }> = {
      success: true,
      data: {
        query,
        temporalInfo: resolvedTemporal,
        snapshots: existingSnapshots,
        results: searchResults,
      },
      meta: {
        totalResults: searchResults.length,
        totalSnapshots: existingSnapshots.length,
        provider: providerName,
      },
    };

    res.status(200).json(response);
  };

  public getSnapshots = async (req: Request, res: Response): Promise<void> => {
    const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined;
    const query = typeof req.query.query === 'string' ? req.query.query : undefined;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const until = typeof req.query.until === 'string' ? req.query.until : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const snapshots = await this.snapshotStore.getSnapshots(conversationId, {
      entity,
      query,
      since,
      until,
      limit,
    });

    const response: ApiResponse<HistoricalSnapshot[]> = {
      success: true,
      data: snapshots,
      meta: {
        total: snapshots.length,
      },
    };

    res.status(200).json(response);
  };

  public compare = async (req: Request, res: Response): Promise<void> => {
    let convId = req.body.conversationId as string | undefined;

    // If conversationId is not provided, create an ephemeral or persistent conversation for this comparison
    if (!convId) {
      const conv = await this.convService.createConversation({
        title: `Comparison: ${req.body.subject}`,
      });
      convId = conv.id;
    }

    const result = await this.comparisonService.compare(convId, {
      subject: req.body.subject,
      attribute: req.body.attribute,
      baselineDate: req.body.baselineDate,
      targetDate: req.body.targetDate,
    });

    const response: ApiResponse<ComparisonResult> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  };
}

export const historicalController = new HistoricalController();
