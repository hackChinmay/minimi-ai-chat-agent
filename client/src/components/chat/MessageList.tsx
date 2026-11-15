import React, { useEffect, useRef } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { ConversationMessage } from '../../types/api';
import { MessageBubble } from './MessageBubble';
import { LoadingIndicator } from './LoadingIndicator';
import { WelcomeScreen } from './WelcomeScreen';

interface MessageListProps {
  messages: ConversationMessage[];
  isSending: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  onRetry?: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isSending,
  isLoadingHistory,
  error,
  onRetry,
  onSelectPrompt,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or sending state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Loading history skeleton
  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading conversation memory...
        </p>
      </div>
    );
  }

  // Empty state: render Welcome Screen
  if (messages.length === 0 && !isSending) {
    return (
      <div className="flex-1 flex flex-col justify-center overflow-y-auto">
        <WelcomeScreen onSelectPrompt={onSelectPrompt} />
      </div>
    );
  }

  return (
    <div
      data-testid="message-list"
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Sending/Thinking Indicator */}
      {isSending && <LoadingIndicator />}

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="truncate">{error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      <div ref={bottomRef} className="h-1" />
    </div>
  );
};
