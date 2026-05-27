# Segment Modules Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the current segment/modules MVP with inline module image uploads, category-aware catalog rendering, persistent public cart behavior, richer admin inboxes, and explicitly scoped multi-tenant mutation routes without changing the underlying tenant/module architecture.

**Architecture:** Reuse the existing admin upload route and module service layer, keep `Product.image` and `Professional.avatar` as final URL fields, and shift module mutations to `businessId`-scoped admin routes enforced by service-level ownership checks. Keep admin/public improvements local to the current editor and public module components, deriving grouping, filters, and category suggestions from the current payload instead of adding global state or new top-level tenant fields.

**Tech Stack:** Node.js, Express, MongoDB/Mongoose, React, Vitest, Cloudinary admin upload pipeline, shared utilities.

---

## Implementation Outline

- [ ] Add failing backend tests for scoped module mutations, ownership isolation, and image-upload-backed product/professional persistence.
- [ ] Add failing frontend tests for inline module image fields, cart localStorage behavior, category grouping, and admin inbox filtering/status flows.
- [ ] Implement scoped backend admin module routes plus compatibility handling for legacy routes with enforced ownership checks.
- [ ] Add reusable inline module image upload UI and wire it into product/professional forms using the existing admin upload service.
- [ ] Harden public catalog/cart behavior with per-slug localStorage persistence, grouped categories, validation, and clear-after-submit.
- [ ] Improve admin orders/appointments inbox UX with derived grouping, filters, empty states, loading, and error feedback.
- [ ] Run targeted suites, full frontend/backend suites, and frontend production build.
