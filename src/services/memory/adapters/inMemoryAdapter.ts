import { Conversation, ConversationMessage, ConversationStorageAdapter } from '../types';

export class InMemoryConversationStorage implements ConversationStorageAdapter {
  public readonly name = 'inmemory';

  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, ConversationMessage[]> = new Map();

  public async createConversation(
    conversationData: Omit<Conversation, 'messageCount'>
  ): Promise<Conversation> {
    const conversation: Conversation = {
      ...conversationData,
      messageCount: 0,
    };

    this.conversations.set(conversation.id, { ...conversation });
    this.messages.set(conversation.id, []);

    return { ...conversation };
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return null;
    }

    const messages = this.messages.get(id) || [];
    return {
      ...conversation,
      messageCount: messages.length,
    };
  }

  public async listConversations(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const all = Array.from(this.conversations.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(offset, offset + limit);

    return all.map((conv) => {
      const msgList = this.messages.get(conv.id) || [];
      return {
        ...conv,
        messageCount: msgList.length,
      };
    });
  }

  public async deleteConversation(id: string): Promise<boolean> {
    const exists = this.conversations.has(id);
    if (!exists) {
      return false;
    }

    this.conversations.delete(id);
    this.messages.delete(id);
    return true;
  }

  public async appendMessage(message: ConversationMessage): Promise<ConversationMessage> {
    const conv = this.conversations.get(message.conversationId);
    if (!conv) {
      throw new Error(`Cannot append message: Conversation ${message.conversationId} does not exist`);
    }

    const msgList = this.messages.get(message.conversationId) || [];
    const newMessage = { ...message };

    msgList.push(newMessage);
    this.messages.set(message.conversationId, msgList);

    // Update conversation updatedAt timestamp
    conv.updatedAt = message.createdAt;
    conv.messageCount = msgList.length;
    this.conversations.set(conv.id, conv);

    return newMessage;
  }

  public async getMessages(
    conversationId: string,
    options?: { limit?: number; before?: string }
  ): Promise<ConversationMessage[]> {
    let msgList = this.messages.get(conversationId) || [];

    // Filter before timestamp if specified
    if (options?.before) {
      const beforeTime = new Date(options.before).getTime();
      msgList = msgList.filter((m) => new Date(m.createdAt).getTime() < beforeTime);
    }

    // Ensure strictly ascending chronological order
    const sorted = [...msgList].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (options?.limit && options.limit > 0) {
      return sorted.slice(-options.limit);
    }

    return sorted;
  }

  public async getMessageCount(conversationId: string): Promise<number> {
    const msgList = this.messages.get(conversationId);
    return msgList ? msgList.length : 0;
  }

  public async clearAll(): Promise<void> {
    this.conversations.clear();
    this.messages.clear();
  }
}
