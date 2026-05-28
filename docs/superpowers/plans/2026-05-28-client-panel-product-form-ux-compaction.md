# Client Panel Product Form UX Compaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the visual height of the catalog product form in the client panel by collapsing the create form and compacting the product form layout in client mode.

**Architecture:** Reuse `TenantModuleManagementSection` as the single implementation point, adding client-mode-only layout behavior and a collapsed create-form state. Keep all product, upload, and permission logic intact.

**Tech Stack:** React, Vitest, React Testing Library, shared dashboard CSS

---

### Task 1: Lock the new client-mode behavior in tests

**Files:**
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.test.jsx`
- Modify: `frontend/src/pages/panel/ClientPanelPage.test.jsx`

- [ ] Add a failing test for collapsed-by-default product creation in client mode.
- [ ] Add assertions for open, cancel, and save product actions.
- [ ] Keep read-only level coverage intact.

### Task 2: Add collapsed create-form state in client mode

**Files:**
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.jsx`

- [ ] Add a client-mode-only toggle for the new product form.
- [ ] Keep admin mode behavior unchanged.
- [ ] Collapse the form again after a successful create.

### Task 3: Compact the product form and product cards

**Files:**
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.jsx`
- Modify: `frontend/src/styles/global.css`

- [ ] Split the product form into denser grouped rows.
- [ ] Reduce spacing, textarea height, and upload footprint in client mode.
- [ ] Keep action buttons close to the fields in both create and edit flows.

### Task 4: Final verification

**Files:**
- Modify: none unless verification reveals regressions

- [ ] Run `npm --prefix frontend run test`
- [ ] Run `npm --prefix frontend run build`
- [ ] Summarize whether admin mode changed materially.
