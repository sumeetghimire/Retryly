import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getDashboard } from '../api'
import { formatCents, timeAgo, statusColor, statusLabel } from '../utils/formatters'
import { Icons } from './Icons'

function StatCard({ icon, value, label, accent, sub }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${accent}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-slate-500 text-xs mt-1 font-medium uppercase tracking-wide">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = async () => {
    try {
      const res = await getDashboard()
      setData(res.data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
      Loading...
    </div>
  )
  if (!data) return (
    <div className="flex items-center justify-center h-64 text-red-400 text-sm">
      Failed to load dashboard
    </div>
  )

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Payment recovery overview</p>
        </div>
        {lastRefresh && (
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live · updated {timeAgo(lastRefresh)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard
          icon={<span className="text-emerald-400">{Icons.collected}</span>}
          value={formatCents(data.total_collected_cents)}
          label="Collected"
          accent="bg-emerald-500/10"
        />
        <StatCard
          icon={<span className="text-amber-400">{Icons.risk}</span>}
          value={formatCents(data.total_at_risk_cents)}
          label="At Risk"
          accent="bg-amber-500/10"
        />
        <StatCard
          icon={<span className="text-blue-400">{Icons.recovery}</span>}
          value={`${data.recovery_rate}%`}
          label="Recovery Rate"
          accent="bg-blue-500/10"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<span className="text-violet-400">{Icons.users}</span>}
          value={data.active_payers}
          label="Active Payers"
          accent="bg-violet-500/10"
        />
        <StatCard
          icon={<span className="text-emerald-400">{Icons.projected}</span>}
          value={formatCents(data.projected_recovery_cents)}
          label="Projected Recovery"
          accent="bg-emerald-500/10"
          sub={data.projected_recovery_cents > 0 ? `Expected by ${data.projected_recovery_date}` : 'No pending retries'}
        />
        <StatCard
          icon={<span className="text-red-400">{Icons.alertTriangle}</span>}
          value={data.high_risk_payers}
          label="High Risk Payers"
          accent="bg-red-500/10"
          sub={data.high_risk_payers > 0 ? '2+ failed payments' : 'All payers healthy'}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-emerald-400">{Icons.sparkle}</span>
            <span className="text-sm font-medium text-white">AI Summary</span>
            <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Claude
            </span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{data.agent_summary}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-sm font-medium text-white mb-4">Today</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Failed</span>
              <span className="text-white font-semibold text-sm">{data.failed_today}</span>
            </div>
            <div className="w-full h-px bg-slate-800" />
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Recovered</span>
              <span className="text-emerald-400 font-semibold text-sm">{data.recovered_today}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Impact Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border border-red-800/30 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Without Retryly</div>
          <div className="text-3xl font-bold text-red-400">{formatCents(data.without_retryly_loss_cents)}</div>
          <div className="text-xs text-slate-500 mt-1">at risk · based on 63% AU SMB late-payment rate</div>
        </div>
        <div className="bg-slate-900 border border-emerald-700/30 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">With Retryly</div>
          <div className="text-3xl font-bold text-emerald-400">{formatCents(data.retryly_saved_cents)}</div>
          <div className="text-xs text-slate-500 mt-1">recovered automatically — zero manual work</div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Avg recovery', value: `${data.avg_days_to_recover}d` },
          { label: 'Links paid', value: `${data.payment_links_paid}/${data.payment_links_sent} sent` },
          { label: 'Active plans', value: `${data.plans_active} (${formatCents(data.plans_total_value_cents)})` },
          { label: 'Top failure', value: data.top_dishonour_reason || '—' },
        ].map((s, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium mb-1">{s.label}</div>
            <div className="text-sm font-semibold text-white truncate">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly trend chart */}
      {data.monthly_trend && data.monthly_trend.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <div className="text-sm font-medium text-white mb-4">6-Month Recovery Trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.monthly_trend} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `$${(v/100).toFixed(0)}`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={v => formatCents(v)} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9' }} />
              <Bar dataKey="recovered" name="Recovered" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Surcharge ban callout */}
      {data.surcharge_ban_impact && data.surcharge_ban_impact.days_until_ban <= 180 && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span>⚠️</span>
            <span className="text-yellow-400 font-semibold text-sm">Card Surcharging Banned in {data.surcharge_ban_impact.days_until_ban} Days (1 Oct 2026)</span>
          </div>
          <p className="text-slate-400 text-sm">{data.surcharge_ban_impact.message}</p>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <span className="text-sm font-medium text-white">Recent Activity</span>
        </div>
        {data.recent_activity.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">Waiting for first payment data from Pinch</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Payer', 'Amount', 'Reason', 'Action', 'Status', 'Time'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_activity.map((item, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-white font-medium">{item.payer_name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-300 tabular-nums">{formatCents(item.amount_cents)}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{item.reason_label}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400 capitalize">{item.action_taken}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{timeAgo(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
