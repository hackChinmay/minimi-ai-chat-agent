# Technical Decisions & Architectural Trade-offs

## 1. Selected Technology Stack

| Layer | Selected Technology | Alternative Considered | Primary Justification |
| :--- | :--- | :--- | :--- |
| **Language** | **TypeScript 5.x** (Strict Mode) | JavaScript (ESM) | Type safety across tool input/output schemas, streaming events, and database records is critical to eliminate runtime bugs in agent pipelines. |
| **Runtime** | **Node.js 20+ / 24+ LTS** | Python / Bun / Deno | Fast asynchronous I/O, native fetch, broad ecosystem support, and zero native toolchain friction for the evaluation environment (`npm install && npm run dev`). |
| **Storage Engine** | **SQLite (`better-sqlite3`)** | Redis / PostgreSQL / Pinecone | Zero-setup local relational storage with synchronous, high-speed disk I/O. Supports ACID transactions for session histories and temporal fact indexing without requiring external Docker daemons. |
| **Search Provider** | **Tavily Search API** (with Brave fallback) | Raw Google/Bing Scraping / SerpAPI | Tavily is specifically optimized for LLM search agents: provides pre-parsed markdown content, explicit publication dates, relevance scores, and canonical source domains without HTML bloat. |
| **Transport Protocol**| **Server-Sent Events (SSE)** | WebSockets / HTTP Polling | Unidirectional text and event streaming over standard HTTP. Simpler connection lifecycle, native reconnection handling, and firewall-friendly compared to WebSockets. |
| **Schema Validation**| **Zod 3.x** | Joi / Yup / TypeBox | First-class TypeScript type inference, zero-dependency runtime validation for `.env` variables, tool parameters, and API request payloads. |

---

## 2. Key Architectural Decisions

### 2.1 Deterministic Decision State Machine vs. Autonomous ReAct Loop
- **Decision**: The agent implements a deterministic two-phase pipeline (Intent Classification $\rightarrow$ Conditional Query Rewriting $\rightarrow$ Tool Execution $\rightarrow$ Grounded Synthesis) rather than an open-ended ReAct (Reasoning + Acting) loop.
- **Rationale**:
  - Open-ended ReAct agents frequently suffer from non-deterministic latency (executing 3 to 6 LLM roundtrips per user question), search overuse on trivial queries, and catastrophic hallucinated tool calling.
  - A deterministic state machine guarantees that conversational turns bypass tools immediately ($< 500\text{ ms}$ response time), while search queries execute exactly one parallelized search batch before synthesis.

### 2.2 Tiered Conversation Memory & Temporal Fact Log
- **Decision**: Separate conversation history into two tiers:
  1. A rolling window of raw conversational turns for immediate conversational flow.
  2. A structured `TemporalFactStore` storing `(Entity, Attribute, Value, Timestamp, SourceURL)` tuples.
- **Rationale**:
  - LLM context windows quickly degrade when raw transcripts are stuffed with search results from 10 turns ago.
  - Questions like *"How does that price compare to what you told me earlier?"* require exact historical assertions, not vague semantic approximations. Querying structured fact tuples enables exact chronological comparison.

### 2.3 Strict System Clock Anchor & Relative Date Normalization
- **Decision**: Dynamically prepend an immutable system timestamp (`Current Date: YYYY-MM-DD`, `Current Time: HH:mm:ss UTC`) to every LLM invocation, and explicitly normalize relative phrases (e.g., "yesterday", "last year") during query rewriting.
- **Rationale**:
  - Without explicit temporal anchoring, LLMs default to their pre-training cutoff date, leading to incorrect queries (e.g., asking for 2023 data when the current year is 2026).

### 2.4 Citation Whitelisting via Gateway Interception
- **Decision**: The LLM is restricted to citing search sources via `[1]`, `[2]` numeric tokens. The server-side synthesis engine verifies every token against the actual array of URLs returned by the search gateway.
- **Rationale**:
  - Prevents the common LLM failure mode of generating convincing but dead, outdated, or hallucinated URLs.

