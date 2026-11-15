import { ConversationMessage } from '../../types';

export interface QueryRewriterOptions {
  currentDate?: Date;
}

export class QueryRewriter {
  /**
   * Decontextualizes follow-up queries and normalizes relative dates.
   */
  public rewrite(
    rawQuery: string,
    history: ConversationMessage[] = [],
    options?: QueryRewriterOptions
  ): string {
    const now = options?.currentDate ?? new Date();
    const currentYear = now.getUTCFullYear().toString();
    const prevYear = (now.getUTCFullYear() - 1).toString();

    let cleaned = rawQuery.trim();

    // 1. Strip conversational filler prefixes and research directives
    cleaned = cleaned.replace(
      /^(can\s+you\s+(please\s+)?(tell\s+me|find|search\s+for|look\s+up|explain)|please\s+(find|search|tell\s+me)|i\s+want\s+to\s+know|what\s+about)\s+/i,
      ''
    );
    cleaned = cleaned.replace(
      /^(research\s+(the\s+)?(latest\s+developments\s+(in|of)|information\s+about|details\s+(on|about)|overview\s+of))\s+/i,
      ''
    );

    // Strip procedural output instructions from the end of queries (e.g. "include verified sources...", "provide a recommendation for...")
    cleaned = cleaned.replace(
      /[.,;]?\s*\b(include\s+verified\s+sources|include\s+publication\s+dates|provide\s+a\s+(final\s+)?recommendation|and\s+a\s+final\s+recommendation|give\s+a\s+recommendation)[^.]*$/i,
      ''
    );

    // Strip "based on features, pricing..." instructional clauses from middle of queries
    cleaned = cleaned.replace(
      /\bbased\s+on\s+(features|pricing|coding\s+capabilities|developer\s+productivity|specs|benchmarks|cost|details)[^.;]*/gi,
      ''
    );

    // 2. Identify if pronoun substitution is needed
    const hasAmbiguousPronoun = /\b(it|its|they|them|that|this|the\s+tool|the\s+service|the\s+product|the\s+car)\b/i.test(
      cleaned
    );

    if (hasAmbiguousPronoun && history.length > 0) {
      const subject = this.extractSubjectFromHistory(history);
      if (subject) {
        // Replace pronoun with subject or prepend subject
        if (/\b(how\s+much\s+(does|is)\s+(it|that|this))\b/i.test(cleaned)) {
          cleaned = `${subject} price cost`;
        } else if (/\b(what\s+are\s+(its|the)\s+(specs|features|pricing))\b/i.test(cleaned)) {
          cleaned = `${subject} ${cleaned.replace(/\b(its|the)\b/i, '').trim()}`;
        } else {
          // General replacement
          cleaned = cleaned.replace(/\b(it|its|that|this|they|them)\b/gi, subject);
          if (!cleaned.toLowerCase().includes(subject.toLowerCase())) {
            cleaned = `${subject} ${cleaned}`;
          }
        }
      }
    }

    // 3. Temporal normalization
    // Replace "last year" with previous year
    cleaned = cleaned.replace(/\blast\s+year\b/gi, prevYear);

    // Replace "this year", "current year" with current year
    cleaned = cleaned.replace(/\b(this|the\s+current)\s+year\b/gi, currentYear);

    // If query asks for "latest", "current", "recent", "pricing" and lacks a 4-digit year, append current year
    const hasYear = /\b\d{4}\b/.test(cleaned);
    const hasTemporalIntent = /\b(latest|current|recent|new|today|pricing|price|cost|release)\b/i.test(
      cleaned
    );

    if (!hasYear && hasTemporalIntent) {
      cleaned = `${cleaned} ${currentYear}`;
    }

    // 4. Collapse whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 5. Ensure non-empty and bounded
    if (cleaned.length < 2) {
      return rawQuery.trim();
    }

    return cleaned.slice(0, 500);
  }

  /**
   * Extracts the primary topic or subject from recent conversation history.
   */
  private extractSubjectFromHistory(history: ConversationMessage[]): string | null {
    // 1. First inspect previous user messages (reverse order) since user queries express intent
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (!msg || msg.role !== 'user') continue;

      const text = msg.content.trim();

      // Pattern: "Tell me about X", "What is X", "How does X work", "Compare X and Y"
      const aboutMatch = text.match(
        /(?:tell\s+me\s+about|what\s+is|what's|how\s+about|info\s+on|details\s+on)\s+([A-Za-z0-9\s._-]{2,40})/i
      );
      if (aboutMatch && aboutMatch[1]) {
        return this.cleanSubject(aboutMatch[1]);
      }

      // Pattern: simple proper nouns / product names (e.g. "Supabase", "Tesla Model 3", "Next.js")
      const words = text.split(/\s+/);
      if (words.length <= 4 && !/^(hi|hello|thanks|ok|help)\b/i.test(text)) {
        return text.replace(/[?!.]+$/, '');
      }
    }

    // 2. Fall back to previous assistant messages if user messages did not yield a subject
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (!msg || msg.role !== 'assistant') continue;

      const boldMatch = msg.content.match(/\*\*([A-Za-z0-9\s._-]{2,30})\*\*/);
      if (boldMatch && boldMatch[1]) {
        return boldMatch[1].trim();
      }
    }

    return null;
  }

  private cleanSubject(raw: string): string {
    return raw
      .replace(/[?!.,;:]+$/, '')
      .replace(/\s+(please|thanks|now|today)$/i, '')
      .trim();
  }
}

export const queryRewriter = new QueryRewriter();
