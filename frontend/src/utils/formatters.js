export function formatCents(cents) {
  if (cents == null) return '$0.00'
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

export function timeAgo(datetime) {
  if (!datetime) return ''
  const now = new Date()
  const then = new Date(datetime)
  const secs = Math.floor((now - then) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function statusColor(status) {
  const map = {
    retrying:            'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    recovered:           'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    needs_attention:     'bg-red-500/10 text-red-400 border border-red-500/20',
    message_sent:        'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    pending:             'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    plan_active:         'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    written_off:         'bg-slate-700/20 text-slate-500 border border-slate-700',
    duplicate_prevented: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  }
  return map[status] || map.pending
}

export function statusLabel(status) {
  const map = {
    retrying:            'Retrying',
    recovered:           'Recovered',
    needs_attention:     'Needs Attention',
    message_sent:        'Sent',
    pending:             'Pending',
    plan_active:         'Plan Active',
    written_off:         'Written Off',
    duplicate_prevented: 'Duplicate Prevented',
    escalated:           'Escalated',
  }
  return map[status] || status
}
