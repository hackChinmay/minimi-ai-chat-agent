import React, { useState } from 'react';
import { ExternalLink, Globe, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { SearchResultItem } from '../../types/api';
import { formatDomain } from '../../utils/formatters';
import { isSafeUrl, truncateText } from '../../utils/sanitize';

interface SourceCitationsProps {
  sources: SearchResultItem[];
  defaultExpanded?: boolean;
}

export const SourceCitations: React.FC<SourceCitationsProps> = ({
  sources,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1 -mx-1 py-0.5"
        aria-expanded={expanded}
        aria-label={`Toggle ${sources.length} sources`}
      >
        <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
        <span>Verified Sources ({sources.length})</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>

      {/* Pill summary when collapsed */}
      {!expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {sources.map((source, idx) => {
            const domain = formatDomain(source.url || source.source);
            const safe = isSafeUrl(source.url);

            if (safe) {
              return (
                <a
                  key={source.id || idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
                  title={source.title}
                >
                  <span className="font-semibold text-indigo-500">[{idx + 1}]</span>
                  <span className="max-w-[120px] truncate">{domain}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                </a>
              );
            }

            return (
              <span
                key={source.id || idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full"
              >
                <span className="font-semibold text-indigo-500">[{idx + 1}]</span>
                <span className="max-w-[120px] truncate">{domain}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Detailed cards when expanded */}
      {expanded && (
        <div className="mt-2.5 space-y-2">
          {sources.map((source, idx) => {
            const domain = formatDomain(source.url || source.source);
            const safe = isSafeUrl(source.url);

            return (
              <div
                key={source.id || idx}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                      [{idx + 1}]
                    </span>
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {safe ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate inline-flex items-center gap-1"
                        title={source.title}
                      >
                        <span className="truncate">{source.title || domain}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                      </a>
                    ) : (
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {source.title || domain}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                    {domain}
                  </span>
                </div>

                {source.content && (
                  <p className="mt-1.5 text-slate-600 dark:text-slate-400 leading-relaxed text-[11px] line-clamp-2">
                    {truncateText(source.content, 200)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
