import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react';
import { ComparisonResult, ComparisonVerdict } from '../../types/api';
import { formatDomain, formatFullDate } from '../../utils/formatters';
import { isSafeUrl } from '../../utils/sanitize';

interface ComparisonCardProps {
  comparison: ComparisonResult;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({ comparison }) => {
  if (!comparison) return null;

  const {
    entity,
    attribute,
    verdict,
    confidence = comparison.metadata?.confidence,
    historical,
    current,
    deltaSummary,
    delta,
    explanation,
    citations = [],
  } = comparison;

  const getVerdictConfig = (v: ComparisonVerdict) => {
    switch (v) {
      case 'CONFIRMED_CHANGE':
        return {
          label: 'Confirmed Change',
          color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          icon: CheckCircle2,
        };
      case 'NO_DETECTED_CHANGE':
        return {
          label: 'No Detected Change',
          color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          icon: Minus,
        };
      case 'UNABLE_TO_VERIFY':
      default:
        return {
          label: 'Unable to Verify',
          color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: AlertCircle,
        };
    }
  };

  const verdictConfig = getVerdictConfig(verdict);
  const VerdictIcon = verdictConfig.icon;

  const numericDelta = delta?.numericDelta;
  const percentageChange = delta?.percentageChange;

  return (
    <div
      data-testid="comparison-card"
      className="my-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900/90 dark:to-slate-950 p-4 shadow-sm"
    >
      {/* Header: Entity & Attribute + Verdict Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {entity}
              {attribute ? (
                <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                  • {attribute}
                </span>
              ) : null}
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Historical Comparison
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confidence && (
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {confidence} confidence
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${verdictConfig.color}`}
          >
            <VerdictIcon className="w-3.5 h-3.5" />
            <span>{verdictConfig.label}</span>
          </span>
        </div>
      </div>

      {/* Two-Column Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        {/* Historical Observation */}
        <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Historical Baseline
            </span>
            {historical?.period && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60">
                {historical.period}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
            {historical?.value || 'N/A'}
          </div>
          {historical?.timestamp && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{formatFullDate(historical.timestamp)}</span>
            </div>
          )}
          {historical?.sourceUrl && isSafeUrl(historical.sourceUrl) && (
            <a
              href={historical.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <span className="truncate max-w-[200px]">
                {historical.sourceTitle || formatDomain(historical.sourceUrl)}
              </span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        {/* Current Observation */}
        <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40">
          <div className="flex items-center justify-between text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1.5">
            <span className="flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5" />
              Current State
            </span>
            {current?.period && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-100/70 dark:bg-indigo-900/50">
                {current.period}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50 break-words">
            {current?.value || 'N/A'}
          </div>
          {current?.timestamp && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600/80 dark:text-indigo-400/80">
              <Calendar className="w-3 h-3" />
              <span>{formatFullDate(current.timestamp)}</span>
            </div>
          )}
          {current?.sourceUrl && isSafeUrl(current.sourceUrl) && (
            <a
              href={current.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <span className="truncate max-w-[200px]">
                {current.sourceTitle || formatDomain(current.sourceUrl)}
              </span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Delta Metrics (if available) */}
      {(numericDelta !== undefined || percentageChange !== undefined || deltaSummary) && (
        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {deltaSummary || delta?.summary || 'Observed Change'}
          </span>
          <div className="flex items-center gap-2">
            {numericDelta !== undefined && (
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                Δ {numericDelta > 0 ? `+${numericDelta}` : numericDelta}
              </span>
            )}
            {percentageChange !== undefined && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded ${
                  percentageChange > 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : percentageChange < 0
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {percentageChange > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : percentageChange < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>
                  {percentageChange > 0 ? `+${percentageChange}%` : `${percentageChange}%`}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="mt-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/50">
          <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-0.5">
            Analysis:
          </span>
          {explanation}
        </div>
      )}

      {/* Citations for comparison */}
      {citations.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">
            Sources:
          </span>
          {citations.map((c, i) => {
            const domain = formatDomain(c.url || c.source);
            return isSafeUrl(c.url) ? (
              <a
                key={c.id || i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300"
              >
                <span>{c.title || domain}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            ) : (
              <span
                key={c.id || i}
                className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-400"
              >
                {c.title || domain}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
