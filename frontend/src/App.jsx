import { useState, useEffect } from 'react'
import './index.css'
import Sidebar from './components/Sidebar'
import HealthCheck from './components/HealthCheck'
import Dashboard from './components/Dashboard'
import AgentInbox from './components/AgentInbox'
import DemoControls from './components/DemoControls'
import Payers from './components/Payers'
import { getDishonours } from './api'

export default function App() {
  const [page, setPage] = useState('health')
  const [inboxCount, setInboxCount] = useState(0)

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

  if (page === 'health') {
    return <HealthCheck onReady={() => setPage('dashboard')} />
  }

  const pages = {
    dashboard: <Dashboard />,
    inbox: <AgentInbox />,
    payers: <Payers />,
    demo: <DemoControls onTriggerMixed={() => setPage('inbox')} />,
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
