import { Request, Response } from 'express';
import { conversationService, ConversationService } from '../services/memory/conversationService';
import { agentOrchestrator, AgentOrchestrator } from '../services/agent/agentOrchestrator';
import { historicalRetrievalService as defaultRetrievalService, HistoricalRetrievalService } from '../services/history/historicalRetrievalService';
import { comparisonService as defaultComparisonService, ComparisonService } from '../services/history/comparisonService';
import { ApiResponse, Conversation, ConversationMessage, ConversationContext, AgentChatResult, ComparisonResult, HistoricalSnapshot } from '../types';

export class ConversationController {
  private readonly service: ConversationService;
  private readonly orchestrator: AgentOrchestrator;
  private readonly retrievalService: HistoricalRetrievalService;
  private readonly comparisonService: ComparisonService;

  constructor(
    service?: ConversationService,
    orchestrator?: AgentOrchestrator,
    retrievalService?: HistoricalRetrievalService,
    comparisonService?: ComparisonService
  ) {
    this.service = service ?? conversationService;
    this.orchestrator = orchestrator ?? agentOrchestrator;
    this.retrievalService = retrievalService ?? defaultRetrievalService;
    this.comparisonService = comparisonService ?? defaultComparisonService;
  }

  public createConversation = async (req: Request, res: Response): Promise<void> => {
    const { title, metadata } = req.body as {
      title?: string;
      metadata?: Record<string, unknown>;
    };

    const conversation = await this.service.createConversation({ title, metadata });

    const response: ApiResponse<Conversation> = {
      success: true,
      data: conversation,
    };

    res.status(201).json(response);
  };

  public getConversation = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params as { conversationId: string };

    const conversation = await this.service.getConversation(conversationId);

    const response: ApiResponse<Conversation> = {
      success: true,
      data: conversation,
    };

    res.status(200).json(response);
  };

  public listConversations = async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const conversations = await this.service.listConversations({ limit, offset });

    const response: ApiResponse<Conversation[]> = {
      success: true,
      data: conversations,
      meta: {
        total: conversations.length,
      },
    };

    res.status(200).json(response);
  };

  public deleteConversation = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params as { conversationId: string };

    await this.service.deleteConversation(conversationId);

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
    };

    res.status(200).json(response);
  };

  public appendMessage = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params as { conversationId: string };
    const { role, content, metadata } = req.body;

    const message = await this.service.appendMessage(conversationId, {
      role,
      content,
      metadata,
    });

    const response: ApiResponse<ConversationMessage> = {
      success: true,
      data: message,
    };

    res.status(201).json(response);
  };

  public getMessages = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params as { conversationId: string };
    const isContextWindow = req.query.contextWindow === 'true';

    if (isContextWindow) {
      const maxMessages = req.query.maxMessages ? Number(req.query.maxMessages) : undefined;
      const maxCharacters = req.query.maxCharacters ? Number(req.query.maxCharacters) : undefined;

      const context = await this.service.getContextWindow(conversationId, {
        maxMessages,
        maxCharacters,
      });

      const response: ApiResponse<ConversationContext> = {
        success: true,
        data: context,
      };

      res.status(200).json(response);
      return;
    }

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;

    const messages = await this.service.getMessages(conversationId, { limit, before });
    const conversation = await this.service.getConversation(conversationId);

    const response: ApiResponse<{
      conversationId: string;
      messages: ConversationMessage[];
      totalMessages: number;
    }> = {
      success: true,
      data: {
        conversationId,
        messages,
        totalMessages: conversation.messageCount,
      },
    };

    res.status(200).json(response);
  };

  public chat = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params as { conversationId: string };
    const { message } = req.body as { message: string };

    const result = await this.orchestrator.processUserMessage({
      conversationId,
      message,
    });

    const response: ApiResponse<AgentChatResult> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  };

  public getHistory = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params as { conversationId: string };
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined;
    const query = typeof req.query.query === 'string' ? req.query.query : undefined;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const until = typeof req.query.until === 'string' ? req.query.until : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const history = await this.retrievalService.retrieveContextualHistory(conversationId, query, {
      entity,
      since,
      until,
      limit,
    });

    const response: ApiResponse<{
      conversationId: string;
      snapshots: HistoricalSnapshot[];
      relevantMessages: unknown[];
    }> = {
      success: true,
      data: {
        conversationId,
        snapshots: history.snapshots,
        relevantMessages: history.relevantMessages,
      },
      meta: {
        totalSnapshots: history.snapshots.length,
        totalRelevantMessages: history.relevantMessages.length,
      },
    };

    res.status(200).json(response);
  };

  public compare = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params as { conversationId: string };
    const { subject, attribute, baselineDate, targetDate } = req.body;

    const result = await this.comparisonService.compare(conversationId, {
      subject,
      attribute,
      baselineDate,
      targetDate,
    });

    const response: ApiResponse<ComparisonResult> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  };
}

export const conversationController = new ConversationController();
