# Structured Workflow Output Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while implementing each task.

**Goal:** Upgrade workflow output variables to stable structured selectors with Dify-inspired editing, validation, ordering, canvas summaries, nested value resolution, and backward compatibility.

**Architecture:** The web normalizes both legacy `value` strings and new `valueSelector` arrays into one `OutputVariable` model and always persists the new model. The API accepts both forms during migration, validates structured selectors against reachable node outputs, and resolves nested paths without flattening structured values. Existing workflow and run response contracts remain compatible.

**Tech Stack:** React 19, TypeScript, Vitest, FastAPI/Pydantic, pytest, LangGraph.

---

### Task 1: Structured selector normalization

**Files:**
- Modify: `apps/web/src/features/workflows/workflowVariables.ts`
- Test: `apps/web/src/features/workflows/workflowVariables.test.ts`

- [ ] Add failing tests for legacy migration, structured selectors, type preservation, identifier validation, and nested selectors.
- [ ] Run the focused Vitest file and confirm the new assertions fail for missing behavior.
- [ ] Implement normalization and validation helpers with legacy `value` fallback.
- [ ] Re-run the focused test and keep the existing cases green.

### Task 2: Dify-inspired output editor and canvas summary

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx`
- Modify: `apps/web/src/styles/globals.css`
- Test: `apps/web/src/features/workflows/WorkflowPage.test.tsx`

- [ ] Add failing interaction tests for grouped selectors, automatic output names, inline validation, reordering, structured persistence, and readable canvas labels.
- [ ] Run the focused component tests and confirm failures are caused by missing behavior.
- [ ] Implement grouped variable selection, automatic unique naming, row reordering, inline validation, and compact canvas summaries.
- [ ] Re-run component tests and refactor only after green.

### Task 3: API compatibility, validation, and nested resolution

**Files:**
- Modify: `apps/api/app/modules/workflow/node_registry.py`
- Modify: `apps/api/app/modules/workflow/graph_validator.py`
- Test: `apps/api/tests/test_workflow_node_registry.py`
- Test: `apps/api/tests/test_workflow_graph_validator.py`

- [ ] Add failing pytest cases for structured selectors, legacy selectors, nested object traversal, type metadata, and malformed selector rejection.
- [ ] Run the focused pytest files and confirm the new tests fail for the intended reasons.
- [ ] Implement a shared selector reader in each API boundary, nested path resolution, and backward-compatible validation.
- [ ] Re-run the focused pytest files and keep legacy coverage green.

### Task 4: Verification

**Files:**
- Verify all files touched above.

- [ ] Run focused frontend and backend tests.
- [ ] Run frontend typecheck and build.
- [ ] Run the complete available API suite after ensuring project dependencies are installed.
- [ ] Review `git diff` to confirm unrelated user changes remain untouched.
