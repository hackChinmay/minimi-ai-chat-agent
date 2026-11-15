// ============================================================================
// API Response Envelope
// ============================================================================

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

// ============================================================================
// Search & Citations
// ============================================================================

export interface SearchResultItem {
  id: string;              // e.g. "source-1"
  index: number;
  title: string;
  url: string;
  content: string;
  source: string;          // canonical domain e.g. "cloud.google.com"
  publishedDate?: string;
  relevanceScore?: number;
}

// ============================================================================
// Conversation Memory
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageCitation {
  id: string;
  url: string;
  title: string;
}

export interface MessageMetadata {
  citations?: MessageCitation[];
  sources?: SearchResultItem[];
  searchUsed?: boolean;
  searchStatus?: 'not_needed' | 'attempted' | 'success' | 'failed';
  searchQueries?: string[];
  searchError?: string;
  category?: string;
  latencyMs?: number;
  tokens?: number;
  comparisonResult?: ComparisonResult;
  [key: string]: unknown;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  metadata?: MessageMetadata;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Chat
// ============================================================================

export interface AgentChatResult {
  conversationId: string;
  message: string;
  role: 'assistant';
  sources: SearchResultItem[];
  searchUsed: boolean;
  searchStatus?: 'not_needed' | 'attempted' | 'success' | 'failed';
  searchQueries: string[];
  metadata: {
    category: string;
    latencyMs: number;
    tokens?: number;
    searchTimeMs?: number;
    searchError?: string;
  };
}

// ============================================================================
// Phase 6 Historical & Comparison
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
  confidence?: 'high' | 'medium' | 'low';
  historical: ComparisonObservation;
  current: ComparisonObservation;
  deltaSummary: string;
  delta?: {
    summary: string;
    numericDelta?: number;
    percentageChange?: number;
  };
  explanation: string;
  citations: SearchResultItem[];
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
