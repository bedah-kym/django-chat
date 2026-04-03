import type { Room, Message, Contact, Note, ActionReceipt, LinkedRoom } from '@/types/chat'

export const mockRooms: Room[] = [
  {
    id: 1,
    name: 'techventures-strategy',
    displayName: 'TechVentures Strategy',
    lastMessage: 'I\'ve drafted the Q2 roadmap. Take a look when you can.',
    lastMessageTime: '2026-04-03T10:30:00Z',
    unreadCount: 3,
    isAiRoom: false,
    participants: [
      { username: 'alex', displayName: 'Alex Mwangi', isOnline: true },
      { username: 'sarah', displayName: 'Sarah Kimani', isOnline: true },
      { username: 'mathia', displayName: 'Mathia AI', isOnline: true },
    ],
  },
  {
    id: 2,
    name: 'client-onboarding',
    displayName: 'Client Onboarding',
    lastMessage: 'The invoice has been sent to the client.',
    lastMessageTime: '2026-04-03T09:15:00Z',
    unreadCount: 0,
    isAiRoom: false,
    participants: [
      { username: 'alex', displayName: 'Alex Mwangi', isOnline: true },
      { username: 'james', displayName: 'James Ochieng', isOnline: false, lastSeen: '2026-04-03T08:00:00Z' },
      { username: 'mathia', displayName: 'Mathia AI', isOnline: true },
    ],
  },
  {
    id: 3,
    name: 'mathia-assistant',
    displayName: 'Mathia Assistant',
    lastMessage: 'Here\'s a summary of your tasks for today.',
    lastMessageTime: '2026-04-03T08:00:00Z',
    unreadCount: 1,
    isAiRoom: true,
    participants: [
      { username: 'alex', displayName: 'Alex Mwangi', isOnline: true },
      { username: 'mathia', displayName: 'Mathia AI', isOnline: true },
    ],
  },
  {
    id: 4,
    name: 'nairobi-trip-planning',
    displayName: 'Nairobi Trip Planning',
    lastMessage: 'Found 3 hotels near KICC under your budget.',
    lastMessageTime: '2026-04-02T16:45:00Z',
    unreadCount: 0,
    isAiRoom: false,
    participants: [
      { username: 'alex', displayName: 'Alex Mwangi', isOnline: true },
      { username: 'sarah', displayName: 'Sarah Kimani', isOnline: true },
      { username: 'mathia', displayName: 'Mathia AI', isOnline: true },
    ],
  },
  {
    id: 5,
    name: 'payments-reconciliation',
    displayName: 'Payments & Reconciliation',
    lastMessage: 'All March invoices have been reconciled.',
    lastMessageTime: '2026-04-01T14:20:00Z',
    unreadCount: 0,
    isAiRoom: false,
    participants: [
      { username: 'alex', displayName: 'Alex Mwangi', isOnline: true },
      { username: 'mathia', displayName: 'Mathia AI', isOnline: true },
    ],
  },
]

