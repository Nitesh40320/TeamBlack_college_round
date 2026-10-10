# Second Opinion — Model Service

Python 3.11 FastAPI service that performs claim extraction, sentence-aware chunking, hybrid retrieval, cross-encoder NLI scoring, evidence-constrained LLM judging, source document verification, and reasoning/safety analysis for AI-generated answers against source documentation.

## Features

- **FastAPI Framework**: High performance async API.
- **Pydantic v2 Schemas**: Strict contract-first schemas matching `docs/CONTRACT.md`.
- **Mock & Live Modes**: Deterministic mock fixture for offline testing and contract verification (`MODEL_MODE=mock`).
- **LLM Abstraction**: Multi-provider support (`gemini`, `openai`, `anthropic`, `fake`) with JSON extraction repair and retry logic.
- **Sentence-Aware Chunker**: Splits source text into sentence-aware overlapping chunks preserving 0-based character spans (`/v1/chunk`).
- **Claim Extractor**: Decontextualizes AI answers into atomic claims with answer span alignment and opinion detection (`/v1/extract-claims`).
- **Verifier & Precise Error Localizer (`verifier.py`, `localizer.py`, `ambiguity.py`)**:
  - **Ambiguity & Subjectivity Detector (`ambiguity.py`)**: Identifies vague quantifiers ("usually", "quickly"), unresolved pronouns ("this", "that"), hedges ("allegedly", "possibly"), and subjective terms ("better"), labelling them `AMBIGUOUS` or `UNVERIFIABLE` with category `AMBIGUOUS_STATEMENT`.
  - **Deterministic Checkers (`localizer.py`)**: Rule-based detection for numbers/units/percentages, dates, named entities, and negation flips compared against best evidence passages, producing minimal error phrases.
  - **LLM-Assisted Fallback**: Triggers minimal error phrase extraction when rules don't fire.
  - **Exact Offset Mapping**: Maps error phrases back to exact 0-based character offsets (`errorSpan`) validated against `answer[start:end]`.
  - **Error Categories**: Assigns `HALLUCINATED_FACT`, `CONTRADICTS_SOURCE`, `NUMERIC_MISMATCH`, `ENTITY_MISMATCH`, `UNSUPPORTED_CLAIM`, or `AMBIGUOUS_STATEMENT`.
  - **Reasoning Flaw Detector (`reasoning.py`)**:
  - **Argument Structure Extraction**: Identifies premises vs conclusions using discourse cues (`therefore`, `because`, `so`, `thus`) and LLM structural analysis.
  - **NON_SEQUITUR**: Detects conclusions not entailed by premises + evidence using cross-encoder NLI and entailment checks.
  - **INTERNAL_CONTRADICTION**: Runs $O(n \cdot k)$ pairwise NLI over candidate claim pairs pre-filtered by embedding/token similarity.
  - **CIRCULAR**: Flags circular reasoning where a conclusion claim restates its premise.
  - **OVERGENERALIZATION**: Flags absolute quantifiers (`always`, `all`, `never`, `every`, `none`) unsupported by evidence.
- **Safety Concern Classifier (`safety.py`)**:
  - **Sensitive Domain Classifier**: Detects unsafe recommendations across `medical`, `legal`, `financial`, `physical_safety`, and `self_harm`.
  - **Severity & Groundedness Evaluation**: Evaluates whether medical doses exceed clinical safety thresholds (>4000mg/day or >1000mg/dose) and checks for missing caveats.
  - **Safer Alternative Note**: Generates actionable advice and safer alternative notes for flagged concerns.

## Package Layout

```
model/
├── api/
│   ├── __init__.py
│   └── routes.py         # /health, /v1/chunk, /v1/extract-claims, /v1/verify, /v1/audit routes
├── pipeline/
│   ├── __init__.py
│   ├── chunker.py        # Sentence-aware chunker with offset preservation
│   ├── claim_extractor.py # Decontextualized claim extraction & span aligner
│   ├── retriever.py      # Hybrid BM25 + dense embedding retriever with RRF
│   ├── nli.py            # Batched cross-encoder NLI scoring
│   ├── judge.py          # Evidence-constrained LLM judge
│   ├── verifier.py       # Verdict determination & error localization integration
│   ├── localizer.py      # Deterministic checkers, LLM fallback, offset mapping & error localization
│   ├── ambiguity.py      # Vague quantifiers, hedges, unresolved pronouns & subjectivity detector
│   ├── reasoning.py      # Argument extraction, non sequitur, contradiction & circular reasoning analysis
│   ├── safety.py         # Sensitive domain safety classification & dosage/caveat checking
│   ├── span_aligner.py   # Exact + fuzzy match span aligner
│   └── mock_fixture.py   # Deterministic mock AuditResult covering all 5 verdicts
├── llm/
│   ├── client.py         # LLMClient abstraction with retries & schema validation
│   ├── json_repair.py    # JSON markdown fence stripper and repair parser
│   └── providers.py      # Gemini, OpenAI, Anthropic, and Fake provider implementations
├── schemas/
│   ├── primitives.py     # Span, Source, etc.
│   ├── pipeline.py       # ChunkRequest, ExtractClaimsRequest, VerifyRequest
│   ├── request.py        # AuditRequest
│   ├── result.py         # AuditResult, Claim, ReasoningIssue, SafetyFlag, OverallScore
│   └── error.py          # ErrorResponse, ErrorDetail
├── tests/
│   ├── test_health.py
│   ├── test_chunker.py
│   ├── test_claim_extractor.py
│   ├── test_span_aligner.py
│   ├── test_retriever.py
│   ├── test_nli.py
│   └── test_verifier.py
├── .env.example
├── config.py             # Configuration via pydantic-settings
├── Dockerfile
└── requirements.txt
```

## Setup & Running

### Local Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run pytest suite:
   ```bash
   pytest
   ```

4. Run FastAPI server with Uvicorn:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## API Endpoints

- `GET /health` -> Liveness probe.
- `POST /v1/chunk` -> Splits source document text into sentence-aware overlapping chunks.
- `POST /v1/extract-claims` -> Extracts atomic, self-contained claims from an answer string.
- `POST /v1/verify` -> Verifies a single extracted claim against provided source documentation.
- `POST /v1/audit` -> Full end-to-end audit execution.
