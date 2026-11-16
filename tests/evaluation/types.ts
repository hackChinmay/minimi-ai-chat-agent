export type EvaluationCategory =
  | 'FACTUAL_RESEARCH'
  | 'AI_CODING_AGENTS_COMPARISON'
  | 'CURRENT_PRICING'
  | 'HISTORICAL_FACTS'
  | 'FUTURE_PREDICTIONS'
  | 'TEMPORAL_COMPARISON'
  | 'DATETIME_AWARENESS'
  | 'MULTITURN_CONTEXT'
  | 'SEARCH_QUERY_RELEVANCE'
  | 'ZERO_SEARCH_RESULTS'
  | 'CITATION_ACCURACY'
  | 'IRRELEVANT_RESULT_FILTERING'
  | 'ERROR_RECOVERY'
  | 'PROMPT_INJECTION'
  | 'CASUAL_CHITCHAT';

export interface EvaluationTurnExpectation {
  userMessage: string;
  expectedSearch: boolean;
  expectedCategory?: string;
  expectedKeywords?: string[];
  forbiddenKeywords?: string[];
  expectedMinSources?: number;
  expectZeroCitations?: boolean;
  expectNoPlaceholders?: boolean;
  historicalBaseline?: {
    entity: string;
    attribute: string;
    value: string;
    observedAt: string;
    sourceUrl?: string;
  };
}

export interface EvaluationCase {
  id: string;
  category: EvaluationCategory;
  name: string;
  description: string;
  turns: EvaluationTurnExpectation[];
}

export interface EvaluationTurnResult {
  caseId: string;
  category: EvaluationCategory;
  turnIndex: number;
  userMessage: string;
  actualResponse: string;
  searchUsed: boolean;
  searchStatus: string;
  searchQueries: string[];
  citedSourcesCount: number;
  rawSearchCount: number;
  hasPlaceholderCitations: boolean;
  searchDecisionMatch: boolean;
  latencyMs: number;
  passed: boolean;
  issues: string[];
}

export interface CategoryMetric {
  totalTurns: number;
  passedTurns: number;
  accuracyRate: number;
  searchAccuracy: number;
  averageLatencyMs: number;
}

export interface EvaluationSummary {
  timestamp: string;
  totalCases: number;
  totalTurns: number;
  passedTurns: number;
  overallPassRate: number;
  searchDecisionAccuracy: number;
  citationValidityRate: number;
  placeholderCitationCount: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  categoryMetrics: Record<EvaluationCategory, CategoryMetric>;
  turnResults: EvaluationTurnResult[];
}
