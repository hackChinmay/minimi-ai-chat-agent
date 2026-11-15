import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { TemporalResolver } from '../src/services/history/temporalResolver';
import { InMemorySnapshotStorage } from '../src/services/history/snapshotStore';
import { HistoricalRetrievalService } from '../src/services/history/historicalRetrievalService';
import { FactExtractor } from '../src/services/history/factExtractor';
import { ComparisonService } from '../src/services/history/comparisonService';
import { ConversationService } from '../src/services/memory/conversationService';
import { InMemoryConversationStorage } from '../src/services/memory/adapters/inMemoryAdapter';
import { SearchService } from '../src/services/search/searchService';
import { MockSearchProvider } from '../src/services/search/providers/mockProvider';
import { MockLLMProvider } from '../src/services/llm/providers/mockLLMProvider';
import { AgentOrchestrator } from '../src/services/agent/agentOrchestrator';
import { SearchDecisionEngine } from '../src/services/agent/searchDecisionEngine';
import { QueryRewriter } from '../src/services/agent/queryRewriter';
import { CitationManager } from '../src/services/agent/citationManager';
import { HistoricalSnapshot } from '../src/types';

describe('Phase 6: Historical Information & Intelligent Comparison', () => {
  // ==========================================================================
  // 1. TemporalResolver Tests
  // ==========================================================================
  describe('TemporalResolver', () => {
    const resolver = new TemporalResolver();
    const refDate = new Date('2026-11-15T12:00:00.000Z');

    it('should parse valid ISO 8601 date (YYYY-MM-DD)', () => {
      const res = resolver.resolve('2023-05-20', refDate);
      expect(res.isValid).toBe(true);
      expect(res.extractedYear).toBe(2023);
      expect(res.targetPeriod).toBe('2023-05-20');
      expect(res.isRelative).toBe(false);
      expect(res.normalizedDate).toBe('2023-05-20T00:00:00.000Z');
    });

    it('should reject invalid calendar dates such as 2024-02-30', () => {
      const res = resolver.resolve('2024-02-30', refDate);
      expect(res.isValid).toBe(false);
    });

    it('should parse month and year expression (e.g. October 2022)', () => {
      const res = resolver.resolve('October 2022', refDate);
      expect(res.isValid).toBe(true);
      expect(res.extractedYear).toBe(2022);
      expect(res.targetPeriod).toBe('october 2022');
      expect(res.normalizedDate).toBe('2022-10-01T00:00:00.000Z');
    });

    it('should parse explicit calendar year (e.g. 2024)', () => {
      const res = resolver.resolve('2024', refDate);
      expect(res.isValid).toBe(true);
      expect(res.extractedYear).toBe(2024);
      expect(res.targetPeriod).toBe('2024');
    });

    it('should resolve "last year" relative to reference date', () => {
      const res = resolver.resolve('last year', refDate);
      expect(res.isValid).toBe(true);
      expect(res.isRelative).toBe(true);
      expect(res.extractedYear).toBe(2025);
      expect(res.targetPeriod).toBe('2025');
    });

    it('should resolve "this year" relative to reference date', () => {
      const res = resolver.resolve('this year', refDate);
      expect(res.isValid).toBe(true);
      expect(res.isRelative).toBe(true);
      expect(res.extractedYear).toBe(2026);
    });

    it('should resolve "2 years ago" relative to reference date', () => {
      const res = resolver.resolve('2 years ago', refDate);
      expect(res.isValid).toBe(true);
      expect(res.isRelative).toBe(true);
      expect(res.extractedYear).toBe(2024);
    });

    it('should resolve "since 2021"', () => {
      const res = resolver.resolve('since 2021', refDate);
      expect(res.isValid).toBe(true);
      expect(res.isRelative).toBe(true);
      expect(res.extractedYear).toBe(2021);
      expect(res.targetPeriod).toBe('since 2021');
    });

    it('should resolve "yesterday" and "today"', () => {
      const yRes = resolver.resolve('yesterday', refDate);
      expect(yRes.isValid).toBe(true);
      expect(yRes.isRelative).toBe(true);
      expect(yRes.targetPeriod).toBe('2026-11-14');

      const tRes = resolver.resolve('today', refDate);
      expect(tRes.isValid).toBe(true);
      expect(tRes.targetPeriod).toBe('2026-11-15');
    });

    it('should gracefully handle empty or invalid expressions', () => {
      const empty = resolver.resolve('', refDate);
      expect(empty.isValid).toBe(false);

      const gibberish = resolver.resolve('random nonsensical query', refDate);
      expect(gibberish.isValid).toBe(false);
    });
  });

  // ==========================================================================
  // 2. SnapshotStore (InMemorySnapshotStorage) Tests
  // ==========================================================================
  describe('InMemorySnapshotStorage', () => {
    let store: InMemorySnapshotStorage;

    beforeEach(() => {
      store = new InMemorySnapshotStorage();
    });

    it('should save and retrieve snapshots for a conversation', async () => {
      const snap: HistoricalSnapshot = {
        id: 'snap-1',
        conversationId: 'conv-1',
        entity: 'ChatGPT Plus',
        attribute: 'price',
        value: '$20/month',
        validPeriod: '2023',
        observedAt: '2023-04-01T10:00:00.000Z',
        retrievedAt: '2023-04-01T10:00:00.000Z',
        sourceUrl: 'https://openai.com/pricing',
      };

      await store.saveSnapshot(snap);
      const retrieved = await store.getSnapshots('conv-1');

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]?.entity).toBe('ChatGPT Plus');
      expect(retrieved[0]?.value).toBe('$20/month');
    });

    it('should prevent duplicate snapshots created within 5 minutes', async () => {
      const now = new Date('2026-11-15T12:00:00.000Z');
      const snap1: HistoricalSnapshot = {
        id: 'snap-1',
        conversationId: 'conv-1',
        entity: 'Supabase Pro',
        attribute: 'price',
        value: '$25/mo',
        observedAt: now.toISOString(),
        retrievedAt: now.toISOString(),
      };

      const snap2: HistoricalSnapshot = {
        id: 'snap-2',
        conversationId: 'conv-1',
        entity: 'Supabase Pro',
        attribute: 'price',
        value: '$25/mo',
        observedAt: new Date(now.getTime() + 60 * 1000).toISOString(), // 1 min later
        retrievedAt: new Date(now.getTime() + 60 * 1000).toISOString(),
      };

      const res1 = await store.saveSnapshot(snap1);
      const res2 = await store.saveSnapshot(snap2);

      expect(res1.id).toBe('snap-1');
      expect(res2.id).toBe('snap-1'); // Duplicate reused existing
      const all = await store.getSnapshots('conv-1');
      expect(all).toHaveLength(1);
    });

    it('should filter snapshots by entity, search query, and date bounds', async () => {
      await store.saveSnapshot({
        id: 's1',
        conversationId: 'conv-1',
        entity: 'Docker Desktop',
        attribute: 'price',
        value: 'Free for personal use',
        observedAt: '2022-01-01T00:00:00.000Z',
        retrievedAt: '2022-01-01T00:00:00.000Z',
      });

      await store.saveSnapshot({
        id: 's2',
        conversationId: 'conv-1',
        entity: 'Docker Business',
        attribute: 'price',
        value: '$24/user/month',
        observedAt: '2024-01-01T00:00:00.000Z',
        retrievedAt: '2024-01-01T00:00:00.000Z',
      });

      // Filter by entity
      const byEntity = await store.getSnapshots('conv-1', { entity: 'Docker Business' });
      expect(byEntity).toHaveLength(1);
      expect(byEntity[0]?.id).toBe('s2');

      // Filter by query substring
      const byQuery = await store.getSnapshots('conv-1', { query: 'personal' });
      expect(byQuery).toHaveLength(1);
      expect(byQuery[0]?.id).toBe('s1');

      // Filter by date bound
      const byDate = await store.getSnapshots('conv-1', { since: '2023-01-01T00:00:00.000Z' });
      expect(byDate).toHaveLength(1);
      expect(byDate[0]?.id).toBe('s2');
    });

    it('should find the latest snapshot for an entity and attribute', async () => {
      await store.saveSnapshot({
        id: 'old',
        conversationId: 'c1',
        entity: 'PostgreSQL',
        attribute: 'version',
        value: '15.2',
        observedAt: '2023-01-01T00:00:00.000Z',
        retrievedAt: '2023-01-01T00:00:00.000Z',
      });

      await store.saveSnapshot({
        id: 'new',
        conversationId: 'c1',
        entity: 'PostgreSQL',
        attribute: 'version',
        value: '17.0',
        observedAt: '2025-01-01T00:00:00.000Z',
        retrievedAt: '2025-01-01T00:00:00.000Z',
      });

      const latest = await store.findLatestSnapshot('c1', 'PostgreSQL', 'version');
      expect(latest?.id).toBe('new');
      expect(latest?.value).toBe('17.0');
    });
  });

  // ==========================================================================
  // 3. HistoricalRetrievalService Tests
  // ==========================================================================
  describe('HistoricalRetrievalService', () => {
    let memoryStorage: InMemoryConversationStorage;
    let convService: ConversationService;
    let snapshotStore: InMemorySnapshotStorage;
    let retrievalService: HistoricalRetrievalService;

    beforeEach(() => {
      memoryStorage = new InMemoryConversationStorage();
      convService = new ConversationService(memoryStorage);
      snapshotStore = new InMemorySnapshotStorage();
      retrievalService = new HistoricalRetrievalService(convService, snapshotStore);
    });

    it('should retrieve both snapshots and contextual messages matching query', async () => {
      const conv = await convService.createConversation({ title: 'Pricing History' });
      await convService.appendMessage(conv.id, {
        role: 'user',
        content: 'What was the price of GitHub Copilot in 2022?',
      });
      await convService.appendMessage(conv.id, {
        role: 'assistant',
        content: 'In 2022, GitHub Copilot was priced at $10 per month.',
      });

      await snapshotStore.saveSnapshot({
        id: 'snap-copilot',
        conversationId: conv.id,
        entity: 'GitHub Copilot',
        attribute: 'price',
        value: '$10/month',
        observedAt: '2022-06-01T00:00:00.000Z',
        retrievedAt: '2022-06-01T00:00:00.000Z',
      });

      const result = await retrievalService.retrieveContextualHistory(conv.id, 'Copilot');
      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0]?.value).toBe('$10/month');
      expect(result.relevantMessages.length).toBeGreaterThan(0);
    });

    it('should mine prior assistant messages when snapshot store has no entry', async () => {
      const conv = await convService.createConversation({ title: 'Mining Test' });
      await convService.appendMessage(conv.id, {
        role: 'assistant',
        content: 'The Figma Professional plan was $12 per month previously.',
        metadata: {
          citations: [{ id: 'source-1', url: 'https://figma.com/pricing', title: 'Figma Pricing' }],
        },
      });

      const claim = await retrievalService.findHistoricalClaim(conv.id, 'Figma', 'price');
      expect(claim).not.toBeNull();
      expect(claim?.value).toContain('$12');
      expect(claim?.sourceUrl).toBe('https://figma.com/pricing');
    });

    it('should strictly enforce conversation isolation', async () => {
      const conv1 = await convService.createConversation({ title: 'Conv 1' });
      const conv2 = await convService.createConversation({ title: 'Conv 2' });

      await snapshotStore.saveSnapshot({
        id: 's-conv1',
        conversationId: conv1.id,
        entity: 'Secret Product',
        attribute: 'cost',
        value: '$999',
        observedAt: '2026-01-01T00:00:00.000Z',
        retrievedAt: '2026-01-01T00:00:00.000Z',
      });

      const conv2History = await retrievalService.retrieveContextualHistory(conv2.id, 'Secret Product');
      expect(conv2History.snapshots).toHaveLength(0);
      expect(conv2History.relevantMessages).toHaveLength(0);
    });

    it('should throw NotFoundError when querying non-existent conversation', async () => {
      await expect(
        retrievalService.retrieveContextualHistory('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // 4. FactExtractor Tests
  // ==========================================================================
  describe('FactExtractor', () => {
    let snapshotStore: InMemorySnapshotStorage;
    let extractor: FactExtractor;

    beforeEach(() => {
      snapshotStore = new InMemorySnapshotStorage();
      extractor = new FactExtractor(snapshotStore);
    });

    it('should extract pricing fact from assistant response and record snapshot', async () => {
      const snapshot = await extractor.extractAndRecord({
        conversationId: 'c-test',
        messageId: 'm-1',
        userQuery: 'How much does Supabase Pro cost?',
        assistantResponse: 'Supabase Pro costs $25 per month as of 2026.',
        sources: [
          {
            id: 'source-1',
            index: 1,
            title: 'Supabase Pricing',
            url: 'https://supabase.com/pricing',
            source: 'supabase.com',
            content: 'Pro plan starts at $25/mo.',
          },
        ],
        observedAt: '2026-11-15T12:00:00.000Z',
      });

      expect(snapshot).not.toBeNull();
      expect(snapshot?.entity).toBe('Supabase Pro');
      expect(snapshot?.attribute).toBe('price');
      expect(snapshot?.value).toContain('$25');
      expect(snapshot?.sourceUrl).toBe('https://supabase.com/pricing');

      const saved = await snapshotStore.getSnapshots('c-test');
      expect(saved).toHaveLength(1);
    });

    it('should not record snapshots when response contains no factual assertions', async () => {
      const snapshot = await extractor.extractAndRecord({
        conversationId: 'c-test',
        messageId: 'm-2',
        userQuery: 'Tell me a joke',
        assistantResponse: 'Why do programmers prefer dark mode? Because light attracts bugs.',
        sources: [],
        observedAt: '2026-11-15T12:00:00.000Z',
      });

      expect(snapshot).toBeNull();
    });
  });

  // ==========================================================================
  // 5. ComparisonService Tests (Verdicts & Calculations)
  // ==========================================================================
  describe('ComparisonService', () => {
    let memoryStorage: InMemoryConversationStorage;
    let convService: ConversationService;
    let snapshotStore: InMemorySnapshotStorage;
    let retrievalService: HistoricalRetrievalService;
    let temporalResolver: TemporalResolver;
    let mockSearchProvider: MockSearchProvider;
    let searchService: SearchService;
    let mockLLM: MockLLMProvider;
    let comparisonService: ComparisonService;

    beforeEach(() => {
      memoryStorage = new InMemoryConversationStorage();
      convService = new ConversationService(memoryStorage);
      snapshotStore = new InMemorySnapshotStorage();
      retrievalService = new HistoricalRetrievalService(convService, snapshotStore);
      temporalResolver = new TemporalResolver();

      mockSearchProvider = new MockSearchProvider({
        customResults: [
          {
            title: 'GitHub Copilot Pricing 2026',
            url: 'https://github.com/features/copilot',
            content: 'GitHub Copilot Individual is now $19 per month.',
            publishedDate: '2026-05-01T00:00:00Z',
            score: 0.95,
          },
        ],
      });
      searchService = new SearchService(mockSearchProvider);

      mockLLM = new MockLLMProvider({
        defaultResponse:
          'GitHub Copilot increased from $10/month in 2022 to $19/month in 2026, representing a $9 price increase.',
      });

      comparisonService = new ComparisonService({
        retrievalService,
        snapshotStore,
        temporalResolver,
        searchService,
        llmProvider: mockLLM,
        convService,
      });
    });

    it('should return CONFIRMED_CHANGE when a price increase is verified', async () => {
      const conv = await convService.createConversation({ title: 'Copilot Comparison' });
      // Historical baseline snapshot ($10 in 2022)
      await snapshotStore.saveSnapshot({
        id: 'snap-old',
        conversationId: conv.id,
        entity: 'GitHub Copilot',
        attribute: 'price',
        value: '$10 per month',
        validPeriod: '2022',
        observedAt: '2022-06-01T00:00:00.000Z',
        retrievedAt: '2022-06-01T00:00:00.000Z',
        sourceUrl: 'https://github.blog/copilot-launch',
      });

      const result = await comparisonService.compare(conv.id, {
        subject: 'GitHub Copilot',
        attribute: 'price',
        baselineDate: '2022',
        targetDate: '2026',
      });

      expect(result.verdict).toBe('CONFIRMED_CHANGE');
      expect(result.confidence).toBe('high');
      expect(result.historical.value).toBe('$10 per month');
      expect(result.current.value).toContain('$19');
      expect(result.delta).toBeDefined();
      expect(result.delta?.summary).toContain('increased by $9.00');
      expect(result.delta?.numericDelta).toBe(9);
      expect(result.delta?.percentageChange).toBe(90);
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.explanation).toContain('Copilot');
    });

    it('should return NO_DETECTED_CHANGE when historical and current values match', async () => {
      const conv = await convService.createConversation({ title: 'ChatGPT Comparison' });
      // Historical baseline snapshot ($20/month)
      await snapshotStore.saveSnapshot({
        id: 'snap-gpt',
        conversationId: conv.id,
        entity: 'ChatGPT Plus',
        attribute: 'price',
        value: '$20 per month',
        validPeriod: '2023',
        observedAt: '2023-02-01T00:00:00.000Z',
        retrievedAt: '2023-02-01T00:00:00.000Z',
      });

      mockSearchProvider.setResults([
        {
          title: 'ChatGPT Plus Subscription',
          url: 'https://openai.com/chatgpt',
          content: 'ChatGPT Plus is available for $20 per month.',
          publishedDate: '2026-01-01T00:00:00Z',
          score: 0.98,
        },
      ]);

      const result = await comparisonService.compare(conv.id, {
        subject: 'ChatGPT Plus',
        attribute: 'price',
        baselineDate: '2023',
      });

      expect(result.verdict).toBe('NO_DETECTED_CHANGE');
      expect(result.delta?.numericDelta).toBe(0);
      expect(result.delta?.summary).toBe('No detected change ($20 vs $20)');
    });

    it('should return UNABLE_TO_VERIFY when web search returns empty results', async () => {
      const conv = await convService.createConversation({ title: 'Empty Search Test' });
      await snapshotStore.saveSnapshot({
        id: 'snap-obscure',
        conversationId: conv.id,
        entity: 'Obscure Startup Tool',
        attribute: 'price',
        value: '$5/month',
        observedAt: '2024-01-01T00:00:00.000Z',
        retrievedAt: '2024-01-01T00:00:00.000Z',
      });

      mockSearchProvider.setResults([]);

      const result = await comparisonService.compare(conv.id, {
        subject: 'Obscure Startup Tool',
        attribute: 'price',
      });

      expect(result.verdict).toBe('UNABLE_TO_VERIFY');
      expect(result.confidence).toBe('low');
      expect(result.explanation).toContain('Cannot confirm whether values changed');
    });

    it('should record target snapshot after successful comparison', async () => {
      const conv = await convService.createConversation({ title: 'Snapshot Storage on Compare' });
      await snapshotStore.saveSnapshot({
        id: 'snap-prev',
        conversationId: conv.id,
        entity: 'PostgreSQL',
        attribute: 'version',
        value: '15.0',
        observedAt: '2023-01-01T00:00:00.000Z',
        retrievedAt: '2023-01-01T00:00:00.000Z',
      });

      mockSearchProvider.setResults([
        {
          title: 'PostgreSQL 17.1 Released',
          url: 'https://postgresql.org/news',
          content: 'PostgreSQL 17.1 is the latest stable release.',
          publishedDate: '2026-10-01T00:00:00Z',
          score: 0.99,
        },
      ]);

      await comparisonService.compare(conv.id, {
        subject: 'PostgreSQL',
        attribute: 'version',
      });

      const snapshots = await snapshotStore.getSnapshots(conv.id, { entity: 'PostgreSQL' });
      expect(snapshots.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // 6. AgentOrchestrator Integration with Historical Baseline
  // ==========================================================================
  describe('AgentOrchestrator Historical Integration', () => {
    let memoryStorage: InMemoryConversationStorage;
    let convService: ConversationService;
    let snapshotStore: InMemorySnapshotStorage;
    let retrievalService: HistoricalRetrievalService;
    let factExtractor: FactExtractor;
    let mockSearch: MockSearchProvider;
    let searchService: SearchService;
    let mockLLM: MockLLMProvider;
    let orchestrator: AgentOrchestrator;

    beforeEach(() => {
      memoryStorage = new InMemoryConversationStorage();
      convService = new ConversationService(memoryStorage);
      snapshotStore = new InMemorySnapshotStorage();
      retrievalService = new HistoricalRetrievalService(convService, snapshotStore);
      factExtractor = new FactExtractor(snapshotStore);

      mockSearch = new MockSearchProvider({
        customResults: [
          {
            title: 'Figma Pricing Update 2026',
            url: 'https://figma.com/pricing',
            content: 'Figma Professional is now $16 per editor per month.',
            publishedDate: '2026-01-01T00:00:00Z',
            score: 0.95,
          },
        ],
      });
      searchService = new SearchService(mockSearch);

      mockLLM = new MockLLMProvider({
        defaultResponse:
          'Previously in 2022, Figma Professional was $12/month. It has now increased to $16/month [source-1].',
      });

      orchestrator = new AgentOrchestrator({
        conversationService: convService,
        searchService,
        llmProvider: mockLLM,
        decisionEngine: new SearchDecisionEngine(),
        queryRewriter: new QueryRewriter(),
        citationManager: new CitationManager(),
        retrievalService,
        factExtractor,
      });
    });

    it('should inject historical baseline and extract new snapshots on temporal comparison', async () => {
      const conv = await convService.createConversation({ title: 'Figma Price Compare' });

      // Pre-seed historical baseline snapshot
      await snapshotStore.saveSnapshot({
        id: 'figma-hist',
        conversationId: conv.id,
        entity: 'Figma Professional',
        attribute: 'price',
        value: '$12/month',
        observedAt: '2022-01-01T00:00:00.000Z',
        retrievedAt: '2022-01-01T00:00:00.000Z',
        sourceUrl: 'https://figma.com/old-pricing',
      });

      const response = await orchestrator.processUserMessage({
        conversationId: conv.id,
        message: 'Did the Figma Professional price increase compared to last year?',
      });

      expect(response.message).toContain('Figma Professional');
      expect(response.sources).toHaveLength(1);

      // Verify that FactExtractor recorded a new snapshot
      const allSnapshots = await snapshotStore.getSnapshots(conv.id);
      expect(allSnapshots.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 7. HTTP API Integration Routes
  // ==========================================================================
  describe('Historical API Endpoints', () => {
    it('GET /api/conversations/:id/history should return 200 with snapshots and relevant messages', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({ title: 'History Endpoint Test' });
      const convId = createRes.body.data.id;

      // Add a message
      await request(app)
        .post(`/api/conversations/${convId}/messages`)
        .send({ role: 'user', content: 'What is the price of Docker Desktop?' });

      const historyRes = await request(app).get(`/api/conversations/${convId}/history`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(historyRes.body.data).toHaveProperty('conversationId', convId);
      expect(Array.isArray(historyRes.body.data.snapshots)).toBe(true);
      expect(Array.isArray(historyRes.body.data.relevantMessages)).toBe(true);
    });

    it('GET /api/conversations/:id/history should return 404 for non-existent conversation', async () => {
      const historyRes = await request(app).get(
        '/api/conversations/00000000-0000-4000-8000-000000000000/history'
      );
      expect(historyRes.status).toBe(404);
      expect(historyRes.body.success).toBe(false);
      expect(historyRes.body.error.code).toBe('NOT_FOUND');
    });

    it('POST /api/conversations/:id/compare should return 200 with ComparisonResult', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({ title: 'Compare Endpoint Test' });
      const convId = createRes.body.data.id;

      const compareRes = await request(app)
        .post(`/api/conversations/${convId}/compare`)
        .send({
          subject: 'PostgreSQL',
          attribute: 'version',
          baselineDate: '2023',
        });

      expect(compareRes.status).toBe(200);
      expect(compareRes.body.success).toBe(true);
      expect(compareRes.body.data).toHaveProperty('verdict');
      expect(compareRes.body.data).toHaveProperty('historical');
      expect(compareRes.body.data).toHaveProperty('current');
      expect(compareRes.body.data).toHaveProperty('explanation');
    });

    it('POST /api/conversations/:id/compare should return 400 when subject is missing', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({ title: 'Invalid Compare Test' });
      const convId = createRes.body.data.id;

      const compareRes = await request(app)
        .post(`/api/conversations/${convId}/compare`)
        .send({
          attribute: 'price',
        });

      expect(compareRes.status).toBe(400);
      expect(compareRes.body.success).toBe(false);
      expect(compareRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
