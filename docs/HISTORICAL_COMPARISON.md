# Phase 6: Historical Information Retrieval & Intelligent Comparison

This document describes the design, implementation, and verification of **Phase 6: Historical Information Retrieval and Intelligent Comparison** in `minimi-ai-chat-agent`.

---

## 1. Architectural Overview

Phase 6 extends MiniMi AI into an intelligent agent capable of:
1. **Retrieving historical information** from previous conversation messages and structured factual snapshots.
2. **Resolving explicit and relative temporal expressions** (e.g., `"2022"`, `"last year"`, `"2 years ago"`, `"since 2021"`) relative to the dynamic system clock.
3. **Evaluating changes between historical baselines and current live facts**, computing quantitative and qualitative deltas.
4. **Providing verified explanations backed by live search citations**, categorizing results into deterministic verdicts (`CONFIRMED_CHANGE`, `NO_DETECTED_CHANGE`, `UNABLE_TO_VERIFY`).
5. **Strictly isolating conversation memory**, guaranteeing that no conversation can inspect or leak historical facts from another conversation.

```
+-----------------------------------------------------------------------------------------+
|                                    Client Request                                       |
|               POST /api/conversations/:id/compare  OR  POST /api/conversations/:id/chat  |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                  Express Route & Validation                             |
|          Validates conversation UUID, request body / query parameters via Zod           |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                              TemporalResolver Subsystem                                 |
|   Resolves explicit dates, month/year, "last year", "since YYYY", "N years ago"        |
|   Validates calendar boundaries (leap years, 28-31 days)                                |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                           HistoricalRetrievalService Subsystem                          |
|   1. Query SnapshotStore (InMemorySnapshotStorage / MongoSnapshotStorage)               |
|   2. Fallback: Mine prior assistant message content & citations for factual claims      |
|   3. Enforce strict conversation isolation                                             |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                ComparisonService Subsystem                              |
|   1. Baseline retrieval -> 2. Target date resolution -> 3. Targeted search execution    |
|   4. Extract current fact from verified evidence snippets                                |
|   5. Calculate delta (numeric delta, %, direction) -> Determine Verdict                 |
|   6. LLM-synthesized / fallback explanation with source citations                       |
|   7. Persist target observation snapshot for future comparisons                         |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Core Modules & Subsystems

### 2.1. Date & Temporal Awareness (`TemporalResolver`)
- **File**: `src/services/history/temporalResolver.ts`
- **Capabilities**:
  - **Explicit ISO 8601 Date Parsing**: Matches `YYYY-MM-DD`, validating true calendar dates (rejects non-existent dates such as `2024-02-31`).
  - **Month & Year Expressions**: Resolves expressions such as `"October 2022"` or `"Sept 2023"` into standardized UTC timestamps (`2022-10-01T00:00:00.000Z`).
  - **Explicit Calendar Year**: Matches `YYYY` (1800–2100).
  - **Relative Year References**:
    - `"last year"`, `"previous year"`: Resolves to `referenceYear - 1`.
    - `"this year"`, `"current year"`: Resolves to `referenceYear`.
    - `"N years ago"`: Resolves to `referenceYear - N`.
    - `"since YYYY"`: Resolves to `since YYYY`.
    - `"yesterday"`, `"today"`, `"now"`: Evaluated strictly relative to reference date.
  - **Temporal Distinctions**: Separates `observationTime` (when the conversation discussed the fact) from `validPeriod` (the historical era or year the fact applies to).

### 2.2. Historical Snapshot Store (`SnapshotStore`)
- **File**: `src/services/history/snapshotStore.ts`
- **Adapters**:
  - `InMemorySnapshotStorage`: Fast, in-memory Map keyed by `conversationId`.
  - `MongoSnapshotStorage`: Persistent MongoDB adapter using Mongoose compound index `{ conversationId: 1, entity: 1, observedAt: -1 }`.
- **Deduplication Protection**: Automatically ignores duplicate snapshots with identical `(conversationId, entity, attribute, value)` saved within a 5-minute sliding window, returning the existing snapshot.
- **Factory**: `createSnapshotStorage()` instantiates the configured adapter based on `STORAGE_PROVIDER` (`memory` vs `mongodb`).

### 2.3. Contextual Historical Retrieval (`HistoricalRetrievalService`)
- **File**: `src/services/history/historicalRetrievalService.ts`
- **Dual-Layer Retrieval**:
  1. **Primary**: Searches structured `HistoricalSnapshot` records by conversation ID, entity, query substring, and `since`/`until` date filters.
  2. **Secondary Fallback**: If no snapshot is found in the store, automatically scans previous assistant messages in the conversation to mine prior claims, version strings, pricing information, and original citation URLs.
- **Conversation Isolation**: Strict validation ensures that snapshots or messages belonging to other conversations are never accessible.
- **Missing Conversation Handling**: Throws a typed `NotFoundError` (HTTP 404) if the target `conversationId` does not exist.

### 2.4. Automatic Fact Extraction (`FactExtractor`)
- **File**: `src/services/history/factExtractor.ts`
- **Background Execution**: Runs after each assistant response turn in `AgentOrchestrator.processUserMessage`.
- **Extraction Rules**:
  - Identifies entities from bold markdown (`**Entity**`) or user query phrasing (`"price of X"`, `"how much does X cost"`).
  - Detects pricing (`$XX/mo`, `$XX/year`) or software release versions (`vX.Y.Z`).
  - Automatically records the factual observation as a snapshot linked to the message and verified source URLs.
  - Non-blocking: Errors are logged at debug level without interrupting the user conversation turn.

### 2.5. Intelligent Comparison Engine (`ComparisonService`)
- **File**: `src/services/history/comparisonService.ts`
- **Execution Flow**:
  1. Look up historical baseline claim from snapshots or message history.
  2. Resolve target temporal period using `TemporalResolver`.
  3. Execute targeted web search for the target period.
  4. Extract current observation from verified search snippets.
  5. Calculate numeric/version delta and assign comparison verdict:
     - `CONFIRMED_CHANGE`: A verified change is detected (e.g., $10 to $19, version bump).
     - `NO_DETECTED_CHANGE`: Values are verified to remain identical (e.g., $20 previously and $20 currently).
     - `UNABLE_TO_VERIFY`: Live search is unavailable, returned empty results, or no historical baseline existed.
  6. Synthesize clear, grounded explanation via LLM with deterministic template fallback.
  7. Retain source URLs and metadata for full auditability.
  8. Store the current observation snapshot in the snapshot store for future continuity.

### 2.6. Agent Orchestrator Integration
- **Files**: `src/services/agent/agentOrchestrator.ts`, `src/services/agent/prompts/systemPrompt.ts`
- When `SearchDecisionEngine` categorizes a query as `TEMPORAL_COMPARISON`:
  1. Orchestrator queries `HistoricalRetrievalService` for historical baseline data.
  2. Injects `<historical_baseline>` XML into the system prompt.
  3. Instructs the LLM to ground its comparison on the historical baseline and live search results.
  4. Automatically records newly mentioned facts via `FactExtractor` upon turn completion.

---

## 3. REST API Endpoints

### 3.1. GET `/api/conversations/:conversationId/history`
Retrieves historical snapshots and contextual messages for a conversation.

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `entity` | string | No | Filter snapshots by entity name. |
| `query` | string | No | Substring match across entity, attribute, or value. |
| `since` | string | No | ISO timestamp lower bound. |
| `until` | string | No | ISO timestamp upper bound. |
| `limit` | number | No | Maximum snapshots to return (default: 20, max: 100). |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "snapshots": [
      {
        "id": "782f9b12-9c1a-4d2b-8a5f-1e9a3b5c7d8e",
        "conversationId": "550e8400-e29b-41d4-a716-446655440000",
        "entity": "GitHub Copilot",
        "attribute": "price",
        "value": "$10/month",
        "validPeriod": "2022",
        "observedAt": "2022-06-01T00:00:00.000Z",
        "retrievedAt": "2022-06-01T00:00:00.000Z",
        "sourceUrl": "https://github.blog/copilot-launch"
      }
    ],
    "relevantMessages": []
  },
  "meta": {
    "totalSnapshots": 1,
    "totalRelevantMessages": 0
  }
}
```

