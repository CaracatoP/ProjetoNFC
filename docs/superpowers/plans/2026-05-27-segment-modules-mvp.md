# Segment Modules MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant segments, default module presets, appointment-request MVP, and product/order MVP to the TapLink admin and public site without breaking existing multi-tenant CRUD, preview, upload, duplication, or public flows.

**Architecture:** Keep `Business` as the tenant source of truth, extend it with `segment`, `modules`, and `segmentConfig`, and expose those values through the existing editor/public payloads. Implement appointment and order data as isolated tenant-scoped collections with dedicated admin/public services, then surface them in the existing dashboard editor and public renderer through module-aware sections instead of creating a parallel app.

**Tech Stack:** Node.js, Express, MongoDB/Mongoose, React, Vitest, shared schema/constants utilities.

---

## Implementation Outline

- [ ] Extend shared constants, schemas, and tenant typing with segment/module contracts and segment presets.
- [ ] Add business persistence defaults and compatibility logic so legacy tenants resolve a valid segment and module map.
- [ ] Add appointment MVP models, repositories, services, validators, controllers, and routes scoped by tenant.
- [ ] Add product/order MVP models, repositories, services, validators, controllers, and routes scoped by tenant.
- [ ] Extend admin API responses to include segment/module data plus appointment/product/order snapshots where needed.
- [ ] Update onboarding, editor utilities, duplicate payload creation, and dashboard editor UI for segment and module controls.
- [ ] Add module-aware admin panels for professionals, services, products, orders, and appointment requests.
- [ ] Extend the public payload and renderer with catalog, loyalty, appointment request, and cart/order UI that only appears when the corresponding module is active.
- [ ] Cover legacy-tenant compatibility, deep-copy duplication, public behavior, and new CRUD flows with backend/frontend tests.
- [ ] Run targeted suites, full test suites, and frontend build.
