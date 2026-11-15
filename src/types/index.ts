export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  meta?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface HealthCheckData {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
}

// ============================================================================
// Search Domain Types & Citation Foundation
// ============================================================================

export interface SearchResultItem {
  id: string;              // Stable citation identifier (e.g., "source-1")
  index: number;           // 1-based sequence index
  title: string;
  url: string;             // Original verified URL
  content: string;         // Text snippet / content
  source: string;          // Canonical domain (e.g., "aws.amazon.com")
  publishedDate?: string;  // ISO or provider date string (only if available)
  relevanceScore?: number; // Score between 0 and 1 (only if available)
}

export interface SearchMetadata {
  totalResults: number;
  searchTimeMs: number;
  provider: string;
}

export interface SearchResponseData {
  query: string;
  results: SearchResultItem[];
  metadata: SearchMetadata;
}

export interface SearchOptions {
  maxResults?: number;
  timeoutMs?: number;
}

// ============================================================================
// Conversation Memory Domain Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageMetadata {
  citations?: Array<{ id: string; url: string; title: string }>;
  searchQueries?: string[];
  [key: string]: unknown;
}

export interface ConversationMessage {
  id: string;               // UUID v4
  conversationId: string;   // UUID v4
  role: MessageRole;
  content: string;
  createdAt: string;        // ISO-8601
  metadata?: MessageMetadata;
}

export interface Conversation {
  id: string;               // UUID v4
  title: string;
  createdAt: string;        // ISO-8601
  updatedAt: string;        // ISO-8601
  messageCount: number;
  metadata?: Record<string, unknown>;
}

export interface ContextWindowOptions {
  maxMessages?: number;     // Max messages in sliding window (default: 10)
  maxCharacters?: number;   // Character budget constraint
}

export interface ConversationContext {
  conversationId: string;
  messages: ConversationMessage[];
  totalStoredMessages: number;
  windowSize: number;
  hasTruncatedHistory: boolean;
}

// ============================================================================
// Agent Orchestration & LLM Domain Types
// ============================================================================

export type IntentCategory =
  | 'CHITCHAT'
  | 'STATIC_KNOWLEDGE'
  | 'CONVERSATION_RECALL'
  | 'REALTIME_SEARCH'
  | 'TEMPORAL_COMPARISON'
  | 'HISTORICAL_DATED';

export interface SearchDecision {
  shouldSearch: boolean;
  category: IntentCategory;
  reason: string;
  searchQuery?: string;
}

export interface AgentChatInput {
  conversationId: string;
  message: string;
}

export type SearchStatus = 'not_needed' | 'attempted' | 'success' | 'failed';

export interface AgentChatResult {
  conversationId: string;
  message: string;
  role: 'assistant';
  sources: SearchResultItem[];
  searchUsed: boolean;
  searchStatus?: SearchStatus;
  searchQueries: string[];
  metadata: {
    category: IntentCategory;
    latencyMs: number;
    tokens?: number;
    searchTimeMs?: number;
    searchError?: string;
  };
}

// ============================================================================
// Phase 6: Historical Information & Intelligent Comparison Types
// ============================================================================

export interface HistoricalSnapshot {
  id: string;
  conversationId: string;
  messageId?: string;
  entity: string;
  attribute: string;
  value: string;
  validPeriod?: string;
  observedAt: string;
  retrievedAt: string;
  sourceUrl?: string;
  sourceTitle?: string;
  metadata?: Record<string, unknown>;
}

export interface HistoricalQueryOptions {
  entity?: string;
  query?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export type ComparisonVerdict =
  | 'CONFIRMED_CHANGE'
  | 'NO_DETECTED_CHANGE'
  | 'UNABLE_TO_VERIFY';

export interface ComparisonObservation {
  value: string;
  period?: string;
  timestamp: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface ComparisonResult {
  conversationId: string;
  entity: string;
  attribute: string;
  verdict: ComparisonVerdict;
  historical: ComparisonObservation;
  current: ComparisonObservation;
  deltaSummary: string;
  explanation: string;
  sources: SearchResultItem[];
  metadata: {
    comparisonTimeMs: number;
    searchUsed: boolean;
    confidence: 'high' | 'medium' | 'low';
    searchError?: string;
  };
}

export interface ComparisonRequest {
  subject: string;
  attribute?: string;
  baselineDate?: string;
  targetDate?: string;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}
