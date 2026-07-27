import { useEffect, useState } from 'react'
import { getDishonours, approveRetry, sendMessage, markResolved, exportDishonours } from '../api'
import { formatCents, statusColor, statusLabel, timeAgo } from '../utils/formatters'
import { Icons } from './Icons'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs Attention' },
  { key: 'retrying', label: 'Retrying' },
  { key: 'recovered', label: 'Recovered' },
]

function ActionButton({ onClick, disabled, loading, children, variant = 'default' }) {
  const variants = {
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700',
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500',
    blue: 'bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/50',
    amber: 'bg-amber-600/80 hover:bg-amber-600 text-white border-amber-500/50',
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
