import { useState, useEffect, useCallback } from 'react'
import { getCashFlowForecast, sendCashFlowReminder } from '../api'
import { formatCents } from '../utils/formatters'

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgoMinutes(isoString) {
  if (!isoString) return 'just now'
  const secs = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

const RISK_COLOR = {
  high:   { dot: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400 border-red-500/25',    label: 'High risk' },
  medium: { dot: 'bg-amber-400',  badge: 'bg-amber-400/15 text-amber-400 border-amber-400/25', label: 'Medium risk' },
  low:    { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Low risk' },
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-pulse">
      <div className="h-7 w-48 bg-slate-800 rounded mb-2" />
      <div className="h-4 w-72 bg-slate-800/60 rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-28" />
        ))}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-20 mb-6" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-16" />
        ))}
      </div>
    </div>
  )
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCard({ icon, value, label, sub, accent, iconBg }) {
  return (
    <div className={`bg-slate-900 border ${accent} rounded-xl p-5`}>
      <div className={`inline-flex p-2 rounded-lg mb-3 ${iconBg}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-600 mt-1">{sub}</div>}
    </div>
  )
}

// ── Payer chip ────────────────────────────────────────────────────────────────

function PayerChip({ payment, onSendReminder, reminderSent, sending }) {
  const rc = RISK_COLOR[payment.risk_level] || RISK_COLOR.low
  const needsReminder = payment.risk_level !== 'low'
  const sent = reminderSent || payment.pre_debit_reminder_sent

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${rc.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rc.dot}`} />
      <span className="font-medium truncate max-w-[100px]">{payment.payer_name}</span>
      <span className="shrink-0 tabular-nums">{formatCents(payment.amount_cents)}</span>
      {needsReminder && (
        sent ? (
          <span className="ml-1 text-[10px] text-emerald-400 font-semibold shrink-0">✓ Reminded</span>
        ) : (
          <button
            onClick={() => onSendReminder(payment.payer_id)}
            disabled={sending}
            className="ml-1 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 border border-slate-600 px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 shrink-0 whitespace-nowrap"
          >
            {sending ? '…' : 'Remind'}
          </button>
        )
      )}
    </div>
  )
}

// ── Day row ───────────────────────────────────────────────────────────────────

