# Second Opinion — Backend Service

Node 20 + Express + TypeScript + Mongoose backend service for Second Opinion AI audit platform.

## Features

- **TypeScript & Express**: Strongly typed routes and controllers.
- **Contract Schema Validation**: Zod validators matching `docs/CONTRACT.md`.
- **Database**: MongoDB via Mongoose with Audit document schema.
- **Model Service Client**: Axios HTTP client with retry backoff and development fixture fallback (`MODEL_BASE_URL`).
- **Middleware**: Centralized error handler, request-id propagation, request logging, and CORS.

## Folder Structure

```
backend/
├── src/
│   ├── config/          # Environment variable validation & DB setup
│   ├── controllers/     # Health and Audit controllers
│   ├── middleware/      # Error handling, request ID, logging
│   ├── models/          # Mongoose Audit model
│   ├── routes/          # Express route definitions
│   ├── services/        # Audit service and modelClient
│   ├── types/           # TypeScript interfaces & Zod schemas
│   ├── app.ts           # Express app instance
│   └── index.ts         # Server entrypoint
├── tests/               # Jest + supertest Integration test suite
├── .env.example
├── Dockerfile
├── jest.config.js
├── package.json
├── tsconfig.json
└── README.md
```

## Running the Backend

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run tests:
   ```bash
   npm test
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## REST API Endpoints

- `GET /health` -> Liveness status check
- `POST /api/audits` -> Submit new audit (runs orchestrator: `queued` → `extracting` → `verifying` → `analyzing` → `completed`)
- `GET /api/audits` -> List recent audits
- `GET /api/audits/:id` -> Fetch single audit by ID (includes claims, reasoningIssues, safetyFlags, and overall summary)
- `GET /api/audits/:id/summary` -> Fetch executive audit summary (grade, score, counts, top findings, and confidence calibration note)
- `GET /api/audits/:id/findings` -> Fetch findings with filters (`verdict`, `category`, `claimType`) and aggregated summary
- `GET /api/audits/:id/annotations` -> Fetch sorted, non-overlapping annotations projection for UI highlighting
- `GET /api/audits/:id/reasoning` -> Fetch reasoning issues list for audit
- `GET /api/audits/:id/safety` -> Fetch safety flags list for audit
- `POST /api/audits/:id/rerun` -> Rerun audit (supports `?fromStage=analyzing` to rerun reasoning & safety analysis without re-running verification)
- `GET /api/eval/latest` -> Proxy model's latest evaluation benchmark results (with in-memory caching and graceful empty state fallback)
- `POST /api/audits/:id/feedback` -> Submit user feedback on a finding (`findingType`, `findingId`, `verdict: correct|incorrect`, `comment?`) with duplicate vote prevention per client session
- `GET /api/feedback/stats` -> Fetch aggregate feedback metrics (total votes, correct/incorrect count, accuracy %, and breakdown by finding type)


