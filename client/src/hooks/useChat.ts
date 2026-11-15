import { useState, useEffect, useCallback, useRef } from 'react';
import { ConversationMessage } from '../types/api';
import { conversationService } from '../services/conversationService';

export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  const activeConvRef = useRef<string | null>(conversationId);
  activeConvRef.current = conversationId;

  // Load message history when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      return;
    }

    let isMounted = true;
    async function loadHistory() {
      try {
        setLoadingHistory(true);
        setError(null);
        const res = await conversationService.getMessages(conversationId!, 50);
        if (isMounted) {
          setMessages(res.messages);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load messages';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
        }
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string, ensureConversationId: () => Promise<string>) => {
      if (!content.trim() || isSending) return;

      const trimmed = content.trim();
      setError(null);
      setIsSending(true);
      setSearchStatus('Processing query...');

      let targetId = conversationId;

      // Optimistic user message representation
      const tempUserMsg: ConversationMessage = {
        id: `temp-${Date.now()}`,
        conversationId: targetId || 'pending',
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg]);

      try {
        if (!targetId) {
          targetId = await ensureConversationId();
        }

        setSearchStatus('Evaluating knowledge and search necessity...');

        const result = await conversationService.sendChatMessage(targetId, trimmed);

        if (activeConvRef.current === targetId) {
          const assistantMsg: ConversationMessage = {
            id: `assistant-${Date.now()}`,
            conversationId: targetId,
            role: 'assistant',
            content: result.message,
            createdAt: new Date().toISOString(),
            metadata: {
              sources: result.sources,
              searchUsed: result.searchUsed,
              searchStatus: result.searchStatus,
              searchQueries: result.searchQueries,
              category: result.metadata?.category,
              latencyMs: result.metadata?.latencyMs,
              tokens: result.metadata?.tokens,
            },
          };

          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to send message';
        setError(msg);
      } finally {
        setIsSending(false);
        setSearchStatus(null);
      }
    },
    [conversationId, isSending]
  );

  const retryLastMessage = useCallback(
    async (ensureConversationId: () => Promise<string>) => {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        await sendMessage(lastUserMsg.content, ensureConversationId);
      }
    },
    [messages, sendMessage]
  );

  return {
    messages,
    loadingHistory,
    isSending,
    searchStatus,
    error,
    sendMessage,
    retryLastMessage,
  };
}
