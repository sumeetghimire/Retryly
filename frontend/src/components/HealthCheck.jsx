import { useEffect, useState } from 'react'
import { getHealth } from '../api'
import { Icons } from './Icons'

const rows = [
  { key: 'pinch', label: 'Pinch Payments API' },
  { key: 'claude', label: 'Claude AI' },
  { key: 'database', label: 'Database' },
]

export default function HealthCheck({ onReady }) {
  const [services, setServices] = useState({ pinch: 'checking', claude: 'checking', database: 'checking' })
  const [hasError, setHasError] = useState(false)

  const check = async () => {
    setServices({ pinch: 'checking', claude: 'checking', database: 'checking' })
    setHasError(false)
    try {
      const { data } = await getHealth()
      setServices({ pinch: data.pinch, claude: data.claude, database: data.database })
      const allGood = data.pinch === 'connected' && data.claude === 'connected' && data.database === 'connected'
      if (allGood) setTimeout(onReady, 1200)
      else setHasError(true)
    } catch {
      setServices({ pinch: 'error', claude: 'error', database: 'error' })
      setHasError(true)
    }
  }

  useEffect(() => { check() }, [])

  const allConnected = Object.values(services).every(s => s === 'connected')

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">Retryly</span>
          </div>
          <p className="text-slate-500 text-sm">Connecting to services</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {rows.map(({ key, label }, i) => {
            const status = services[key]
            return (
              <div key={key} className={`flex items-center justify-between px-5 py-4 ${i < rows.length - 1 ? 'border-b border-slate-800' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    status === 'connected' ? 'bg-emerald-500' :
                    status === 'error' ? 'bg-red-500' : 'bg-slate-600 animate-pulse'
                  }`} />
                  <span className="text-sm text-slate-300">{label}</span>
                </div>
                <span className={`text-xs font-medium ${
                  status === 'connected' ? 'text-emerald-400' :
                  status === 'error' ? 'text-red-400' : 'text-slate-500'
                }`}>
                  {status === 'checking' ? 'Connecting...' : status === 'connected' ? 'Connected' : 'Failed'}
                </span>
              </div>
            )
          })}
        </div>

        {hasError && (
          <button
            onClick={check}
            className="mt-4 w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        )}

        {allConnected && (
          <p className="mt-4 text-center text-emerald-400 text-xs">All systems operational</p>
        )}
      </div>
    </div>
  )
}
