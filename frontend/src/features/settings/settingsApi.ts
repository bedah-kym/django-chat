import { getAuthToken } from '@/api/client'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

// CSRF helper — Django's CsrfViewMiddleware requires X-CSRFToken on
// unsafe-method requests when the user is authenticated via session
// cookie. Read the csrftoken cookie set by Django and echo it back.
function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

// Auth headers for settings/account endpoints. Every Settings endpoint
// is now DRF token-authenticated, so we MUST send Authorization: Token;
// CSRF is also echoed for any view still routed through session auth.
function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  const headers: Record<string, string> = { 'X-CSRFToken': getCsrfToken() }
  if (token) headers['Authorization'] = `Token ${token}`
  return headers
}

// Back-compat alias for the (many) callsites in this file.
function csrfHeaders(): Record<string, string> {
  return authHeaders()
}

// ─── REAL: Avatar Upload ──────────────────────────────────────────────────────
export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('avatar', file)
  const res = await fetch(`${BASE}/accounts/avatar/upload/`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: csrfHeaders(),
  })
  if (!res.ok) throw new Error('Avatar upload failed')
  return res.json() as Promise<{ url: string }>
}

// ─── REAL: Calendly ───────────────────────────────────────────────────────────
export async function getCalendlyStatus(): Promise<{ connected: boolean; username?: string }> {
  const res = await fetch(`${BASE}/api/calendly/user/status/`, { credentials: 'include', headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to get Calendly status')
  return res.json() as Promise<{ connected: boolean; username?: string }>
}

export async function connectCalendly(): Promise<{ authorization_url: string }> {
  const res = await fetch(`${BASE}/api/calendly/connect/`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfHeaders(),
  })
  if (!res.ok) throw new Error('Failed to initiate Calendly connect')
  return res.json() as Promise<{ authorization_url: string }>
}

export async function disconnectCalendly(): Promise<void> {
  const res = await fetch(`${BASE}/api/calendly/disconnect/`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfHeaders(),
  })
  if (!res.ok) throw new Error('Failed to disconnect Calendly')
}

export interface CalendlyEvent {
  title: string
  start: string
  end: string
  uri?: string
  status?: string
  invitee?: string | null
}

export async function fetchCalendlyEvents(): Promise<{ events: CalendlyEvent[]; error?: string }> {
  const res = await fetch(`${BASE}/api/calendly/user/events/`, {
    credentials: 'include',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch Calendly events')
  return res.json()
}

export interface CalendlyEventType {
  uri: string
  name: string
  slug?: string
  scheduling_url: string
  duration?: number
  kind?: string
  active?: boolean
  selected?: boolean
}

export async function fetchCalendlyEventTypes(): Promise<{
  event_types: CalendlyEventType[]
  selected_uri?: string | null
  booking_link?: string | null
  error?: string
}> {
  const res = await fetch(`${BASE}/api/calendly/event-types/`, {
    credentials: 'include',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch Calendly event types')
  return res.json()
}

export async function setCalendlyEventType(
  eventTypeUri: string,
  eventTypeName?: string,
  bookingLink?: string,
): Promise<{ ok: boolean; event_type_uri: string; event_type_name?: string; booking_link?: string }> {
  const res = await fetch(`${BASE}/api/calendly/set-event-type/`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type_uri: eventTypeUri, event_type_name: eventTypeName, booking_link: bookingLink }),
  })
  if (!res.ok) throw new Error('Failed to set Calendly event type')
  return res.json()
}

// ─── REAL: Gmail ──────────────────────────────────────────────────────────────
export async function connectGmail(): Promise<{ authorization_url: string }> {
  const res = await fetch(`${BASE}/api/gmail/connect/`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfHeaders(),
  })
  if (!res.ok) throw new Error('Failed to initiate Gmail connect')
  return res.json() as Promise<{ authorization_url: string }>
}

// ─── STUBBED: Profile ─────────────────────────────────────────────────────────
// TODO: PATCH /api/users/profile/
export async function updateProfile(_data: unknown): Promise<void> {
  await new Promise(r => setTimeout(r, 400))
}

// ─── STUBBED: Capabilities ───────────────────────────────────────────────────
// TODO: PATCH /api/users/capabilities/
export async function updateCapabilities(_data: unknown): Promise<void> {
  await new Promise(r => setTimeout(r, 400))
}

// ─── STUBBED: Notification Prefs ─────────────────────────────────────────────
// TODO: PATCH /api/users/notifications/
export async function updateNotificationPrefs(_data: unknown): Promise<void> {
  await new Promise(r => setTimeout(r, 400))
}

// ─── STUBBED: Integrations ────────────────────────────────────────────────────
// TODO: POST /api/integrations/:type/
export async function connectIntegration(_type: string, _creds: unknown): Promise<void> {
  await new Promise(r => setTimeout(r, 600))
}

// TODO: DELETE /api/integrations/:type/
export async function disconnectIntegration(_type: string): Promise<void> {
  await new Promise(r => setTimeout(r, 400))
}

// ─── STUBBED: Workspace ───────────────────────────────────────────────────────
// TODO: PATCH /api/workspace/
export async function updateWorkspace(_data: unknown): Promise<void> {
  await new Promise(r => setTimeout(r, 400))
}

// ─── STUBBED: Invites ─────────────────────────────────────────────────────────
// TODO: POST /api/invites/
export async function sendInvite(_email: string): Promise<void> {
  await new Promise(r => setTimeout(r, 500))
}
