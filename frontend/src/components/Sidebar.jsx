import { Icons } from './Icons'

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { id: 'inbox', label: 'Agent Inbox', icon: Icons.inbox },
  { id: 'payers', label: 'Payers', icon: Icons.payers },
  { id: 'demo', label: 'Sandbox', icon: Icons.demo },
]

export default function Sidebar({ page, setPage, inboxCount }) {
  return (
    <aside className="w-60 bg-slate-950 border-r border-slate-800/60 flex flex-col min-h-screen shrink-0">
      <div className="px-5 py-6 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Retryly</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-snug">
          Automatic payment recovery
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((item) => {
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
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
            </button>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-slate-500">Pinch Payments · Sandbox</span>
        </div>
      </div>
    </aside>
  )
}
