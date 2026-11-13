# minimi-ai-chat-agent

An intelligent conversational AI agent engineered with persistent memory, real-time web search, and date-aware historical comparison.

---

## 1. Project Overview

`minimi-ai-chat-agent` is designed to deliver fast, highly accurate, source-backed answers using web search as its sole external capability. It features deterministic temporal grounding to accurately handle changing information (such as product pricing, software releases, and historical events) while maintaining low latency on conversational turns.

### Current Implementation Status
- **Phase 1: Architecture & Technical Decisions**: Completed ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md), [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)).
- **Phase 2: Production Backend Foundation**: Completed (Express.js, TypeScript strict mode, Zod, centralized error handling, security headers, correlation IDs).
- **Phase 3: Production Web Search Integration**: Completed ([docs/SEARCH_INTEGRATION.md](docs/SEARCH_INTEGRATION.md) — Tavily provider, Mock provider, `SearchProvider` interface, result normalization, stable citation identifiers, exponential backoff retries, and `POST /api/search`).
- **Phase 4: Conversation Memory Architecture**: Completed ([docs/CONVERSATION_MEMORY.md](docs/CONVERSATION_MEMORY.md) — Pluggable storage abstraction, In-Memory and MongoDB adapters, sliding context window manager with system prompt preservation, and `/api/conversations` endpoints).

---

## 2. Prerequisites

- **Node.js**: `v20.0.0` or higher (`v24.x` recommended)
- **npm**: `v9.0.0` or higher
- **Operating System**: Windows, macOS, or Linux

Verify your installed versions:
```bash
node -v
npm -v
```

---

## 3. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd minimi-ai-chat-agent
npm install
```

---

## 4. Environment Setup

Copy `.env.example` to create your local `.env` configuration:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `string` | `development` | Runtime environment (`development`, `production`, `test`). |
| `PORT` | `number` | `3000` | Port for the HTTP server to listen on. |
| `CORS_ORIGIN` | `string` | `*` | Allowed CORS origins (comma-separated or `*` for all). |
| `LOG_LEVEL` | `string` | `info` | Minimum log level (`debug`, `info`, `warn`, `error`). |
| `API_PREFIX` | `string` | `/api` | Base path prefix for all API routes. |
| `REQUEST_BODY_LIMIT` | `string` | `1mb` | Max allowable request payload size. |
| `SEARCH_PROVIDER` | `string` | `tavily` | Active search provider (`tavily`, `mock`, `brave`). |
| `TAVILY_API_KEY` | `string` | *(empty)* | API key for Tavily (required if `SEARCH_PROVIDER=tavily`). |
| `SEARCH_TIMEOUT_MS`| `number` | `5000` | Timeout in milliseconds for web search calls. |
| `STORAGE_PROVIDER` | `string` | `memory` | Storage provider for conversation memory (`memory`, `mongodb`). |
| `MONGODB_URI` | `string` | *(empty)* | MongoDB connection string (required if `STORAGE_PROVIDER=mongodb`). |
| `MAX_CONTEXT_MESSAGES` | `number` | `20` | Default maximum messages in sliding context window. |
| `MAX_MESSAGE_LENGTH` | `number` | `32000` | Maximum character length for individual conversation messages. |

> **Security Note:** `.env` is ignored by git (`.gitignore`). Secret keys are validated at boot via Zod and are never exposed in client bundles or public endpoints.

---

## 5. Development & Running

### Start Development Server
Runs the application with hot-reloading via `tsx watch`:

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

### Health Check Endpoint
Verify the server status:

```bash
curl http://localhost:3000/api/health
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "0.1.0",
    "environment": "development",
    "uptime": 5,
    "timestamp": "2026-11-11T09:02:17.000Z"
  }
}
```

### Web Search Endpoint (`POST /api/search`)
Query the search subsystem:

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "PostgreSQL managed cloud pricing 2026", "maxResults": 3}'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "query": "PostgreSQL managed cloud pricing 2026",
    "results": [
      {
        "id": "source-1",
        "index": 1,
        "title": "Cloud SQL for PostgreSQL Pricing",
        "url": "https://cloud.google.com/sql/pricing",
        "content": "Detailed pricing for high-availability managed PostgreSQL instances.",
        "source": "cloud.google.com",
        "publishedDate": "2026-03-01T00:00:00Z",
        "relevanceScore": 0.9823
      }
    ],
    "metadata": {
      "totalResults": 1,
      "searchTimeMs": 320,
      "provider": "tavily"
    }
  }
}
```

### Conversation Memory Endpoints (`/api/conversations`)

#### Create a Conversation (`POST /api/conversations`)
```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "Pricing research", "metadata": {"topic": "databases"}}'
```

#### Append Message to Conversation (`POST /api/conversations/:id/messages`)
```bash
curl -X POST http://localhost:3000/api/conversations/<CONVERSATION_ID>/messages \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "How much does managed PostgreSQL cost on Google Cloud?"}'
```

#### Retrieve Messages / Sliding Context Window (`GET /api/conversations/:id/messages`)
```bash
curl "http://localhost:3000/api/conversations/<CONVERSATION_ID>/messages?maxMessages=10&preserveSystemPrompt=true"
```

#### List Conversations (`GET /api/conversations`)
```bash
curl "http://localhost:3000/api/conversations?page=1&limit=10"
```

#### Delete Conversation (`DELETE /api/conversations/:id`)
```bash
curl -X DELETE http://localhost:3000/api/conversations/<CONVERSATION_ID>
```

---

## 6. Production Build & Start

Compile TypeScript to JavaScript and run in production:

```bash
# 1. Compile TypeScript to dist/
npm run build

# 2. Run compiled production server
npm start
```

---

## 7. Testing