export const mockMessages: Record<number, Message[]> = {
  1: [
    { id: 101, member: 'sarah', content: 'Hey Alex, have you seen the latest metrics from last quarter?', timestamp: '2026-04-03T09:00:00Z', parentId: null, isAi: false },
    { id: 102, member: 'alex', content: 'Yes! Revenue is up 23% which is great. But our churn rate needs attention.', timestamp: '2026-04-03T09:05:00Z', parentId: null, isAi: false },
    {
      id: 103, member: 'mathia', timestamp: '2026-04-03T09:08:00Z', parentId: null, isAi: true,
      thinking: 'The user wants churn analysis. Let me query the analytics database for Q1 metrics, cross-reference with customer segments, and identify the top reasons for churn. I should also compare against the previous quarter to show trends.',
      thinkingDurationMs: 3200,
      toolCalls: [
        { name: 'query_analytics', status: 'result', result: '{"churn_rate": 4.2, "prev_quarter": 3.1, "top_reasons": ["pricing", "features", "competitor"]}' },
      ],
      content: 'Based on the data I\'ve analyzed, here are the key insights:\n\n**Revenue Growth:** 23% QoQ increase, primarily driven by enterprise clients.\n\n**Churn Analysis:**\n- Monthly churn: 4.2% (up from 3.1%)\n- Primary reasons: pricing concerns (38%), feature gaps (27%), competitor switching (22%)\n\n**Recommendations:**\n1. Implement a customer health scoring system\n2. Launch a targeted retention campaign for at-risk accounts\n3. Consider a mid-tier pricing option\n\nWould you like me to draft the retention campaign outline?',
    },
    { id: 104, member: 'sarah', content: 'That\'s really helpful, Mathia. Can you also pull the NPS scores for last quarter?', timestamp: '2026-04-03T09:15:00Z', parentId: null, isAi: false },
    {
      id: 105, member: 'mathia', timestamp: '2026-04-03T09:18:00Z', parentId: null, isAi: true,
      content: 'Here are the NPS scores:\n\n| Segment | Score | Trend |\n|---------|-------|-------|\n| Enterprise | 72 | +5 |\n| SMB | 45 | -8 |\n| Startup | 61 | +2 |\n\nThe SMB segment shows a concerning decline. This aligns with the churn data — most churned accounts are in the SMB tier.',
    },
    { id: 106, member: 'alex', content: 'Can you write a quick script to export this data to CSV?', timestamp: '2026-04-03T09:25:00Z', parentId: null, isAi: false },
    {
      id: 107, member: 'mathia', timestamp: '2026-04-03T09:28:00Z', parentId: null, isAi: true,
      thinking: 'User wants a CSV export script. I\'ll write a Python script using the pandas library since it\'s the most common data analysis tool. Keep it simple — read from our API, transform to DataFrame, write to CSV.',
      thinkingDurationMs: 1800,
      content: 'Here\'s a quick Python script to export the NPS data:\n\n```python\nimport pandas as pd\nfrom datetime import datetime\n\n# NPS data by segment\ndata = {\n    "Segment": ["Enterprise", "SMB", "Startup"],\n    "Score": [72, 45, 61],\n    "Trend": ["+5", "-8", "+2"],\n    "Quarter": ["Q1 2026"] * 3\n}\n\ndf = pd.DataFrame(data)\nfilename = f"nps_scores_{datetime.now().strftime(\'%Y%m%d\')}.csv"\ndf.to_csv(filename, index=False)\nprint(f"Exported to {filename}")\n```\n\nRun this with `python export_nps.py`. Want me to also include the churn data in the export?',
    },
    { id: 108, member: 'alex', content: 'Let\'s schedule a strategy meeting for Friday. @sarah can you check calendars?', timestamp: '2026-04-03T10:00:00Z', parentId: null, isAi: false },
    { id: 109, member: 'sarah', content: 'On it. I\'ll send calendar invites by EOD.', timestamp: '2026-04-03T10:15:00Z', parentId: null, isAi: false },
    {
      id: 110, member: 'mathia', timestamp: '2026-04-03T10:30:00Z', parentId: null, isAi: true,
      toolCalls: [
        { name: 'schedule_meeting', status: 'result', result: '{"event_id": "evt_123", "title": "Q2 Strategy Meeting", "date": "2026-04-05", "time": "10:00"}' },
        { name: 'send_email', status: 'result', result: '{"sent_to": ["sarah@client.co", "alex@mathia.co"], "subject": "Q2 Strategy Meeting - Friday 10AM"}' },
      ],
      content: 'Done! I\'ve scheduled the **Q2 Strategy Meeting** for Friday, April 5th at 10:00 AM and sent calendar invites to both of you. I\'ve also drafted the Q2 roadmap — take a look when you can.',
    },
  ],
  2: [
    { id: 201, member: 'james', content: 'The new client from Mombasa wants to start next week. What do we need?', timestamp: '2026-04-03T08:30:00Z', parentId: null, isAi: false },
    { id: 202, member: 'mathia', content: 'Here\'s the standard onboarding checklist:\n\n- [ ] NDA signed\n- [ ] Service agreement finalized\n- [ ] Initial deposit received\n- [ ] Welcome email sent\n- [ ] Kickoff meeting scheduled\n- [ ] Access credentials provisioned\n\nShall I create an invoice for the initial deposit?', timestamp: '2026-04-03T08:35:00Z', parentId: null, isAi: true },
    { id: 203, member: 'alex', content: 'Yes, please create the invoice. Standard terms — 50% upfront.', timestamp: '2026-04-03T09:00:00Z', parentId: null, isAi: false },
    { id: 204, member: 'mathia', content: 'The invoice has been sent to the client.', timestamp: '2026-04-03T09:15:00Z', parentId: null, isAi: true },
  ],
  3: [
    { id: 301, member: 'mathia', content: 'Good morning, Alex! Here\'s a summary of your tasks for today:\n\n1. **Strategy meeting prep** — Review Q2 roadmap draft\n2. **Client onboarding** — Mombasa client kickoff pending\n3. **Payments** — 2 invoices awaiting payment\n4. **Travel** — Nairobi trip hotel confirmation needed\n\nYou have 2 meetings today:\n- 10:00 AM — Team standup\n- 2:00 PM — Client call with Sarah\n\nAnything you\'d like to prioritize?', timestamp: '2026-04-03T08:00:00Z', parentId: null, isAi: true },
  ],
  4: [
    { id: 401, member: 'alex', content: 'We need to book a hotel near KICC for the conference next month.', timestamp: '2026-04-02T15:00:00Z', parentId: null, isAi: false },
    { id: 402, member: 'mathia', content: 'Found 3 hotels near KICC under your budget:\n\n1. **Hilton Nairobi** — KES 12,500/night ⭐ 4.2\n2. **Sarova Stanley** — KES 10,800/night ⭐ 4.5\n3. **Fairmont The Norfolk** — KES 15,200/night ⭐ 4.7\n\nAll within 1km of KICC. Shall I book one of these?', timestamp: '2026-04-02T15:05:00Z', parentId: null, isAi: true },
    { id: 403, member: 'sarah', content: 'I\'d recommend Sarova Stanley — great location and within budget.', timestamp: '2026-04-02T16:30:00Z', parentId: null, isAi: false },
    { id: 404, member: 'alex', content: 'Agreed. Mathia, book Sarova Stanley for April 15-18.', timestamp: '2026-04-02T16:40:00Z', parentId: null, isAi: false },
    { id: 405, member: 'mathia', content: 'Found 3 hotels near KICC under your budget.', timestamp: '2026-04-02T16:45:00Z', parentId: null, isAi: true },
  ],
  5: [
    { id: 501, member: 'mathia', content: 'Monthly reconciliation complete. Summary:\n\n**March 2026:**\n- Total invoiced: KES 450,000\n- Total received: KES 425,000\n- Outstanding: KES 25,000 (2 invoices)\n\nAll March invoices have been reconciled.', timestamp: '2026-04-01T14:20:00Z', parentId: null, isAi: true },
  ],
}

