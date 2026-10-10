# Second Opinion — Frontend Web Application

React 18 + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query web application for **Second Opinion**, the AI-answer auditing platform.

---

## 📸 Interface Screenshots

> **Landing & Overview Page**  
> ![Landing Page Overview](docs/screenshots/landing_page.png)

> **Annotated Answer & Source Text Split View**  
> ![Audit Detail Split View](docs/screenshots/audit_detail.png)

> **Interactive Reasoning Fallacy Graph**  
> ![Reasoning Graph View](docs/screenshots/reasoning_graph.png)

> **Model Evaluation & Calibration Dashboard**  
> ![Evaluation Benchmark Dashboard](docs/screenshots/evaluation.png)

---

## 🚀 Key Features

### 1. Landing & Overview Page (`/`)
- **One-Click Demo Audit**: Quick launch buttons (`Acme Financial Report`, `Pediatric Ibuprofen Dosage`, `Speed of Light Physics`) loading pre-seeded audit examples directly.
- **Platform Capability Showcase**: Highlights fact verification, reasoning fallacy graph, domain safety guardrails, and confidence calibration.

### 2. New Audit Creation (`/new`)
- **Rich Input Editor**: AI Answer textarea with live character counter (`X / 50,000 chars`) and optional Question prompt.
- **Multi-Source Upload Panel**: File dropzone supporting `.txt`, `.md`, `.pdf`, `.docx`, and direct text paste.
- **Pre-populated Sample Case**: One-click sample filler with realistic medical, financial, and historical claim errors.

### 3. Audit Report Inspector (`/audit/:id`)
- **Server-Sent Events (SSE) Live Stream**: Real-time stage progress updates (`Queued` → `Extracting` → `Verifying` → `Analyzing` → `Completed`) with automatic polling fallback.
- **Safety Banner**: Prominent severity-colored warnings for medical, financial, or legal hazard claims with safer recommended alternatives.
- **Overall Assessment Card**: Grade gauge (A/B/C/D/F), 0-100 score, stacked verdict count bar, and top 3 critical issues.
- **Annotated Answer & Source Text Split View**: Synchronized dual-pane highlighting. Hovering/focusing highlights displays popovers with verdict rationale.
- **Reasoning Graph View**: Interactive argument flow graph (claims as nodes, premise → conclusion edges, broken inferences, and contradiction links).
- **Claim Detail Drawer**: Slide-over inspector grouping evidence into 🟢 **Supports**, 🔴 **Contradicts**, and 🔵 **Related**.
- **Human Feedback**: Thumbs up / thumbs down voting on individual claims, reasoning issues, and safety flags.
- **Multi-Format Export & Sharing**: One-click downloads for Markdown (`.md`), PDF (`.pdf`), and JSON (`.json`) plus copy-link action with toast notification.

### 4. Audit History (`/history`)
- **Searchable, Filterable & Sortable**: Search answer text (`q`), filter by grade (`A`–`F`), verdict presence, and safety hazards.
- **Pagination & Management**: Paginated table with grade chips, verdict count summary, safety indicators, and quick delete.

### 5. Model Evaluation Dashboard (`/evaluation`)
- **Macro F1 & Contradiction Precision**: Metrics breakdown across test splits.
- **Per-Verdict F1 Bar Chart**: Recharts bar chart showing Precision, Recall, and F1 across verdict categories.
- **Reliability Calibration Diagram**: Line chart plotting predicted confidence against empirical accuracy.

### 6. Accessibility & Responsiveness
- **Dark / Light Theme Toggle**: Persistent theme switcher in navigation layout.
- **Toast Notification System**: Instant feedback for copies, exports, and status changes.
- **ARIA & Keyboard Navigation**: Accessible focus management (`Tab`, `Enter`, `Space`) on claim highlights, tabs, and drawers.
- **Mobile Friendly**: Responsive sidebar drawer, collapsible topbar, and scrollable data tables.

---

## 🛠️ Getting Started

### Installation

```bash
cd frontend
npm install
```

### Local Development Server

```bash
npm run dev
```

App runs locally at `http://localhost:3000`.

### Unit Tests (Vitest)

```bash
npm run test
```

### End-to-End Tests (Playwright)

```bash
npm run test:e2e
```

### Production Build

```bash
npm run build
```

---

## 🧪 Playwright E2E Flow

1. **Submit Audit**: Navigates to `/new` and submits AI answer text with source documents.
2. **Inspect Claims**: Verifies redirection to `/audit/:id` and claim highlight projection.
3. **Open Drawer**: Clicks claim card to trigger slide-over evidence inspector.
4. **Export & Copy**: Verifies copy-link action and export endpoint triggers.
