import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { ConversationService } from '../src/services/memory/conversationService';
import { InMemoryConversationStorage } from '../src/services/memory/adapters/inMemoryAdapter';
import { ContextManager } from '../src/services/memory/contextManager';
import { NotFoundError, BadRequestError } from '../src/utils/errors';
import { ConversationMessage } from '../src/types';

describe('Phase 4: Conversation Memory Architecture', () => {
  let memoryStorage: InMemoryConversationStorage;
  let conversationService: ConversationService;

  beforeEach(async () => {
    memoryStorage = new InMemoryConversationStorage();
    conversationService = new ConversationService(memoryStorage);
  });

  // ==========================================================================
  // 1. Conversation Management (Unit / Service Level)
  // ==========================================================================

  describe('ConversationService - Conversation Management', () => {
    it('should generate a valid UUID and timestamps upon conversation creation', async () => {
      const conv = await conversationService.createConversation({ title: 'AI Ethics' });

      expect(conv).toBeDefined();
      expect(conv.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(conv.title).toBe('AI Ethics');
      expect(conv.messageCount).toBe(0);
      expect(new Date(conv.createdAt).toString()).not.toBe('Invalid Date');
      expect(new Date(conv.updatedAt).toString()).not.toBe('Invalid Date');
    });

    it('should default title to "New Conversation" if title is omitted', async () => {
      const conv = await conversationService.createConversation();
      expect(conv.title).toBe('New Conversation');
    });

    it('should retrieve an existing conversation by ID', async () => {
      const created = await conversationService.createConversation({ title: 'Retrieval Test' });
      const retrieved = await conversationService.getConversation(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Retrieval Test');
    });

    it('should throw NotFoundError when retrieving non-existent conversation', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(conversationService.getConversation(fakeId)).rejects.toThrow(NotFoundError);
    });

    it('should list multiple conversations sorted by updatedAt descending', async () => {
      const conv1 = await conversationService.createConversation({ title: 'First' });
      const conv2 = await conversationService.createConversation({ title: 'Second' });

      // Add message to conv1 to update its updatedAt
      await conversationService.appendMessage(conv1.id, { role: 'user', content: 'Ping' });

      const list = await conversationService.listConversations();
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0]?.id).toBe(conv1.id); // conv1 was updated more recently
    });

    it('should delete a conversation and its messages cleanly', async () => {
      const conv = await conversationService.createConversation({ title: 'To Delete' });
      await conversationService.appendMessage(conv.id, { role: 'user', content: 'Hello' });

      const deleted = await conversationService.deleteConversation(conv.id);
      expect(deleted).toBe(true);

      await expect(conversationService.getConversation(conv.id)).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // 2. Message Management & Ordering
  // ==========================================================================

  describe('ConversationService - Message Management & Ordering', () => {
    it('should append user and assistant messages preserving chronological sequence', async () => {
      const conv = await conversationService.createConversation({ title: 'Chat Flow' });

      const msg1 = await conversationService.appendMessage(conv.id, {
        role: 'user',
        content: 'What is PostgreSQL?',
      });

      const msg2 = await conversationService.appendMessage(conv.id, {
        role: 'assistant',
        content: 'PostgreSQL is an open-source relational database.',
      });

      const messages = await conversationService.getMessages(conv.id);
      expect(messages).toHaveLength(2);
      expect(messages[0]?.id).toBe(msg1.id);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.id).toBe(msg2.id);
      expect(messages[1]?.role).toBe('assistant');

      // Verify conversation messageCount was incremented
      const updatedConv = await conversationService.getConversation(conv.id);
      expect(updatedConv.messageCount).toBe(2);
    });

    it('should reject appending message to a non-existent conversation', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        conversationService.appendMessage(fakeId, { role: 'user', content: 'Orphan message' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject empty or whitespace-only message content', async () => {
      const conv = await conversationService.createConversation({ title: 'Validation' });
      await expect(
        conversationService.appendMessage(conv.id, { role: 'user', content: '   ' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should maintain strict conversation isolation across independent sessions', async () => {
      const convA = await conversationService.createConversation({ title: 'Session A' });
      const convB = await conversationService.createConversation({ title: 'Session B' });

      await conversationService.appendMessage(convA.id, { role: 'user', content: 'Message for A' });
      await conversationService.appendMessage(convB.id, { role: 'user', content: 'Message for B' });

      const messagesA = await conversationService.getMessages(convA.id);
      const messagesB = await conversationService.getMessages(convB.id);

      expect(messagesA).toHaveLength(1);
      expect(messagesA[0]?.content).toBe('Message for A');

      expect(messagesB).toHaveLength(1);
      expect(messagesB[0]?.content).toBe('Message for B');
    });
  });

  // ==========================================================================
  // 3. Context Window Management
  // ==========================================================================

  describe('ContextManager - Sliding Window & Truncation', () => {
    const contextMgr = new ContextManager({ defaultMaxMessages: 3 });

    it('should return all messages when history is within message limit', () => {
      const messages: ConversationMessage[] = [
        { id: '1', conversationId: 'c1', role: 'user', content: 'One', createdAt: '2026-01-01T00:00:00Z' },
        { id: '2', conversationId: 'c1', role: 'assistant', content: 'Two', createdAt: '2026-01-01T00:01:00Z' },
      ];

      const context = contextMgr.buildContextWindow('c1', messages);
      expect(context.messages).toHaveLength(2);
      expect(context.hasTruncatedHistory).toBe(false);
      expect(context.totalStoredMessages).toBe(2);
    });

    it('should slide window and truncate older messages when limit is exceeded', () => {
      const messages: ConversationMessage[] = [
        { id: '1', conversationId: 'c1', role: 'user', content: 'Turn 1', createdAt: '2026-01-01T00:00:00Z' },
        { id: '2', conversationId: 'c1', role: 'assistant', content: 'Turn 2', createdAt: '2026-01-01T00:01:00Z' },
        { id: '3', conversationId: 'c1', role: 'user', content: 'Turn 3', createdAt: '2026-01-01T00:02:00Z' },
        { id: '4', conversationId: 'c1', role: 'assistant', content: 'Turn 4', createdAt: '2026-01-01T00:03:00Z' },
        { id: '5', conversationId: 'c1', role: 'user', content: 'Turn 5', createdAt: '2026-01-01T00:04:00Z' },
      ];

      const context = contextMgr.buildContextWindow('c1', messages, { maxMessages: 3 });
      expect(context.messages).toHaveLength(3);
      expect(context.messages.map((m) => m.content)).toEqual(['Turn 3', 'Turn 4', 'Turn 5']);
      expect(context.hasTruncatedHistory).toBe(true);
      expect(context.totalStoredMessages).toBe(5);
    });

    it('should preserve system instructions at the head of context window even during truncation', () => {
      const messages: ConversationMessage[] = [
        { id: 'sys', conversationId: 'c1', role: 'system', content: 'System Prompt Anchor', createdAt: '2026-01-01T00:00:00Z' },
        { id: '1', conversationId: 'c1', role: 'user', content: 'Turn 1', createdAt: '2026-01-01T00:01:00Z' },
        { id: '2', conversationId: 'c1', role: 'assistant', content: 'Turn 2', createdAt: '2026-01-01T00:02:00Z' },
        { id: '3', conversationId: 'c1', role: 'user', content: 'Turn 3', createdAt: '2026-01-01T00:03:00Z' },
        { id: '4', conversationId: 'c1', role: 'assistant', content: 'Turn 4', createdAt: '2026-01-01T00:04:00Z' },
      ];

      const context = contextMgr.buildContextWindow('c1', messages, { maxMessages: 2 });
      expect(context.messages).toHaveLength(3); // 1 system + 2 recent turns
      expect(context.messages[0]?.role).toBe('system');
      expect(context.messages[0]?.content).toBe('System Prompt Anchor');
      expect(context.messages[1]?.content).toBe('Turn 3');
      expect(context.messages[2]?.content).toBe('Turn 4');
      expect(context.hasTruncatedHistory).toBe(true);
    });

    it('should respect character budget constraints when maxCharacters is specified', () => {
      const messages: ConversationMessage[] = [
        { id: '1', conversationId: 'c1', role: 'user', content: 'Short', createdAt: '2026-01-01T00:00:00Z' },
        { id: '2', conversationId: 'c1', role: 'assistant', content: 'Very long content here that consumes many characters', createdAt: '2026-01-01T00:01:00Z' },
        { id: '3', conversationId: 'c1', role: 'user', content: 'Latest short message', createdAt: '2026-01-01T00:02:00Z' },
      ];

      const context = contextMgr.buildContextWindow('c1', messages, { maxCharacters: 30 });
      // Should retain the latest message since adding the previous long message exceeds 30 chars
      expect(context.messages).toHaveLength(1);
      expect(context.messages[0]?.content).toBe('Latest short message');
      expect(context.hasTruncatedHistory).toBe(true);
    });

    it('should return empty context structure when no messages exist', () => {
      const context = contextMgr.buildContextWindow('c1', []);
      expect(context.messages).toEqual([]);
      expect(context.totalStoredMessages).toBe(0);
      expect(context.windowSize).toBe(0);
      expect(context.hasTruncatedHistory).toBe(false);
    });
  });

  // ==========================================================================
  // 4. HTTP API Endpoints Integration Tests
  // ==========================================================================

  describe('Conversations API Routes', () => {
    it('POST /api/conversations should create a new conversation with 201 Created', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({ title: 'API Integration Test', metadata: { category: 'testing' } });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('API Integration Test');
      expect(res.body.data.metadata).toEqual({ category: 'testing' });
      expect(res.body.data.messageCount).toBe(0);
    });

    it('GET /api/conversations/:conversationId should return 200 with conversation metadata', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({ title: 'Fetch By ID' });

      const convId = createRes.body.data.id;
      const getRes = await request(app).get(`/api/conversations/${convId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.id).toBe(convId);
      expect(getRes.body.data.title).toBe('Fetch By ID');
    });

    it('GET /api/conversations/:conversationId should return 400 for malformed UUID', async () => {
      const res = await request(app).get('/api/conversations/not-a-valid-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/conversations/:conversationId should return 404 for non-existent UUID', async () => {
      const randomUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).get(`/api/conversations/${randomUuid}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('POST /api/conversations/:conversationId/messages should append a message and return 201', async () => {
      const createRes = await request(app).post('/api/conversations').send();
      const convId = createRes.body.data.id;

      const msgRes = await request(app)
        .post(`/api/conversations/${convId}/messages`)
        .send({
          role: 'user',
          content: 'Hello agent, can you help me compare PostgreSQL and MySQL?',
          metadata: { intent: 'comparison' },
        });

      expect(msgRes.status).toBe(201);
      expect(msgRes.body.success).toBe(true);
      expect(msgRes.body.data.conversationId).toBe(convId);
      expect(msgRes.body.data.role).toBe('user');
      expect(msgRes.body.data.content).toContain('PostgreSQL and MySQL');
      expect(msgRes.body.data.metadata).toEqual({ intent: 'comparison' });
    });

    it('POST /api/conversations/:conversationId/messages should return 400 for invalid role', async () => {
      const createRes = await request(app).post('/api/conversations').send();
      const convId = createRes.body.data.id;

      const res = await request(app)
        .post(`/api/conversations/${convId}/messages`)
        .send({ role: 'unauthorized_role', content: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/conversations/:conversationId/messages should return conversation messages', async () => {
      const createRes = await request(app).post('/api/conversations').send();
      const convId = createRes.body.data.id;

      await request(app)
        .post(`/api/conversations/${convId}/messages`)
        .send({ role: 'user', content: 'Turn 1' });
      await request(app)
        .post(`/api/conversations/${convId}/messages`)
        .send({ role: 'assistant', content: 'Turn 2' });

      const res = await request(app).get(`/api/conversations/${convId}/messages`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversationId).toBe(convId);
      expect(res.body.data.messages).toHaveLength(2);
      expect(res.body.data.totalMessages).toBe(2);
    });

    it('GET /api/conversations/:conversationId/messages?contextWindow=true should return sliding context window', async () => {
      const createRes = await request(app).post('/api/conversations').send();
      const convId = createRes.body.data.id;

      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/api/conversations/${convId}/messages`)
          .send({ role: 'user', content: `Message ${i}` });
      }

      const res = await request(app).get(
        `/api/conversations/${convId}/messages?contextWindow=true&maxMessages=2`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages).toHaveLength(2);
      expect(res.body.data.windowSize).toBe(2);
      expect(res.body.data.totalStoredMessages).toBe(5);
      expect(res.body.data.hasTruncatedHistory).toBe(true);
      expect(res.body.data.messages[0].content).toBe('Message 4');
      expect(res.body.data.messages[1].content).toBe('Message 5');
    });

    it('DELETE /api/conversations/:conversationId should remove conversation and return 200', async () => {
      const createRes = await request(app).post('/api/conversations').send();
      const convId = createRes.body.data.id;

      const delRes = await request(app).delete(`/api/conversations/${convId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);

      const checkRes = await request(app).get(`/api/conversations/${convId}`);
      expect(checkRes.status).toBe(404);
    });

    it('GET /api/conversations should list conversations with pagination metadata', async () => {
      await request(app).post('/api/conversations').send({ title: 'List Test 1' });
      await request(app).post('/api/conversations').send({ title: 'List Test 2' });

      const res = await request(app).get('/api/conversations?limit=10&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.meta).toHaveProperty('total');
    });
  });

  // ==========================================================================
  // 5. Storage Factory Fallbacks
  // ==========================================================================

  describe('StorageFactory', () => {
    it('should create InMemoryConversationStorage for "inmemory" and fallback on unknown providers', async () => {
      const { createConversationStorage } = await import(
        '../src/services/memory/storageFactory'
      );

      const inMem = createConversationStorage('inmemory');
      expect(inMem.name).toBe('inmemory');

      const fallback = createConversationStorage('unknown_provider');
      expect(fallback.name).toBe('inmemory');
    });
  });
});
