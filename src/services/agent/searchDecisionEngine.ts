import { ConversationMessage, SearchDecision } from '../../types';
import { logger } from '../../utils/logger';

export class SearchDecisionEngine {
  /**
   * Evaluates a user query and conversation context to determine if web search is needed.
   */
  public evaluate(query: string, history: ConversationMessage[] = []): SearchDecision {
    const raw = query.trim();
    const lower = raw.toLowerCase();

    // 0. Prompt Injection, Jailbreak, or System Override Defense
    if (this.isPromptInjectionOrJailbreak(lower)) {
      return {
        shouldSearch: false,
        category: 'CHITCHAT',
        reason: 'Query is a prompt injection attempt, jailbreak, or system override.',
      };
    }

    // 1. Chitchat, Greetings & Humor fast-path
    if (this.isChitchat(lower)) {
      return {
        shouldSearch: false,
        category: 'CHITCHAT',
        reason: 'Query is conversational pleasantry, greeting, joke, or identity question.',
      };
    }

    // 2. System Date & Time Inquiries (grounded in system prompt temporal context)
    if (this.isSystemDateOrTimeQuery(lower)) {
      return {
        shouldSearch: false,
        category: 'STATIC_KNOWLEDGE',
        reason: 'Query asks for current system date, year, or time which is provided via temporal grounding.',
      };
    }

    // 3. Pure in-conversation recall
    if (this.isConversationRecall(lower, history)) {
      return {
        shouldSearch: false,
        category: 'CONVERSATION_RECALL',
        reason: 'Query strictly asks about in-session history without requiring external verification.',
      };
    }

    // 4. General programming / logic / math concepts (without freshness or pricing markers)
    if (this.isStaticProgrammingOrMath(lower)) {
      return {
        shouldSearch: false,
        category: 'STATIC_KNOWLEDGE',
        reason: 'Query is a timeless programming, algorithm, math, or theoretical concept question.',
      };
    }

    // 5. Timeless encyclopedic concept check (scientific, philosophical, physical)
    if (this.isTimelessConcept(lower)) {
      return {
        shouldSearch: false,
        category: 'STATIC_KNOWLEDGE',
        reason: 'Query is an explanation of a fundamental scientific, encyclopedic, or linguistic concept.',
      };
    }

    // 6. Static ancient or fixed pre-modern history
    if (this.isStaticAncientHistory(lower)) {
      return {
        shouldSearch: false,
        category: 'STATIC_KNOWLEDGE',
        reason: 'Query asks about established static historical facts that do not require real-time web search.',
      };
    }

    // 7. Speculative distant future predictions
    if (this.isSpeculativeFuture(lower)) {
      return {
        shouldSearch: false,
        category: 'STATIC_KNOWLEDGE',
        reason: 'Query asks for speculative predictions of future sporting outcomes or stock prices.',
      };
    }

    // 8. Temporal comparison (comparing previous statements/prices with current data)
    if (this.isTemporalComparison(lower, history)) {
      return {
        shouldSearch: true,
        category: 'TEMPORAL_COMPARISON',
        reason: 'Query asks to compare or check changes against previous conversation statements.',
      };
    }

    // 9. Pricing, commercial, or financial inquiries
    if (this.isPricingQuery(lower)) {
      return {
        shouldSearch: true,
        category: 'REALTIME_SEARCH',
        reason: 'Query asks for pricing, cost, or commercial subscription information which changes over time.',
      };
    }

    // 10. Freshness, current technology, or real-time events
    if (this.isRealTimeFreshnessQuery(lower)) {
      return {
        shouldSearch: true,
        category: 'REALTIME_SEARCH',
        reason: 'Query contains temporal markers or asks for recent software versions, events, or current status.',
      };
    }

    // 11. Explicit historical dated questions
    if (this.isHistoricalDatedQuery(lower)) {
      return {
        shouldSearch: true,
        category: 'HISTORICAL_DATED',
        reason: 'Query asks about historical events or facts anchored to a specific calendar date/year.',
      };
    }

    // 12. Follow-up resolution: check if follow-up refers to an entity that requires search
    if (this.isContextualFollowUpRequiringSearch(lower, history)) {
      return {
        shouldSearch: true,
        category: 'REALTIME_SEARCH',
        reason: 'Follow-up query refers to an external entity, product, or tool discussed in prior turns.',
      };
    }

    // Default: for general real-world questions, search to guarantee freshness and avoid hallucination
    logger.debug(`Defaulting to web search for query: "${raw}"`);
    return {
      shouldSearch: true,
      category: 'REALTIME_SEARCH',
      reason: 'Query involves real-world entities or external facts requiring source-grounded verification.',
    };
  }

