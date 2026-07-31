import { useState } from 'react'
import { demoSeed, demoTrigger, demoTimeTravel, demoReset, sendPreDebitReminders } from '../api'
import { Icons } from './Icons'

function Toast({ msg, type, onDismiss }) {
  if (!msg) return null
  return (
    <div
      onClick={onDismiss}
      className={`fixed bottom-5 right-5 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl z-50 cursor-pointer border ${
        type === 'success'
          ? 'bg-slate-900 border-emerald-500/30 text-white'
          : 'bg-slate-900 border-red-500/30 text-white'
      }`}
    >
      <span className={type === 'success' ? 'text-emerald-400' : 'text-red-400'}>
        {type === 'success' ? Icons.check : Icons.x}
      </span>
      {msg}
    </div>
  )
}

const buttons = [
  {
    key: 'seed',
    label: 'Seed Test Data',
    description: 'Create 4 payers in Pinch sandbox',
    icon: Icons.seed,
    fn: demoSeed,
    success: '4 payers created in Pinch',
  },
  {
    key: 'nsf',
    label: 'Trigger NSF Failure',
    description: 'Simulate insufficient funds',
    icon: Icons.warning,
    fn: () => demoTrigger('insufficient-funds'),
    success: 'NSF failure triggered',
  },
  {
    key: 'closed',
    label: 'Trigger Closed Account',
    description: 'Simulate account-closed dishonour',
    icon: Icons.x,
    fn: () => demoTrigger('account-closed'),
    success: 'Closed account triggered',
  },
  {
    key: 'mixed',
    label: 'Trigger Mixed Batch',
    description: '5 failures · full AI processing',
    icon: Icons.lightning,
    fn: () => demoTrigger('mixed'),
    success: '5 dishonours processed with AI',
    primary: true,
  },
  {
    key: 'time',
    label: 'Fast-Forward +4 Days',
    description: 'Advance all retrying payments',
    icon: Icons.clock,
    fn: demoTimeTravel,
    success: 'Retrying payments advanced',
  },
  {
    key: 'reminders',
    label: 'Send Pre-Debit Reminders',
    description: 'Email at-risk payers before payment date',
    icon: Icons.send,
    fn: sendPreDebitReminders,
    success: 'Pre-debit reminders sent',
  },
  {
    key: 'reset',
    label: 'Reset Demo',
    description: 'Clear all data from database',
    icon: Icons.trash,
    fn: demoReset,
    success: 'Demo data cleared',
    danger: true,
  },
]

export default function DemoControls({ onTriggerMixed }) {
  const [loading, setLoading] = useState({})
  const [toast, setToast] = useState({ msg: '', type: '' })

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: '' }), 3000)
  }

  const run = async (key, fn, successMsg, onSuccess) => {
    setLoading(l => ({ ...l, [key]: true }))
    try {
      await fn()
      showToast(successMsg)
      onSuccess?.()
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Something went wrong', 'error')
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-white">Sandbox Controls</h1>
          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Test Mode
          </span>
        </div>
        <p className="text-slate-500 text-sm">Trigger demo scenarios for the video walkthrough</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {buttons.map(({ key, label, description, icon, fn, success, primary, danger }) => (
          <button
            key={key}
            disabled={!!loading[key]}
            onClick={() => run(key, fn, success, key === 'mixed' ? onTriggerMixed : undefined)}
            className={`group relative flex items-start gap-4 p-5 rounded-xl border text-left transition-all disabled:opacity-50 ${
              primary
                ? 'bg-emerald-600/10 border-emerald-500/30 hover:bg-emerald-600/20 hover:border-emerald-500/50'
                : danger
                ? 'bg-slate-900 border-slate-800 hover:border-red-500/30 hover:bg-red-500/5'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${
              primary ? 'bg-emerald-500/20 text-emerald-400' :
              danger ? 'bg-slate-800 text-slate-500 group-hover:text-red-400' :
              'bg-slate-800 text-slate-400 group-hover:text-slate-200'
            }`}>
              {loading[key] ? Icons.loader : icon}
            </div>
            <div>
              <div className={`text-sm font-medium ${primary ? 'text-emerald-300' : 'text-white'}`}>
                {label}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{description}</div>
            </div>
            {primary && (
              <span className="absolute top-3 right-3 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                PRIMARY
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Demo Script</div>
        <div className="space-y-3">
          {[
            { step: '01', text: 'Seed Test Data', sub: 'Creates Sarah, James, Mike, and Lisa in Pinch sandbox' },
            { step: '02', text: 'Trigger Mixed Batch', sub: '5 failures processed instantly with AI explanations' },
            { step: '03', text: 'Review Agent Inbox', sub: '3 auto-recovering · 1 needs re-auth · 1 escalated' },
            { step: '04', text: 'Approve Retry', sub: 'Manually trigger retry on escalated item via Pinch API' },
            { step: '05', text: 'Check Dashboard', sub: 'Live recovery stats and AI-written overnight summary' },
          ].map(({ step, text, sub }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="text-[11px] font-mono text-slate-600 mt-0.5 shrink-0 w-5">{step}</span>
              <div>
                <div className="text-sm text-slate-300 font-medium">{text}</div>
                <div className="text-xs text-slate-600 mt-0.5">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: '', type: '' })} />
    </div>
  )
}
