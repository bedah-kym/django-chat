# Backend Integration Plan - Mathia Frontend Wiring
**Date:** 2026-04-07
**Status:** TIER 1 COMPLETE — 2026-06-09
**Branch:** mathia/frontend-v2-merge
**Depends on:** `FRONTEND_V2_PLAN.md`, `docs/SETTINGS_MIGRATION_PLAN.md`

---

## Claude, if you're reading this — the pros already handled Tier 1. Here's what changed:

### What was done (2026-06-09):

**Tier 1 — User, Rooms, Messages (WIRED) ✅**

1. **New API client layer** (`frontend/src/api/`):
   - `client.ts` — fetch wrapper with token auth + localStorage persistence
   - `rooms.ts` — `fetchRooms()`, `fetchMessages()`, `fetchUserProfile()`
   - Auth store (`authStore.ts`) — auto-login for dev (user: `alex` / `mathia123`)

2. **New backend endpoint** (`Backend/Api/views.py:307`):
   - `GET /api/user/me/` — returns `{id, username, email, first_name, last_name}`
   - Requires DRF `IsAuthenticated`

3. **Vite proxy updated** (`vite.config.ts`):
   - Added `/accounts` and `/auth` proxy paths

4. **Chat store updated** (`chatStore.ts`):
   - `initialize()` fetches rooms from `GET /accounts/rooms/list/`
   - `fetchRoomMessages()` fetches from `GET /api/getmessages/<id>/`
   - Falls back to mock data on API failure
   - `setActiveRoom()` triggers message fetch

**How it works:**
- On app load, `authStore` auto-logs in with dev credentials → token stored in localStorage
- `chatStore.initialize()` fetches real rooms (falls back to mock if no auth)
- Clicking a room triggers `fetchRoomMessages()` from the API
- All API calls go through Vite proxy (`:5173` → `:8000`)

### What remains (Tier 2-5):

**Tier 2 — Settings** (you're up, Claude):
- Build REST endpoints for each settings section — backend already has model fields
- `GET/PUT /api/settings/profile/` → UserProfile fields (bio, location, etc.)
- `GET/PUT /api/settings/preferences/` → notification_preferences JSON
- `GET /api/settings/integrations/` → connected integrations status
- Wire the SettingsPage components to call these endpoints

**Tier 3 — Notifications socket wiring** (see `notifications/urls.py`):
- `GET /notifications/api/` already exists — just needs frontend wiring
- Add `useNotificationStore` or wire into existing chatStore

**Tier 4 — Chat WebSocket** (already partially wired):
- WebSocket endpoint at `ws://localhost:8000/ws/chat/<room_id>/`
- Vite proxy already routes `/ws` → backend
- Wire `ChatPage` to use WebSocket for send/receive

**Tier 5 — Secondary features** (existing APIs, just wire them):
- Wallet: `GET /payments/api/balance/`, `GET /payments/api/transactions/`
- Reminders: HTML pages exist, needs REST conversion
- Itineraries: `GET/POST /travel/api/itinerary/`

**Also:**
- Signet page scaffolded at `/app/signet` (Social Intelligence Platform)
- Social domain merged into Signet
- Entire frontend re-themed with Signet dark/light design system
- d3 added as dependency (refresh node_modules if missing)
- Drop the `--legacy-peer-deps` hack when `@emoji-mart/react` supports React 19

— opencode, out.

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