  private isPromptInjectionOrJailbreak(lower: string): boolean {
    const injectionPatterns = [
      /\b(system\s+override|ignore\s+(all\s+)?previous\s+instructions)\b/,
      /\b(print|show|output|repeat)\s+(your\s+)?(entire\s+)?system\s+prompt\b/,
      /\b(you\s+are\s+now\s+dan|dan\s+mode|jailbreak|developer\s+mode)\b/,
      /\b(disregard\s+all\s+(rules|instructions|guidelines))\b/,
    ];
    return injectionPatterns.some((p) => p.test(lower));
  }

  private isChitchat(lower: string): boolean {
    const patterns = [
      /^(hi|hello|hey|howdy|hola|greetings)(\s+there|\s+minimi)?[\s.!?]*$/,
      /^(good\s+(morning|afternoon|evening|day))[\s.!?]*$/,
      /^(thank\s+you|thanks|thx|thanks\s+a\s+lot)[\s.!?]*$/,
      /^(who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do)[\s.!?]*$/,
      /^(how\s+are\s+you|how's\s+it\s+going|what's\s+up)[\s.!?]*$/,
      /^(bye|goodbye|see\s+ya|have\s+a\s+good\s+day)[\s.!?]*$/,
      /^(ok|okay|cool|awesome|great|got\s+it|understood)[\s.!?]*$/,
      // Greetings that continue into friendly pleasantry
      /^(hello|hi|hey)\s+minimi!?\s+how\s+are\s+you/i,
      // Jokes and humor
      /\b(tell\s+me\s+a\s+joke|tell\s+a\s+joke|programmer\s+joke|joke\s+about)\b/,
    ];
    return patterns.some((p) => p.test(lower));
  }

