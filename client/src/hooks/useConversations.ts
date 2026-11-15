import { useState, useEffect, useCallback } from 'react';
import { Conversation } from '../types/api';
import { conversationService } from '../services/conversationService';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await conversationService.listConversations(50, 0);
      setConversations(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(
    async (title = 'New Conversation') => {
      try {
        setError(null);
        const created = await conversationService.createConversation(title);
        setConversations((prev) => [created, ...prev]);
        setActiveConversationId(created.id);
        return created;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create conversation';
        setError(msg);
        throw err;
      }
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await conversationService.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete conversation';
        setError(msg);
        throw err;
      }
    },
    [activeConversationId]
  );

  const selectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return {
    conversations,
    activeConversationId,
    activeConversation,
    loading,
    error,
    createConversation,
    deleteConversation,
    selectConversation,
    refreshConversations: fetchConversations,
  };
}
