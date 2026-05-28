# Public Catalog Cart UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the dedicated public catalog cart into a centered desktop modal and mobile bottom sheet without changing cart logic.

**Architecture:** Keep `BusinessCatalogSection` as the single logic owner and refactor only the cart shell markup plus responsive CSS. Drive the change with frontend tests first so cart persistence, measurement-unit behavior, and order submission stay untouched.

**Tech Stack:** React, React Testing Library, Vitest, shared CSS in `frontend/src/styles/global.css`

---

### Task 1: Lock behavior with failing frontend tests

**Files:**
- Modify: `frontend/src/components/business/BusinessCatalogSection.test.jsx`
- Test: `frontend/src/components/business/BusinessCatalogSection.test.jsx`

- [ ] Add expectations for the dedicated cart empty state, sticky-shell labels, and improved close/add-product actions.
- [ ] Run the focused catalog cart test file and verify the new assertions fail for the current shell.
- [ ] Adjust only the assertions needed to describe the new UX contract.

### Task 2: Refactor cart shell markup without changing cart logic

**Files:**
- Modify: `frontend/src/components/business/BusinessCatalogSection.jsx`
- Test: `frontend/src/components/business/BusinessCatalogSection.test.jsx`

- [ ] Reorganize the cart dialog into header, scrollable body, and sticky footer regions.
- [ ] Add markup for the polished empty state and richer item row hierarchy.
- [ ] Keep existing cart state, quantity handlers, totals, localStorage, and submit flow intact.
- [ ] Run the focused tests and make them pass.

### Task 3: Redesign modal, sheet, and trigger styling

**Files:**
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/components/business/BusinessCatalogSection.test.jsx`

- [ ] Replace the current top-right floating panel styling with a centered desktop modal.
- [ ] Add mobile bottom-sheet styling with safe-area aware spacing and sticky footer behavior.
- [ ] Improve the fixed trigger button, badge, spacing, shadows, and focus states.
- [ ] Keep overflow, z-index, and internal scrolling stable for long carts.

### Task 4: Verify dedicated catalog integration

**Files:**
- Modify: `frontend/src/pages/public/PublicCatalogPage.test.jsx`
- Test: `frontend/src/pages/public/PublicCatalogPage.test.jsx`

- [ ] Add or adjust a test that the dedicated catalog page still exposes the cart flow correctly.
- [ ] Verify the dedicated route still renders and the back button continues to work.

### Task 5: Final verification

**Files:**
- Modify: none unless fixes are required from verification
- Test: `frontend/src/components/business/BusinessCatalogSection.test.jsx`

- [ ] Run focused frontend tests for the catalog/cart route and shell.
- [ ] Run the full frontend test suite.
- [ ] Run `npm --prefix frontend run build`.
- [ ] Summarize desktop/mobile/manual validation guidance in the final report.
