const BASE_URL = '/api'
const TOKEN_KEY = 'mathia-auth-token'

let authToken: string | null = localStorage.getItem(TOKEN_KEY)

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length !== 2) return null
  return parts.pop()?.split(';').shift() || null
}

function persistToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function setAuthToken(token: string | null) {
  authToken = token
  persistToken(token)
}

export function getAuthToken(): string | null {
  return authToken
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch('/auth/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  const data = await res.json()
  setAuthToken(data.token)
  return data.token
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (authToken) {
    headers['Authorization'] = `Token ${authToken}`
  }
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method) && !headers['X-CSRFToken']) {
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401 || res.status === 403) {
    setAuthToken(null)
    const text = await res.text()
    throw new Error(text || 'Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `API error: ${res.status} ${res.statusText}`)
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function accountsRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  }

  if (authToken) {
    headers['Authorization'] = `Token ${authToken}`
  }

  const res = await fetch(`/accounts${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 302 || res.redirected) {
    setAuthToken(null)
    throw new Error('Unauthorized — redirect to login')
  }

  if (res.status === 401 || res.status === 403) {
    setAuthToken(null)
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text()
    if (text.startsWith('{')) {
      return JSON.parse(text) as T
    }
    throw new Error(`API error: ${res.status}`)
  }

  return res.json()
}

// Hits the chatbot URL group directly (Django mounts chatbot at /chatbot/, NOT
// /api/chatbot/). Mirrors apiRequest but with the right base — using apiRequest
// would produce /api/chatbot/api/... which 404s. Pass paths beginning with "/".
export async function chatbotApiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (authToken) {
    headers['Authorization'] = `Token ${authToken}`
  }
  const res = await fetch(`/chatbot${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 302 || res.redirected) {
    setAuthToken(null)
    throw new Error('Unauthorized — redirect to login')
  }
  if (res.status === 401 || res.status === 403) {
    setAuthToken(null)
    throw new Error('Unauthorized')
  }
  if (res.status === 204) {
    return undefined as unknown as T
  }
  if (!res.ok) {
    throw new Error(`Chatbot API error: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
