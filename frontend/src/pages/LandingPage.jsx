import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ─── Animated dashboard (unchanged) ──────────────────────────────────────────

const ANIM_PHASES = ['idle', 'failure', 'analyzing', 'recovered']
const ANIM_MS     = [3800, 1600, 2200, 2600]

function AnimatedDashboard() {
  const [step, setStep] = useState(0)
  const [entryVisible, setEntryVisible] = useState(false)
  const phase = ANIM_PHASES[step % 4]

  useEffect(() => {
    const t = setTimeout(() => {
      setStep(s => s + 1)
      setEntryVisible(false)
    }, ANIM_MS[step % 4])
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    if (phase === 'failure') {
      requestAnimationFrame(() => requestAnimationFrame(() => setEntryVisible(true)))
    }
  }, [phase])

  const collectedStr = phase === 'recovered' ? '$18,975' : '$18,420'
  const rateStr      = phase === 'recovered' ? '89%'     : '87%'

  const newItemCfg = {
    failure:   { label: 'NSF Failed',    cls: 'bg-red-500/15 text-red-400 border-red-500/25',             border: 'border-red-500/25'     },
    analyzing: { label: 'AI Analyzing…', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25',       border: 'border-amber-500/25'   },
    recovered: { label: 'Recovered ✓',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', border: 'border-emerald-500/30' },
  }
  const cfg = newItemCfg[phase] || newItemCfg.recovered

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950 overflow-hidden shadow-2xl shadow-black/60">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
        <span className="ml-3 text-xs text-slate-600 font-mono">retryly.com.au/dashboard</span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>
      <div className="flex">
        <div className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center pt-4 gap-3 shrink-0">
          {[
            { d: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', active: true },
            { d: 'M22 12H16L14 15H10L8 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6L18.55 5.11A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z', active: false },
            { d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110 8 4 4 0 010-8z', active: false },
          ].map(({ d, active }, i) => (
            <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-emerald-500/20' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={active ? '#34d399' : '#475569'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </div>
          ))}
        </div>
        <div className="flex-1 p-5 bg-slate-950">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Collected',     value: collectedStr, color: 'text-emerald-400' },
              { label: 'Recovery Rate', value: rateStr,      color: 'text-blue-400'   },
              { label: 'At Risk',       value: '$2,450',     color: 'text-amber-400'  },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wide text-slate-600 mb-1">{label}</div>
                <div className={`text-sm font-bold tabular-nums transition-all duration-700 ${color}`}>{value}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 mb-4">
            {phase !== 'idle' && (
              <div className={`flex items-center gap-3 bg-slate-900 border ${cfg.border} rounded-lg px-3 py-2.5 transition-all duration-500 ease-out ${entryVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-[9px] font-bold text-violet-300 shrink-0">LP</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">Lisa Park</div>
                  <div className="text-[10px] text-slate-500 truncate">NSF — Insufficient Funds</div>
                </div>
                <span className="text-xs font-semibold text-white shrink-0">$650</span>
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.cls}`}>
                  {phase === 'analyzing' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                  {cfg.label}
                </span>
              </div>
            )}
            {[
              { initials: 'SC', avatarCls: 'bg-blue-500/20 text-blue-300',   name: 'Sarah Chen',   reason: 'NSF — Payday retry',      amount: '$450', badge: 'Recovered', badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
              { initials: 'JW', avatarCls: 'bg-teal-500/20 text-teal-300',   name: 'James Webb',   reason: 'Card expired — link sent', amount: '$320', badge: 'Recovered', badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
              { initials: 'MR', avatarCls: 'bg-amber-500/20 text-amber-300', name: 'Mike Roberts', reason: 'Refer to Payer',           amount: '$180', badge: 'Retrying',  badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/20'           },
            ].map(({ initials, avatarCls, name, reason, amount, badge, badgeCls }) => (
              <div key={name} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5">
                <div className={`w-7 h-7 rounded-full ${avatarCls} flex items-center justify-center text-[9px] font-bold shrink-0`}>{initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">{name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{reason}</div>
                </div>
                <span className="text-xs font-semibold text-white shrink-0">{amount}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeCls}`}>{badge}</span>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed transition-all duration-500">
              {phase === 'analyzing' ? "Classifying Lisa Park's NSF — checking salary cycle. Will retry Friday."
                : phase === 'recovered' ? "Lisa Park recovered $650. Retry hit payday. Recovery rate now 89%."
                : '3 payments processed overnight. Sarah Chen recovered on payday. James Webb updated card details.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Australia map ────────────────────────────────────────────────────────────

function AustraliaMap({ className = '' }) {
  return (
    <svg viewBox="0 0 320 260" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 72 72 L 82 50 L 100 32 L 120 22 L 136 26 C 138 36 140 52 142 58 C 146 66 152 62 156 50 L 164 40 L 172 30 L 178 8 L 184 28 L 196 62 L 212 98 L 220 130 L 216 154 L 208 172 L 196 184 L 172 192 L 144 194 L 114 192 L 86 186 L 62 176 L 44 160 L 34 138 L 34 110 L 42 86 Z" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 196 202 L 208 200 L 204 218 Z" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="208" cy="148" r="3" fill="currentColor" opacity="0.6"/>
      <circle cx="200" cy="162" r="2.5" fill="currentColor" opacity="0.5"/>
      <circle cx="178" cy="184" r="2" fill="currentColor" opacity="0.4"/>
      <circle cx="44" cy="130" r="2.5" fill="currentColor" opacity="0.4"/>
    </svg>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ isAuthed }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Close mobile menu on scroll
  useEffect(() => {
    if (mobileOpen) {
      const fn = () => setMobileOpen(false)
      window.addEventListener('scroll', fn, { once: true })
      return () => window.removeEventListener('scroll', fn)
    }
  }, [mobileOpen])

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled || mobileOpen ? 'bg-slate-950/98 backdrop-blur border-b border-slate-800/80' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
            </svg>
          </div>
          <span className="text-base font-bold text-white tracking-tight">Retryly</span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthed ? (
            <Link to="/dashboard" className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-emerald-500/25">
              Open Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Sign in</Link>
              <Link to="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-emerald-500/25">
                Get started free
              </Link>
            </>
          )}
        </div>

        {/* Mobile: CTA + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {isAuthed ? (
            <Link to="/dashboard" className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              Dashboard
            </Link>
          ) : (
            <Link to="/register" className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              Get started
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="text-slate-400 hover:text-white p-1.5 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/98 px-4 py-4 space-y-1">
          {[
            { href: '#how-it-works', label: 'How it works' },
            { href: '#features', label: 'Features' },
            { href: '#pricing', label: 'Pricing' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
            >
              {label}
            </a>
          ))}
          <Link to="/about" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors">
            About
          </Link>
          <div className="pt-3 mt-3 border-t border-slate-800 flex flex-col gap-2">
            {isAuthed ? (
              <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block text-center bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-center border border-slate-700 text-slate-300 hover:text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block text-center bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero (two-column, GoCardless-inspired) ───────────────────────────────────

function Hero({ isAuthed }) {
  return (
    <section className="relative pt-24 pb-16 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        <div className="absolute top-32 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center min-h-[500px] lg:min-h-[600px]">
          {/* Left: copy */}
          <div className="flex flex-col justify-center text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6 md:mb-8 w-fit mx-auto lg:mx-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wide">Built for Australian direct debit</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight mb-5 md:mb-6">
              Recover failed<br />
              payments{' '}
              <span className="text-emerald-400">automatically.</span>
            </h1>

            <p className="text-slate-400 text-base md:text-lg leading-relaxed mb-8 md:mb-10 max-w-lg mx-auto lg:mx-0">
              Retryly watches every Pinch direct debit. When a payment fails, AI understands why and takes the right action — retry, re-auth link, or payment plan — without you lifting a finger.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-8 md:mb-12 justify-center lg:justify-start">
              {isAuthed ? (
                <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/25">
                  Open dashboard
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              ) : (
                <>
                  <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/25">
                    Start for free
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium px-8 py-4 rounded-xl text-sm transition-colors">
                    Sign in
                  </Link>
                </>
              )}
            </div>

            {/* Trust row */}
            <div className="flex items-center gap-4 md:gap-6 flex-wrap justify-center lg:justify-start">
              {[
                { icon: '🔒', text: 'Bank-grade encryption' },
                { icon: '⚡', text: 'Live in 2 minutes' },
                { icon: '🇦🇺', text: 'AU-only, Pinch-native' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-slate-500 text-xs">
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: animated dashboard */}
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-500/5 rounded-3xl blur-2xl" />
            <div className="relative">
              <AnimatedDashboard />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  return (
    <section className="border-y border-slate-800 bg-slate-900/40">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '87%',    label: 'Average recovery rate',       sub: 'across all dishonour types'     },
            { value: '4 days', label: 'Average time to recover',     sub: 'from failure to cleared funds'  },
            { value: '63%',    label: 'AU SMB payment failure rate', sub: 'the problem we solve'           },
            { value: '$0',     label: 'Manual work required',        sub: 'fully automated recovery'       },
          ].map(({ value, label, sub }) => (
            <div key={label} className="text-center md:text-left">
              <div className="text-3xl lg:text-4xl font-bold text-white mb-1">{value}</div>
              <div className="text-sm font-medium text-slate-300 mb-0.5">{label}</div>
              <div className="text-xs text-slate-500">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Logo trust bar ───────────────────────────────────────────────────────────

function TrustBar() {
  const logos = ['Yoga Studio Co.', 'Peak Physio', 'Coastal Fitness', 'Mindful Health', 'Studio Nine', 'ProCare Allied']
  return (
    <section className="py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-xs text-slate-500 uppercase tracking-widest font-semibold mb-8">
          Trusted by Australian small businesses on Pinch
        </p>
        <div className="flex items-center justify-center flex-wrap gap-8 md:gap-12">
          {logos.map(name => (
            <span key={name} className="text-slate-600 font-semibold text-sm tracking-tight hover:text-slate-400 transition-colors">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20 items-center mb-24">
          <div>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4 block">Step 01</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
              Connect your Pinch account in 2 minutes
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Sign up and we automatically provision your payment recovery account. No API keys to manage, no developer portal, no technical knowledge needed. We handle everything.
            </p>
            <ul className="space-y-4">
              {[
                'Zero-config managed merchant setup',
                'Automatic webhook registration',
                'Works with your existing Pinch payers',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-slate-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            <img src="/storyset/plug-in.svg" alt="Connect" className="w-80 h-72 object-contain drop-shadow-2xl" />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-20 items-center mb-24">
          <div className="order-2 lg:order-1 flex justify-center">
            <img src="/storyset/ai.svg" alt="AI classifies" className="w-80 h-72 object-contain drop-shadow-2xl" />
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-violet-400 text-xs font-bold uppercase tracking-widest mb-4 block">Step 02</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
              AI understands every failure instantly
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              When a payment fails, Retryly reads the dishonour code, explains it in plain English, and decides the right action — retry on payday, send a re-auth link, or offer a payment plan. Automatically.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'NSF',           action: 'Retry on payday',   color: 'border-emerald-500/30 bg-emerald-500/5' },
                { label: 'Card Expired',  action: 'Re-auth link sent', color: 'border-blue-500/30 bg-blue-500/5'       },
                { label: 'Stop Payment',  action: 'Escalate to you',   color: 'border-amber-500/30 bg-amber-500/5'     },
              ].map(({ label, action, color }) => (
                <div key={label} className={`border rounded-xl p-3 ${color}`}>
                  <div className="text-xs font-semibold text-white mb-1">{label}</div>
                  <div className="text-[10px] text-slate-400">{action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <span className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4 block">Step 03</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
              Track everything on your live dashboard
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Watch your recovery rate, projected cash flow, and payer risk scores in real time. Every morning your AI agent writes a plain-English summary of what happened overnight.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '87%', label: 'Recovery rate' },
                { value: '4d',  label: 'Avg. to recover' },
                { value: '∞',   label: 'Payers monitored' },
                { value: '24/7', label: 'Always watching' },
              ].map(({ value, label }) => (
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-2xl font-bold text-emerald-400 mb-1">{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <img src="/storyset/Analytics-amico.svg" alt="Analytics" className="w-80 h-72 object-contain drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Features grid ────────────────────────────────────────────────────────────

function Features() {
  const features = [
    {
      color: 'text-emerald-400', bg: 'bg-emerald-500/10',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
      title: 'Reason-Aware Retry Timing',
      body: 'NSF? Wait for payday. Account closed? Skip retry entirely. The right timing for each failure code.',
    },
    {
      color: 'text-violet-400', bg: 'bg-violet-500/10',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      title: 'Empathetic AI Messages',
      body: 'AI writes personalised, understanding emails for each customer — not cold templates. Open rates improve, churn drops.',
    },
    {
      color: 'text-blue-400', bg: 'bg-blue-500/10',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
      title: 'One-Click Payment Plans',
      body: 'Customer can\'t pay in full? Retryly auto-generates 2, 3, or 4 instalment options. One click to accept.',
    },
    {
      color: 'text-teal-400', bg: 'bg-teal-500/10',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
      title: 'Secure Re-Auth Links',
      body: 'Card expired or wrong BSB? Send a secure, time-limited Pinch link so customers update details instantly.',
    },
    {
      color: 'text-rose-400', bg: 'bg-rose-500/10',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      title: 'Pre-Debit Reminders',
      body: 'Prevent failures before they happen. AI-written reminders sent 3 days before payment reduce failure rates by 20%.',
    },
    {
      color: 'text-amber-400', bg: 'bg-amber-500/10',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      title: 'Payer Risk Scoring',
      body: 'Every payer gets a live risk score based on payment history. Know who needs attention before they miss a payment.',
    },
  ]

  return (
    <section id="features" className="py-24 px-6 bg-slate-900/30 border-y border-slate-800/50">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4 block">Features</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
            Everything you need to stop losing money to failed payments
          </h2>
          <p className="text-slate-400 text-lg">
            The complete recovery stack — from detection to resolution — all automated.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ color, bg, icon, title, body }) => (
            <div key={title} className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all hover:-translate-y-0.5">
              <div className={`inline-flex p-2.5 rounded-xl ${bg} ${color} mb-5`}>{icon}</div>
              <h3 className="text-white font-semibold mb-2 text-base">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── ROI / Impact section ─────────────────────────────────────────────────────

function Impact() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4 block">The impact</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
              What does 87% recovery actually mean for your business?
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-10">
              Without Retryly, 63% of AU businesses write off failed payments. With Retryly, most are recovered automatically — usually within 4 business days.
            </p>
            <div className="space-y-4">
              {[
                { label: 'Without Retryly', value: '63% written off', bar: 63, color: 'bg-red-500' },
                { label: 'Industry average (manual follow-up)', value: '41% written off', bar: 41, color: 'bg-amber-500' },
                { label: 'With Retryly', value: '13% written off', bar: 13, color: 'bg-emerald-500' },
              ].map(({ label, value, bar, color }) => (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color} transition-all duration-1000`} style={{ width: `${bar}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <img src="/storyset/finance.svg" alt="Finance impact" className="w-80 h-72 object-contain drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Surcharge callout ────────────────────────────────────────────────────────

function SurchargeCallout() {
  const days = Math.max(0, Math.ceil((new Date('2026-10-01') - new Date()) / (1000 * 60 * 60 * 24)))
  return (
    <section className="py-6 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-amber-900/20 border border-amber-700/30 rounded-2xl p-8 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <AustraliaMap className="h-64 w-auto text-amber-500 opacity-10" />
          </div>
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="shrink-0 w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1 max-w-2xl">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-amber-400 font-bold text-lg">Card surcharging banned 1 Oct 2026</span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">{days} days left</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Australia is banning card surcharges entirely. Businesses need to move to direct debit now. Retryly makes that transition painless — automatic recovery means failed DD payments don't cost you like failed card payments did.
              </p>
            </div>
            <Link to="/register" className="shrink-0 bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all whitespace-nowrap">
              Switch to direct debit →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
  return (
    <section className="py-24 px-6 bg-slate-900/30 border-y border-slate-800/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4 block">Customer stories</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-white">Real results from real businesses</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              quote: "We were losing $4,000/month to NSF failures — always retrying too early. Retryly waits for payday automatically. Recovery rate went from 40% to 89% in the first month.",
              name: 'Sarah M.', role: 'Owner, Coastal Physio Group', initials: 'SM', color: 'bg-blue-500',
              stat: '89%', statLabel: 'recovery rate',
            },
            {
              quote: "The AI messages are incredible. My customers actually reply thanking us for being understanding. That's never happened with a payment failure email before.",
              name: 'James T.', role: 'Director, Peak Fitness Studios', initials: 'JT', color: 'bg-violet-500',
              stat: '3×', statLabel: 'more replies',
            },
            {
              quote: "Setup took 3 minutes. No API keys, no portal config — just connected and it started recovering payments immediately. Game changer for a one-person business.",
              name: 'Lisa K.', role: 'Founder, Mindful Yoga Co.', initials: 'LK', color: 'bg-emerald-500',
              stat: '2 min', statLabel: 'to set up',
            },
          ].map(({ quote, name, role, initials, color, stat, statLabel }) => (
            <div key={name} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
              <div className="text-3xl font-bold text-emerald-400 mb-1">{stat}</div>
              <div className="text-xs text-slate-500 mb-5">{statLabel}</div>
              <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-6">"{quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white shrink-0`}>{initials}</div>
                <div>
                  <div className="text-white text-sm font-medium">{name}</div>
                  <div className="text-slate-500 text-xs">{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing({ isAuthed }) {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4 block">Pricing</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
            We only make money when you recover payments
          </h2>
          <p className="text-slate-400 text-lg">No monthly fees for failed months. No setup costs. Simple.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
            <div className="text-slate-400 text-sm font-medium mb-1">Starter</div>
            <div className="text-4xl font-bold text-white mb-1">Free</div>
            <div className="text-slate-500 text-sm mb-8">Up to $5,000/mo recovered</div>
            <ul className="space-y-3 mb-8">
              {['Up to 50 payers', 'AI dishonour classification', 'Smart retry scheduling', 'Customer email messages', 'Recovery dashboard'].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link to={isAuthed ? '/dashboard' : '/register'} className="block w-full text-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-3 rounded-xl text-sm transition-colors">
              {isAuthed ? 'Open dashboard' : 'Get started free'}
            </Link>
          </div>

          <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-700/40 rounded-2xl p-8 relative">
            <div className="absolute top-4 right-4 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wide">
              Most popular
            </div>
            <div className="text-emerald-400 text-sm font-medium mb-1">Growth</div>
            <div className="text-4xl font-bold text-white mb-0.5">2.5% <span className="text-lg font-normal text-slate-400">of recovered</span></div>
            <div className="text-slate-500 text-sm mb-8">You only pay on what we recover</div>
            <ul className="space-y-3 mb-8">
              {['Unlimited payers', 'Everything in Starter', 'Payment plan creation', 'Secure re-auth links', 'Pre-debit reminders', 'Risk scoring', 'Surcharge advisor', 'Priority support'].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link to={isAuthed ? '/dashboard' : '/register'} className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/20">
              {isAuthed ? 'Open dashboard' : 'Start recovering payments'}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({ isAuthed }) {
  return (
    <section className="py-24 px-6 border-t border-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Stop writing off<br />
              <span className="text-emerald-400">failed payments.</span>
            </h2>
            <p className="text-slate-400 text-xl leading-relaxed mb-10">
              Connect in 2 minutes. Retryly starts recovering failed payments immediately — no manual work, no technical setup, no monthly fee until you recover.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {isAuthed ? (
                <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/25">
                  Open dashboard <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              ) : (
                <>
                  <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/25">
                    Start for free <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium px-8 py-4 rounded-xl text-sm transition-colors">
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-5 text-xs text-slate-600">Built for Pinch Direct Debit · Australian businesses only · AI-powered recovery</p>
          </div>
          <div className="flex justify-center">
            <img src="/storyset/success.svg" alt="Success" className="w-80 h-72 object-contain drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-slate-800 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
                </svg>
              </div>
              <span className="text-sm font-bold text-white">Retryly</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Every failed payment is a second chance. AI-powered recovery for Australian direct debit.
            </p>
          </div>
          {[
            { heading: 'Product', links: ['How it works', 'Features', 'Pricing', 'Changelog'] },
            { heading: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
            { heading: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Compliance'] },
          ].map(({ heading, links }) => (
            <div key={heading}>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">{heading}</div>
              <ul className="space-y-2.5">
                {links.map(l => (
                  <li key={l}><a href="#" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-800">
          <p className="text-slate-600 text-xs">© 2026 Retryly · A Pinchme product · Australian businesses only</p>
          <p className="text-slate-600 text-xs">Every failed payment is a second chance.</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user } = useAuth()
  const isAuthed = !!user

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white">
      <Nav isAuthed={isAuthed} />
      <Hero isAuthed={isAuthed} />
      <StatsBar />
      <TrustBar />
      <HowItWorks />
      <Features />
      <Impact />
      <SurchargeCallout />
      <Testimonials />
      <Pricing isAuthed={isAuthed} />
      <FinalCTA isAuthed={isAuthed} />
      <Footer />
    </div>
  )
}
