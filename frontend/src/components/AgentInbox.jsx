import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getDishonours, approveRetry, sendMessage, markResolved, writeOff, acceptPlan, resendLink, getAuditLog, exportDishonours, getRiskReport } from '../api'
import { formatCents, statusColor, statusLabel, timeAgo } from '../utils/formatters'
import { Icons } from './Icons'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs Attention' },
  { key: 'retrying', label: 'Retrying' },
  { key: 'recovered', label: 'Recovered' },
  { key: 'at_risk', label: 'At Risk' },
]

function ActionButton({ onClick, disabled, loading, children, variant = 'default' }) {
  const variants = {
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700',
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500',
    blue: 'bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/50',
    amber: 'bg-amber-600/80 hover:bg-amber-600 text-white border-amber-500/50',
    red: 'bg-red-900/50 hover:bg-red-900 text-red-400 border-red-800',
  }
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 ${variants[variant]}`}
    >
      {loading ? Icons.loader : children}
    </button>
  )
}

function PaymentLinkPanel({ item, onResend, loading }) {
  const url = item.payment_link_url || item.reauth_link
  const expires = item.payment_link_expires_at ? new Date(item.payment_link_expires_at) : null
  const daysLeft = expires ? Math.floor((expires - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const status = item.payment_link_status || 'sent'

  if (status === 'paid') return (
    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      <div className="text-emerald-400 font-medium text-sm">✅ Customer paid via link</div>
    </div>
  )

  return (
    <div className="p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-blue-400">🔗</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Payment Link</span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border font-medium ${
          status === 'viewed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
          status === 'expired' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
          'bg-slate-500/10 text-slate-400 border-slate-500/20'
        }`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
      {url && (
        <div className="flex items-center gap-2">
          <input readOnly value={url} className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 truncate" />
          <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Copied!') }}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors shrink-0">Copy</button>
        </div>
      )}
      {daysLeft !== null && (
        <div className={`text-xs ${daysLeft < 2 ? 'text-red-400' : 'text-slate-500'}`}>
          Expires {daysLeft > 0 ? `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'today'}
        </div>
      )}
      <ActionButton variant="amber" loading={loading} disabled={loading} onClick={onResend}>
        Resend Link
      </ActionButton>
    </div>
  )
}

function PlanPanel({ item, onAccept, loading }) {
  const options = item.plan_options?.options || []
  const [selected, setSelected] = useState(null)
  const [confirmed, setConfirmed] = useState(null)

  if (item.plan_accepted_at || item.status === 'plan_active') return (
    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      <div className="text-emerald-400 font-medium text-sm">✅ Plan created — {item.plan_id ? `ID: ${item.plan_id}` : 'active'}</div>
    </div>
  )

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span>💳</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Payment Plan</span>
      </div>
      <p className="text-xs text-slate-500">Better recovery odds with a payment plan</p>
      <div className="grid grid-cols-3 gap-2">
        {(options.length ? options : [
          { num_payments: 2, frequency: 'fortnightly', recommended: false, amount_per_payment: Math.floor(item.amount_cents / 2) },
          { num_payments: 3, frequency: 'fortnightly', recommended: true, amount_per_payment: Math.floor(item.amount_cents / 3) },
          { num_payments: 4, frequency: 'monthly', recommended: false, amount_per_payment: Math.floor(item.amount_cents / 4) },
        ]).map((opt, i) => (
          <button
            key={i}
            onClick={() => setSelected(i + 1)}
            className={`p-2 rounded-lg border text-left transition-all text-xs ${selected === i + 1 ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
          >
            <div className="font-semibold">{opt.num_payments}x {formatCents(opt.amount_per_payment)}</div>
            <div className="text-[10px] opacity-70 capitalize">{opt.frequency}</div>
            {opt.recommended && <div className="text-[10px] text-emerald-400">⭐ Recommended</div>}
          </button>
        ))}
      </div>
      {selected && !confirmed && (
        <ActionButton variant="primary" loading={loading} disabled={loading}
          onClick={() => { onAccept(selected); setConfirmed(selected) }}>
          Confirm Plan
        </ActionButton>
      )}
    </div>
  )
}