export const mockContacts: Contact[] = [
  { id: 1, name: 'Sarah Kimani', email: 'sarah@client.co', phone: '+254 722 111 222', company: 'ClientCorp', roomId: 1 },
  { id: 2, name: 'James Ochieng', email: 'james@partner.co', phone: '+254 733 333 444', company: 'PartnerInc', roomId: 2 },
  { id: 3, name: 'Grace Wanjiku', email: 'grace@vendor.co', phone: '+254 711 555 666', company: 'VendorLtd', roomId: 1 },
]

export const mockNotes: Note[] = [
  { id: 1, content: 'Q2 roadmap draft shared — review before Friday meeting', createdAt: '2026-04-03T10:30:00Z', isPinned: true, author: 'alex' },
  { id: 2, content: 'NPS scores declining in SMB segment — needs action plan', createdAt: '2026-04-03T09:20:00Z', isPinned: true, author: 'sarah' },
  { id: 3, content: 'Retention campaign ideas: loyalty discount, feature preview access, dedicated support', createdAt: '2026-04-02T15:00:00Z', isPinned: false, author: 'alex' },
]

export const mockActionReceipts: ActionReceipt[] = [
  { id: 1, action: 'Invoice Created', status: 'completed', timestamp: '2026-04-03T09:15:00Z', details: 'Invoice #INV-2026-042 sent to Mombasa client' },
  { id: 2, action: 'Email Sent', status: 'completed', timestamp: '2026-04-03T08:45:00Z', details: 'Welcome email to james@partner.co' },
  { id: 3, action: 'Meeting Scheduled', status: 'pending', timestamp: '2026-04-03T10:00:00Z', details: 'Strategy meeting — awaiting confirmations' },
  { id: 4, action: 'Hotel Booking', status: 'pending', timestamp: '2026-04-02T16:45:00Z', details: 'Sarova Stanley, April 15-18' },
]

export const mockLinkedRooms: LinkedRoom[] = [
  { id: 2, name: 'client-onboarding', displayName: 'Client Onboarding' },
  { id: 5, name: 'payments-reconciliation', displayName: 'Payments & Reconciliation' },
]

