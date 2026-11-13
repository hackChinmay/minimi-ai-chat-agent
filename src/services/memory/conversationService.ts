import { randomUUID } from 'node:crypto';
import { ConversationStorageAdapter } from './types';
import { createConversationStorage } from './storageFactory';
import { ContextManager, contextManager } from './contextManager';
import {
  Conversation,
  ConversationMessage,
  ConversationContext,
  ContextWindowOptions,
  MessageRole,
  MessageMetadata,
} from '../../types';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface CreateConversationInput {
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface AppendMessageInput {
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
}

export class ConversationService {
  private readonly storage: ConversationStorageAdapter;
  private readonly contextManager: ContextManager;

  constructor(storage?: ConversationStorageAdapter, contextMgr?: ContextManager) {
    this.storage = storage ?? createConversationStorage();
    this.contextManager = contextMgr ?? contextManager;
  }

  public getStorage(): ConversationStorageAdapter {
    return this.storage;
  }

  public async createConversation(input?: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const title = input?.title?.trim() || 'New Conversation';

    logger.debug(`Creating new conversation [${id}] with title: "${title}"`);

    return this.storage.createConversation({
      id,
      title,
      createdAt: now,
      updatedAt: now,
      metadata: input?.metadata ?? {},
    });
  }

  public async getConversation(conversationId: string): Promise<Conversation> {
    const conversation = await this.storage.getConversation(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation with ID ${conversationId} not found`);
    }
    return conversation;
  }

  public async listConversations(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    return this.storage.listConversations(options);
  }

  public async deleteConversation(conversationId: string): Promise<boolean> {
    const deleted = await this.storage.deleteConversation(conversationId);
    if (!deleted) {
      throw new NotFoundError(`Conversation with ID ${conversationId} not found`);
    }
    logger.debug(`Deleted conversation [${conversationId}]`);
    return true;
  }

  public async appendMessage(
    conversationId: string,
    input: AppendMessageInput
  ): Promise<ConversationMessage> {
    // 1. Verify that conversation exists
    await this.getConversation(conversationId);

    // 2. Validate message content
    if (!input.content || typeof input.content !== 'string') {
      throw new BadRequestError('Message content is required and must be a string');
    }

    const trimmedContent = input.content.trim();
    if (trimmedContent.length === 0) {
      throw new BadRequestError('Message content cannot be empty or whitespace only');
    }

    if (trimmedContent.length > env.MAX_MESSAGE_LENGTH) {
      throw new BadRequestError(
        `Message content exceeds maximum allowed length of ${env.MAX_MESSAGE_LENGTH} characters`
      );
    }

    // 3. Validate role
    const validRoles: MessageRole[] = ['user', 'assistant', 'system'];
    if (!validRoles.includes(input.role)) {
      throw new BadRequestError(`Invalid message role "${input.role}". Allowed roles: ${validRoles.join(', ')}`);
    }

    const message: ConversationMessage = {
      id: randomUUID(),
      conversationId,
      role: input.role,
      content: trimmedContent,
      createdAt: new Date().toISOString(),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    logger.debug(`Appending [${input.role}] message to conversation [${conversationId}]`);
    return this.storage.appendMessage(message);
  }

  public async getMessages(
    conversationId: string,
    options?: { limit?: number; before?: string }
  ): Promise<ConversationMessage[]> {
    // Verify conversation exists
    await this.getConversation(conversationId);
    return this.storage.getMessages(conversationId, options);
  }

  public async getContextWindow(
    conversationId: string,
    options?: ContextWindowOptions
  ): Promise<ConversationContext> {
    // Verify conversation exists
    await this.getConversation(conversationId);
    const allMessages = await this.storage.getMessages(conversationId);

    return this.contextManager.buildContextWindow(conversationId, allMessages, options);
  }
}

export const conversationService = new ConversationService();
