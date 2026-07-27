import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { connectPinch, savePreferences, getWebhookUrl } from '../api'

const STEPS = ['Connect Pinch', 'Set up Webhook', 'Your Preferences']

function Step1({ onNext }) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleConnect = async () => {
    if (!key.trim()) return
    setLoading(true)
    try {
      const { data } = await connectPinch(key.trim())
      setResult(data)
      toast.success(`Connected — found ${data.payer_count} customer(s)`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Pinch API Key</label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk_live_..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          Find your API key: Pinch Portal → Developer → API Keys
        </p>
      </div>
      {result && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-emerald-400 text-sm">Connected — {result.payer_count} customer(s) found</span>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleConnect}
          disabled={loading || !key.trim()}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {loading ? 'Verifying…' : 'Verify API Key'}
        </button>
        {result && (
          <button
            onClick={onNext}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}

function Step2({ onNext }) {
  const [webhookUrl, setWebhookUrl] = useState('')

  useState(() => {
    getWebhookUrl()
      .then(({ data }) => setWebhookUrl(data.webhook_url))
      .catch(() => {})
  })

  const copy = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Add this webhook URL to your Pinch Portal to start receiving failed payment events.</p>
      <ol className="text-sm text-slate-400 space-y-1.5 list-decimal list-inside">
        <li>Log in to Pinch Portal</li>
        <li>Go to Settings → Webhooks</li>
        <li>Click Add Webhook</li>
        <li>Paste the URL below</li>
        <li>Select event: <span className="text-white font-mono">bank-results</span></li>
        <li>Save</li>
      </ol>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-emerald-400 break-all">
          {webhookUrl || 'Loading…'}
        </code>
        <button
          onClick={copy}
          className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors shrink-0"
        >
          Copy
        </button>
      </div>
      <button
        onClick={onNext}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
      >
        I've added the webhook →
      </button>
    </div>
  )
}

function Step3({ onDone }) {
  const [prefs, setPrefs] = useState({
    auto_retry: true,
    retry_days: 4,
    max_retries: 3,
    business_name: '',
    sender_email: '',
    notify_channel: 'email',
  })
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await savePreferences(prefs)
      toast.success('Preferences saved!')
      onDone()
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-white">Auto retry</div>
          <div className="text-xs text-slate-500">Automatically retry soft failures</div>
        </div>
        <button
          onClick={() => setPrefs(p => ({ ...p, auto_retry: !p.auto_retry }))}
          className={`relative w-10 h-5 rounded-full transition-colors ${prefs.auto_retry ? 'bg-emerald-600' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${prefs.auto_retry ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Retry after (days): {prefs.retry_days}</label>
        <input
          type="range" min="3" max="7" value={prefs.retry_days}
          onChange={e => setPrefs(p => ({ ...p, retry_days: +e.target.value }))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Max retries</label>
        <select
          value={prefs.max_retries}
          onChange={e => setPrefs(p => ({ ...p, max_retries: +e.target.value }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Business name</label>
        <input
          type="text" value={prefs.business_name}
          onChange={e => setPrefs(p => ({ ...p, business_name: e.target.value }))}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          placeholder="Your Business Pty Ltd"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Sender email</label>
        <input
          type="email" value={prefs.sender_email}
          onChange={e => setPrefs(p => ({ ...p, sender_email: e.target.value }))}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          placeholder="billing@yourbusiness.com.au"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Notification channel</label>
        <div className="flex gap-2">
          {['email', 'sms', 'both'].map(ch => (
            <button
              key={ch}
              onClick={() => setPrefs(p => ({ ...p, notify_channel: ch }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${prefs.notify_channel === ch ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? 'Saving…' : 'Start recovering payments →'}
      </button>
    </div>
  )
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">Retryly</span>
        </div>

        <div className="flex items-center gap-1 mb-6 justify-center">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${i === step ? 'bg-emerald-600 text-white' : i < step ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-emerald-600' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-1">{STEPS[step]}</h2>
          <div className="w-full h-px bg-slate-800 mb-4" />

          {step === 0 && <Step1 onNext={() => setStep(1)} />}
          {step === 1 && <Step2 onNext={() => setStep(2)} />}
          {step === 2 && <Step3 onDone={() => navigate('/dashboard')} />}
        </div>
      </div>
    </div>
  )
}
