import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { createMerchant, getMerchantStatus, connectApiKey, savePreferences } from '../api'

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2.5 mb-10 justify-center">
      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
        </svg>
      </div>
      <span className="text-lg font-semibold text-white tracking-tight">Retryly</span>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function Input({ type = 'text', ...props }) {
  return (
    <input
      type={type}
      {...props}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
    />
  )
}

function PrimaryButton({ onClick, disabled, loading, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-6 flex items-center gap-1">
      ← Back
    </button>
  )
}

// ── Screen 1: Choose connection method ────────────────────────────────────────

function ChooseScreen({ onManaged, onApiKey }) {
  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-xl font-semibold text-white mb-2">Connect your Pinch account</h1>
        <p className="text-slate-400 text-sm">Choose how you'd like to connect Retryly to your Pinch payments</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Managed Merchant — Recommended */}
        <div className="relative bg-slate-900 border-2 border-emerald-500/60 rounded-xl p-5 cursor-pointer hover:border-emerald-400 transition-colors" onClick={onManaged}>
          <div className="absolute -top-2.5 right-4 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Recommended
          </div>
          <div className="text-2xl mb-3">✨</div>
          <h3 className="text-sm font-semibold text-white mb-1">Automatic Setup</h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            We create and manage your Pinch connection. No technical steps required.
          </p>
          <ul className="space-y-1.5 mb-5">
            {[
              'No API keys or developer portal',
              'Fully managed by Retryly',
              'Takes about 24 hours to activate',
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                {b}
              </li>
            ))}
          </ul>
          <div className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors text-center">
            Get Started →
          </div>
        </div>

        {/* API Key */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 cursor-pointer hover:border-slate-500 transition-colors" onClick={onApiKey}>
          <div className="text-2xl mb-3">🔑</div>
          <h3 className="text-sm font-semibold text-white mb-1">Connect Existing Account</h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Already have a Pinch account? Connect it directly with your API key.
          </p>
          <ul className="space-y-1.5 mb-5">
            {[
              'Works immediately',
              'Uses your existing Pinch setup',
              'Full control of your account',
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                {b}
              </li>
            ))}
          </ul>
          <div className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors text-center">
            Connect Account →
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500">
        Not sure? Most new users choose <span className="text-slate-300">Automatic Setup</span>.
      </p>
    </div>
  )
}

// ── Screen 2A: Managed merchant form ─────────────────────────────────────────

