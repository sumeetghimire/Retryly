# Retryly — Automatic Payment Recovery for Australian SMBs

> Every failed payment is a second chance. Retryly uses AI to automatically recover failed direct debit payments through smart retry timing, personalised customer communication, payment plans, and predictive risk scoring — all powered by Pinch Payments and Claude.

Built for the **Pinch Me! I Want $50K** hackathon (July 2026).

---

## The Problem

Australian SMBs lose thousands each month to failed BECS direct debit payments. The current process is manual: chase emails, spreadsheets, phone calls. The average recovery rate without automation is under 40%. Retryly fixes this.

## What Retryly Does

- **Classifies** every dishonour by BECS reason code (soft/hard/escalate)
- **Schedules** retry on the optimal day — avoids Mondays, payday congestion (14th/15th), weekends
- **Generates** personalised customer messages via Claude (SMS + email), calibrated by failure history
- **Offers payment plans** for chronic late payers (2+ failures) via Pinch subscriptions
- **Sends payment links** for hard failures where re-authorisation is needed
- **Scores risk** for every payer before payments fail — alerts on high-risk accounts
- **Enforces governance**: max retries, cooldown days, hard-code lockout, idempotency nonces
- **Surcharge advisor**: models impact of RBA card surcharging ban (1 Oct 2026), shows BECS savings
- **Dashboard**: 6-month trend charts, recovery impact, AI daily summary

---

## Claude Use Cases

| Feature | Claude Prompt |
|---|---|
| Dishonour explanation | Explains BECS reason code in plain English for the business owner |
| Customer message | Personalised SMS/email to the payer, reason-code-aware, tone calibrated by failure count |
| Pre-debit reminder | 2-sentence friendly heads-up before next debit |
| Recovery summary | Daily owner email with stats and recommended actions |
| Surcharge insight | 2-sentence RBA ban impact tailored to the business's payer mix |
| AI Dashboard summary | Natural language overview of recovery performance |

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new business account |
| POST | `/api/auth/login` | Login (rate limited: 5/min) |
| POST | `/api/auth/logout` | Logout, clear session cookie |
| GET | `/api/auth/me` | Get current user |

### Onboarding
| Method | Path | Description |
|---|---|---|
| POST | `/api/onboarding/connect-pinch` | Validate and store Pinch API key |
| POST | `/api/onboarding/preferences` | Save retry preferences |
| GET | `/api/onboarding/webhook-url` | Get webhook URL to paste into Pinch |

### Dishonours (Agent Inbox)
| Method | Path | Description |
|---|---|---|
| GET | `/api/dishonours` | List all dishonours |
| POST | `/api/dishonours/{id}/approve-retry` | Approve a retry |
| POST | `/api/dishonours/{id}/accept-plan` | Accept a payment plan option |
| POST | `/api/dishonours/{id}/resend-link` | Resend payment link |
| POST | `/api/dishonours/{id}/write-off` | Write off a dishonour |
| GET | `/api/dishonours/{id}/audit-log` | View action history |

### Dashboard & Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard` | Full dashboard stats + AI summary |
| GET | `/api/payers` | Payer list with risk scores |
| GET | `/api/risk-report` | High/medium risk payers |
| GET | `/api/surcharge-advisor` | BECS vs card fee analysis |

### Webhook
| Method | Path | Description |
|---|---|---|
| POST | `/webhook/pinch` | Pinch webhook receiver (payment.dishonoured) |

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | System health check (Pinch, Claude, DB, uptime) |

---

## 5-Step Setup

### Prerequisites
- Python 3.11+
- Node 18+
- PostgreSQL database
- Pinch Payments account (sandbox)
- Anthropic API key

### 1. Clone & configure
```bash
git clone https://github.com/sumeetghimire/Retryly.git
cd Retryly
cp .env.example .env
# Fill in your values in .env
```

### 2. Backend
```bash
cd /path/to/Retryly
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### 4. Connect Pinch webhook
- Go to Pinch Dashboard → Webhooks
- Add URL: `https://your-domain.com/webhook/pinch`
- Subscribe to: `payment.dishonoured`

### 5. Seed test data (Sandbox)
- Register an account in the UI
- Connect your Pinch sandbox API key
- Click **Seed Test Data** in the Sandbox tab
- Watch dishonours appear in the Agent Inbox

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `PINCH_API_KEY` | Pinch Payments API key (sandbox or production) |
| `PINCH_BASE_URL` | Pinch API base URL |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `APP_ENV` | `development` or `production` |
| `DEMO_MODE` | `true` to use seed data instead of live Pinch calls |
| `SECRET_KEY` | Secret for encrypting stored API keys |

---

## Architecture

```
Pinch Webhook → FastAPI → DishonourClassifier → ProcessDishonours task
                                                       ↓
                                               RetryScheduler (smart timing)
                                               RiskScorer (before payment)
                                               ClaudeService (messages)
                                               PinchService (retry/plan/link)
                                                       ↓
                                               Postgres (SQLAlchemy async)
                                                       ↓
                                               React dashboard (Vite + Tailwind)
```

## Key Design Decisions

- **HTTP-only cookie sessions** — no JWTs in localStorage (XSS protection)
- **Idempotency nonces** — `retryly-{payment_id}-attempt-{n}` prevents duplicate charges
- **Retry governance** — hard BECS codes never retried, max retries + cooldown enforced
- **Smart timing** — avoids Mondays, weekends, 14th/15th, prefers payer's historical success days
- **Risk scoring** — computed before payment date, not after failure (proactive not reactive)

---

## Demo Walkthrough

1. Register → Connect Pinch sandbox key → complete onboarding
2. Seed test data (Sandbox tab)
3. Agent Inbox shows dishonours with Claude explanations + customer messages
4. Approve a retry — see smart date + timing reason
5. Accept a payment plan for a chronic late payer
6. Check Dashboard → AI summary, 6-month chart, recovery impact
7. Check Payers → risk dots, recovery rate bars
8. Check Surcharge Advisor → BECS vs card savings, RBA ban countdown
