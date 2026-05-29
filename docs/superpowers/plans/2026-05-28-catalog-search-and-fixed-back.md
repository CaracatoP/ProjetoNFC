# Catalog Search And Fixed Back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar busca local ao catalogo publico e ao painel de produtos, alem de fixar o botao de voltar da pagina dedicada do catalogo.

**Architecture:** A busca fica 100% no frontend, reaproveitando os produtos ja carregados e filtrando em memoria. O botao de voltar continua em `PublicCatalogPage`, enquanto a logica de filtro publico mora em `BusinessCatalogSection` e a do painel na aba de catalogo de `TenantModuleManagementSection`.

**Tech Stack:** React, React Router, Vitest, Testing Library, CSS global existente.

---

### Task 1: Cover The New UX With Failing Tests

**Files:**
- Modify: `frontend/src/pages/public/PublicCatalogPage.test.jsx`
- Modify: `frontend/src/components/business/BusinessCatalogSection.test.jsx`
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.test.jsx`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the focused frontend tests and confirm red**
- [ ] **Step 3: Implement the minimum UI and filter logic**
- [ ] **Step 4: Re-run the focused tests and confirm green**

### Task 2: Polish Layout And Search States

**Files:**
- Modify: `frontend/src/pages/public/PublicCatalogPage.jsx`
- Modify: `frontend/src/components/business/BusinessCatalogSection.jsx`
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.jsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Add the fixed back button and public search shell**
- [ ] **Step 2: Add panel search and empty-search states**
- [ ] **Step 3: Adjust spacing and fixed positioning in CSS**
- [ ] **Step 4: Verify preview query params and cart trigger coexistence**

### Task 3: Full Verification

**Files:**
- Modify: `frontend/src/pages/public/PublicCatalogPage.test.jsx`
- Modify: `frontend/src/components/business/BusinessCatalogSection.test.jsx`
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.test.jsx`

- [ ] **Step 1: Run `npm --prefix frontend run test`**
- [ ] **Step 2: Run `npm --prefix frontend run build`**
- [ ] **Step 3: Summarize manual validation points for catalog and panel**
