import { describe, it, expect, beforeEach } from 'vitest';
import { AgentOrchestrator } from '../src/services/agent/agentOrchestrator';
import { ConversationService } from '../src/services/memory/conversationService';
import { InMemoryConversationStorage } from '../src/services/memory/adapters/inMemoryAdapter';
import { SearchService } from '../src/services/search/searchService';
import { MockSearchProvider } from '../src/services/search/providers/mockProvider';
import { MockLLMProvider } from '../src/services/llm/providers/mockLLMProvider';
import { CitationManager } from '../src/services/agent/citationManager';
import { QueryRewriter } from '../src/services/agent/queryRewriter';
import { SearchDecisionEngine } from '../src/services/agent/searchDecisionEngine';
import { RawSearchResult } from '../src/services/search/types';
import { createLLMProvider } from '../src/services/llm/llmProviderFactory';
import { createSearchProvider } from '../src/services/search/searchProviderFactory';
import { OpenAILLMProvider } from '../src/services/llm/providers/openAILLMProvider';
import { TavilySearchProvider } from '../src/services/search/providers/tavilyProvider';
import { LLMAuthenticationError, SearchAuthenticationError } from '../src/utils/errors';

describe('Regression Suite: Agent Research & Citation Pipeline', () => {
  let storage: InMemoryConversationStorage;
  let convService: ConversationService;
  let mockSearchProvider: MockSearchProvider;
  let searchService: SearchService;
  let mockLLMProvider: MockLLMProvider;
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    storage = new InMemoryConversationStorage();
    convService = new ConversationService(storage);
    mockSearchProvider = new MockSearchProvider();
    searchService = new SearchService(mockSearchProvider);
    mockLLMProvider = new MockLLMProvider();

    orchestrator = new AgentOrchestrator({
      conversationService: convService,
      searchService,
      llmProvider: mockLLMProvider,
      decisionEngine: new SearchDecisionEngine(),
      queryRewriter: new QueryRewriter(),
      citationManager: new CitationManager(),
    });
  });

  // ============================================================================
  // Scenario 1: AI Coding Agent Research Turn
  // ============================================================================
  it('should trigger search for AI coding agents, retrieve relevant sources, and cite them accurately', async () => {
    const conv = await convService.createConversation('AI Coding Agents Research');
    const userPrompt =
      'Research the latest developments in AI coding agents as of November 2026. Compare OpenAI Codex, Claude Code, and GitHub Copilot based on features, pricing, coding capabilities, and developer productivity. Include verified sources, publication dates, and a final recommendation for a student software developer.';

    const result = await orchestrator.processUserMessage({
      conversationId: conv.id,
      message: userPrompt,
    });

    // 1. Search must be triggered
    expect(result.searchUsed).toBe(true);
    expect(result.searchStatus).toBe('success');
    expect(result.searchQueries.length).toBeGreaterThan(0);

    const executedQuery = result.searchQueries[0].toLowerCase();
    expect(executedQuery).toContain('codex');
    expect(executedQuery).toContain('claude code');
    expect(executedQuery).toContain('copilot');

    // 2. Sources must be relevant to AI coding agents, NEVER PostgreSQL
    expect(result.sources.length).toBeGreaterThan(0);
    for (const source of result.sources) {
      expect(source.title.toLowerCase()).toContain('coding agent');
      expect(source.title.toLowerCase()).not.toContain('postgres');
      expect(source.source).not.toContain('example.com');
    }

    // 3. Response must synthesize comparison, pricing, and recommendations with citations
    expect(result.message).toContain('Claude Code');
    expect(result.message).toContain('GitHub Copilot');
    expect(result.message).toContain('OpenAI Codex');
    expect(result.message).toContain('[source-1]');
    expect(result.message).toContain('Recommendation');

    // 4. finalSources must contain only verified cited sources
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.metadata.rawSearchResults).toBeDefined();
    expect(result.metadata.rawSearchResults!.length).toBeGreaterThanOrEqual(result.sources.length);
  });

  // ============================================================================
  // Scenario 2: PostgreSQL Hosting Research Turn
  // ============================================================================
  it('should trigger search for PostgreSQL hosting and return database benchmarks', async () => {
    const conv = await convService.createConversation('PostgreSQL Research');
    const userPrompt = 'What are the modern managed PostgreSQL cloud hosting pricing tiers in 2026?';

    const result = await orchestrator.processUserMessage({
      conversationId: conv.id,
      message: userPrompt,
    });

    expect(result.searchUsed).toBe(true);
    expect(result.searchStatus).toBe('success');
    expect(result.sources.length).toBeGreaterThan(0);

    // Sources must be about PostgreSQL
    for (const source of result.sources) {
      expect(source.title.toLowerCase()).toContain('postgres');
    }

    expect(result.message).toContain('PostgreSQL');
    expect(result.message).toContain('[source-1]');
  });

  // ============================================================================
  // Scenario 3: Irrelevant Search Result Rejection
  // ============================================================================
  it('should not include uncited or irrelevant search results in finalSources', async () => {
    const conv = await convService.createConversation('Irrelevant Rejection Test');

    // Mock search returns completely unrelated results
    mockSearchProvider.setResults([
      {
        title: 'Banana Farming in Tropical Climates',
        url: 'https://agriculture.org/bananas',
        content: 'Comprehensive soil guidelines for banana production.',
        publishedDate: '2026-01-01T00:00:00Z',
      },
    ]);

    // LLM answers the user query without citing the irrelevant banana source
    mockLLMProvider.setHandler((messages) => {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      return `Here is technical guidance for ${lastUser?.content}: Microservices require robust API gateways.`;
    });

    const result = await orchestrator.processUserMessage({
      conversationId: conv.id,
      message: 'Explain microservices architecture best practices',
    });

    // Since LLM did not cite the banana source, finalSources must be empty
    expect(result.sources).toEqual([]);
    // But raw search results are preserved for diagnostics
    expect(result.metadata.rawSearchResults?.length).toBe(1);
    expect(result.metadata.rawSearchResults?.[0].title).toBe('Banana Farming in Tropical Climates');
  });

  // ============================================================================
  // Scenario 4: Empty Search Results Degradation
  // ============================================================================
  it('should gracefully degrade when search returns zero results without hallucinating citations', async () => {
    const conv = await convService.createConversation('Empty Search Test');

    // Force search to return empty array
    mockSearchProvider.setResults([]);

    const result = await orchestrator.processUserMessage({
      conversationId: conv.id,
      message: 'What is the release date of NonExistentQuantumOS in 2026?',
    });

    expect(result.searchUsed).toBe(true);
    expect(result.searchStatus).toBe('success');
    expect(result.sources).toEqual([]);
    expect(result.message).not.toContain('[source-1]');
    expect(result.message).not.toContain('[1]');
  });

  // ============================================================================
  // Scenario 5: LLM Provider Failure Handling
  // ============================================================================
  it('should handle LLM provider failure, release locks, and propagate error cleanly', async () => {
    const conv = await convService.createConversation('LLM Failure Test');

    mockLLMProvider.setSimulatedError(new Error('Simulated upstream LLM rate limit'));

    await expect(
      orchestrator.processUserMessage({
        conversationId: conv.id,
        message: 'Calculate fibonacci sequence',
      })
    ).rejects.toThrow('Simulated upstream LLM rate limit');

    // In-flight conversation lock must be released so subsequent calls work
    mockLLMProvider.setSimulatedError(undefined);
    const retryResult = await orchestrator.processUserMessage({
      conversationId: conv.id,
      message: 'Calculate fibonacci sequence',
    });

    expect(retryResult.role).toBe('assistant');
  });

  // ============================================================================
  // Scenario 6: Placeholder Citation Rejection
  // ============================================================================
  it('should reject placeholder domains like example.com and aws.example.com from verified citations', async () => {
    const citationManager = new CitationManager();

    const placeholderSources: RawSearchResult[] = [
      {
        title: 'Fake Document',
        url: 'https://example.com/fake-pricing',
        content: 'Fake data',
      },
      {
        title: 'Fake AWS Doc',
        url: 'https://aws.example.com/fake-pricing',
        content: 'Fake AWS data',
      },
      {
        title: 'Legitimate Report',
        url: 'https://github.blog/2026-copilot-update',
        content: 'Legitimate report data',
      },
    ];

    const searchItems = placeholderSources.map((s, idx) => ({
      ...s,
      id: `source-${idx + 1}`,
      index: idx + 1,
      source: new URL(s.url).hostname,
    }));

    const llmContent =
      'According to [source-1] and [source-2], prices changed. But [source-3] provides real metrics.';

    const attribution = citationManager.extractAndValidate(llmContent, searchItems);

    // [source-1] (example.com) and [source-2] (aws.example.com) must be stripped
    expect(attribution.cleanContent).not.toContain('[source-1]');
    expect(attribution.cleanContent).not.toContain('[source-2]');
    expect(attribution.cleanContent).toContain('[source-3]');

    // Only source-3 (github.blog) should be in citedSources
    expect(attribution.citedSources.length).toBe(1);
    expect(attribution.citedSources[0].url).toBe('https://github.blog/2026-copilot-update');
  });

  // ============================================================================
  // Scenario 7: Multi-Turn Follow-Up Questions
  // ============================================================================
  it('should resolve pronouns in follow-up turns, query appropriate topic, and maintain memory', async () => {
    const conv = await convService.createConversation('Multi-Turn Test');

    // Turn 1
    const turn1 = await orchestrator.processUserMessage({
      conversationId: conv.id,
      message: 'Tell me about Claude Code in 2026',
    });
    expect(turn1.message).toBeDefined();

    // Turn 2: Follow-up using ambiguous pronoun "it"
    const turn2 = await orchestrator.processUserMessage({
      conversationId: conv.id,
      message: 'How much does it cost this year?',
    });

    expect(turn2.searchUsed).toBe(true);
    expect(turn2.searchQueries.length).toBeGreaterThan(0);

    const followUpQuery = turn2.searchQueries[0].toLowerCase();
    // Pronoun "it" should be rewritten to "Claude Code"
    expect(followUpQuery).toContain('claude code');

    // History must contain all 4 turns (2 user, 2 assistant)
    const history = await convService.getMessages(conv.id);
    expect(history.length).toBe(4);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
    expect(history[2].role).toBe('user');
    expect(history[3].role).toBe('assistant');
  });

  // ============================================================================
  // Scenario 8: Production Provider Configuration & No Silent Fallbacks
  // ============================================================================
  it('should never silently fall back from unknown or unconfigured production providers', async () => {
    // 1. Unknown LLM provider must throw, never silently fall back to MockLLMProvider
    expect(() => createLLMProvider('unsupported_llm')).toThrow(/Unsupported LLM provider/);

    // 2. Unknown Search provider must throw, never silently fall back to MockSearchProvider
    expect(() => createSearchProvider('unsupported_search')).toThrow(/Unsupported search provider/);

    // 3. OpenAI provider without key must throw LLMAuthenticationError
    const openAIWithoutKey = new OpenAILLMProvider({ apiKey: '' });
    await expect(openAIWithoutKey.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(
      LLMAuthenticationError
    );

    // 4. Tavily provider without key must throw SearchAuthenticationError
    const tavilyWithoutKey = new TavilySearchProvider({ apiKey: '' });
    await expect(tavilyWithoutKey.search('test query')).rejects.toThrow(
      SearchAuthenticationError
    );
  });
});
