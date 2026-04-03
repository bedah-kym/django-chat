export const tourSteps = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Welcome to MATHIA',
      description: 'This is your workspace sidebar. Navigate between dashboard, travel, wallet, and more.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="room-list"]',
    popover: {
      title: 'Chat Rooms',
      description: 'Your rooms are here. Each room can have team members and Mathia AI assistant.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="chat-input"]',
    popover: {
      title: 'Start a Conversation',
      description: 'Type messages here. Use @mathia to invoke AI, attach files, record voice notes, or send emojis.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="context-toggle"]',
    popover: {
      title: 'Context Panel',
      description: 'Open the context panel to see contacts, notes, action history, and AI summaries for this room.',
      side: 'left' as const,
    },
  },
  {
    element: '[data-tour="search-btn"]',
    popover: {
      title: 'Search Messages',
      description: 'Search through your conversation history with text and date filters.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="notifications"]',
    popover: {
      title: 'Notifications',
      description: 'Stay updated with real-time notifications for messages, payments, and reminders.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="theme-toggle"]',
    popover: {
      title: 'Dark Mode',
      description: 'Toggle between light and dark themes for comfortable viewing.',
      side: 'bottom' as const,
    },
  },
  {
    popover: {
      title: 'You\'re All Set!',
      description: 'Explore your dashboard, chat with your team, and let Mathia help you get things done. Enjoy!',
    },
  },
]
