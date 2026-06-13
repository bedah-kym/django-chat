import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ensureAuth } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { DomainLayout } from '@/components/layout/DomainLayout'
import { CommandPalette } from '@/components/CommandPalette'
import { OnboardingTour } from '@/features/onboarding/OnboardingTour'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { RouteSkeleton } from '@/components/ui/RouteSkeleton'

const ChatPage = lazy(() => import('@/features/chat/ChatPage').then(m => ({ default: m.ChatPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const RemindersPage = lazy(() => import('@/features/reminders/RemindersPage').then(m => ({ default: m.RemindersPage })))
const TripPlannerPage = lazy(() => import('@/features/travel/TripPlannerPage').then(m => ({ default: m.TripPlannerPage })))
const ItineraryListPage = lazy(() => import('@/features/travel/ItineraryListPage').then(m => ({ default: m.ItineraryListPage })))
const ItineraryDetailPage = lazy(() => import('@/features/travel/ItineraryDetailPage').then(m => ({ default: m.ItineraryDetailPage })))
const WalletPage = lazy(() => import('@/features/payments/WalletPage').then(m => ({ default: m.WalletPage })))
const InvoiceCreatePage = lazy(() => import('@/features/payments/InvoiceCreatePage').then(m => ({ default: m.InvoiceCreatePage })))
const InvoiceDetailPage = lazy(() => import('@/features/payments/InvoiceDetailPage').then(m => ({ default: m.InvoiceDetailPage })))
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const PentestPage = lazy(() => import('@/features/pentest/PentestPage').then(m => ({ default: m.PentestPage })))
const NewEngagementPage = lazy(() => import('@/features/pentest/NewEngagementPage').then(m => ({ default: m.NewEngagementPage })))
const EngagementWorkspace = lazy(() => import('@/features/pentest/EngagementWorkspace').then(m => ({ default: m.EngagementWorkspace })))
const BugBountyPage = lazy(() => import('@/features/bugbounty/BugBountyPage').then(m => ({ default: m.BugBountyPage })))
const ProgramDetailPage = lazy(() => import('@/features/bugbounty/ProgramDetailPage').then(m => ({ default: m.ProgramDetailPage })))
const ReportsPage = lazy(() => import('@/features/bugbounty/ReportsPage').then(m => ({ default: m.ReportsPage })))
const HomePage = lazy(() => import('@/features/home/HomePage').then(m => ({ default: m.HomePage })))
const SignetPage = lazy(() => import('@/features/signet/SignetPage').then(m => ({ default: m.SignetPage })))
const SecurityDomainPage = lazy(() => import('@/features/domains/SecurityDomainPage').then(m => ({ default: m.SecurityDomainPage })))
const OpsDomainPage = lazy(() => import('@/features/domains/OpsDomainPage').then(m => ({ default: m.OpsDomainPage })))
const ComingSoonDomainPage = lazy(() => import('@/features/domains/ComingSoonDomainPage').then(m => ({ default: m.ComingSoonDomainPage })))

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

export function App() {
  useEffect(() => {
    ensureAuth()
    useChatStore.getState().initialize()
    useNotificationStore.getState().initialize()
  }, [])

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
      <CommandPalette />
      <Routes>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<LazyPage><HomePage /></LazyPage>} />
          <Route path="dashboard" element={<Navigate to="/app/home" replace />} />
          <Route path="settings" element={<LazyPage><SettingsPage /></LazyPage>} />
          <Route path="onboarding" element={<LazyPage><OnboardingPage /></LazyPage>} />
          <Route path="signet" element={<DomainLayout domainId="signet" />}>
            <Route index element={<LazyPage><SignetPage /></LazyPage>} />
            <Route path="chat/:roomId" element={<LazyPage><ChatPage /></LazyPage>} />
          </Route>
          <Route path="security" element={<DomainLayout domainId="security" />}>
            <Route index element={<LazyPage><SecurityDomainPage /></LazyPage>} />
            <Route path="chat/:roomId" element={<LazyPage><ChatPage /></LazyPage>} />
            <Route path="pentest" element={<LazyPage><PentestPage /></LazyPage>} />
            <Route path="pentest/new" element={<LazyPage><NewEngagementPage /></LazyPage>} />
            <Route path="pentest/:engagementId" element={<LazyPage><EngagementWorkspace /></LazyPage>} />
            <Route path="bugbounty" element={<LazyPage><BugBountyPage /></LazyPage>} />
            <Route path="bugbounty/:programId" element={<LazyPage><ProgramDetailPage /></LazyPage>} />
            <Route path="bugbounty/reports" element={<LazyPage><ReportsPage /></LazyPage>} />
          </Route>
          <Route path="dev" element={<DomainLayout domainId="dev" />}>
            <Route index element={<LazyPage><ComingSoonDomainPage domainId="dev" /></LazyPage>} />
            <Route path="chat/:roomId" element={<LazyPage><ChatPage /></LazyPage>} />
          </Route>
          <Route path="ops" element={<DomainLayout domainId="ops" />}>
            <Route index element={<LazyPage><OpsDomainPage /></LazyPage>} />
            <Route path="chat/:roomId" element={<LazyPage><ChatPage /></LazyPage>} />
            <Route path="reminders" element={<LazyPage><RemindersPage /></LazyPage>} />
          </Route>
          <Route path="travel" element={<Navigate to="/app/travel/itineraries" replace />} />
          <Route path="travel/plan" element={<LazyPage><TripPlannerPage /></LazyPage>} />
          <Route path="travel/itineraries" element={<LazyPage><ItineraryListPage /></LazyPage>} />
          <Route path="travel/:id" element={<LazyPage><ItineraryDetailPage /></LazyPage>} />
          <Route path="payments" element={<Navigate to="/app/payments/wallet" replace />} />
          <Route path="payments/wallet" element={<LazyPage><WalletPage /></LazyPage>} />
          <Route path="payments/wallet/transactions" element={<LazyPage><WalletPage /></LazyPage>} />
          <Route path="payments/invoices/new" element={<LazyPage><InvoiceCreatePage /></LazyPage>} />
          <Route path="payments/invoices/:ref" element={<LazyPage><InvoiceDetailPage /></LazyPage>} />
        </Route>
        <Route path="*" element={<Navigate to="/app/home" replace />} />
      </Routes>
    </>
  )
}
