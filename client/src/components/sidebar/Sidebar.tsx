import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Bot,
  X,
  History,
  Sparkles,
} from 'lucide-react';
import { Conversation } from '../../types/api';
import { groupConversationsByDate } from '../../utils/formatters';
import { ConversationItem } from './ConversationItem';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => Promise<void>;
  isCreating?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  isOpen,
  onClose,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isCreating = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      (c.title || 'Untitled Chat').toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  // Group filtered conversations by date
  const groups = useMemo(() => {
    return groupConversationsByDate(filteredConversations);
  }, [filteredConversations]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        data-testid="sidebar"
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                  MiniMi AI
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Intelligent Agent
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action: New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm shadow-indigo-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search Bar */}
        {conversations.length > 3 && (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-200/60 dark:bg-slate-800/80 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
          {conversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-2">
              <History className="w-8 h-8 opacity-40" />
              <p className="text-xs">No conversations yet.</p>
              <p className="text-[11px] text-slate-500">
                Click &quot;New Chat&quot; to begin.
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center p-4 text-xs text-slate-400">
              No chats found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeId}
                    onSelect={(id) => {
                      onSelectConversation(id);
                      onClose();
                    }}
                    onDelete={onDeleteConversation}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {/* System Capabilities Footer */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Agent Capabilities:
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400 leading-tight">
            Web Search • Historical Memory • Comparison Engine
          </p>
        </div>
      </aside>
    </>
  );
};
