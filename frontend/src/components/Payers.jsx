import { useEffect, useState } from 'react'
import { getPayers, exportPayers } from '../api'
import { timeAgo } from '../utils/formatters'
import { Icons } from './Icons'

const riskConfig = {
  high: { label: 'High', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  medium: { label: 'Medium', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  low: { label: 'Low', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

function Avatar({ name }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center text-white text-[11px] font-semibold shrink-0`}>
      {initials}
    </div>
  )
}

export default function Payers() {
  const [payers, setPayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPayers().then(r => setPayers(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading...</div>
  )

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Payers</h1>
          <p className="text-slate-500 text-sm mt-0.5">{payers.length} customer{payers.length !== 1 ? 's' : ''} on record</p>
        </div>
        <button
          onClick={exportPayers}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 transition-all"
        >
          {Icons.download} Export Excel
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {payers.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-slate-500 text-sm">No payers yet — connect your Pinch account</div>
            <div className="text-slate-600 text-xs mt-1">Run Seed Test Data in Sandbox to get started</div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Customer', 'Email', 'Payments', 'Recovery', 'Last Activity', 'Risk'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payers.map((p, i) => {
                const risk = riskConfig[p.risk_score] || riskConfig.low
                return (
                  <tr key={p.id} className={`hover:bg-slate-800/30 transition-colors ${i < payers.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} />
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white">{p.name}</span>
                          <span
                            title={`Risk score: ${p.risk_score === 'high' ? '60+' : p.risk_score === 'medium' ? '30-59' : '0-29'}/100`}
                            className={`w-2 h-2 rounded-full ${p.risk_score === 'high' ? 'bg-red-500' : p.risk_score === 'medium' ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-400">{p.email}</td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-white tabular-nums">{p.total_payments}</div>
                      {p.failed_payments > 0 && (
                        <div className="text-xs text-red-400 mt-0.5">{p.failed_payments} failed</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${p.recovery_rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums">{p.recovery_rate}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{timeAgo(p.last_payment_date) || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${risk.cls}`}>
                        {risk.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