The project uses [Vitest](https://vitest.dev/) and [Supertest](https://github.com/ladjs/supertest) for fast, isolated API and unit testing.

```bash
# Run all test suites
npm test

# Run tests in interactive watch mode
npm run test:watch

# Run test coverage report
npm run test:coverage
```

### Test Coverage Areas
- **GET /api/health**: Payload format, uptime validation, version, and `X-Request-Id` preservation.
- **POST /api/search**: Natural-language queries, query sanitization, result normalization, stable citation identifiers (`source-1`), metadata reporting.
- **Tavily Provider Reliability**: AbortController timeouts, malformed payload detection, 429 rate limit backoff retries, 5xx server error retries, and non-retryable 400/401/403 bails.
- **Conversation Memory & Management**: Conversation creation, listing, retrieval, deletion, strict UUID parameter checks, isolation between conversations.
- **Sliding Context Window**: Window sizing (`maxMessages`), character budgeting (`maxCharacters`), system prompt preservation, chronological ordering, truncation flag.
- **Request Validation**: Body, query parameter, and path parameter constraints using Zod schemas.
- **Centralized Error Handling**: Operational error codes, custom `AppError` subclasses, JSON parse error recovery, and 500 error sanitization.
- **Configuration Validation**: Zod environment parsing and boundary verification.

---

## 8. Backend Architecture & Module Overview

```text
minimi-ai-chat-agent/
├── .env.example              # Environment configuration template
├── .gitignore                # Git ignore patterns
├── README.md                 # Project documentation
├── package.json              # Dependency declarations and scripts
├── tsconfig.json             # Strict TypeScript configuration
├── vitest.config.ts          # Vitest testing configuration
│
├── docs/                     # Architectural documentation
│   ├── ARCHITECTURE.md       # High-level architecture, memory model, security
│   ├── CONVERSATION_MEMORY.md# Memory subsystem, sliding window & storage adapter design
│   ├── IMPLEMENTATION_PLAN.md# Phased delivery roadmap and testing strategy
│   ├── SEARCH_INTEGRATION.md # Web search subsystem design & provider guide
│   └── TECHNICAL_DECISIONS.md# Tech stack evaluation, rationale, rejected options
│
├── src/
│   ├── server.ts             # Process lifecycle, graceful shutdown, boot checks
│   ├── app.ts                # Express application factory, middleware assembly
│   │
│   ├── config/
│   │   └── env.ts            # Type-safe environment validation via Zod
│   │
│   ├── controllers/
│   │   ├── conversationController.ts # HTTP handlers for /api/conversations
│   │   ├── healthController.ts # HTTP handler for GET /api/health
│   │   └── searchController.ts # HTTP handler for POST /api/search
│   │
│   ├── middleware/
│   │   ├── errorHandler.ts   # Centralized error handler returning standard envelopes
│   │   ├── notFoundHandler.ts# 404 handler for unmatched routes
│   │   ├── requestId.ts      # UUID correlation tracking (`X-Request-Id`)
│   │   ├── requestLogger.ts  # Structured HTTP access logger with duration metrics
│   │   └── validate.ts       # Zod schema validation middleware (body, query, params)
│   │
│   ├── routes/
│   │   ├── conversationRoute.ts # Conversation & message route definitions
│   │   ├── healthRoute.ts    # Health check route definition
│   │   ├── searchRoute.ts    # Search route definition & input schema
│   │   └── index.ts          # Root API router aggregator
│   │
│   ├── services/
│   │   ├── healthService.ts  # Business logic for system health and uptime
│   │   ├── memory/           # Conversation Memory Subsystem
│   │   │   ├── types.ts      # Storage adapter interface & domain contracts
│   │   │   ├── contextManager.ts # Sliding window, budgeting & prompt anchoring
│   │   │   ├── conversationService.ts # Conversation lifecycle & message operations
│   │   │   ├── storageFactory.ts # Pluggable storage factory (Memory/MongoDB)
│   │   │   └── adapters/
│   │   │       ├── inMemoryAdapter.ts # Fast Map-based repository
│   │   │       └── mongoAdapter.ts    # Mongoose-backed persistent repository
│   │   └── search/           # Web Search Subsystem
│   │       ├── types.ts      # SearchProvider interface & raw result types
│   │       ├── searchService.ts # Query sanitization, normalization & citation IDs
│   │       ├── searchProviderFactory.ts # Pluggable provider factory
│   │       └── providers/
│   │           ├── tavilyProvider.ts # Production Tavily client with retries
│   │           └── mockProvider.ts   # Offline deterministic mock provider
│   │
│   ├── types/
│   │   └── index.ts          # Standard API contracts, Conversation & Search domain models
│   │
│   └── utils/
│       ├── asyncHandler.ts   # Promise resolution wrapper for Express route handlers
│       ├── errors.ts         # Custom AppError hierarchy (SearchTimeout, RateLimit, etc.)
│       └── logger.ts         # Structured, level-aware application logger
│
└── tests/
    ├── config.test.ts        # Environment variable parsing and validation tests
    ├── errorHandler.test.ts  # Centralized error middleware and payload tests
    ├── health.test.ts        # Health check endpoint integration tests
    ├── memory.test.ts        # Conversation memory lifecycle, sliding window & adapter tests
    ├── notFound.test.ts      # 404 handling integration tests
    ├── search.test.ts        # Search provider unit & POST /api/search integration tests
    └── validate.test.ts      # Request validation middleware tests
```

---

## 9. Next Steps (Upcoming Phases)

- **Phase 5**: Agent Core, LLM Integration & Search Tool-Calling Loop.
- **Phase 6**: Server-Sent Events (SSE) Streaming & Interactive Chat API.
- **Phase 7**: Evaluation Framework (EV-01 to EV-06) & Final Polish.
