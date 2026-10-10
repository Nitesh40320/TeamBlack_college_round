# Second Opinion — Frontend Web Application

React + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query web client for the Second Opinion AI audit platform.

## Features

- **New Audit Page (`/new`)**:
  - **Large Answer Input**: Textarea with real-time character counter (`X / 50,000 chars`).
  - **Optional Question Prompt**: Field to provide original user prompt context.
  - **Multi-Source Panel**: Drag-and-drop or file upload support for `.txt`, `.md`, `.pdf`, `.docx`, plus direct paste input.
  - **Removable Source Cards**: Each source card features title editing, character counts, editable/expandable text, and quick deletion.
  - **Load Sample Data**: One-click filling of realistic example containing deliberate errors (Aspirin dosage mismatch, cardiovascular claim contradiction, hallucinated ancient history, antipyretics opinion).
  - **Client-Side Validation**: Immediate inline error feedback for missing required fields, empty sources, and character/source limits.
  - **TanStack Query Mutation**: Handles background submission, loading states, and automatic redirection to `/audit/:id`.
- **Audit Detail Page (`/audit/:id`)**:
  - **Annotated Answer & Source Text Split View**:
    - **Inline Answer Highlights**: Full AI answer rendered with interactive inline highlights at exact `errorSpan`s (falling back to `answerSpan` for non-error claims). Styled by verdict using dual-signal color and underline styling (wavy red for `CONTRADICTED`, dashed amber for `UNSUPPORTED`, dotted purple for `AMBIGUOUS`, dotted gray for `UNVERIFIABLE`, solid emerald for `SUPPORTED`).
    - **Hover Tooltip & Keyboard Accessibility**: Hovering or focusing (`Tab`) any highlight displays a popover with verdict badge, error category, and rationale. Fully accessible with `Enter` or `Space` key interaction.
    - **Simultaneous Cross-Pane Highlighting**: Selecting any claim highlights its span in the AI answer (left pane) and its linked evidence span in the source viewer (right pane) simultaneously with tab switching.
    - **Legend, Filters & Problem Toggle**: Legend explaining underline styles, filter chips by verdict and category, and a "Show only problems" toggle for focusing on error claims.
    - **Deterministic Overlap Resolution**: Uses `segmentAnswerSpans` utility with Verdict Severity Ranking (`CONTRADICTED` > `UNSUPPORTED` > `AMBIGUOUS` > `UNVERIFIABLE` > `SUPPORTED`) to handle overlapping spans smoothly.
  - **Pipeline Status Stepper**: Visual step progress (`Queued` → `Extracting` → `Verifying` → `Analyzing` → `Done`) polling with TanStack Query until completed, showing "claims verified x/y" live status.
  - **Claims List with Filter & Sort**: Table/card view showing verdict badges (color + icon + text), claim text, claim type, evidence count, and answer span. Filter chips per verdict (`All`, `SUPPORTED`, `CONTRADICTED`, `UNSUPPORTED`, `UNVERIFIABLE`, `AMBIGUOUS`) and severity sorting (`CONTRADICTED` > `UNSUPPORTED` > `AMBIGUOUS` > `UNVERIFIABLE` > `SUPPORTED`).
  - **Claim Detail Drawer**: Slide-over inspector showing claim text, verdict badge, explanation, and evidence passages grouped into 🟢 **Supports**, 🔴 **Contradicts**, and 🔵 **Related**, each with source title, score, and matched passage highlighting.
  - **Source Viewer Panel**: Tabbed panel per source document. Clicking "View in Source text" from any evidence passage switches tabs and smoothly scrolls to & highlights its exact character span in the source text.
  - **Rerun & Failed Handling**: Integrated retry button calling `rerunAudit` mutation when jobs fail or require re-evaluation.
- **Dual-Signal Verdict System**: `verdictTokens.ts` mapping all 5 verdicts (`SUPPORTED`, `CONTRADICTED`, `UNSUPPORTED`, `UNVERIFIABLE`, `AMBIGUOUS`) to distinct color schemes + Lucide icons.
- **Mock & Backend Compatibility**: Seamless fallback caching engine allowing standalone evaluation without a running backend, and direct API communication when live.

## Getting Started

### Installation

```bash
cd frontend
npm install
```

### Local Development

```bash
npm run dev
```

The application will start at `http://localhost:3000`.

### Running Tests

```bash
npm run test
```

### Production Build

```bash
npm run build
```

## Manual Verification Steps

1. Open `/new` in your browser or navigate to `/audit/a1b2c3d4-e5f6-7890-abcd-ef1234567890`.
2. Inspect the **Annotated Answer & Source Text Split View** on the audit detail page.
3. Hover over highlighted spans in the left pane (AI Answer text) to view the popover with verdict badge, error category, and rationale explanation.
4. Press `Tab` to navigate through highlights using keyboard, and press `Enter` to select a claim.
5. Confirm that selecting a claim highlights both the answer error span on the left and the linked source evidence span on the right simultaneously.
6. Toggle **"Show only problems"** and filter by verdict chips to verify real-time highlight filtering.
7. Test the **Verdict Filter Chips** and severity sorting (`Highest Severity First`) on the claims table below.
8. Click on any claim card to open the **Claim Detail Drawer**. Verify the evidence passages grouped into **Supports**, **Contradicts**, and **Related**.
9. Click **"Rerun Audit"** to verify that the pipeline resets to `queued` and re-polls until completion.
