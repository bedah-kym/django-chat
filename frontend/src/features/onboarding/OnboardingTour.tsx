import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

export function OnboardingTour() {
  const tourSeen = useSettingsStore(s => s.tourSeen)
  const markTourSeen = useSettingsStore(s => s.markTourSeen)

  useEffect(() => {
    if (tourSeen) return

    const timer = setTimeout(() => {
      import('driver.js').then(({ driver }) => {
        const driverObj = driver({
          showProgress: true,
          animate: true,
          allowClose: true,
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          steps: [
            { element: '[data-tour="sidebar"]', popover: { title: 'Welcome to Kazi', description: 'Your workspace sidebar — navigate rooms, travel, wallet, and more.' } },
            { element: '[data-tour="room-list"]', popover: { title: 'Chat Rooms', description: 'Each room has team members and Mathia AI assistant.' } },
            { element: '[data-tour="chat-input"]', popover: { title: 'Start a Conversation', description: 'Type messages, use @mathia for AI, attach files, record voice, send emojis.' } },
            { element: '[data-tour="context-toggle"]', popover: { title: 'Context Panel', description: 'Contacts, notes, action history, and AI summaries for this room.' } },
            { element: '[data-tour="search-btn"]', popover: { title: 'Search Messages', description: 'Search conversation history with text and date filters. (Ctrl+F)' } },
            { element: '[data-tour="notifications"]', popover: { title: 'Notifications', description: 'Real-time updates for messages, payments, and reminders.' } },
            { element: '[data-tour="theme-toggle"]', popover: { title: 'Dark Mode', description: 'Toggle light/dark themes.' } },
            { popover: { title: 'You\'re All Set!', description: 'Explore your dashboard, chat with your team, and let Mathia help. Enjoy!' } },
          ],
          onDestroyed: () => markTourSeen(),
        })
        driverObj.drive()
      }).catch(() => {
        // driver.js not available, skip tour
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [tourSeen, markTourSeen])

  return null
}
