import { useEffect, useState } from 'react'
import { getSurchargeAdvisor } from '../api'
import { formatCents } from '../utils/formatters'

export default function SurchargeAdvisor() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSurchargeAdvisor()
      .then(({ data }) => setData(data))
      .catch(() => setError('Failed to load surcharge data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading…</div>
  )
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-8">
      <div className="text-red-400 mb-2">⚠️</div>
      <div className="text-slate-400 text-sm">{error || 'Failed to load data'}</div>
    </div>
  )

  if (data.payers_on_card === 0) return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-2.5 mb-6">
        <span className="text-yellow-400 text-xl">⚠️</span>
        <h1 className="text-xl font-semibold text-white">Surcharge Advisor</h1>
      </div>
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <div className="text-emerald-400 font-semibold">All customers already on direct debit — you're ahead of the ban!</div>
        <div className="text-slate-500 text-sm mt-1">No action needed for the 1 October 2026 RBA reform.</div>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400">⚠️</span>
            <h1 className="text-xl font-semibold text-white">Card Surcharging Banned in {data.days_until_ban} Days</h1>
          </div>
          <p className="text-slate-500 text-sm">RBA reform effective 1 October 2026</p>
        </div>
        <div className="text-center bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-3">
          <div className="text-3xl font-bold text-yellow-400">{data.days_until_ban}</div>
          <div className="text-yellow-400/70 text-xs font-medium uppercase tracking-wide">days left</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Monthly card fees</div>
          <div className="text-2xl font-bold text-red-400">{formatCents(data.total_monthly_card_fees_cents)}</div>
          <div className="text-xs text-slate-500 mt-1">Currently passed to customers</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">With BECS direct debit</div>
          <div className="text-2xl font-bold text-emerald-400">{formatCents(data.total_monthly_dd_fees_cents)}</div>
          <div className="text-xs text-slate-500 mt-1">Much lower Pinch fees</div>
        </div>
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">You save</div>
          <div className="text-2xl font-bold text-emerald-400">{formatCents(data.monthly_saving_cents)}/mo</div>
          <div className="text-xs text-slate-500 mt-1">{formatCents(data.annual_saving_cents)}/year</div>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span>💡</span>
          <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">AI Insight</span>
          <span className="ml-auto text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded font-medium">Claude</span>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">{data.claude_insight}</p>
      </div>

      <div className="bg-slate-900/50 border border-emerald-500/20 rounded-xl p-5 mb-6 text-center">
        <div className="text-3xl font-bold text-emerald-400 mb-1">{formatCents(data.annual_saving_cents)}</div>
        <div className="text-white font-medium">saved per year</div>
        <div className="text-slate-500 text-sm mt-1">
          By switching your {data.payers_on_card} card customer{data.payers_on_card !== 1 ? 's' : ''} to direct debit before 1 October 2026
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Customer Breakdown</span>
          <span className="text-xs text-slate-500">{data.payers_on_card} on card · {data.payers_on_dd} on DD</span>
        </div>
        {data.payer_breakdown.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">No data available</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Customer', 'Avg Payment', 'Card Fee', 'DD Fee', 'You Save', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.payer_breakdown.map((p, i) => (
                <tr key={i} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i < 3 ? 'bg-emerald-500/5' : ''}`}>
                  <td className="px-4 py-3 text-sm text-white font-medium">{p.payer_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{formatCents(p.avg_payment_cents)}</td>
                  <td className="px-4 py-3 text-sm text-red-400 tabular-nums">{formatCents(p.card_fee_cents)}</td>
                  <td className="px-4 py-3 text-sm text-emerald-400 tabular-nums">{formatCents(p.dd_fee_cents)}</td>
                  <td className="px-4 py-3 text-sm text-emerald-400 font-semibold tabular-nums">{formatCents(p.monthly_saving_cents)}</td>
                  <td className="px-4 py-3">
                    <a
                      href="https://app.pinchpayments.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Switch to DD →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
