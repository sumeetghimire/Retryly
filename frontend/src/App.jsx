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
import { getDishonours } from './api'

function AppLayout() {
  const { user, isLoading } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [inboxCount, setInboxCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

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
  }

  return (
    <div className="flex w-full min-h-screen bg-slate-950">
      <Sidebar page={page} setPage={setPage} inboxCount={inboxCount} />
      <main className="flex-1 overflow-y-auto">
        {pages[page] || <Dashboard />}
      </main>
    </div>
  )
}

function PublicRoute({ children }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user) return <Navigate to="/" replace />
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
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
