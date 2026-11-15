import { request } from './apiClient';
import {
  Conversation,
  ConversationMessage,
  AgentChatResult,
} from '../types/api';

export const conversationService = {
  async createConversation(title?: string, metadata?: Record<string, unknown>): Promise<Conversation> {
    return request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, metadata }),
    });
  },

  async listConversations(limit = 50, offset = 0): Promise<Conversation[]> {
    return request<Conversation[]>(`/conversations?limit=${limit}&offset=${offset}`, {
      method: 'GET',
    });
  },

  async getConversation(id: string): Promise<Conversation> {
    return request<Conversation>(`/conversations/${id}`, {
      method: 'GET',
    });
  },

  async deleteConversation(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  async getMessages(
    conversationId: string,
    limit = 50
  ): Promise<{ conversationId: string; messages: ConversationMessage[]; totalMessages: number }> {
    return request<{
      conversationId: string;
      messages: ConversationMessage[];
      totalMessages: number;
    }>(`/conversations/${conversationId}/messages?limit=${limit}`, {
      method: 'GET',
    });
  },

  async sendChatMessage(conversationId: string, message: string): Promise<AgentChatResult> {
    return request<AgentChatResult>(`/conversations/${conversationId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async checkHealth(): Promise<{ status: string; uptime: number; version: string }> {
    return request<{ status: string; uptime: number; version: string }>('/health', {
      method: 'GET',
    });
  },
};
