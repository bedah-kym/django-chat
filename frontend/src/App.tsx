import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { ChatPage } from '@/features/chat/ChatPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { RemindersPage } from '@/features/reminders/RemindersPage'
import { TripPlannerPage } from '@/features/travel/TripPlannerPage'
import { ItineraryListPage } from '@/features/travel/ItineraryListPage'
import { ItineraryDetailPage } from '@/features/travel/ItineraryDetailPage'
import { WalletPage } from '@/features/payments/WalletPage'
import { InvoiceCreatePage } from '@/features/payments/InvoiceCreatePage'
import { InvoiceDetailPage } from '@/features/payments/InvoiceDetailPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { OnboardingTour } from '@/features/onboarding/OnboardingTour'

export function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--chat-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-color)',
            fontSize: '13px',
          },
        }}
      />
      <OnboardingTour />
      <Routes>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="chat/:roomId" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="travel/plan" element={<TripPlannerPage />} />
          <Route path="travel/itineraries" element={<ItineraryListPage />} />
          <Route path="travel/:id" element={<ItineraryDetailPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="wallet/transactions" element={<WalletPage />} />
          <Route path="invoices/new" element={<InvoiceCreatePage />} />
          <Route path="invoices/:ref" element={<InvoiceDetailPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
    </>
  )
}
