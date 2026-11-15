import React, { useState } from 'react';
import {
  User,
  Bot,
  Copy,
  Check,
  Globe,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { ConversationMessage, SearchResultItem } from '../../types/api';
import { formatTimestamp } from '../../utils/formatters';
import { MarkdownContent } from './MarkdownContent';
import { SourceCitations } from './SourceCitations';
import { ComparisonCard } from './ComparisonCard';

interface MessageBubbleProps {
  message: ConversationMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // copy failed
    }
  };

  const metadata = message.metadata || {};
  const searchUsed = metadata.searchUsed;
  const searchStatus = metadata.searchStatus;
  const sources = (metadata.sources || []) as SearchResultItem[];
  const comparisonResult = metadata.comparisonResult;
  const latencyMs = metadata.latencyMs as number | undefined;

  return (
    <div
      data-testid={`message-${message.role}`}
      className={`group flex items-start gap-3 max-w-3xl ${
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm ${
          isUser
            ? 'bg-slate-700 dark:bg-slate-600'
            : 'bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-indigo-500/20'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Container */}
      <div
        className={`flex-1 min-w-0 rounded-2xl p-4 shadow-sm transition-all ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-sm'
        }`}
      >
        {/* Header / Meta Bar */}
        <div
          className={`flex items-center justify-between gap-2 mb-1.5 text-[11px] ${
            isUser ? 'text-indigo-200' : 'text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">{isUser ? 'You' : 'MiniMi AI'}</span>
            {message.createdAt && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3 opacity-60" />
                <span>{formatTimestamp(message.createdAt)}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            {/* Search Indicator badge for assistant */}
            {!isUser && searchUsed && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  searchStatus === 'failed'
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    : 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20'
                }`}
                title={searchStatus ? `Search status: ${searchStatus}` : 'Web search used'}
              >
                <Globe className="w-2.5 h-2.5" />
                <span>Search</span>
              </span>
            )}

            {/* Latency badge */}
            {!isUser && latencyMs && (
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                {(latencyMs / 1000).toFixed(1)}s
              </span>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none ${
                isUser ? 'text-indigo-100 hover:text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Message Content */}
        {isUser ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          <MarkdownContent content={message.content} />
        )}

        {/* Comparison Result Card (Phase 6) */}
        {!isUser && comparisonResult && (
          <ComparisonCard comparison={comparisonResult} />
        )}

        {/* Verified Sources / Citations (Phase 3 & 5) */}
        {!isUser && sources.length > 0 && (
          <SourceCitations sources={sources} />
        )}

        {/* Search Warning / Error Note if search failed */}
        {!isUser && searchStatus === 'failed' && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Search fallback active: Web search failed, answered using base knowledge.</span>
          </div>
        )}
      </div>
    </div>
  );
};
