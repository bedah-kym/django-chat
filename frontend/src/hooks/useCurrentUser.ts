import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const username = useAuthStore((s) => s.username)
  const email = useAuthStore((s) => s.email)
  const displayName = useAuthStore((s) => s.displayName)
  const avatarUrl = useAuthStore((s) => s.avatarUrl)
  const isLoading = useAuthStore((s) => s.isLoading)
  const login = useAuthStore((s) => s.login)
  const fetchUserProfile = useAuthStore((s) => s.fetchUserProfile)

  useEffect(() => {
    if (!isAuthenticated) {
      login('alex', 'mathia123').catch(() => {})
    } else if (!displayName) {
      fetchUserProfile()
    }
  }, [])

  return {
    isAuthenticated,
    username,
    email,
    displayName,
    avatarUrl,
    isLoading,
  }
}
