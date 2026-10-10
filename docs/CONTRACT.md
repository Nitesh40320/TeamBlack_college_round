# Second Opinion — JSON Contract

> **Single source of truth** for all JSON shapes exchanged between the frontend, backend,
> and model service. Any agent that needs to modify a shape **must propose the change here
> in their final message** rather than editing silently.

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Shared Primitives](#2-shared-primitives)
3. [AuditRequest](#3-auditrequest)
4. [AuditResult](#4-auditresult)
5. [Error Response](#5-error-response)
6. [Model Service Endpoints](#6-model-service-endpoints)
7. [Backend REST Endpoints](#7-backend-rest-endpoints)
8. [Full Realistic Example](#8-full-realistic-example)

---

## 1. Conventions

| Convention | Rule |
|---|---|
| **Offsets** | All `start` / `end` character offsets are **0-based, end-exclusive**, measured against the **original, unmodified** `answer` string. |
| **IDs** | All `id` fields are **UUID v4** strings unless noted otherwise. |
| **Timestamps** | ISO 8601 UTC strings: `"2024-09-01T12:00:00.000Z"`. |
| **Scores** | `confidence.score` is `[0, 1]`; `overall.score` is `[0, 100]`. |
| **Enums** | All enum values are **lowercase** unless the field name contains `verdict`, `grade`, or `errorCategory` (those use SCREAMING_SNAKE or single-letter). |
| **Optionality** | Fields marked `?` may be absent or `null`. |

---

## 2. Shared Primitives

### TypeScript

```typescript
/** A span inside the answer string. 0-based, end-exclusive. */
type Span = {
  start: number; // inclusive
  end: number;   // exclusive
};

/** A reference to a passage in one of the provided sources. */
type SourceSpan = {
  start: number;
  end: number;
};
```

### JSON Schema

```json
{
  "$defs": {
    "Span": {
      "type": "object",
      "required": ["start", "end"],
      "properties": {
        "start": { "type": "integer", "minimum": 0 },
        "end":   { "type": "integer", "minimum": 0 }
      },
      "additionalProperties": false
    }
  }
}
```

---

## 3. AuditRequest

Sent by the **frontend to backend** (`POST /api/audits`) and forwarded by the
**backend to model** (`POST /v1/audit`).

### TypeScript

```typescript
type Source = {
  id: string;    // caller-supplied opaque ID (e.g. "src-1")
  title: string; // human-readable label shown in UI
  text: string;  // full plaintext of the source document
};

type AuditRequest = {
  question?: string; // optional user prompt that generated the answer
  answer: string;    // the AI-generated text to audit
  sources: Source[]; // 1-20 source documents; order is preserved
};
```

### JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "AuditRequest",
  "type": "object",
  "required": ["answer", "sources"],
  "properties": {
    "question": { "type": "string", "maxLength": 2000 },
    "answer":   { "type": "string", "minLength": 1, "maxLength": 50000 },
    "sources": {
      "type": "array",
      "minItems": 1,
      "maxItems": 20,
      "items": {
        "type": "object",
        "required": ["id", "title", "text"],
        "properties": {
          "id":    { "type": "string", "minLength": 1 },
          "title": { "type": "string", "minLength": 1, "maxLength": 500 },
          "text":  { "type": "string", "minLength": 1, "maxLength": 200000 }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

---

## 4. AuditResult

Returned by the **model service** and stored / surfaced by the **backend**.

### 4.1 Top-Level Shape

### TypeScript

```typescript
type AuditStatus =
  | "queued"
  | "extracting"
  | "verifying"
  | "analyzing"
  | "completed"
  | "failed";

type AuditResult = {
  id: string;           // UUID v4
  status: AuditStatus;
  claims: Claim[];
  reasoningIssues: ReasoningIssue[];
  safetyFlags: SafetyFlag[];
  overall: OverallScore;
  meta: Meta;
  error?: string;       // present only when status === "failed"
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
};
```

---

### 4.2 Claim

```typescript
type ClaimType =
  | "factual"
  | "numeric"
  | "causal"
  | "recommendation"
  | "opinion";

type Verdict =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "UNSUPPORTED"
  | "UNVERIFIABLE"
  | "AMBIGUOUS";

type ErrorCategory =
  | "HALLUCINATED_FACT"
  | "CONTRADICTS_SOURCE"
  | "UNSUPPORTED_CLAIM"
  | "NUMERIC_MISMATCH"
  | "ENTITY_MISMATCH"
  | "AMBIGUOUS_STATEMENT";

type EvidenceRelation = "supports" | "contradicts" | "related";

type ConfidenceLevel = "low" | "medium" | "high";

type Evidence = {
  sourceId: string;             // matches Source.id from the request
  span: SourceSpan;             // character span inside that source's text
  text: string;                 // verbatim excerpt from the source
  relation: EvidenceRelation;
  score: number;                // [0, 1] semantic similarity / relevance
};

type Confidence = {
  score: number;                // [0, 1]
  level: ConfidenceLevel;
  uncertaintyReasons: string[]; // human-readable reasons for uncertainty
};

type Claim = {
  id: string;                   // UUID v4
  text: string;                 // the extracted claim sentence
  answerSpan: Span;             // location of this claim inside answer
  claimType: ClaimType;
  verdict: Verdict;
  errorCategory?: ErrorCategory; // absent when verdict === "SUPPORTED"
  errorSpan?: Span;              // tightest span of the error inside answer
  explanation: string;           // natural-language rationale
  evidence: Evidence[];
  confidence: Confidence;
};
```

#### JSON Schema (Claim)

```json
{
  "$id": "Claim",
  "type": "object",
  "required": ["id","text","answerSpan","claimType","verdict","explanation","evidence","confidence"],
  "properties": {
    "id":          { "type": "string", "format": "uuid" },
    "text":        { "type": "string" },
    "answerSpan":  { "$ref": "#/$defs/Span" },
    "claimType":   { "enum": ["factual","numeric","causal","recommendation","opinion"] },
    "verdict":     { "enum": ["SUPPORTED","CONTRADICTED","UNSUPPORTED","UNVERIFIABLE","AMBIGUOUS"] },
    "errorCategory": {
      "enum": ["HALLUCINATED_FACT","CONTRADICTS_SOURCE","UNSUPPORTED_CLAIM",
               "NUMERIC_MISMATCH","ENTITY_MISMATCH","AMBIGUOUS_STATEMENT"]
    },
    "errorSpan":   { "$ref": "#/$defs/Span" },
    "explanation": { "type": "string" },
    "evidence": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["sourceId","span","text","relation","score"],
        "properties": {
          "sourceId": { "type": "string" },
          "span":     { "$ref": "#/$defs/Span" },
          "text":     { "type": "string" },
          "relation": { "enum": ["supports","contradicts","related"] },
          "score":    { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "additionalProperties": false
      }
    },
    "confidence": {
      "type": "object",
      "required": ["score","level","uncertaintyReasons"],
      "properties": {
        "score":              { "type": "number", "minimum": 0, "maximum": 1 },
        "level":              { "enum": ["low","medium","high"] },
        "uncertaintyReasons": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

---

### 4.3 ReasoningIssue

```typescript
type ReasoningIssueType =
  | "NON_SEQUITUR"
  | "INTERNAL_CONTRADICTION"
  | "CIRCULAR"
  | "OVERGENERALIZATION";

type ReasoningIssue = {
  id: string;                       // UUID v4
  claimIds: string[];               // Claim IDs involved in this issue
  answerSpan: Span;                 // span covering the problematic passage
  type: ReasoningIssueType;
  explanation: string;
  confidence: Confidence;
};
```

---

### 4.4 SafetyFlag

```typescript
type SafetySeverity = "low" | "medium" | "high";

type SafetyFlag = {
  id: string;             // UUID v4
  claimId?: string;       // linked Claim ID, if applicable
  answerSpan: Span;
  domain: string;         // e.g. "medical", "legal", "financial"
  severity: SafetySeverity;
  explanation: string;
  recommendation: string; // suggested corrective action for the user
};
```

---

### 4.5 OverallScore

```typescript
type VerdictCounts = {
  SUPPORTED: number;
  CONTRADICTED: number;
  UNSUPPORTED: number;
  UNVERIFIABLE: number;
  AMBIGUOUS: number;
};

type Grade = "A" | "B" | "C" | "D" | "F";

type OverallScore = {
  score: number;           // [0, 100]
  grade: Grade;
  summary: string;         // 1-3 sentence human-readable summary
  counts: VerdictCounts;
};
```

---

### 4.6 Meta

```typescript
type ModelVersions = {
  embedder: string;   // e.g. "text-embedding-3-small@2024-02"
  verifier: string;   // e.g. "gpt-4o-mini@2024-07-18"
  analyzer: string;   // e.g. "gpt-4o@2024-08-06"
};

type Timings = {
  totalMs: number;
  chunkingMs: number;
  extractionMs: number;
  verificationMs: number;
  analysisMs: number;
};

type RunMode = "mock" | "live";

type Meta = {
  timings: Timings;
  modelVersions: ModelVersions;
  mode: RunMode;
};
```

---

## 5. Error Response

All services return this shape on non-2xx responses.

### TypeScript

```typescript
type ErrorResponse = {
  error: {
    code: string;    // machine-readable slug, e.g. "VALIDATION_ERROR"
    message: string; // human-readable description
    details?: unknown; // optional structured detail (e.g. Zod issues array)
  };
};
```

### JSON Schema

```json
{
  "$id": "ErrorResponse",
  "type": "object",
  "required": ["error"],
  "properties": {
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "properties": {
        "code":    { "type": "string" },
        "message": { "type": "string" },
        "details": {}
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

### Standard Error Codes

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | `VALIDATION_ERROR` | Request body failed schema validation |
| 404 | `NOT_FOUND` | Requested resource does not exist |
| 422 | `UNPROCESSABLE_ENTITY` | Semantically invalid input |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `MODEL_UNAVAILABLE` | Model service unreachable |

---

## 6. Model Service Endpoints

Base URL: `http://model:8000` (internal Docker network).

### `POST /v1/chunk`

Splits a source document into overlapping chunks for embedding.

**Request**
```json
{ "sourceId": "src-1", "text": "...", "chunkSize": 512, "overlap": 64 }
```

**Response `200`**
```json
{
  "sourceId": "src-1",
  "chunks": [
    { "index": 0, "text": "...", "span": { "start": 0, "end": 512 } }
  ]
}
```

---

### `POST /v1/extract-claims`

Extracts discrete claims from the answer text.

**Request**
```json
{ "answer": "...", "question": "..." }
```

**Response `200`**
```json
{
  "claims": [
    {
      "id": "c1a2b3c4-...",
      "text": "Aspirin reduces fever.",
      "answerSpan": { "start": 0, "end": 22 },
      "claimType": "factual"
    }
  ]
}
```

---

### `POST /v1/verify`

Verifies a single extracted claim against the provided sources.

**Request**
```json
{
  "claim": {
    "id": "c1a2b3c4-...",
    "text": "Aspirin reduces fever.",
    "answerSpan": { "start": 0, "end": 22 },
    "claimType": "factual"
  },
  "sources": [{ "id": "src-1", "title": "...", "text": "..." }]
}
```

**Response `200`** -- returns a fully populated `Claim` object (see section 4.2).

---

### `POST /v1/audit`

Full end-to-end pipeline: chunk -> extract -> verify -> analyze.

**Request** -- `AuditRequest` (see section 3).

**Response `200`** -- `AuditResult` (see section 4).

---

### `GET /health`

Liveness and readiness probe.

**Response `200`**
```json
{ "status": "ok", "version": "0.1.0", "mode": "live" }
```

---

## 7. Backend REST Endpoints

Base URL: `http://localhost:4000` (external).

### `POST /api/audits`

Submit a new audit job.

**Request body** -- `AuditRequest`.

**Response `202`**
```json
{
  "id": "9f4e1234-...",
  "status": "queued",
  "createdAt": "2024-09-01T12:00:00.000Z"
}
```

---

### `GET /api/audits`

List recent audits (paginated).

**Query params**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Items per page (max 100) |
| `status` | string | -- | Filter by `AuditStatus` |

**Response `200`**
```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

### `GET /api/audits/:id`

Fetch a single audit by ID.

**Response `200`** -- full `AuditResult`.

**Response `404`** -- `ErrorResponse` with `code: "NOT_FOUND"`.

---

## 8. Full Realistic Example

**Scenario**: User asks an AI assistant about aspirin dosage and the assistant makes
one correct claim, one numeric error, and one unsupported claim.

### 8.1 AuditRequest

```json
{
  "question": "What is the standard adult dose of aspirin for fever?",
  "answer": "Aspirin is commonly used to reduce fever in adults. The standard dose is 1000 mg every 4 hours, not exceeding 4 g per day. It also prevents heart attacks in all adults over 40.",
  "sources": [
    {
      "id": "src-1",
      "title": "BNF - Aspirin Monograph (2024 ed.)",
      "text": "Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever. The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily. Aspirin is not recommended as routine prophylaxis for cardiovascular events in low-risk adults due to bleeding risk."
    }
  ]
}
```

### 8.2 AuditResult

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "claims": [
    {
      "id": "c0000001-0000-0000-0000-000000000001",
      "text": "Aspirin is commonly used to reduce fever in adults.",
      "answerSpan": { "start": 0, "end": 50 },
      "claimType": "factual",
      "verdict": "SUPPORTED",
      "explanation": "The source confirms aspirin is indicated for fever in adults.",
      "evidence": [
        {
          "sourceId": "src-1",
          "span": { "start": 0, "end": 92 },
          "text": "Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever.",
          "relation": "supports",
          "score": 0.97
        }
      ],
      "confidence": {
        "score": 0.96,
        "level": "high",
        "uncertaintyReasons": []
      }
    },
    {
      "id": "c0000001-0000-0000-0000-000000000002",
      "text": "The standard dose is 1000 mg every 4 hours, not exceeding 4 g per day.",
      "answerSpan": { "start": 51, "end": 121 },
      "claimType": "numeric",
      "verdict": "CONTRADICTED",
      "errorCategory": "NUMERIC_MISMATCH",
      "errorSpan": { "start": 72, "end": 79 },
      "explanation": "The source states 300-900 mg per dose; 1000 mg exceeds the documented maximum single dose.",
      "evidence": [
        {
          "sourceId": "src-1",
          "span": { "start": 93, "end": 174 },
          "text": "The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily.",
          "relation": "contradicts",
          "score": 0.99
        }
      ],
      "confidence": {
        "score": 0.94,
        "level": "high",
        "uncertaintyReasons": []
      }
    },
    {
      "id": "c0000001-0000-0000-0000-000000000003",
      "text": "It also prevents heart attacks in all adults over 40.",
      "answerSpan": { "start": 123, "end": 175 },
      "claimType": "recommendation",
      "verdict": "CONTRADICTED",
      "errorCategory": "CONTRADICTS_SOURCE",
      "errorSpan": { "start": 123, "end": 175 },
      "explanation": "The source explicitly states aspirin is NOT recommended as routine cardiovascular prophylaxis in low-risk adults.",
      "evidence": [
        {
          "sourceId": "src-1",
          "span": { "start": 175, "end": 298 },
          "text": "Aspirin is not recommended as routine prophylaxis for cardiovascular events in low-risk adults due to bleeding risk.",
          "relation": "contradicts",
          "score": 0.98
        }
      ],
      "confidence": {
        "score": 0.98,
        "level": "high",
        "uncertaintyReasons": []
      }
    }
  ],
  "reasoningIssues": [],
  "safetyFlags": [
    {
      "id": "sf000001-0000-0000-0000-000000000001",
      "claimId": "c0000001-0000-0000-0000-000000000003",
      "answerSpan": { "start": 123, "end": 175 },
      "domain": "medical",
      "severity": "high",
      "explanation": "Blanket cardiovascular prophylaxis recommendation contradicts clinical guidance and could cause patient harm.",
      "recommendation": "Advise users to consult a cardiologist or GP before starting aspirin for heart attack prevention."
    }
  ],
  "overall": {
    "score": 28,
    "grade": "D",
    "summary": "The answer contains one correct factual claim but two significant errors: a numeric dosage mismatch and a directly contradicted cardiovascular recommendation. The medical safety concern warrants immediate correction.",
    "counts": {
      "SUPPORTED": 1,
      "CONTRADICTED": 2,
      "UNSUPPORTED": 0,
      "UNVERIFIABLE": 0,
      "AMBIGUOUS": 0
    }
  },
  "meta": {
    "timings": {
      "totalMs": 4321,
      "chunkingMs": 45,
      "extractionMs": 980,
      "verificationMs": 2810,
      "analysisMs": 486
    },
    "modelVersions": {
      "embedder": "text-embedding-3-small@2024-02",
      "verifier": "gpt-4o-mini@2024-07-18",
      "analyzer": "gpt-4o@2024-08-06"
    },
    "mode": "live"
  },
  "createdAt": "2024-09-01T12:00:00.000Z",
  "updatedAt": "2024-09-01T12:00:04.321Z"
}
```
