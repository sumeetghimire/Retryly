import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icons } from './Icons'
import { getCashFlowSummary } from '../api'
import toast from 'react-hot-toast'

const DAYS_UNTIL_BAN = Math.max(0, Math.floor((new Date('2026-10-01') - new Date()) / (1000 * 60 * 60 * 24)))

const SettingsIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { id: 'inbox', label: 'Agent Inbox', icon: Icons.inbox },
  { id: 'payers', label: 'Payers', icon: Icons.payers },
  { id: 'cashflow', label: 'Cash Flow', icon: '📈' },
  { id: 'surcharge', label: 'Surcharge Advisor', icon: '💳', badge: DAYS_UNTIL_BAN < 90 ? `${DAYS_UNTIL_BAN}d` : null, badgeColor: 'bg-red-500/20 text-red-400 border-red-500/20' },
  { id: 'demo', label: 'Sandbox', icon: Icons.demo },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export default function Sidebar({ page, setPage, inboxCount, isOpen, onClose }) {
  const { user, logout } = useAuth()
  const [atRiskCents, setAtRiskCents] = useState(0)

  useEffect(() => {
    getCashFlowSummary()
      .then(({ data }) => setAtRiskCents(data.at_risk_total_cents || 0))
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out')
    } catch {}
  }

  const handleNav = (id) => {
    setPage(id)
    onClose?.()
  }

  const sidebarContent = (
    <aside className="w-60 bg-slate-950 border-r border-slate-800/60 flex flex-col h-full">
      <div className="px-5 py-6 border-b border-slate-800/60 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-white tracking-tight">Retryly</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-snug">Automatic payment recovery</p>
        </div>
        {/* Close button on mobile */}
        <button
          onClick={onClose}
          className="md:hidden text-slate-500 hover:text-white p-1 transition-colors"
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-left transition-all duration-150 ${
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className={active ? 'text-emerald-400' : ''}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {item.id === 'inbox' && inboxCount > 0 && (
                <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] font-semibold rounded-full px-1.5 py-0.5 border border-red-500/20 tabular-nums">
                  {inboxCount}
                </span>
              )}
              {item.id === 'cashflow' && atRiskCents > 0 && (
                <span className="ml-auto bg-amber-500/20 text-amber-400 text-[10px] font-semibold rounded-full px-1.5 py-0.5 border border-amber-500/20 tabular-nums">
                  ${(atRiskCents / 100).toFixed(0)}
                </span>
              )}
              {item.badge && item.id !== 'inbox' && item.id !== 'cashflow' && (
                <span className={`ml-auto text-[10px] font-semibold rounded-full px-1.5 py-0.5 border tabular-nums ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-800/60 space-y-2">
        {user && (
          <div className="px-1 mb-1">
            <div className="text-[11px] text-white font-medium truncate">{user.business_name}</div>
            <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[12px] text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sign out</span>
        </button>
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-slate-500">Pinch Payments · Sandbox</span>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
