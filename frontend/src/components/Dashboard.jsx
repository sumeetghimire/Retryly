import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getDashboard, getCashFlowSummary } from '../api'
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

function WelcomeBanner() {
  const [visible, setVisible] = useState(
    () => !localStorage.getItem('retryly_welcome_dismissed')
  )
  if (!visible) return null
  const dismiss = () => {
    localStorage.setItem('retryly_welcome_dismissed', '1')
    setVisible(false)
  }
  return (
    <div className="flex items-center justify-between gap-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-5 py-4 mb-6">
      <p className="text-sm text-emerald-300">
        🎉 <span className="font-medium">Retryly is connected and watching your payments.</span>{' '}
        We'll notify you the moment a payment fails and needs attention.
      </p>
      <button
        onClick={dismiss}
        className="text-emerald-500 hover:text-emerald-300 text-xs font-medium shrink-0 transition-colors"
      >
        Dismiss
      </button>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [cashflow, setCashflow] = useState(null)

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

  // Separate effect — cashflow summary loads independently, never blocks dashboard
  useEffect(() => {
    getCashFlowSummary()
      .then(({ data }) => setCashflow(data))
      .catch(() => {})
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
    <div className="p-4 md:p-8 max-w-6xl">
      <WelcomeBanner />
      <div className="flex items-center justify-between mb-6 md:mb-8">
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-emerald-400">{Icons.sparkle}</span>
            <span className="text-sm font-medium text-white">AI Summary</span>
            <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
              AI
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

      {/* Recovery ROI Hero */}
      <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 border border-emerald-700/30 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-emerald-400">{Icons.sparkle}</span>
          <span className="text-sm font-semibold text-white uppercase tracking-wide">Total Recovered — All Time</span>
        </div>
        <div className="flex items-end gap-6">
          <div>
            <div className="text-4xl font-bold text-emerald-400 tracking-tight">{formatCents(data.total_recovered_all_time_cents)}</div>
            <div className="text-xs text-slate-500 mt-1">revenue Retryly has saved your business</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-bold text-white">{data.recovery_rate}%</div>
            <div className="text-xs text-slate-500">recovery rate</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white">{data.avg_days_to_recover}d</div>
            <div className="text-xs text-slate-500">avg to recover</div>
          </div>
        </div>
      </div>

      {/* Recovery Impact Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="bg-slate-900 border border-red-800/30 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Without Retryly</div>
          <div className="text-3xl font-bold text-red-400">{formatCents(data.without_retryly_loss_cents)}</div>
          <div className="text-xs text-slate-500 mt-1">at risk · based on 63% AU SMB late-payment rate</div>
        </div>
        <div className="bg-slate-900 border border-emerald-700/30 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Recovered This Month</div>
          <div className="text-3xl font-bold text-emerald-400">{formatCents(data.retryly_saved_cents)}</div>
          <div className="text-xs text-slate-500 mt-1">recovered automatically — zero manual work</div>
        </div>
      </div>

      {/* Recovery Benchmarking */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-slate-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <span className="text-sm font-medium text-white">Recovery Benchmarks</span>
          <span className="ml-auto text-[10px] text-slate-500 font-medium">vs AU industry average</span>
        </div>
        <div className="space-y-3">
          {[
            {
              label: 'Recovery Rate',
              yours: data.recovery_rate,
              industry: 38,
              unit: '%',
              higherIsBetter: true,
            },
            {
              label: 'Days to Recover',
              yours: data.avg_days_to_recover,
              industry: 14,
              unit: 'd',
              higherIsBetter: false,
            },
            {
              label: 'Auto-Resolution',
              yours: Math.round((data.recovered_today + (data.plans_active || 0)) / Math.max(data.failed_today || 1, 1) * 100),
              industry: 22,
              unit: '%',
              higherIsBetter: true,
            },
          ].map((b, i) => {
            const better = b.higherIsBetter ? b.yours >= b.industry : b.yours <= b.industry
            const maxVal = Math.max(b.yours, b.industry, 1)
            const yoursWidth = Math.round((b.yours / maxVal) * 100)
            const industryWidth = Math.round((b.industry / maxVal) * 100)
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">{b.label}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`font-semibold tabular-nums ${better ? 'text-emerald-400' : 'text-amber-400'}`}>
                      You: {b.yours}{b.unit}
                    </span>
                    <span className="text-slate-600 tabular-nums">Avg: {b.industry}{b.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 h-2">
                  <div className="flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${better ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(yoursWidth, 100)}%` }}
                    />
                  </div>
                  <div className="w-px h-3 bg-slate-600" />
                  <div className="text-[9px] text-slate-600 shrink-0 tabular-nums w-10">
                    Avg {industryWidth}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-600 mt-3">Industry benchmarks sourced from Australian Banking Association and CommBank Business Insights 2024</p>
      </div>

      {/* Retry Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4 md:mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span className="text-sm font-medium text-white">Retry Queue</span>
            {data.retry_queue?.length > 0 && (
              <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                {data.retry_queue.length}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">Scheduled retries in progress</span>
        </div>

        {!data.retry_queue?.length ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            All payments healthy — no retries currently queued
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {data.retry_queue.map((item) => {
              const d = item.days_until_retry
              const isOverdue = d !== null && d < 0
              const isToday   = d === 0
              const isSoon    = d !== null && d > 0 && d <= 2

              let countdownText  = 'Unscheduled'
              let countdownColor = 'text-slate-500'
              if (item.retry_scheduled_date) {
                if (isOverdue)     { countdownText = 'Overdue';               countdownColor = 'text-red-400' }
                else if (isToday)  { countdownText = 'Today';                 countdownColor = 'text-amber-400' }
                else if (isSoon)   { countdownText = `In ${d} day${d !== 1 ? 's' : ''}`;  countdownColor = 'text-amber-400' }
                else               { countdownText = `In ${d} days`;          countdownColor = 'text-blue-400' }
              }

              const formattedDate = item.retry_scheduled_date
                ? new Date(item.retry_scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                : null

              return (
                <div key={item.dishonour_id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-800/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white truncate">{item.payer_name}</span>
                      <span className="text-xs text-slate-400 tabular-nums shrink-0">
                        {(item.amount_cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{item.reason_label}</div>
                    {item.retry_timing_reason && (
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">{item.retry_timing_reason}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-semibold tabular-nums ${countdownColor}`}>{countdownText}</div>
                    {formattedDate && (
                      <div className="text-[11px] text-slate-500">{formattedDate}</div>
                    )}
                    <div className="text-[11px] text-slate-600 mt-0.5">Attempt {item.retry_attempt_count + 1}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 md:mb-6">
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

      {/* ── Cash Flow Forecast widget ── */}
      {cashflow && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4 md:mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-base">📈</span>
              <span className="text-sm font-medium text-white">14-Day Cash Flow Forecast</span>
            </div>
            <button
              onClick={() => navigate('/cashflow')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              View full forecast →
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: key numbers */}
              <div className="space-y-2">
                <div>
                  <div className="text-2xl font-bold text-emerald-400 tracking-tight">{formatCents(cashflow.best_case_cents)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">expected over 14 days</div>
                </div>
                {cashflow.at_risk_total_cents > 0 && (
                  <div>
                    <div className="text-base font-semibold text-amber-400">{formatCents(cashflow.at_risk_total_cents)} at risk</div>
                    <div className="text-xs text-slate-500">{cashflow.high_risk_count} high-risk payment{cashflow.high_risk_count !== 1 ? 's' : ''}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-emerald-400">~{formatCents(cashflow.retryly_recovers_cents)} recoverable</div>
                  <div className="text-xs text-slate-500">estimated auto-recovery</div>
                </div>
                {cashflow.claude_insight && (
                  <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-slate-800 mt-3 line-clamp-2">
                    {cashflow.claude_insight}
                  </p>
                )}
              </div>
              {/* Right: mini stacked bar chart */}
              {cashflow.daily_forecast && cashflow.daily_forecast.length > 0 && (
                <div
                  className="cursor-pointer"
                  onClick={() => navigate('/cashflow')}
                  title="Click to view full forecast"
                >
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart
                      data={cashflow.daily_forecast.map(d => ({
                        day: d.day_label.split(' ').slice(0, 2).join(' '),
                        safe:   d.day_safe_cents   / 100,
                        medium: d.day_medium_cents  / 100,
                        high:   d.day_high_cents    / 100,
                      }))}
                      barSize={16}
                      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    >
                      <Tooltip
                        formatter={(v, name) => [`$${v.toFixed(0)}`, name]}
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 11, color: '#f1f5f9' }}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      />
                      <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="safe"   name="Safe"        stackId="a" fill="#10b981" radius={[0,0,0,0]} />
                      <Bar dataKey="medium" name="Medium risk" stackId="a" fill="#f59e0b" radius={[0,0,0,0]} />
                      <Bar dataKey="high"   name="High risk"   stackId="a" fill="#ef4444" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
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