function AuditLog({ id }) {
  const [log, setLog] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getAuditLog(id)
      setLog(data.log)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-slate-800">
      <button
        onClick={() => { if (!open) load(); setOpen(o => !o) }}
        className="w-full px-5 py-2 text-left text-xs text-slate-500 hover:text-slate-400 transition-colors"
      >
        {open ? '▲' : '▼'} View Audit Log
      </button>
      {open && (
        <div className="px-5 pb-3">
          {loading ? <div className="text-xs text-slate-500">Loading…</div> : (
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500">
                <th className="text-left pb-1">Time</th>
                <th className="text-left pb-1">Action</th>
                <th className="text-left pb-1">Outcome</th>
              </tr></thead>
              <tbody>
                {(log || []).map((entry, i) => (
                  <tr key={i} className="border-t border-slate-800/50">
                    <td className="py-1 text-slate-500">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="py-1 text-slate-400 capitalize">{entry.action}</td>
                    <td className="py-1 text-slate-400">{entry.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function MessagePanel({ item }) {
  const [channel, setChannel] = useState('email')

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Draft Customer Message</div>
        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md p-0.5">
          <button onClick={() => setChannel('email')} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${channel === 'email' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Email</button>
          <button onClick={() => setChannel('sms')} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${channel === 'sms' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>SMS</button>
        </div>
      </div>
      {channel === 'email' ? (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-[inherit] max-h-40 overflow-y-auto">
          {item.claude_customer_message || 'Generating...'}
        </div>
      ) : (
        <div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-[inherit]">
            {item.claude_sms_message || 'Generating...'}
          </div>
          {item.claude_sms_message && (
            <div className={`mt-1.5 text-right text-[10px] tabular-nums ${item.claude_sms_message.length > 160 ? 'text-red-400' : 'text-slate-600'}`}>
              {item.claude_sms_message.length}/160 chars
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AtRiskCard({ payer }) {
  return (
    <div className="bg-slate-900 border border-red-800/40 rounded-xl overflow-hidden hover:border-red-700/50 transition-colors">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{payer.payer_name}</span>
            {payer.amount > 0 && <><span className="text-slate-600">·</span><span className="text-sm text-white tabular-nums">{formatCents(payer.amount)}</span></>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{payer.scheduled_date ? `Due: ${new Date(payer.scheduled_date).toLocaleDateString()}` : 'Upcoming payment'}</div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium ${payer.risk_level === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
          {payer.risk_level === 'high' ? '🔴' : '🟡'} {payer.risk_level.charAt(0).toUpperCase() + payer.risk_level.slice(1)} · {payer.risk_score}/100
        </span>
      </div>
      <div className="px-5 py-3 flex flex-wrap gap-1.5">
        {(payer.risk_factors || []).map((f, i) => (
          <span key={i} className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">{f}</span>
        ))}
      </div>
    </div>
  )
}

export default function AgentInbox({ inboxCount: propCount }) {
  const [tab, setTab] = useState('all')
  const [items, setItems] = useState([])
  const [riskItems, setRiskItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState({})

  const load = async (status = tab) => {
    setLoading(true)
    try {
      if (status === 'at_risk') {
        const { data } = await getRiskReport()
        setRiskItems(data)
        setTotal(data.length)
        setItems([])
      } else {
        const { data } = await getDishonours(status)
        setItems(data.items)
        setTotal(data.total)
        setRiskItems([])
      }
    } catch {
      toast.error('Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(tab) }, [tab])

  const act = async (id, fn, label) => {
    setActing(a => ({ ...a, [id]: label }))
    try {
      await fn(id)
      toast.success('Done')
      await load(tab)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed')
    } finally {
      setActing(a => { const n = { ...a }; delete n[id]; return n })
    }
  }

  const EMPTY_MESSAGES = {
    all: '✅ All payments healthy — nothing to action',
    needs_attention: '✅ All payments healthy — nothing to action',
    retrying: 'No payments currently retrying',
    recovered: 'No recovered payments yet',
    at_risk: '✅ No high-risk payments in the next 3 days',
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Agent Inbox</h1>
          <p className="text-slate-500 text-sm mt-0.5">Failed payments requiring review or action</p>
        </div>
        <button onClick={exportDishonours} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 transition-all">
          {Icons.download} Export Excel
        </button>
      </div>

      <div className="flex items-center gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${tab === t.key ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t.label}
            {t.key === tab && total > 0 && <span className="ml-1.5 text-slate-400 tabular-nums">{total}</span>}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Loading…</div>}

      {!loading && tab === 'at_risk' && riskItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-emerald-400 mb-3">{Icons.checkCircle}</div>
          <div className="text-base font-medium text-white">{EMPTY_MESSAGES['at_risk']}</div>
        </div>
      )}

      {!loading && tab === 'at_risk' && (
        <div className="space-y-3">
          {riskItems.map(p => <AtRiskCard key={p.payer_id} payer={p} />)}
        </div>
      )}

      {!loading && tab !== 'at_risk' && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-emerald-400 mb-3">{Icons.checkCircle}</div>
          <div className="text-base font-medium text-white">{EMPTY_MESSAGES[tab] || 'Nothing here'}</div>
        </div>
      )}

      <div className="space-y-3">
        {tab !== 'at_risk' && items.map(item => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{item.payer_name}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-sm font-mono text-white tabular-nums">{formatCents(item.amount_cents)}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{item.reason_label}</div>
              </div>
              <div className="flex items-center gap-2">
                {item.retry_attempt_count > 0 && (
                  <span className="text-[10px] text-slate-400 tabular-nums">Attempt {item.retry_attempt_count}</span>
                )}
                {item.recovery_probability && item.recovery_probability !== 'Low' && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {item.recovery_probability}
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium ${statusColor(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
            </div>

            {/* Max retries warning */}
            {item.max_retries_reached && (
              <div className="px-5 py-3 bg-amber-900/20 border-b border-amber-800/30 flex items-center justify-between gap-3">
                <span className="text-amber-400 text-xs font-medium">⚠️ Max retries reached</span>
                <div className="flex gap-2">
                  <ActionButton variant="amber" disabled={!!acting[item.id]} onClick={() => act(item.id, () => acceptPlan(item.id, 2), 'plan')}>
                    Offer Payment Plan
                  </ActionButton>
                  <ActionButton variant="red" disabled={!!acting[item.id]} loading={acting[item.id] === 'writeoff'} onClick={() => act(item.id, writeOff, 'writeoff')}>
                    Write Off
                  </ActionButton>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 divide-x divide-slate-800">
              <div className="p-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-emerald-400">{Icons.sparkle}</span>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">What happened</span>
                  <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">AI</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{item.claude_explanation || 'Processing...'}</p>
                {item.retry_scheduled_date && (
                  <p className="text-slate-400 text-xs mt-2">
                    🗓️ {item.retry_timing_reason || `Retrying ${item.retry_scheduled_date}`}
                  </p>
                )}
              </div>

              {item.action_taken === 'plan' ? (
                <PlanPanel
                  item={item}
                  loading={acting[item.id] === 'plan'}
                  onAccept={(opt) => act(item.id, (id) => acceptPlan(id, opt), 'plan')}
                />
              ) : item.action_taken === 'reauth' ? (
                <PaymentLinkPanel
                  item={item}
                  loading={acting[item.id] === 'resend'}
                  onResend={() => act(item.id, resendLink, 'resend')}
                />
              ) : (
                <MessagePanel item={item} />
              )}
            </div>

            <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/30 flex-wrap">
              <span className="text-xs text-slate-600 mr-auto">{timeAgo(item.created_at)}</span>
              {item.status === 'needs_attention' && item.action_taken === 'escalate' && (
                <ActionButton variant="primary" loading={acting[item.id] === 'retry'} disabled={!!acting[item.id]} onClick={() => act(item.id, approveRetry, 'retry')}>
                  {Icons.refresh} Approve Retry
                </ActionButton>
              )}
              <ActionButton variant="blue" loading={acting[item.id] === 'send'} disabled={!!acting[item.id]} onClick={() => act(item.id, sendMessage, 'send')}>
                {Icons.send} Send Message
              </ActionButton>
              <ActionButton loading={acting[item.id] === 'resolve'} disabled={!!acting[item.id]} onClick={() => act(item.id, markResolved, 'resolve')}>
                {Icons.check} Resolve
              </ActionButton>
            </div>

            <AuditLog id={item.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MessagePanel({ item }) {
  const [channel, setChannel] = useState('email')

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Draft Customer Message</div>
        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md p-0.5">
          <button
            onClick={() => setChannel('email')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${channel === 'email' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Email
          </button>
          <button
            onClick={() => setChannel('sms')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${channel === 'sms' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            SMS
          </button>
        </div>
      </div>
      {channel === 'email' ? (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-[inherit] max-h-40 overflow-y-auto scrollbar-thin">
          {item.claude_customer_message || 'Generating...'}
        </div>
      ) : (
        <div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-[inherit]">
            {item.claude_sms_message || 'Generating...'}
          </div>
          {item.claude_sms_message && (
            <div className={`mt-1.5 text-right text-[10px] tabular-nums ${item.claude_sms_message.length > 160 ? 'text-red-400' : 'text-slate-600'}`}>
              {item.claude_sms_message.length}/160 chars
            </div>
          )}
        </div>
      )}
      {item.action_taken === 'reauth' && item.reauth_link && (
        <a
          href={item.reauth_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-2.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {Icons.link} Payment re-auth link
        </a>
      )}
    </div>
  )
}

export default function AgentInbox() {
  const [tab, setTab] = useState('all')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState({})

  const load = async (status = tab) => {
    setLoading(true)
    try {
      const { data } = await getDishonours(status)
      setItems(data.items)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(tab) }, [tab])

  const act = async (id, fn, label) => {
    setActing(a => ({ ...a, [id]: label }))
    try {
      await fn(id)
      await load(tab)
    } finally {
      setActing(a => { const n = { ...a }; delete n[id]; return n })
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Agent Inbox</h1>
          <p className="text-slate-500 text-sm mt-0.5">Failed payments requiring review or action</p>
        </div>
        <button
          onClick={exportDishonours}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 transition-all"
        >
          {Icons.download} Export Excel
        </button>
      </div>

      <div className="flex items-center gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.key
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.key === tab && total > 0 && (
              <span className="ml-1.5 text-slate-400 tabular-nums">{total}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Loading...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-emerald-400 mb-3">{Icons.checkCircle}</div>
          <div className="text-base font-medium text-white">All clear</div>
          <div className="text-slate-500 text-sm mt-1">No payments need attention right now</div>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{item.payer_name}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-sm font-mono text-white tabular-nums">{formatCents(item.amount_cents)}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.reason_label}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.recovery_probability && item.recovery_probability !== 'Low' && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {item.recovery_probability}
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium ${statusColor(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-800">
              <div className="p-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-emerald-400">{Icons.sparkle}</span>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">What happened</span>
                  <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">AI</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {item.claude_explanation || 'Processing...'}
                </p>
              </div>
              <MessagePanel item={item} />
            </div>

            <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/30">
              <span className="text-xs text-slate-600 mr-auto">{timeAgo(item.created_at)}</span>
              {item.status === 'needs_attention' && item.action_taken === 'escalate' && (
                <ActionButton
                  variant="primary"
                  loading={acting[item.id] === 'retry'}
                  disabled={!!acting[item.id]}
                  onClick={() => act(item.id, approveRetry, 'retry')}
                >
                  {Icons.refresh} Approve Retry
                </ActionButton>
              )}
              {item.action_taken === 'reauth' && (
                <ActionButton
                  variant="amber"
                  disabled={!!acting[item.id]}
                  onClick={() => item.reauth_link && window.open(item.reauth_link, '_blank')}
                >
                  {Icons.link} Send Re-auth Link
                </ActionButton>
              )}
              <ActionButton
                variant="blue"
                loading={acting[item.id] === 'send'}
                disabled={!!acting[item.id]}
                onClick={() => act(item.id, sendMessage, 'send')}
              >
                {Icons.send} Send Message
              </ActionButton>
              <ActionButton
                loading={acting[item.id] === 'resolve'}
                disabled={!!acting[item.id]}
                onClick={() => act(item.id, markResolved, 'resolve')}
              >
                {Icons.check} Resolve
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
