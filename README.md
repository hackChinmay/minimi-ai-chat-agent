# minimi-ai-chat-agent

An intelligent conversational AI agent engineered with persistent memory, real-time web search, and date-aware historical comparison.

---

## 1. Project Overview

`minimi-ai-chat-agent` is designed to deliver fast, highly accurate, source-backed answers using web search as its sole external capability. It features deterministic temporal grounding to accurately handle changing information (such as product pricing, software releases, and historical events) while maintaining low latency on conversational turns.

This repository currently implements **Phase 2: Production Backend Foundation**, establishing a modular, strictly typed, resilient Express.js + TypeScript foundation with security headers, correlation tracking, centralized error handling, and automated test coverage.

Detailed architectural specifications and roadmaps can be found in:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md)

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
- **Route Not Found (404)**: Standardized error envelope for unmapped routes.
- **Centralized Error Handling**: Operational error codes, Zod validation errors, malformed JSON (400), and unhandled rejection protection (500).
- **Environment Configuration**: Strict Zod parsing, defaults assignment, and rejection of invalid port/enum values.

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
│   ├── IMPLEMENTATION_PLAN.md# Phased delivery roadmap and testing strategy
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
│   │   └── healthController.ts # HTTP request/response handling for health checks
│   │
│   ├── middleware/
│   │   ├── errorHandler.ts   # Centralized error handler returning standard envelopes
│   │   ├── notFoundHandler.ts# 404 handler for unmatched routes
│   │   ├── requestId.ts      # UUID correlation tracking (`X-Request-Id`)
│   │   ├── requestLogger.ts  # Structured HTTP access logger with duration metrics
│   │   └── validate.ts       # Zod schema validation middleware (body, query, params)
│   │
│   ├── routes/
│   │   ├── healthRoute.ts    # Health check route definition
│   │   └── index.ts          # Root API router aggregator
│   │
│   ├── services/
│   │   └── healthService.ts  # Business logic for system health and uptime
│   │
│   ├── types/
│   │   └── index.ts          # Standard API contracts (ApiResponse, ApiErrorPayload)
│   │
│   └── utils/
│       ├── asyncHandler.ts   # Promise resolution wrapper for Express route handlers
│       ├── errors.ts         # Custom AppError hierarchy (BadRequest, NotFound, etc.)
│       └── logger.ts         # Structured, level-aware application logger
│
└── tests/
    ├── config.test.ts        # Environment variable parsing and validation tests
    ├── errorHandler.test.ts  # Centralized error middleware and payload tests
    ├── health.test.ts        # Health check endpoint integration tests
    └── notFound.test.ts      # 404 handling integration tests
```

### Standard API Response Envelope

All API endpoints follow a unified response structure:

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable description of error",
    "details": {},
    "requestId": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    "timestamp": "2026-11-11T09:02:17.000Z"
  }
}
```

---

## 9. Next Steps (Upcoming Phases)

- **Phase 3**: Web Search Subsystem, Caching & Mock Providers (Tavily/Brave).
- **Phase 4**: Conversational Memory, Sliding Window & SQLite Temporal Fact Log.
- **Phase 5**: Intent Router, Query Rewriter & Agent State Machine.
- **Phase 6**: Server-Sent Events (SSE) Streaming & Chat API.
- **Phase 7**: Evaluation Framework (EV-01 to EV-06) & Final Polish.
