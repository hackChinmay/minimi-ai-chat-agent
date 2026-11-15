import React, { useEffect, useState } from 'react';
import { useConversations } from './hooks/useConversations';
import { useChat } from './hooks/useChat';
import { AppLayout } from './components/layout/AppLayout';
import { conversationService } from './services/conversationService';

export const App: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    activeConversation,
    createConversation,
    deleteConversation,
    selectConversation,
    refreshConversations,
  } = useConversations();

  const {
    messages,
    loadingHistory,
    isSending,
    error: chatError,
    sendMessage,
    retryLastMessage,
  } = useChat(activeConversationId);

  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);

  // Check health on mount and periodically
  useEffect(() => {
    let isMounted = true;
    async function check() {
      try {
        const res = await conversationService.checkHealth();
        if (isMounted) setIsBackendHealthy(res?.status === 'healthy' || Boolean(res));
      } catch {
        if (isMounted) setIsBackendHealthy(false);
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSendMessage = async (content: string) => {
    const ensureConversation = async (): Promise<string> => {
      if (activeConversationId) return activeConversationId;
      const title = content.length > 32 ? content.slice(0, 32) + '...' : content;
      const created = await createConversation(title);
      return created.id;
    };

    await sendMessage(content, ensureConversation);
    // Refresh conversation list to update titles/updatedAt
    refreshConversations();
  };

  const handleRetry = () => {
    const ensureConversation = async (): Promise<string> => {
      if (activeConversationId) return activeConversationId;
      const created = await createConversation('New Chat');
      return created.id;
    };
    retryLastMessage(ensureConversation);
  };

  const handleNewChat = () => {
    selectConversation(null);
  };

  return (
    <AppLayout
      conversations={conversations}
      activeConversation={activeConversation}
      messages={messages}
      isSending={isSending}
      isLoadingHistory={loadingHistory}
      error={chatError}
      onSelectConversation={selectConversation}
      onNewChat={handleNewChat}
      onDeleteConversation={deleteConversation}
      onSendMessage={handleSendMessage}
      onRetry={handleRetry}
      isBackendHealthy={isBackendHealthy}
    />
  );
};

export default App;
