import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import HealthCheck from './components/HealthCheck'
import Dashboard from './components/Dashboard'
import AgentInbox from './components/AgentInbox'
import DemoControls from './components/DemoControls'
import Payers from './components/Payers'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import SurchargeAdvisor from './pages/SurchargeAdvisor'
import Settings from './pages/Settings'
import CashFlowForecast from './pages/CashFlowForecast'
import LandingPage from './pages/LandingPage'
import About from './pages/About'
import { getDishonours } from './api'

const _VALID_PAGES = new Set(['dashboard', 'inbox', 'payers', 'demo', 'surcharge', 'settings', 'cashflow'])

function AppLayout() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(() => {
    const path = window.location.pathname.slice(1)
    return _VALID_PAGES.has(path) ? path : 'dashboard'
  })
  const [inboxCount, setInboxCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const refresh = async () => {
      try {
        const { data } = await getDishonours('needs_attention')
        setInboxCount(data.total)
      } catch {}
    }
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  // Sync URL → page state (for Link-based navigation e.g. from Dashboard widget)
  useEffect(() => {
    const path = location.pathname.slice(1)
    const VALID = new Set(['dashboard', 'inbox', 'payers', 'demo', 'surcharge', 'settings', 'cashflow'])
    if (VALID.has(path) && path !== page) setPage(path)
  }, [location.pathname])

  // Close sidebar on page change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [page])

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-500 text-sm">
      Loading…
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (!user.onboarding_complete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  const pages = {
    dashboard: <Dashboard />,
    inbox: <AgentInbox inboxCount={inboxCount} />,
    payers: <Payers />,
    demo: <DemoControls onTriggerMixed={() => { setPage('inbox'); navigate('/') }} />,
    surcharge: <SurchargeAdvisor />,
    settings: <Settings />,
    cashflow: <CashFlowForecast />,
  }

  return (
    <div className="flex w-full min-h-screen bg-slate-950">
      <Sidebar
        page={page}
        setPage={setPage}
        inboxCount={inboxCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-slate-800/60 bg-slate-950 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white p-1 transition-colors"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Retryly</span>
          </div>
          {inboxCount > 0 ? (
            <button
              onClick={() => setPage('inbox')}
              className="relative text-slate-400 hover:text-white p-1 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12H16L14 15H10L8 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6L18.55 5.11A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {inboxCount > 9 ? '9+' : inboxCount}
              </span>
            </button>
          ) : (
            <div className="w-8" />
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {pages[page] || <Dashboard />}
        </main>
      </div>
    </div>
  )
}

function PublicRoute({ children }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', fontSize: '13px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