### 3.2. POST `/api/conversations/:conversationId/compare`
Compares a historical observation against current verified live data.

**Request Body:**
```json
{
  "subject": "GitHub Copilot",
  "attribute": "price",
  "baselineDate": "2022",
  "targetDate": "2026"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "entity": "GitHub Copilot",
    "attribute": "price",
    "verdict": "CONFIRMED_CHANGE",
    "confidence": "high",
    "historical": {
      "value": "$10 per month",
      "period": "2022",
      "timestamp": "2022-06-01T00:00:00.000Z",
      "sourceUrl": "https://github.blog/copilot-launch"
    },
    "current": {
      "value": "$19 per month",
      "period": "2026",
      "timestamp": "2026-11-15T18:22:00.000Z",
      "sourceUrl": "https://github.com/features/copilot"
    },
    "deltaSummary": "Price increased by $9.00 (+90%)",
    "delta": {
      "summary": "Price increased by $9.00 (+90%)",
      "numericDelta": 9,
      "percentageChange": 90
    },
    "explanation": "GitHub Copilot increased from $10/month in 2022 to $19/month in 2026, representing a $9 price increase.",
    "citations": [
      {
        "id": "source-1",
        "title": "GitHub Copilot Pricing 2026",
        "url": "https://github.com/features/copilot",
        "source": "github.com"
      }
    ],
    "sources": [
      {
        "id": "source-1",
        "title": "GitHub Copilot Pricing 2026",
        "url": "https://github.com/features/copilot",
        "source": "github.com"
      }
    ],
    "metadata": {
      "comparisonTimeMs": 42,
      "searchUsed": true,
      "confidence": "high"
    }
  }
}
```