function ManagedFormScreen({ email, onBack, onSuccess, onActivated }) {
  const [form, setForm] = useState({
    business_name: '',
    abn: '',
    contact_first_name: '',
    contact_last_name: '',
    contact_phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    setError('')
    const required = ['business_name', 'abn', 'contact_first_name', 'contact_last_name', 'contact_phone']
    if (required.some(k => !form[k].trim())) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    try {
      const res = await createMerchant(form)
      if (res.data?.status === 'active') {
        onActivated()
      } else {
        onSuccess()
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <BackLink onClick={onBack} />
      <h2 className="text-base font-semibold text-white mb-1">Tell us about your business</h2>
      <p className="text-slate-500 text-sm mb-5">We'll set up your payment account automatically</p>

      <div className="space-y-4">
        <Field label="Business Name *">
          <Input value={form.business_name} onChange={set('business_name')} placeholder="Acme Plumbing Pty Ltd" />
        </Field>
        <Field label="ABN *" hint="Format: XX XXX XXX XXX">
          <Input value={form.abn} onChange={set('abn')} placeholder="12 345 678 901" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name *">
            <Input value={form.contact_first_name} onChange={set('contact_first_name')} placeholder="Jane" />
          </Field>
          <Field label="Last Name *">
            <Input value={form.contact_last_name} onChange={set('contact_last_name')} placeholder="Smith" />
          </Field>
        </div>
        <Field label="Phone Number *">
          <Input value={form.contact_phone} onChange={set('contact_phone')} placeholder="0412 345 678" type="tel" />
        </Field>
        <Field label="Email">
          <Input value={email || ''} readOnly className="opacity-60 cursor-not-allowed" />
        </Field>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <PrimaryButton onClick={handleSubmit} loading={loading}>
          Create My Account →
        </PrimaryButton>
      </div>
    </div>
  )
}

// ── Screen 3A: Pending verification ──────────────────────────────────────────

function PendingScreen({ email, onActive }) {
  const [status, setStatus] = useState('pending')
  const intervalRef = useRef(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await getMerchantStatus()
        if (data.status === 'active') {
          setStatus('active')
          clearInterval(intervalRef.current)
          setTimeout(onActive, 1500)
        } else if (data.status === 'rejected') {
          setStatus('rejected')
          clearInterval(intervalRef.current)
        }
      } catch {}
    }

    poll()
    intervalRef.current = setInterval(poll, 30000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const steps = ['Account submitted', 'Verifying', 'Active']
  const currentStep = status === 'active' ? 2 : status === 'rejected' ? 1 : 1

  return (
    <div className="text-center">
      <div className={`text-6xl mb-6 transition-all duration-500 ${status === 'active' ? 'scale-110' : ''}`}>
        {status === 'active' ? '✅' : status === 'rejected' ? '❌' : '⏳'}
      </div>

      {status === 'active' ? (
        <>
          <h2 className="text-xl font-semibold text-white mb-2">Your account is active!</h2>
          <p className="text-slate-400 text-sm">Taking you to your preferences…</p>
        </>
      ) : status === 'rejected' ? (
        <>
          <h2 className="text-xl font-semibold text-white mb-2">Verification unsuccessful</h2>
          <p className="text-slate-400 text-sm">Please contact <span className="text-emerald-400">support@retryly.com.au</span> for help.</p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-white mb-2">Your account is being verified</h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto mb-6">
            We're setting up your Pinch payment account. This usually takes less than 24 hours.
            We'll email you at <span className="text-white">{email}</span> when it's ready.
          </p>
        </>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 my-6">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                i < currentStep ? 'bg-emerald-600 text-white' :
                i === currentStep ? 'bg-emerald-600/40 border border-emerald-500 text-emerald-300 animate-pulse' :
                'bg-slate-800 text-slate-500'
              }`}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${i === currentStep ? 'text-emerald-400' : 'text-slate-500'}`}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mb-4 ${i < currentStep ? 'bg-emerald-600' : 'bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* While-you-wait cards */}
      {status === 'pending' && (
        <div className="mt-8">
          <p className="text-xs text-slate-500 mb-4 uppercase tracking-wide">While you wait, here's what Retryly will do for you</p>
          <div className="grid grid-cols-3 gap-3 text-left">
            {[
              { icon: '🔍', title: 'Classify failures', body: 'AI identifies why each payment failed' },
              { icon: '🔄', title: 'Auto-retry', body: 'Smart timing to maximise recovery' },
              { icon: '✉️', title: 'AI messages', body: 'Professional emails to your customers' },
            ].map((c, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="text-xl mb-2">{c.icon}</div>
                <div className="text-xs font-semibold text-white mb-1">{c.title}</div>
                <div className="text-[11px] text-slate-400">{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Screen 2B: API Key connect ────────────────────────────────────────────────

function ApiKeyScreen({ onBack, onSuccess }) {
  const [key, setKey] = useState('')
  const [appId, setAppId] = useState('')
  const [mode, setMode] = useState('test')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    if (!key.trim() || !appId.trim()) {
      setError('Please enter both your Merchant ID and Secret Key.')
      return
    }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const { data } = await connectApiKey(key.trim(), appId.trim(), mode)
      if (data.valid) {
        setResult(data)
        setTimeout(onSuccess, 1500)
      } else {
        setError(data.message || 'Could not connect. Check your credentials and try again.')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not connect. Check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { n: 1, text: 'Log in at portal.getpinch.com.au' },
    { n: 2, text: 'Click "Developer" in the left sidebar' },
    { n: 3, text: 'Click "API Keys"' },
    { n: 4, text: 'Copy your Merchant ID (mch_...) and Secret Key (sk_live_...)' },
  ]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <BackLink onClick={onBack} />
      <h2 className="text-base font-semibold text-white mb-1">Connect your Pinch account</h2>
      <p className="text-slate-500 text-sm mb-5">We'll link Retryly to your existing Pinch account</p>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">How to find your credentials</p>
        <ol className="space-y-2">
          {steps.map(s => (
            <li key={s.n} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
              <span className="text-xs text-slate-300">{s.text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-4">
        {/* Environment */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Environment</label>
          <div className="flex gap-2">
            {[{ v: 'test', label: 'Test (Sandbox)' }, { v: 'live', label: 'Live (Production)' }].map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                  mode === v
                    ? v === 'live'
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {mode === 'live' ? 'Connects to your real Pinch account and live payments.' : 'Safe to test — no real payments are processed.'}
          </p>
        </div>

        <Field label="Merchant ID" hint="Found in Developer → API Keys — starts with mch_">
          <Input
            value={appId}
            onChange={e => setAppId(e.target.value)}
            placeholder="mch_xxxxxxxxxxxx"
          />
        </Field>

        <Field label="Secret Key" hint="Found in Developer → API Keys">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk_live_... or sk_test_..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-xs"
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
        </Field>

        <div className="flex items-start gap-2 bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2.5">
          <span className="text-emerald-400 shrink-0">🔒</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Your credentials are encrypted with 256-bit AES. We only use them to monitor and recover your payments. We never share or store them in plain text.
          </p>
        </div>

        {result && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
            <span className="text-emerald-400">✓</span>
            <span className="text-emerald-400 text-sm">
              Connected! Found {result.payer_count} customer{result.payer_count !== 1 ? 's' : ''} in your Pinch account
            </span>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <PrimaryButton onClick={handleConnect} loading={loading} disabled={!key.trim() || !appId.trim() || !!result}>
          {result ? 'Connected ✓' : 'Verify & Connect →'}
        </PrimaryButton>
      </div>
    </div>
  )
}

// ── Screen 4: Preferences ─────────────────────────────────────────────────────

function PreferencesScreen({ user, onDone }) {
  const [prefs, setPrefs] = useState({
    auto_retry: true,
    retry_days: 4,
    max_retries: 3,
    business_name: user?.business_name || '',
    sender_email: user?.email || '',
    notify_channel: 'email',
    notify_recovered: true,
    notify_attention: true,
    notify_summary: true,
  })
  const [loading, setLoading] = useState(false)
  const set = (k) => (v) => setPrefs(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setLoading(true)
    try {
      await savePreferences(prefs)
      onDone()
    } catch {
      toast.error('Failed to save preferences')
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-base font-semibold text-white mb-1">Set your preferences</h2>
      <p className="text-slate-500 text-sm mb-5">
        Retryly will use these settings to recover your payments automatically
      </p>

      <div className="space-y-5">
        {/* Auto retry toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">Auto-retry failed payments</div>
            <div className="text-xs text-slate-500 mt-0.5">Retryly will automatically retry recoverable failures</div>
          </div>
          <button
            onClick={() => set('auto_retry')(!prefs.auto_retry)}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${prefs.auto_retry ? 'bg-emerald-600' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${prefs.auto_retry ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="w-full h-px bg-slate-800" />

        {/* Retry days */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-400">Retry after how many days</label>
            <span className="text-sm font-semibold text-white">{prefs.retry_days} days</span>
          </div>
          <input
            type="range" min="3" max="7" step="1" value={prefs.retry_days}
            onChange={e => set('retry_days')(+e.target.value)}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>3</span><span>4</span><span>5</span><span>6</span><span>7</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            We'll wait this long before retrying, to give customers time to top up their account
          </p>
        </div>

        <div className="w-full h-px bg-slate-800" />

        {/* Max retries */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Maximum retry attempts</label>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => set('max_retries')(n)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${prefs.max_retries === n ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">After this many attempts, we'll escalate to you</p>
        </div>

        <div className="w-full h-px bg-slate-800" />

        {/* Business name + sender email */}
        <Field label="Your business name (for customer messages)">
          <Input value={prefs.business_name} onChange={e => set('business_name')(e.target.value)} placeholder="Acme Plumbing" />
        </Field>
        <Field label="Sender email address">
          <Input type="email" value={prefs.sender_email} onChange={e => set('sender_email')(e.target.value)} placeholder="billing@yourbusiness.com.au" />
        </Field>

        <div className="w-full h-px bg-slate-800" />

        {/* Notifications */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-3">Notify me when:</label>
          <div className="space-y-2.5">
            {[
              { key: 'notify_recovered', label: 'A payment is auto-recovered' },
              { key: 'notify_attention', label: 'A payment needs my attention' },
              { key: 'notify_summary', label: 'Daily recovery summary' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={e => set(key)(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <PrimaryButton onClick={handleSave} loading={loading}>
          Save & Start Retryly →
        </PrimaryButton>
      </div>
    </div>
  )
}

// ── Root Onboarding component ─────────────────────────────────────────────────

export default function Onboarding() {
  const [screen, setScreen] = useState('choose')
  const { user } = useAuth()

  // After preferences are saved, do a full reload so AuthContext re-fetches
  // the user with onboarding_complete = true, avoiding the onboarding redirect loop.
  const handleDone = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Logo />

        {screen === 'choose' && (
          <ChooseScreen
            onManaged={() => setScreen('managed-form')}
            onApiKey={() => setScreen('api-key')}
          />
        )}

        {screen === 'managed-form' && (
          <ManagedFormScreen
            email={user?.email}
            onBack={() => setScreen('choose')}
            onSuccess={() => setScreen('pending')}
            onActivated={() => setScreen('preferences')}
          />
        )}

        {screen === 'pending' && (
          <PendingScreen
            email={user?.email}
            onActive={() => setScreen('preferences')}
          />
        )}

        {screen === 'api-key' && (
          <ApiKeyScreen
            onBack={() => setScreen('choose')}
            onSuccess={() => setScreen('preferences')}
          />
        )}

        {screen === 'preferences' && (
          <PreferencesScreen user={user} onDone={handleDone} />
        )}
      </div>
    </div>
  )
}
