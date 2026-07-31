import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Nav({ isAuthed }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled || mobileOpen ? 'bg-slate-950/98 backdrop-blur border-b border-slate-800/80' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
            </svg>
          </div>
          <span className="text-base font-bold text-white tracking-tight">Retryly</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <Link to="/about" className="text-white transition-colors">About</Link>
          <a href="/#how-it-works" className="hover:text-white transition-colors">How it works</a>
        </div>

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

        <div className="flex md:hidden items-center gap-2">
          {isAuthed ? (
            <Link to="/dashboard" className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Dashboard</Link>
          ) : (
            <Link to="/register" className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Get started</Link>
          )}
          <button onClick={() => setMobileOpen(o => !o)} className="text-slate-400 hover:text-white p-1.5 transition-colors">
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

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/98 px-4 py-4 space-y-1">
          {[
            { to: '/', label: 'Home', isLink: true },
            { to: '/about', label: 'About', isLink: true },
          ].map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors">
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-800/60 mt-2 flex flex-col gap-2">
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg">Sign in</Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm font-semibold text-center bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg">Get started free</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

function StatCard({ value, label, sub }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
      <div className="text-3xl font-bold text-emerald-400 mb-1">{value}</div>
      <div className="text-sm font-medium text-white mb-1">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function FeatureRow({ icon, title, description, highlight }) {
  return (
    <div className={`flex gap-4 p-5 rounded-xl border ${highlight ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/40'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${highlight ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={highlight ? '#34d399' : '#64748b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div>
        <div className="text-sm font-semibold text-white mb-1">{title}</div>
        <div className="text-sm text-slate-400 leading-relaxed">{description}</div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-4">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{children}</span>
    </div>
  )
}

export default function About() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav isAuthed={!!user} />

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 max-w-4xl mx-auto text-center">
        <SectionLabel>About Retryly</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
          The revenue you're losing<br className="hidden sm:block" />
          <span className="text-emerald-400"> isn't gone — it's just stuck.</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Every Australian business running direct debits loses 2–8% of revenue to failed payments.
          Most businesses chase them manually — or write them off. Retryly fixes that automatically,
          using AI to decide when to retry, who to contact, and how to recover without damaging customer relationships.
        </p>
      </section>

      {/* ── Stats ── */}
      <section className="pb-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="2–8%" label="Revenue lost to dishonours" sub="Industry average for AU direct debit" />
          <StatCard value="87%" label="Average recovery rate" sub="With smart timing and outreach" />
          <StatCard value="0 min" label="Manual work required" sub="Fully automated end-to-end" />
          <StatCard value="~$0" label="Setup cost" sub="No developer needed" />
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <SectionLabel>The Problem</SectionLabel>
            <h2 className="text-3xl font-bold text-white mb-4">Failed payments are messy, manual, and expensive</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              When a direct debit dishonours, most SMBs get a cryptic error code — <span className="text-slate-200 font-medium">NSF</span>, <span className="text-slate-200 font-medium">Refer to Payer</span>, <span className="text-slate-200 font-medium">Account Closed</span> — and have to figure out what to do next themselves.
            </p>
            <p className="text-slate-400 leading-relaxed mb-4">
              That means: logging into your payment portal, identifying which payment failed, emailing or calling the customer, scheduling a manual retry, and hoping it goes through.
            </p>
            <p className="text-slate-400 leading-relaxed">
              For a business with dozens or hundreds of recurring payments, this is a part-time job. Most just accept the loss.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'NSF — Insufficient Funds', detail: 'Retry immediately → fails again. Smart timing needed.' },
              { label: 'Refer to Payer', detail: 'Needs customer contact — but when and how?' },
              { label: 'Account Closed', detail: 'Old bank details. Needs new payment method.' },
              { label: 'Payment Stopped', detail: 'Customer dispute. Requires human escalation.' },
            ].map(({ label, detail }) => (
              <div key={label} className="flex gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-300 mb-0.5">{label}</div>
                  <div className="text-xs text-slate-500">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How Retryly Solves It ── */}
      <section className="pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="text-3xl font-bold text-white">AI that knows what each failure code means</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <FeatureRow
            highlight
            icon="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            title="Intelligent failure classification"
            description="Each dishonour code tells a different story. NSF means the customer needs more time — retry on payday. Account Closed means you need new bank details. Refer to Payer means call them. Retryly classifies each failure and picks the right response automatically."
          />
          <FeatureRow
            highlight
            icon="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            title="Smart retry scheduling"
            description="Retrying too soon wastes the attempt and annoys the customer. Retryly schedules retries at the optimal moment — next business day for refer-to-payer, payday cycle for NSF — maximising the chance of success on the first retry."
          />
          <FeatureRow
            icon="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 5.18 2 2 0 015 3h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 10a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17.92z"
            title="Automated customer outreach"
            description="When a payment fails, Retryly automatically emails the customer with a clear, professional message — no awkward chasing calls required. For re-authorisation cases, a Pinch Payment Link is sent directly so they can update details on the spot."
          />
          <FeatureRow
            icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            title="Risk scoring per payer"
            description="Every payer gets a risk score based on their payment history. High-risk payers get different treatment — more proactive outreach, earlier escalation — while low-risk payers are treated gently to preserve the relationship."
          />
          <FeatureRow
            icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            title="Flexible payment plans"
            description="When a customer simply can't pay in full, Retryly offers to split the balance into 2, 3 or 4 instalments via Pinch subscriptions. This recovers revenue that would otherwise be written off and keeps the customer relationship intact."
          />
          <FeatureRow
            icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            title="Pre-debit reminders"
            description="Prevention beats cure. Retryly sends automated reminders before payment is due — giving customers time to top up their account, reducing the dishonour rate at the source before it becomes a recovery problem."
          />
        </div>
      </section>

      {/* ── Cash Flow Forecast section ── */}
      <section className="pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center mb-10">
          <div>
            <SectionLabel>Know What's Coming</SectionLabel>
            <h2 className="text-3xl font-bold text-white mb-4">Know what's coming before it hits</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              Most payment tools tell you what went wrong yesterday. Retryly tells you what's at risk tomorrow.
            </p>
            <p className="text-slate-400 leading-relaxed mb-4">
              The Cash Flow Forecast shows your expected collections for the next 14 days — adjusted in real time for each payer's risk score, payment history, and upcoming debit schedule.
            </p>
            <p className="text-slate-400 leading-relaxed mb-4">
              High-risk payments are flagged before they fail. Pre-debit reminders go out automatically. And when something does fail, Retryly's recovery engine is already running.
            </p>
            <p className="text-slate-400 leading-relaxed">
              For the first time, Australian SMBs on direct debit can see their cash position not as it is — but as it's likely to be.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Best case', value: '$18,400', color: 'text-emerald-400', sub: 'If all payments succeed', bar: 100 },
              { label: 'At risk', value: '$3,200', color: 'text-amber-400', sub: '4 payers flagged', bar: 17 },
              { label: 'Retryly recovers', value: '~$2,600', color: 'text-emerald-400', sub: 'Estimated auto-recovery', bar: 14 },
              { label: 'Worst case', value: '$15,200', color: 'text-slate-300', sub: 'If high-risk payments fail', bar: 83 },
            ].map(({ label, value, color, sub, bar }) => (
              <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
                  <span className={`text-base font-bold tabular-nums ${color}`}>{value}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${bar}%` }} />
                </div>
                <div className="text-[11px] text-slate-600 mt-1">{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 stat cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              stat: '80%',
              label: 'of AU SMBs impacted by cash flow issues last year',
              source: 'CommBank/UNSW 2025 survey',
            },
            {
              stat: '47%',
              label: 'of AU SME insolvencies cite cash flow as the primary cause',
              source: 'ASIC benchmarks',
            },
            {
              stat: '1 in 4',
              label: 'SMBs say payment friction has caused them to lose customers',
              source: 'Ezidebit 2025 SMB Payments Research',
            },
          ].map(({ stat, label, source }) => (
            <div key={stat} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-emerald-400 mb-2">{stat}</div>
              <div className="text-sm text-slate-300 leading-snug mb-2">{label}</div>
              <div className="text-[11px] text-slate-600">Source: {source}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Pinch ── */}
      <section className="pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <SectionLabel>Built for Pinch</SectionLabel>
              <h2 className="text-3xl font-bold text-white mb-4">Deep Pinch integration — not just a webhook forwarder</h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                Retryly is purpose-built on top of Pinch Payments' direct debit infrastructure. This isn't a generic wrapper — every feature is designed around how Pinch works, what its webhooks deliver, and what its API can do.
              </p>
              <p className="text-slate-400 leading-relaxed">
                The result: Pinch merchants get recovery capabilities that would otherwise require a custom engineering project, available in minutes with zero technical setup.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: 'Zero-friction onboarding',
                  desc: 'Connect with your Pinch Merchant ID and Secret Key. Retryly auto-registers its webhook — no Pinch portal configuration needed.',
                },
                {
                  title: 'Managed merchant model',
                  desc: 'Non-technical SMBs can onboard via Pinch\'s managed merchant (PayFac) path. Just enter your ABN — no API keys, no developer portal.',
                },
                {
                  title: 'Native dishonour processing',
                  desc: 'Pinch\'s bank-results webhook fires immediately when a payment fails. Retryly picks it up in real time and starts the recovery workflow.',
                },
                {
                  title: 'Pinch Payment Links for re-auth',
                  desc: 'When a customer needs to update their bank details, Retryly creates a Pinch Payment Link and sends it automatically — the customer re-authorises in one click.',
                },
                {
                  title: 'Pinch Subscriptions for plans',
                  desc: 'Payment plans are created as Pinch Subscriptions, so instalments are handled natively by the same direct debit infrastructure.',
                },
              ].map(({ title, desc }) => (
                <div key={title} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-0.5">{title}</div>
                    <div className="text-sm text-slate-400">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why It Works Beyond Pinch ── */}
      <section className="pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <SectionLabel>The Bigger Picture</SectionLabel>
          <h2 className="text-3xl font-bold text-white mb-4">The same problem exists across every payment processor</h2>
          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Pinch is the first integration, but the dishonour recovery problem isn't unique to Pinch. Any business running recurring payments — direct debit, cards, ACH — faces the same challenge.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          {[
            {
              processor: 'Stripe',
              desc: 'Stripe has Radar and Smart Retries for card payments, but nothing for ACH/direct debit failure recovery with AI classification and customer outreach.',
              color: 'text-violet-400',
              bg: 'bg-violet-500/10 border-violet-500/20',
            },
            {
              processor: 'GoCardless',
              desc: 'GoCardless handles BACS and SEPA direct debits across the UK and Europe. Failed payment recovery is manual — the same gap Retryly fills for Pinch.',
              color: 'text-blue-400',
              bg: 'bg-blue-500/10 border-blue-500/20',
            },
            {
              processor: 'Ezidebit / Debitsuccess',
              desc: 'Legacy Australian direct debit platforms used by gyms and childcare centres. No intelligent recovery, just basic retry rules that miss the nuance of why payments fail.',
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
            },
          ].map(({ processor, desc, color, bg }) => (
            <div key={processor} className={`rounded-xl border ${bg} p-5`}>
              <div className={`text-base font-bold ${color} mb-2`}>{processor}</div>
              <div className="text-sm text-slate-400 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8">
          <h3 className="text-lg font-bold text-white mb-3">What makes Retryly's approach processor-agnostic</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-400 leading-relaxed">
            <p>
              The AI logic at the core of Retryly — classifying failure codes, choosing retry timing, generating customer messages, scoring risk — doesn't depend on Pinch. It depends on the semantics of payment failure, which are consistent across processors.
            </p>
            <p>
              Adding a new processor is an integration layer, not a product rebuild. The webhook schema changes; the recovery intelligence doesn't. This makes Retryly a platform, not just a Pinch add-on.
            </p>
          </div>
        </div>
      </section>

      {/* ── What's unique ── */}
      <section className="pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <SectionLabel>What Makes Us Different</SectionLabel>
          <h2 className="text-3xl font-bold text-white">Not just retrying — recovering</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: 'AI triage, not dumb rules',
              desc: 'Most retry systems apply a single rule: "retry in 3 days." Retryly reads the failure code, the payer\'s history, and the amount — then decides the optimal path for that specific payment.',
              icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
            },
            {
              title: 'Customer relationship first',
              desc: 'A failed payment doesn\'t have to mean a lost customer. Retryly\'s outreach is professional and empathetic — not aggressive. The goal is recovery without churn.',
              icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
            },
            {
              title: 'Designed for SMBs, not enterprises',
              desc: 'Enterprise payment ops teams build custom tooling. SMBs can\'t. Retryly is the turnkey version — set up in 5 minutes, zero ongoing maintenance, no technical knowledge required.',
              icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
            },
          ].map(({ title, desc, icon }) => (
            <div key={title} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pb-32 px-4 sm:px-6 max-w-3xl mx-auto text-center">
        <div className="bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-10 md:p-14">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to stop losing revenue?</h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto leading-relaxed">
            Connect your Pinch account in minutes. Retryly starts recovering failed payments automatically — no setup, no ongoing work.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl transition-all hover:shadow-xl hover:shadow-emerald-500/25 text-sm">
              Get started free
            </Link>
            <Link to="/" className="border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium px-8 py-3 rounded-xl transition-all text-sm">
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800/60 py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Retryly</span>
          </div>
          <p className="text-xs text-slate-600">Built for Australian businesses running direct debits via Pinch Payments.</p>
          <div className="flex gap-6 text-xs text-slate-500">
            <Link to="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <Link to="/about" className="hover:text-slate-300 transition-colors">About</Link>
            <Link to="/login" className="hover:text-slate-300 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
