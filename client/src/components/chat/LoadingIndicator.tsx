import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface LoadingIndicatorProps {
  statusMessage?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  statusMessage = 'MiniMi is thinking...',
}) => {
  return (
    <div
      data-testid="loading-indicator"
      className="flex items-start gap-3 max-w-3xl mr-auto animate-fade-in"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-500/20">
        <Bot className="w-4 h-4" />
      </div>

      <div className="p-4 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          <span>{statusMessage}</span>
        </div>

        <div className="flex items-center gap-1.5 py-1">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