// Older messages for pagination (loaded when user scrolls to top)
export const mockOlderMessages: Record<number, Message[]> = {
  1: [
    { id: 50, member: 'alex', content: 'Good morning team. Let\'s review last quarter today.', timestamp: '2026-04-02T08:00:00Z', parentId: null, isAi: false },
    { id: 51, member: 'sarah', content: 'Morning! I\'ve prepared the slides.', timestamp: '2026-04-02T08:15:00Z', parentId: null, isAi: false },
    { id: 52, member: 'mathia', content: 'I\'ve pulled the latest analytics dashboards. Ready when you are.', timestamp: '2026-04-02T08:20:00Z', parentId: null, isAi: true },
    { id: 53, member: 'alex', content: 'Let\'s start with customer acquisition numbers.', timestamp: '2026-04-02T09:00:00Z', parentId: null, isAi: false },
    { id: 54, member: 'mathia', content: '**Customer Acquisition Q4 2025:**\n- New customers: 142 (+18% QoQ)\n- CAC: KES 3,200 (down from 3,800)\n- Top channel: Referrals (38%), Organic (29%), Paid (33%)\n\nReferrals are outperforming paid — worth doubling down on the referral program.', timestamp: '2026-04-02T09:05:00Z', parentId: null, isAi: true },
    { id: 55, member: 'sarah', content: 'The referral numbers are impressive. What\'s the conversion rate?', timestamp: '2026-04-02T09:30:00Z', parentId: null, isAi: false },
    { id: 56, member: 'mathia', content: 'Referral conversion: **24%** vs paid at **11%**. Referrals convert at more than double the rate.', timestamp: '2026-04-02T09:32:00Z', parentId: 55, isAi: true },
    { id: 57, member: 'alex', content: 'Great insights. Let me send a voice note with my thoughts on the referral strategy.', timestamp: '2026-04-02T10:00:00Z', parentId: null, isAi: false },
    { id: 58, member: 'alex', content: '', timestamp: '2026-04-02T10:02:00Z', parentId: null, isAi: false, audioUrl: '/audio/sample.webm', voiceTranscript: 'I think we should increase the referral bonus from 500 to 1000 KES and create a tiered reward system for top referrers.' },
    { id: 59, member: 'sarah', content: 'Agreed with the voice note — tiered rewards would motivate our power users.', timestamp: '2026-04-02T10:15:00Z', parentId: 58, isAi: false },
    { id: 60, member: 'mathia', content: 'I can draft the tiered referral program. Here\'s a quick outline:\n\n| Tier | Referrals | Reward |\n|------|-----------|--------|\n| Bronze | 1-3 | KES 1,000 each |\n| Silver | 4-10 | KES 1,500 each |\n| Gold | 11+ | KES 2,000 each + VIP support |\n\nShall I create the full proposal?', timestamp: '2026-04-02T10:20:00Z', parentId: null, isAi: true },
  ],
  2: [
    { id: 150, member: 'james', content: 'Do we have a template for the onboarding email?', timestamp: '2026-04-02T14:00:00Z', parentId: null, isAi: false },
    { id: 151, member: 'mathia', content: 'Yes, here\'s the standard welcome template:\n\n> Welcome to TechVentures! We\'re excited to have you on board.\n> Your dedicated account manager is **Alex Mwangi**.\n> \n> Next steps:\n> 1. Complete your profile\n> 2. Schedule a kickoff call\n> 3. Review the service agreement\n\nShall I customize it for the Mombasa client?', timestamp: '2026-04-02T14:05:00Z', parentId: null, isAi: true },
    { id: 152, member: 'alex', content: 'Yes, customize it and include the pricing we discussed.', timestamp: '2026-04-02T14:30:00Z', parentId: 151, isAi: false },
  ],
  3: [],
  4: [
    { id: 350, member: 'alex', content: 'What\'s the weather forecast for Nairobi mid-April?', timestamp: '2026-04-01T12:00:00Z', parentId: null, isAi: false },
    { id: 351, member: 'mathia', content: 'Nairobi mid-April forecast:\n- **Temperature:** 16-24°C\n- **Rainfall:** Moderate (long rains season)\n- **Humidity:** 65-80%\n\nBring a light jacket and umbrella. The mornings can be cool.', timestamp: '2026-04-01T12:05:00Z', parentId: null, isAi: true },
  ],
  5: [
    { id: 450, member: 'mathia', content: 'February reconciliation complete.\n\n**February 2026:**\n- Total invoiced: KES 380,000\n- Total received: KES 380,000\n- Outstanding: KES 0\n\nAll invoices paid on time.', timestamp: '2026-03-01T14:00:00Z', parentId: null, isAi: true },
  ],
}
