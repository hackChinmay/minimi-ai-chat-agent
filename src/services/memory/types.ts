import {
  Conversation,
  ConversationMessage,
  ConversationContext,
  ContextWindowOptions,
} from '../../types';

export interface ConversationStorageAdapter {
  readonly name: string;

  // Conversation Operations
  createConversation(conversation: Omit<Conversation, 'messageCount'>): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  listConversations(options?: { limit?: number; offset?: number }): Promise<Conversation[]>;
  deleteConversation(id: string): Promise<boolean>;

  // Message Operations
  appendMessage(message: ConversationMessage): Promise<ConversationMessage>;
  getMessages(
    conversationId: string,
    options?: { limit?: number; before?: string }
  ): Promise<ConversationMessage[]>;
  getMessageCount(conversationId: string): Promise<number>;

  // Testing & Maintenance
  clearAll?(): Promise<void>;
  close?(): Promise<void>;
}

export interface ContextSummarizer {
  summarize(messages: ConversationMessage[]): Promise<string>;
}

export { Conversation, ConversationMessage, ConversationContext, ContextWindowOptions };
