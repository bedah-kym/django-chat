import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { DomainLayout } from '@/components/layout/DomainLayout'
import { ChatPage } from '@/features/chat/ChatPage'
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
import { PentestPage } from '@/features/pentest/PentestPage'
import { NewEngagementPage } from '@/features/pentest/NewEngagementPage'
import { EngagementWorkspace } from '@/features/pentest/EngagementWorkspace'
import { BugBountyPage } from '@/features/bugbounty/BugBountyPage'
import { ProgramDetailPage } from '@/features/bugbounty/ProgramDetailPage'
import { ReportsPage } from '@/features/bugbounty/ReportsPage'
import { HomePage } from '@/features/home/HomePage'
import { SecurityDomainPage } from '@/features/domains/SecurityDomainPage'
import { OpsDomainPage } from '@/features/domains/OpsDomainPage'
import { ComingSoonDomainPage } from '@/features/domains/ComingSoonDomainPage'

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
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="dashboard" element={<Navigate to="/app/home" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="security" element={<DomainLayout domainId="security" />}>
            <Route index element={<SecurityDomainPage />} />
            <Route path="chat/:roomId" element={<ChatPage />} />
            <Route path="pentest" element={<PentestPage />} />
            <Route path="pentest/new" element={<NewEngagementPage />} />
            <Route path="pentest/:engagementId" element={<EngagementWorkspace />} />
            <Route path="bugbounty" element={<BugBountyPage />} />
            <Route path="bugbounty/:programId" element={<ProgramDetailPage />} />
            <Route path="bugbounty/reports" element={<ReportsPage />} />
          </Route>
          <Route path="social" element={<DomainLayout domainId="social" />}>
            <Route index element={<ComingSoonDomainPage domainId="social" />} />
            <Route path="chat/:roomId" element={<ChatPage />} />
          </Route>
          <Route path="dev" element={<DomainLayout domainId="dev" />}>
            <Route index element={<ComingSoonDomainPage domainId="dev" />} />
            <Route path="chat/:roomId" element={<ChatPage />} />
          </Route>
          <Route path="ops" element={<DomainLayout domainId="ops" />}>
            <Route index element={<OpsDomainPage />} />
            <Route path="chat/:roomId" element={<ChatPage />} />
            <Route path="reminders" element={<RemindersPage />} />
            <Route path="travel/plan" element={<TripPlannerPage />} />
            <Route path="travel/itineraries" element={<ItineraryListPage />} />
            <Route path="travel/:id" element={<ItineraryDetailPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="wallet/transactions" element={<WalletPage />} />
            <Route path="invoices/new" element={<InvoiceCreatePage />} />
            <Route path="invoices/:ref" element={<InvoiceDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/app/home" replace />} />
      </Routes>
    </>
  )
}
