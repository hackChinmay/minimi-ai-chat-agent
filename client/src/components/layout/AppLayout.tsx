import React, { useState } from 'react';
import { Conversation, ConversationMessage } from '../../types/api';
import { Sidebar } from '../sidebar/Sidebar';
import { Header } from './Header';
import { MessageList } from '../chat/MessageList';
import { ChatInput } from '../input/ChatInput';

interface AppLayoutProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: ConversationMessage[];
  isSending: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onRetry?: () => void;
  isBackendHealthy?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  conversations,
  activeConversation,
  messages,
  isSending,
  isLoadingHistory,
  error,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onSendMessage,
  onRetry,
  isBackendHealthy = true,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100">
      {/* Sidebar (Desktop fixed / Mobile drawer) */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversation?.id || null}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectConversation={onSelectConversation}
        onNewChat={onNewChat}
        onDeleteConversation={onDeleteConversation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <Header
          conversationTitle={activeConversation?.title}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={onNewChat}
          isBackendHealthy={isBackendHealthy}
        />

        {/* Messages scrollable viewport */}
        <MessageList
          messages={messages}
          isSending={isSending}
          isLoadingHistory={isLoadingHistory}
          error={error}
          onRetry={onRetry}
          onSelectPrompt={(prompt) => onSendMessage(prompt)}
        />

        {/* Input box */}
        <ChatInput
          onSendMessage={onSendMessage}
          disabled={isSending}
        />
      </div>
    </div>
  );
};
