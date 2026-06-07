const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

// CSRF helper — Django's CsrfViewMiddleware requires X-CSRFToken on
// unsafe-method requests when the user is authenticated via session
// cookie. Read the csrftoken cookie set by Django and echo it back.
function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function csrfHeaders(): Record<string, string> {
  return { 'X-CSRFToken': getCsrfToken() }
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
  const res = await fetch(`${BASE}/api/calendly/user/status/`, { credentials: 'include' })
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