---

## 4. Testing & Verification

The Phase 6 implementation includes 29 dedicated unit and integration tests in `tests/history.test.ts`.

### Test Suite Structure
1. **TemporalResolver (10 tests)**:
   - Valid ISO 8601 parsing (`YYYY-MM-DD`).
   - Rejection of invalid calendar dates (`2024-02-30`).
   - Month and year parsing (`October 2022`).
   - Calendar year parsing (`2024`).
   - Relative resolution of `"last year"`, `"this year"`, `"2 years ago"`, `"since 2021"`, `"yesterday"`, and `"today"`.
   - Graceful fallback on unparseable phrases.
2. **Snapshot Storage (4 tests)**:
   - Save and retrieve snapshots.
   - 5-minute sliding window deduplication.
   - Filtering by entity, query substring, and date ranges.
   - Retrieval of latest snapshot for entity/attribute.
3. **Historical Retrieval Service (4 tests)**:
   - Dual-layer snapshot and message retrieval.
   - Assistant message factual claim mining.
   - Cross-conversation isolation verification.
   - 404 response on non-existent conversations.
4. **FactExtractor (2 tests)**:
   - Automatic pricing fact extraction from assistant responses.
   - Non-creation of snapshots for non-factual conversational turns.
5. **Comparison Service (4 tests)**:
   - `CONFIRMED_CHANGE` with numeric delta and percentage change.
   - `NO_DETECTED_CHANGE` for identical prices.
   - `UNABLE_TO_VERIFY` on empty search results.
   - Automatic recording of post-comparison snapshot.
6. **Agent Orchestrator Integration (1 test)**:
   - Baseline prompt injection and automatic fact extraction in chat flow.
7. **HTTP REST Endpoints (4 tests)**:
   - `GET /api/conversations/:id/history` (200 OK & 404 Not Found).
   - `POST /api/conversations/:id/compare` (200 OK & 400 Validation Error).

### Overall Test Suite Results
All **123 tests** across **9 test suites** pass cleanly without real external network or paid API calls:
```
Test Files  9 passed (9)
     Tests  123 passed (123)
```

---

## 5. Security & Isolation

1. **Cross-Conversation Privacy**: All snapshot and history lookups are partitioned by `conversationId`. Lookups for non-matching IDs return empty sets or HTTP 404.
2. **Untrusted Web Content Defense**: Evidence extracted from live web search is sanitized before inclusion in prompts, preventing CDATA closing tag breakouts and XML injection attacks.
3. **Credential Protection**: No API keys or secrets are stored in snapshots, messages, or database records.
4. **Sliding Deduplication**: Prevents rapid concurrent turns or repeated identical queries from bloating the snapshot repository.
