import React, { useState } from 'react';
import { MessageSquare, Trash2, Check, X } from 'lucide-react';
import { Conversation } from '../../types/api';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onDelete,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(conversation.id);
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(conversation.id);
        }
      }}
      data-testid={`conversation-item-${conversation.id}`}
      className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
        isActive
          ? 'bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-semibold shadow-xs'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <MessageSquare
          className={`w-4 h-4 shrink-0 ${
            isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
          }`}
        />
        <span className="truncate">{conversation.title || 'Untitled Chat'}</span>
      </div>

      {/* Action / Delete / Confirmation */}
      <div className="flex items-center gap-1 shrink-0">
        {isConfirmingDelete ? (
          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 p-0.5 rounded border border-rose-200 dark:border-rose-900">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 hover:text-rose-600 text-rose-500 rounded"
              title="Confirm Delete"
              aria-label="Confirm Delete"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancelDelete}
              className="p-1 hover:text-slate-600 text-slate-400 rounded"
              title="Cancel"
              aria-label="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="p-1 opacity-0 group-hover:opacity-100 hover:text-rose-600 text-slate-400 rounded transition-all focus:opacity-100"
            title="Delete conversation"
            aria-label="Delete conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
