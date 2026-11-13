import { SearchResultItem, IntentCategory, SearchDecision, AgentChatInput, AgentChatResult, SearchStatus } from '../../types';

export { IntentCategory, SearchDecision, AgentChatInput, AgentChatResult, SearchStatus };

export interface CitationMatch {
  rawMatch: string;
  sourceId: string;
  sourceIndex: number;
}

export interface VerifiedAttribution {
  cleanContent: string;
  citedSources: SearchResultItem[];
  allAvailableSources: SearchResultItem[];
}