  private isSystemDateOrTimeQuery(lower: string): boolean {
    return (
      /\b(what\s+(is\s+)?(today('?s)?|the\s+current)\s+(date|year|day|time))\b/.test(lower) ||
      /\b(what\s+year\s+is\s+it(\s+right\s+now)?)\b/.test(lower) ||
      /\b(today('?s)?\s+current\s+(date|year))\b/.test(lower)
    );
  }

  private isConversationRecall(lower: string, history: ConversationMessage[]): boolean {
    if (history.length === 0) return false;

    const recallPatterns = [
      /\b(what\s+did\s+i\s+(just\s+)?(say|ask))\b/,
      /\b(what\s+was\s+my\s+(first|previous|last)\s+question)\b/,
      /\b(summarize\s+(our\s+)?(conversation|chat|discussion))\b/,
      /\b(repeat\s+what\s+you\s+said)\b/,
      /\b(what\s+have\s+we\s+talked\s+about)\b/,
      /\b(do\s+you\s+remember\s+what\s+i\s+told\s+you)\b/,
    ];
    return recallPatterns.some((p) => p.test(lower));
  }

  private isStaticAncientHistory(lower: string): boolean {
    if (
      /\b(magna\s+carta|gutenberg|printing\s+press|renaissance|roman\s+empire|julius\s+caesar|alexander\s+the\s+great|french\s+revolution)\b/.test(
        lower
      )
    ) {
      return true;
    }
    // Questions asking in what year an event occurred prior to modern computing (1200 - 1899)
    const matchYear = /\b(1[0-8]\d{2})\b/.exec(lower);
    if (matchYear && !/\b(202\d|201\d|199\d)\b/.test(lower)) {
      return true;
    }
    return false;
  }

  private isSpeculativeFuture(lower: string): boolean {
    return (
      /\b(who\s+will\s+win|predict(\s+the)?\s+(exact\s+)?(closing\s+)?(stock\s+price|price|winner)|forecast\s+the\s+exact)\b/.test(
        lower
      ) && /\b(203\d|204\d|205\d)\b/.test(lower)
    );
  }

  private isTemporalComparison(lower: string, _history: ConversationMessage[]): boolean {
    const comparisonTriggers = [
      /\b(has\s+(that|the|this|it)\s+changed)\b/,
      /\b(did\s+(it|that|the\s+price)\s+change)\b/,
      /\b(is\s+that\s+still\s+(the\s+case|true|the\s+price|accurate|valid))\b/,
      /\b(you\s+(said|stated|told\s+me)\s+(earlier|before))\b/,
      /\b(earlier\s+you\s+said)\b/,
      /\b(compare\s+(that|this|it|the\s+release|the\s+version)\s+with\s+(today|now|current|earlier))\b/,
      /\b(difference\s+between\s+(then|earlier)\s+and\s+now)\b/,
      /\b(since\s+our\s+last\s+(discussion|chat|conversation))\b/,
      /\b(recorded\s+earlier)\b/,
    ];
    return comparisonTriggers.some((p) => p.test(lower));
  }

  private isPricingQuery(lower: string): boolean {
    const pricingKeywords = [
      /\b(price|pricing|cost|costs|subscription|subscriptions|fee|fees|plan|plans|tier|tiers)\b/,
      /\bhow\s+much\s+(does|is|do|would|are)\b/,
      /\b(retail\s+price|starting\s+price|msrp|monthly\s+cost|annual\s+cost)\b/,
      /\$\d+/,
    ];
    return pricingKeywords.some((p) => p.test(lower));
  }

  private isRealTimeFreshnessQuery(lower: string): boolean {
    const freshnessKeywords = [
      /\b(latest|newest|recent|recently|current|currently|today|now)\b/,
      /\b(release|released|version|changelog|updates|announcement)\b/,
      /\b(news|weather|headline|headlines|stock|stocks|ticker)\b/,
      /\b(available|availability|in\s+stock|out\s+of\s+stock)\b/,
      /\b(who\s+is\s+the\s+current\s+ceo|who\s+is\s+the\s+president)\b/,
      /\b(2025|2026|2027)\b/,
    ];
    return freshnessKeywords.some((p) => p.test(lower));
  }

  private isHistoricalDatedQuery(lower: string): boolean {
    // Looks for explicit recent modern years like 1990-2024 or dates + event keywords
    const hasYear = /\b(19\d{2}|20[0-2][0-4])\b/.test(lower);
    const eventKeywords = /\b(who\s+won|winner|olympics|world\s+cup|election|prime\s+minister|president|founded|launched|acquired)\b/.test(
      lower
    );
    return hasYear && eventKeywords;
  }

  private isStaticProgrammingOrMath(lower: string): boolean {
    // Questions about programming fundamentals, algorithms, syntax, math
    const codePatterns = [
      /\b(write|implement|code|create)\s+(a\s+|an\s+)?([a-z0-9#+.]+\s+)?(function|method|class|algorithm|script|regex|query|program|interface)\b/,
      /\bhow\s+(do\s+i|to|can\s+i|does)\s+([a-z0-9#+.]+\s+)?(reverse|sort|filter|map|find|traverse|invert|implement|work)\b/,
      /\b(how\s+does\s+)?(binary\s+search|quicksort|mergesort|bubble\s+sort|dijkstra|depth\s+first|breadth\s+first)(\s+work)?\b/,
      /\b(time\s+complexity|space\s+complexity|big\s+o)\b/,
      /\b(explain\s+polymorphism|explain\s+inheritance|explain\s+encapsulation|oop\s+principles)\b/,
      /\bwhat\s+is\s+(recursion|closure|memoization|currying|a\s+monad|a\s+pointer)\b/,
      /\b(solve|calculate|evaluate)\s+(this\s+)?(equation|derivative|integral|math|expression)\b/,
    ];

    // Must NOT contain freshness markers or pricing
    const hasFreshness = /\b(2025|2026|latest|recent|new\s+in|pricing|price|cost|release)\b/.test(lower);
    return codePatterns.some((p) => p.test(lower)) && !hasFreshness;
  }

  private isContextualFollowUpRequiringSearch(
    lower: string,
    history: ConversationMessage[]
  ): boolean {
    if (history.length === 0) return false;

    // Follow-up questions with pronouns ("it", "they", "its", "that")
    const isPronounFollowUp = /\b(it|they|its|that|the\s+tool|the\s+service|the\s+product|the\s+car)\b/.test(
      lower
    );

    const asksForAttributes = /\b(specs|specifications|features|speed|performance|alternatives|competitors|pros\s+and\s+cons|review|transport|architecture)\b/.test(
      lower
    );

    return isPronounFollowUp && asksForAttributes;
  }

  private isTimelessConcept(lower: string): boolean {
    const conceptPatterns = [
      /\b(what\s+is|explain|describe)\s+([a-z\s]+)?(quantum\s+superposition|quantum\s+computing|photosynthesis|gravity|osmosis|entropy|cellular\s+respiration|dna|rna)\b/,
      /^define\s+(noun|verb|adjective|hyperbole|metaphor|irony)[\s.?]*$/,
      /^why\s+is\s+the\s+sky\s+blue[\s.?]*$/,
    ];
    return conceptPatterns.some((p) => p.test(lower));
  }
}

export const searchDecisionEngine = new SearchDecisionEngine();
