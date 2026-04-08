# Backend Integration Plan - Kazi Frontend Wiring
**Date:** 2026-04-07
**Status:** DRAFT - Pending QA
**Branch:** frontend-v2
**Depends on:** `FRONTEND_V2_PLAN.md`, `docs/SETTINGS_MIGRATION_PLAN.md`

---

## Context

The React frontend UI is largely built. Most pages are complete visually but still talk to mock data.
This plan covers the backend API work needed to make the SPA functional.

Current route assumptions:
- Global entry: `/app/home`
- Security workspace: `/app/security/*`
- Business/Ops workspace: `/app/ops/*`
- Settings remains global at `/app/settings`

No new backend product features are required for this document. The goal remains to expose existing Django logic as JSON/real-time interfaces for the SPA.

---

## Key Alignment Notes

- Room APIs should support frontend domain scoping. Security rooms are rendered inside the Security workspace, Ops rooms inside Business/Ops.
- Existing wallet, reminders, invoices, and travel endpoints should map to routes under `/app/ops/*`.
- Pentest and bug bounty data should map to routes under `/app/security/*`.
- Gmail OAuth should still redirect back to `/app/settings`.

---

## API Priorities

### Tier 1 - Foundation
- `GET /api/user/me/`
- `GET /api/rooms/`
- `POST /api/rooms/`
- `GET /api/rooms/:id/`
- `GET /api/rooms/:id/messages/`

### Tier 2 - Settings
- profile, capabilities, notifications, workspace, invites, integrations

### Tier 3 - Notifications
- list/read/read-all/dismiss
- frontend notification socket wiring

### Tier 4 - Core Chat
- room WebSocket send/receive wiring
- file upload support

### Tier 5 - Secondary features
- reminders
- wallet/transactions/invoices
- itineraries

---

## Frontend Expectations

The current frontend expects:
- domain-aware room lists
- domain-nested chat URLs
- security engagement/workflow/finding/report mock shapes to be replaced with real data
- ops wallet/invoice/travel links to remain under the Ops domain

When wiring endpoints, keep the existing SPA route structure intact rather than reintroducing flat global feature paths.

---

## Build Order

1. Room/user foundation APIs
2. Settings/integrations APIs
3. Notifications APIs and frontend socket wiring
4. Chat send/receive wiring
5. Security data wiring for pentest + bug bounty
6. Ops data wiring for wallet, reminders, travel

---

## QA Focus

- All responses require authenticated access
- Settings JSON writes deep-merge shared preference blobs safely
- Integrations return JSON for SPA flows
- Room payloads support frontend unread counts and domain-aware rendering
- Security and Ops pages can fully hydrate without mock data
