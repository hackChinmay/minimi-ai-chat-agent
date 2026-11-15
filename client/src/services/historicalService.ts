import { request } from './apiClient';
import {
  HistoricalSnapshot,
  ComparisonResult,
  ComparisonRequest,
} from '../types/api';

export interface HistoricalQueryOptions {
  entity?: string;
  query?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export const historicalService = {
  async getConversationHistory(
    conversationId: string,
    options?: HistoricalQueryOptions
  ): Promise<{ conversationId: string; snapshots: HistoricalSnapshot[]; relevantMessages: unknown[] }> {
    const params = new URLSearchParams();
    if (options?.entity) params.append('entity', options.entity);
    if (options?.query) params.append('query', options.query);
    if (options?.since) params.append('since', options.since);
    if (options?.until) params.append('until', options.until);
    if (options?.limit) params.append('limit', String(options.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ conversationId: string; snapshots: HistoricalSnapshot[]; relevantMessages: unknown[] }>(
      `/conversations/${conversationId}/history${qs}`,
      { method: 'GET' }
    );
  },

  async compareWithinConversation(
    conversationId: string,
    req: ComparisonRequest
  ): Promise<ComparisonResult> {
    return request<ComparisonResult>(`/conversations/${conversationId}/compare`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async compareDirect(
    req: ComparisonRequest & { conversationId?: string }
  ): Promise<ComparisonResult> {
    return request<ComparisonResult>('/historical/compare', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async searchHistorical(
    query: string,
    date?: string,
    conversationId?: string
  ): Promise<{
    query: string;
    temporalInfo: { raw: string; extractedYear?: number; isRelative: boolean; isValid: boolean };
    snapshots: HistoricalSnapshot[];
    results: unknown[];
  }> {
    return request<{
      query: string;
      temporalInfo: { raw: string; extractedYear?: number; isRelative: boolean; isValid: boolean };
      snapshots: HistoricalSnapshot[];
      results: unknown[];
    }>('/historical/search', {
      method: 'POST',
      body: JSON.stringify({ query, date, conversationId }),
    });
  },

  async getSnapshots(
    options?: HistoricalQueryOptions & { conversationId?: string }
  ): Promise<HistoricalSnapshot[]> {
    const params = new URLSearchParams();
    if (options?.conversationId) params.append('conversationId', options.conversationId);
    if (options?.entity) params.append('entity', options.entity);
    if (options?.query) params.append('query', options.query);
    if (options?.since) params.append('since', options.since);
    if (options?.until) params.append('until', options.until);
    if (options?.limit) params.append('limit', String(options.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<HistoricalSnapshot[]>(`/historical/snapshots${qs}`, {
      method: 'GET',
    });
  },
};
