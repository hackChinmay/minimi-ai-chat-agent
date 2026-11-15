import React from 'react';
import { Menu, Plus, Bot } from 'lucide-react';

interface HeaderProps {
  conversationTitle?: string;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  isBackendHealthy?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  conversationTitle,
  onToggleSidebar,
  onNewChat,
  isBackendHealthy = true,
}) => {
  return (
    <header className="h-14 border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
      {/* Left: Mobile hamburger & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 md:hidden">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-md">
            {conversationTitle || 'MiniMi AI Agent'}
          </h2>
        </div>
      </div>

      {/* Right: Status Pill & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Backend health status badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">
            {isBackendHealthy ? 'Agent Ready' : 'Backend Disconnected'}
          </span>
        </div>

        {/* Quick new chat button (mobile) */}
        <button
          onClick={onNewChat}
          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 md:hidden"
          title="New Chat"
          aria-label="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
