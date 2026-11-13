import { SearchResultItem } from '../../types';
import { VerifiedAttribution } from './types';
import { logger } from '../../utils/logger';

export class CitationManager {
  /**
   * Parses citation markers in LLM content, validates them against actual search results,
   * strips hallucinated citation markers, and returns verified sources.
   */
  public extractAndValidate(
    content: string,
    availableSources: SearchResultItem[] = []
  ): VerifiedAttribution {
    if (availableSources.length === 0) {
      // If no search sources were available, strip any hallucinated citations
      const stripped = content.replace(/\[(?:source-)?\d+\]/gi, '').replace(/\s{2,}/g, ' ');
      return {
        cleanContent: stripped.trim(),
        citedSources: [],
        allAvailableSources: [],
      };
    }

    // Build lookup maps by ID and by 1-based index
    const sourceById = new Map<string, SearchResultItem>();
    const sourceByIndex = new Map<number, SearchResultItem>();

    for (const src of availableSources) {
      sourceById.set(src.id.toLowerCase(), src);
      sourceByIndex.set(src.index, src);
    }

    const citedSourcesMap = new Map<string, SearchResultItem>();

    // Match [source-1] or [1]
    const citationRegex = /\[(source-)?(\d+)\]/gi;

    const cleanContent = content.replace(citationRegex, (match, _prefix, indexStr) => {
      const indexNum = parseInt(indexStr, 10);
      const matchedSource = sourceByIndex.get(indexNum) || sourceById.get(`source-${indexNum}`);

      if (matchedSource) {
        // Valid citation
        citedSourcesMap.set(matchedSource.id, matchedSource);
        return `[source-${matchedSource.index}]`;
      } else {
        // Hallucinated citation index: strip it out
        logger.warn(`Stripping hallucinated citation marker "${match}" - no corresponding search result.`);
        return '';
      }
    });

    const citedSources = Array.from(citedSourcesMap.values()).sort((a, b) => a.index - b.index);

    return {
      cleanContent: cleanContent.replace(/\s{2,}/g, ' ').trim(),
      citedSources,
      allAvailableSources: availableSources,
    };
  }
}

export const citationManager = new CitationManager();