function DayRow({ day, maxDayTotal, isBiggestRisk, remindersSent, sendingIds, onSendReminder }) {
  const barWidth = maxDayTotal > 0 ? (day.day_total_cents / maxDayTotal) * 100 : 0
  const total = day.day_total_cents || 1
  const safePct  = (day.day_safe_cents   / total * 100).toFixed(1)
  const medPct   = (day.day_medium_cents / total * 100).toFixed(1)
  const highPct  = (day.day_high_cents   / total * 100).toFixed(1)
  const allSafe  = day.day_at_risk_cents === 0

  const dayLabel = day.day_label  // "Monday 28 July"
  const [weekday, ...rest] = dayLabel.split(' ')
  const dateStr = rest.join(' ')

  return (
    <div className={`border rounded-xl p-4 transition-colors ${
      isBiggestRisk
        ? 'border-red-500/30 bg-red-950/10'
        : 'border-slate-800 bg-slate-900/40'
    }`}>
      {isBiggestRisk && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Biggest risk day</span>
        </div>
      )}

      {/* Desktop layout */}
      <div className="hidden md:flex items-start gap-4">
        {/* Date */}
        <div className="w-28 shrink-0">
          <div className="text-sm font-semibold text-white">{weekday}</div>
          <div className="text-xs text-slate-400">{dateStr}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            {day.days_from_now === 0 ? 'today' : day.days_from_now === 1 ? 'tomorrow' : `in ${day.days_from_now} days`}
          </div>
        </div>

        {/* Bar + payers */}
        <div className="flex-1 min-w-0">
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-2.5">
            <div className="h-full flex" style={{ width: `${barWidth}%` }}>
              <div className="h-full bg-emerald-500" style={{ width: `${safePct}%` }} />
              <div className="h-full bg-amber-400" style={{ width: `${medPct}%` }} />
              <div className="h-full bg-red-500"   style={{ width: `${highPct}%` }} />
            </div>
          </div>
          {allSafe ? (
            <span className="text-xs text-emerald-400 font-medium">✓ All safe</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {day.payments.map((p) => (
                <PayerChip
                  key={p.payment_id}
                  payment={p}
                  reminderSent={remindersSent.has(p.payer_id)}
                  sending={sendingIds.has(p.payer_id)}
                  onSendReminder={onSendReminder}
                />
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="w-32 shrink-0 text-right">
          <div className="text-sm font-semibold text-white">{formatCents(day.day_total_cents)}</div>
          <div className="text-[11px] text-slate-500">expected</div>
          {day.day_at_risk_cents > 0 && (
            <div className="text-xs font-semibold text-amber-400 mt-0.5">{formatCents(day.day_at_risk_cents)} at risk</div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-semibold text-white">{weekday} </span>
            <span className="text-sm text-slate-400">{dateStr}</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-white">{formatCents(day.day_total_cents)}</div>
            {day.day_at_risk_cents > 0 && (
              <div className="text-[11px] text-amber-400">{formatCents(day.day_at_risk_cents)} at risk</div>
            )}
          </div>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
          <div className="h-full flex" style={{ width: `${barWidth}%` }}>
            <div className="h-full bg-emerald-500" style={{ width: `${safePct}%` }} />
            <div className="h-full bg-amber-400"   style={{ width: `${medPct}%` }} />
            <div className="h-full bg-red-500"     style={{ width: `${highPct}%` }} />
          </div>
        </div>
        {allSafe ? (
          <span className="text-xs text-emerald-400 font-medium">✓ All safe</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {day.payments.map((p) => (
              <PayerChip
                key={p.payment_id}
                payment={p}
                reminderSent={remindersSent.has(p.payer_id)}
                sending={sendingIds.has(p.payer_id)}
                onSendReminder={onSendReminder}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CashFlowForecast() {
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [remindersSent, setRemindersSent] = useState(new Set())
  const [sendingIds, setSendingIds] = useState(new Set())
  const [sendingAll, setSendingAll] = useState(false)
  const [allSentCount, setAllSentCount] = useState(0)

  const load = useCallback(async (force = false) => {
    setError(null)
    if (!force) setLoading(true)
    try {
      const { data } = await getCashFlowForecast(force)
      setForecast(data)
      setGeneratedAt(data.generated_at)
    } catch (e) {
      setError('Unable to load forecast — check your Pinch connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSendReminder = async (payerId) => {
    setSendingIds(prev => new Set(prev).add(payerId))
    try {
      await sendCashFlowReminder(payerId)
      setRemindersSent(prev => new Set(prev).add(payerId))
    } catch {
      // fail silently — reminder button stays active
    } finally {
      setSendingIds(prev => { const s = new Set(prev); s.delete(payerId); return s })
    }
  }

  const handleSendAllPending = async () => {
    if (!forecast) return
    setSendingAll(true)
    const pending = []
    for (const day of forecast.daily_forecast) {
      for (const p of day.payments) {
        if (
          p.risk_level !== 'low' &&
          !p.pre_debit_reminder_sent &&
          !remindersSent.has(p.payer_id)
        ) {
          pending.push(p.payer_id)
        }
      }
    }
    const unique = [...new Set(pending)]
    let count = 0
    for (const pid of unique) {
      try {
        await sendCashFlowReminder(pid)
        setRemindersSent(prev => new Set(prev).add(pid))
        count++
      } catch {}
    }
    setAllSentCount(count)
    setSendingAll(false)
  }

  if (loading) return <Skeleton />

  if (error) return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-8 text-center">
        <div className="text-red-400 font-semibold mb-2">{error}</div>
        <button
          onClick={() => load(true)}
          className="mt-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )

  const { summary, daily_forecast, claude_insight, pre_debit_reminders_sent, pre_debit_reminders_pending } = forecast || {}

  if (!summary || summary.best_case_cents === 0 && daily_forecast?.length === 0) return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Cash Flow Forecast</h1>
        <p className="text-slate-500 text-sm mt-0.5">Next 14 days — based on scheduled payments and payer risk scores</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">📅</div>
        <div className="text-white font-semibold mb-2">No scheduled payments in the next 14 days</div>
        <div className="text-slate-400 text-sm">
          Connect your Pinch account and seed test data to see your forecast.
        </div>
      </div>
    </div>
  )

  const maxDayTotal = Math.max(...(daily_forecast || []).map(d => d.day_total_cents), 1)
  const biggestRiskDate = summary?.biggest_risk_date

  // Calculate pending reminders including locally sent ones
  const totalAtRiskPayers = new Set()
  for (const day of daily_forecast || []) {
    for (const p of day.payments) {
      if (p.risk_level !== 'low') totalAtRiskPayers.add(p.payer_id)
    }
  }
  const alreadySent = new Set([
    ...(daily_forecast || []).flatMap(d => d.payments.filter(p => p.pre_debit_reminder_sent).map(p => p.payer_id)),
    ...remindersSent,
  ])
  const pendingCount = [...totalAtRiskPayers].filter(id => !alreadySent.has(id)).length

  const atRiskColor = summary.at_risk_total_cents > 0
    ? (summary.high_risk_count > 0 ? 'border-red-500/30 bg-red-950/5' : 'border-amber-500/30 bg-amber-950/5')
    : 'border-slate-800'

  return (
    <div className="p-4 md:p-8 max-w-5xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Cash Flow Forecast</h1>
          <p className="text-slate-500 text-sm mt-0.5">Next 14 days — based on scheduled payments and payer risk scores</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500">Updated {timeAgoMinutes(generatedAt)}</span>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
        <SummaryCard
          icon="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"
          value={formatCents(summary.best_case_cents)}
          label="Best Case"
          sub="If all payments succeed"
          accent="border-emerald-500/20"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />
        <SummaryCard
          icon="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"
          value={formatCents(summary.at_risk_total_cents)}
          label="At Risk"
          sub={`${summary.high_risk_count + summary.medium_risk_count} payments flagged`}
          accent={atRiskColor}
          iconBg={summary.high_risk_count > 0 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}
        />
        <SummaryCard
          icon="M1 4l1 10 7 10M3.51 15a9 9 0 100 .98"
          value={`~${formatCents(summary.retryly_recovers_cents)}`}
          label="Retryly Recovers"
          sub="Estimated auto-recovery"
          accent="border-emerald-500/20"
          iconBg="bg-emerald-500/10 text-emerald-400"
        />
        <SummaryCard
          icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          value={formatCents(summary.worst_case_cents)}
          label="Worst Case"
          sub="If high-risk payments fail"
          accent="border-slate-700"
          iconBg="bg-slate-800 text-slate-400"
        />
      </div>

      {/* ── Claude AI Insight ── */}
      {claude_insight && (
        <div className="bg-slate-900 border-l-[3px] border-l-emerald-400 border border-slate-800 rounded-xl p-5 mb-5 flex gap-3">
          <span className="text-lg shrink-0 mt-0.5">💡</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-white">AI Insight</span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">✨ AI</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{claude_insight}</p>
            <p className="text-[11px] text-slate-600 mt-1.5">Updates automatically as payments are processed</p>
          </div>
        </div>
      )}

      {/* ── 14-day timeline ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">14-Day Payment Timeline</h2>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> Safe</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/> Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> High</span>
          </div>
        </div>

        {daily_forecast && daily_forecast.length > 0 ? (
          <div className="space-y-2">
            {daily_forecast.map((day) => (
              <DayRow
                key={day.date}
                day={day}
                maxDayTotal={maxDayTotal}
                isBiggestRisk={day.day_label === biggestRiskDate && day.day_at_risk_cents > 0}
                remindersSent={remindersSent}
                sendingIds={sendingIds}
                onSendReminder={handleSendReminder}
              />
            ))}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
            No scheduled payments in the forecast window.
          </div>
        )}
      </div>

      {/* ── Reminder footer ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white mb-0.5">Pre-debit Reminders</div>
            <div className="text-xs text-slate-500">
              {alreadySent.size > 0 ? `${alreadySent.size} sent` : '0 sent'}
              {pendingCount > 0 ? ` · ${pendingCount} pending` : ' · none pending'}
            </div>
            {allSentCount > 0 && (
              <div className="text-xs text-emerald-400 mt-1 font-medium">✓ {allSentCount} reminder{allSentCount !== 1 ? 's' : ''} sent</div>
            )}
          </div>
          {pendingCount > 0 && (
            <button
              onClick={handleSendAllPending}
              disabled={sendingAll}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {sendingAll ? 'Sending…' : `Send all ${pendingCount} pending reminder${pendingCount !== 1 ? 's' : ''}`}
            </button>
          )}
          {pendingCount === 0 && (
            <span className="text-xs text-emerald-400 font-medium">✓ All at-risk payers reminded</span>
          )}
        </div>
      </div>

    </div>
  )
}