---

## 3. Alternatives Considered and Reasons for Rejection

### Alternative 1: Multi-Turn Autonomous ReAct Loop (LangChain / AutoGPT style)
- **Concept**: Let the model decide in an autonomous while-loop when to search, read results, search again, and stop.
- **Why Rejected**:
  - **Unpredictable Latency**: Average turn duration balloons from $1.5\text{s}$ to $8\text{--}15\text{s}$.
  - **Cost Inefficiency**: Token consumption increases 4x to 8x per turn due to repeated prompt re-ingestion.
  - **Tool Churn**: Models often get stuck in repetitive queries when web results are ambiguous.

### Alternative 2: Unconditional Search (RAG on Every Turn)
- **Concept**: Execute a web search for every single incoming message before prompting the LLM.
- **Why Rejected**:
  - Destroys conversational speed for greetings ("Hi", "Thanks"), code questions ("Write a binary search"), and clarifications.
  - Consumes external search API rate limits unnecessarily.
  - Injects noisy, irrelevant search snippets into conversational prompts.

### Alternative 3: Vector Database (Pinecone / Qdrant / Chroma) for Memory
- **Concept**: Embed past turns and search snippets into high-dimensional vector spaces and perform nearest-neighbor cosine similarity searches.
- **Why Rejected**:
  - **Temporal Blindness**: Vector embeddings capture semantic similarity, not chronological sequence. A vector search often fails to differentiate between *"price in 2022"* vs *"price in 2026"*.
  - **Operational Overhead**: Requires external hosted services or heavy C++ bindings, violating the zero-friction `npm install && npm run dev` requirement.
  - Relational SQLite with timestamp indexes and entity keys provides faster, deterministic, and inspectable temporal lookups.

### Alternative 4: Headless Browser Scraping (Puppeteer / Playwright)
- **Concept**: Launch a local browser instance to scrape Google or DuckDuckGo HTML directly.
- **Why Rejected**:
  - Heavy memory consumption ($> 300\text{ MB}$ per Chromium process).
  - High latency ($> 3\text{--}5\text{s}$ per page load and JavaScript rendering).
  - Vulnerable to anti-bot challenges (CAPTCHAs, Cloudflare) and layout changes.
  - Structured Search APIs (Tavily, Brave) return sanitized, machine-ready text in $< 500\text{ ms}$.

### Alternative 5: Plain In-Memory JavaScript Map for Sessions
- **Concept**: Store chat history in a plain Node.js `Map<string, Message[]>`.
- **Why Rejected**:
  - All conversational history and extracted historical facts are wiped if the Node server restarts or crashes.
  - Unbounded memory consumption over extended use.

---

## 4. Known Limitations, Edge Cases & Engineering Trade-offs

| Limitation / Trade-off | Description | Mitigation Strategy |
| :--- | :--- | :--- |
| **Search API Latency Floor** | Any turn requiring web search is constrained by external network latency (typically 400ms – 1,200ms). | Early-exit intent routing skips search for non-temporal/evergreen queries. Parallel query dispatching runs concurrent searches. Results are cached with TTL. |
| **Search Rate Limiting (HTTP 429)** | Free or developer tiers of search APIs have requests-per-minute (RPM) constraints. | Exponential backoff with full jitter; search result caching; graceful degradation to model knowledge with explicit user notification. |
| **Date Ambiguity in Web Content** | Many web articles do not publish explicit metadata dates or display recycled timestamps. | Query rewriter appends explicit calendar years to search queries (e.g. `"2026"`). Snippets with missing dates are marked as unverified in temporal comparison mode. |
| **Conflicting Web Reports** | Different web sources may report conflicting prices or dates for the same entity. | The synthesis engine is prompted to surface discrepancies explicitly to the user rather than hallucinating an average or picking a single arbitrary source. |
| **Clock Synchronization** | System clock reliance assumes the host machine's clock is reasonably synchronized via NTP. | Server uses standard UTC ISO-8601 timestamps throughout all internal modules to avoid timezone skew. |
