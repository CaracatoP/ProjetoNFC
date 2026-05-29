# Client Panel Collapsible Sections And Order Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the client panel easier to operate by adding collapsible sections for basic settings, catalog products, and order status groups, plus soft-delete archiving for orders with inline double confirmation.

**Architecture:** Keep the admin experience largely unchanged by gating the new collapse behavior to `mode="client"`. Add the smallest backend slice needed for order archiving by introducing an `archivedAt` marker, excluding archived orders from normal listings, and enforcing permission plus `businessId` ownership in the client-panel route.

**Tech Stack:** React, Vitest, React Testing Library, Node.js, Express, MongoDB/Mongoose

---

### Task 1: Lock the new client-panel UX in failing frontend tests

**Files:**
- Modify: `frontend/src/pages/panel/ClientPanelPage.test.jsx`
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.test.jsx`

- [ ] Add a failing test for minimizing and expanding `Configuracoes basicas` in client mode.
- [ ] Add a failing test for minimizing and expanding `Produtos cadastrados` in client mode.
- [ ] Add a failing test for client-mode order groups starting with `Recebidos` open and secondary groups closed.
- [ ] Add a failing test for inline double confirmation before archiving a pedido.

### Task 2: Lock soft-delete order behavior in failing backend tests

**Files:**
- Modify: `backend/src/routes/clientPanelRoutes.test.js`

- [ ] Add a failing test for archiving a pedido from the authenticated tenant.
- [ ] Add a failing test proving archived pedidos disappear from the normal panel order list.
- [ ] Add a failing test for cross-tenant archive attempts returning forbidden/not found.
- [ ] Add a failing test for a session without order-management permission being blocked.

### Task 3: Implement backend soft-delete archiving for orders

**Files:**
- Modify: `backend/src/models/Order.js`
- Modify: `backend/src/repositories/orderRepository.js`
- Modify: `backend/src/services/moduleService.js`
- Modify: `backend/src/services/clientPanelService.js`
- Modify: `backend/src/controllers/clientPanelController.js`
- Modify: `backend/src/routes/clientPanelRoutes.js`

- [ ] Add `archivedAt` to the order model with safe serializer behavior for legacy orders.
- [ ] Exclude archived orders from default list queries.
- [ ] Add repository/service helpers to archive by `businessId` instead of hard-deleting.
- [ ] Add `DELETE /api/panel/orders/:id` guarded by existing session permissions and ownership checks.

### Task 4: Implement collapsible client-only panel sections and archive confirmation

**Files:**
- Modify: `frontend/src/pages/panel/ClientPanelPage.jsx`
- Modify: `frontend/src/components/business/editor/TenantModuleManagementSection.jsx`
- Modify: `frontend/src/services/clientPanelService.js`
- Modify: `frontend/src/styles/global.css`

- [ ] Add client-mode collapse state to `BasicSettingsCard` without changing admin mode flow.
- [ ] Add a collapsible `Produtos cadastrados` block in catalog client mode.
- [ ] Add collapsible order status groups in client mode, defaulting to `Recebidos` open and others closed.
- [ ] Add inline double confirmation and archive action wiring for pedidos.

### Task 5: Final verification

**Files:**
- Modify: none unless verification reveals regressions

- [ ] Run `npm --prefix backend run test -- src/routes/clientPanelRoutes.test.js`
- [ ] Run `npm --prefix frontend run test -- src/pages/panel/ClientPanelPage.test.jsx src/components/business/editor/TenantModuleManagementSection.test.jsx`
- [ ] Run `npm --prefix frontend run test`
- [ ] Run `npm --prefix backend run test`
- [ ] Run `npm --prefix frontend run build`
