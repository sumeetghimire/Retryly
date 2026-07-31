import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  getSettings, updateProfile, updateRecovery,
  reconnectPinch, disconnectPinch, deleteAccount,
} from '../api'

// ── Small reusable bits ───────────────────────────────────────────────────────

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <div>
        <div className="text-sm text-white font-medium">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-emerald-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function Field({ label, description, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {description && <p className="text-[11px] text-slate-600 mb-2">{description}</p>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    />
  )
}

function SaveBtn({ loading, onClick, label = 'Save changes' }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="mt-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
    >
      {loading ? 'Saving…' : label}
    </button>
  )
}

// ── Status badge for Pinch connection ────────────────────────────────────────

function PinchStatusBadge({ connected, status }) {
  if (!connected) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      Not connected
    </span>
  )
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Connected · Active
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      {status}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function DisconnectModal({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-red-800/40 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Disconnect Pinch account?</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Retryly runs entirely on Pinch Payments. Disconnecting will:
            </p>
          </div>
        </div>
        <ul className="space-y-2 mb-6 ml-14">
          {[
            'Stop all automatic payment recovery',
            'Disable retries, payment links and payment plans',
            'Disable pre-debit reminders',
            'Take you back to the setup screen to reconnect',
          ].map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-red-400 mt-0.5 shrink-0">×</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mb-5 ml-14">Your existing payer and dishonour data will be preserved. You can reconnect at any time.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
          >
            Keep connected
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {loading ? 'Disconnecting…' : 'Yes, disconnect'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  // Profile state
  const [businessName, setBusinessName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // Recovery state
  const [autoRetry, setAutoRetry] = useState(true)
  const [retryDays, setRetryDays] = useState(4)
  const [maxRetries, setMaxRetries] = useState(3)
  const [cooldownDays, setCooldownDays] = useState(3)
  const [notifyChannel, setNotifyChannel] = useState('email')
  const [senderEmail, setSenderEmail] = useState('')
  const [recoverySaving, setRecoverySaving] = useState(false)

  // Pinch reconnect state
  const [newApiKey, setNewApiKey] = useState('')
  const [newAppId, setNewAppId] = useState('')
  const [connectSaving, setConnectSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getSettings()
      .then(({ data }) => {
        setData(data)
        setBusinessName(data.profile.business_name || '')
        setAutoRetry(data.recovery.auto_retry)
        setRetryDays(data.recovery.retry_days)
        setMaxRetries(data.recovery.max_retries)
        setCooldownDays(data.recovery.retry_cooldown_days)
        setNotifyChannel(data.recovery.notify_channel || 'email')
        setSenderEmail(data.recovery.sender_email || '')
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleProfileSave = async () => {
    setProfileSaving(true)
    try {
      await updateProfile({ business_name: businessName })
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleRecoverySave = async () => {
    setRecoverySaving(true)
    try {
      await updateRecovery({
        auto_retry: autoRetry,
        retry_days: retryDays,
        max_retries: maxRetries,
        retry_cooldown_days: cooldownDays,
        notify_channel: notifyChannel,
        sender_email: senderEmail || null,
      })
      toast.success('Recovery settings saved')
    } catch {
      toast.error('Failed to save recovery settings')
    } finally {
      setRecoverySaving(false)
    }
  }

  const handleConnect = async () => {
    if (!newApiKey.trim() || !newAppId.trim()) {
      toast.error('Enter both your App ID and API Key')
      return
    }
    setConnectSaving(true)
    try {
      const { data: res } = await reconnectPinch(newApiKey.trim(), newAppId.trim())
      if (res.valid) {
        toast.success(`Connected — ${res.payer_count} payers found`)
        setNewApiKey('')
        setNewAppId('')
        // Refresh settings
        const { data: fresh } = await getSettings()
        setData(fresh)
      } else {
        toast.error(res.message || 'Invalid API key')
      }
    } catch {
      toast.error('Failed to connect Pinch account')
    } finally {
      setConnectSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectPinch()
      toast.success('Pinch account disconnected — redirecting to setup')
      setShowDisconnectModal(false)
      await refreshUser()  // update cached onboarding_complete → false
      navigate('/onboarding')
    } catch {
      toast.error('Failed to disconnect')
      setDisconnecting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm')
      return
    }
    setDeleting(true)
    try {
      await deleteAccount()
      toast.success('Account deleted')
      await logout()
    } catch {
      toast.error('Failed to delete account')
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading settings…</div>
  )

  const pinch = data?.pinch || {}

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-6">
      {showDisconnectModal && (
        <DisconnectModal
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnectModal(false)}
          loading={disconnecting}
        />
      )}
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account, Pinch connection and recovery preferences.</p>
      </div>

      {/* ── Profile ─────────────────────────────────────────────────── */}
      <SectionCard title="Profile" description="Your business details shown in customer emails.">
        <div className="space-y-4">
          <Field label="Business name">
            <Input value={businessName} onChange={setBusinessName} placeholder="Your business name" />
          </Field>
          <Field label="Email address">
            <Input value={user?.email || ''} onChange={() => {}} disabled placeholder="Email" />
            <p className="text-[11px] text-slate-600 mt-1.5">Email cannot be changed. Contact support if needed.</p>
          </Field>
        </div>
        <SaveBtn loading={profileSaving} onClick={handleProfileSave} />
      </SectionCard>

      {/* ── Pinch Connection ─────────────────────────────────────────── */}
      <SectionCard title="Pinch Connection" description="Your linked Pinch Payments account for direct debit recovery.">
        <div className="space-y-4">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white font-medium">Connection status</div>
              {pinch.onboarding_type === 'managed' && pinch.merchant_id && (
                <div className="text-xs text-slate-500 mt-0.5">Managed · {pinch.merchant_id}</div>
              )}
              {pinch.onboarding_type === 'api_key' && pinch.masked_key && (
                <div className="text-xs text-slate-500 font-mono mt-0.5">{pinch.masked_key}</div>
              )}
            </div>
            <PinchStatusBadge connected={pinch.connected} status={pinch.merchant_status} />
          </div>

          {/* Disconnect button */}
          {pinch.connected && (
            <button
              onClick={() => setShowDisconnectModal(true)}
              className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              Disconnect Pinch account
            </button>
          )}

          {/* Connect / reconnect with API key */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <p className="text-xs font-medium text-slate-400">
              {pinch.connected ? 'Switch to a different Pinch account' : 'Connect with Pinch credentials'}
            </p>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Merchant ID</label>
              <input
                type="text"
                value={newAppId}
                onChange={e => setNewAppId(e.target.value)}
                placeholder="mch_xxxxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Secret Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newApiKey}
                  onChange={e => setNewApiKey(e.target.value)}
                  placeholder="sk_live_••••••••••••••••"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 font-mono"
                />
                <button
                  onClick={handleConnect}
                  disabled={connectSaving || !newApiKey.trim() || !newAppId.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  {connectSaving ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              Find both in the Pinch portal → Developer → API Keys. Merchant ID starts with <code className="text-slate-500">mch_</code>, Secret Key with <code className="text-slate-500">sk_live_</code>.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── Notifications ────────────────────────────────────────────── */}
      <SectionCard title="Notifications" description="Control how Retryly contacts your customers.">
        <div className="space-y-5">
          <Toggle
            checked={notifyChannel === 'email'}
            onChange={on => setNotifyChannel(on ? 'email' : 'none')}
            label="Customer email notifications"
            description="Send AI-written emails for failed payments, retries and resolutions."
          />
          {notifyChannel === 'email' && (
            <Field label="Sender email (optional)" description="Shown as From address. Leave blank to use Retryly default.">
              <Input
                value={senderEmail}
                onChange={setSenderEmail}
                placeholder="billing@yourbusiness.com.au"
                type="email"
              />
            </Field>
          )}
        </div>
        <SaveBtn loading={recoverySaving} onClick={handleRecoverySave} />
      </SectionCard>

      {/* ── Recovery Preferences ─────────────────────────────────────── */}
      <SectionCard title="Recovery Preferences" description="Fine-tune how Retryly retries failed payments.">
        <div className="space-y-5">
          <Toggle
            checked={autoRetry}
            onChange={setAutoRetry}
            label="Auto-retry failed payments"
            description="Automatically schedule retries based on failure type. Disable to require manual approval."
          />

          <div className="grid grid-cols-3 gap-4">
            <Field label="Retry wait (days)" description="Days to wait before retrying NSF failures.">
              <input
                type="number"
                min={1} max={30}
                value={retryDays}
                onChange={e => setRetryDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
              />
            </Field>
            <Field label="Max retries" description="Give up after this many attempts.">
              <input
                type="number"
                min={1} max={10}
                value={maxRetries}
                onChange={e => setMaxRetries(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
              />
            </Field>
            <Field label="Cooldown (days)" description="Min days between retries for same payer.">
              <input
                type="number"
                min={1} max={14}
                value={cooldownDays}
                onChange={e => setCooldownDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
              />
            </Field>
          </div>
        </div>
        <SaveBtn loading={recoverySaving} onClick={handleRecoverySave} />
      </SectionCard>

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <div className="bg-red-950/20 border border-red-800/30 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-red-800/30">
          <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>
          <p className="text-xs text-slate-500 mt-0.5">These actions are permanent and cannot be undone.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="text-sm text-white font-medium mb-1">Delete account</div>
            <p className="text-xs text-slate-500 mb-3">
              Permanently deletes your Retryly account, all settings, and disconnects your Pinch integration. Your Pinch data is not affected.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="flex-1 bg-slate-950 border border-red-800/40 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== 'DELETE'}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
