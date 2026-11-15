import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_CHARS = 4000;

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask MiniMi anything, compare historical data, or search the web...',
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = content.trim().length > 0 && !disabled;

  return (
    <div className="p-3 sm:p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-t border-slate-200/80 dark:border-slate-800">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
        <div className="relative flex flex-col rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className="w-full px-4 pt-3 pb-8 sm:pb-3 sm:pr-24 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-none min-h-[48px] max-h-[200px]"
            aria-label="Chat message input"
          />

          {/* Action Row / Submit Button */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            {content.length > 3000 && (
              <span className="text-[10px] font-mono text-slate-400 mr-1">
                {content.length}/{MAX_CHARS}
              </span>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                canSubmit
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
              title="Send message (Enter)"
              aria-label="Send message"
            >
              {disabled ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Footer shortcuts hint */}
        <div className="hidden sm:flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-2">
          <span className="flex items-center gap-1">
            <span>Powered by MiniMi AI Agent Orchestration</span>
          </span>
          <span className="flex items-center gap-1">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px]">
              Enter
            </kbd>
            <span>to send,</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px]">
              Shift + Enter
            </kbd>
            <span>for new line</span>
          </span>
        </div>
      </form>
    </div>
  );
};
