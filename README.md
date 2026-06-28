# 🛰️ Mathia — Social Intelligence Platform

**Passive intelligence collection → LLM tagging → operator triage → scope-gated action.**

Mathia is an **OSINT / social-intelligence platform** for studying manipulation and
disinformation, with an authorized **"act-on-intel"** security arm. It collects public
signal, scores it with versioned LLM tagging, surfaces ranked leads to a human operator, and
— only behind explicit human approval and owner-granted authorization — can hand a lead to a
scope-guarded penetration-testing workflow.

It is built on the **Mathia orchestration spine**: a human-gated, fully-audited agent runtime
(originally an "AI operating system" for solo founders) whose trust-critical
machinery — approval gates, provenance receipts, structured-output contracts, durable
workflows — is exactly what an intelligence platform needs.

---

## 🧭 The principled boundary (read this first)

Intelligence and action are deliberately decoupled. **There is no automatic
intel → attack pipeline.**

- Collection is **passive and official-API-first** (no individual targeting; research posture).
- A pentest is authorized **per-target by the asset owner** — your own assets, a signed
  engagement, or a bug-bounty scope — **never derived from gathered OSINT**.
- Every action that touches a target passes a fail-closed chain: **typed scope → verified
  authorization → scope enforcement → per-action human approval → kill-switch**.
- Everything is **provenance-tracked and human-gated**; nothing consequential runs without an
  approved, audited record.

---

## 🧱 Capabilities

### 🛰️ SIGNET — live intelligence engine
Multi-platform passive collection (Reddit, Telegram, …) → versioned LLM tagging
(manipulation / disinformation taxonomy) → reach-based tier/threat scoring → ranked operator
triage. Deployed and soaking. *(See `Backend/signet/`.)*

### 🛡️ Pentest — the scope-gated act-on-intel arm
A penetration-testing workflow that can only act against authorized assets. The full safety
spine is shipped and human-gated end to end:

| Stage | What it does |
| --- | --- |
| **Scope** | typed allow/deny resolver, deny-wins, fail-closed (`pentest/scope.py`) |
| **Lifecycle** | draft → admin-verified → running, append-only audit (`pentest/lifecycle.py`) |
| **Enforcement** | single chokepoint: running + verified + in-scope (`pentest/enforcement.py`) |
| **Approval** | per-action M3 approval for high-active/destructive actions + revoke kill-switch |
| **Execution** | external Kali-agent transport (REST, token-auth) running a **server-side action allowlist** |

Execution today is **passive OSINT only** — `passive_dns_lookup`, `domain_rdap_lookup`,
`ct_subdomain_lookup` — which contact DNS resolvers / fixed providers, never the target host.
Active probing and approved high-active execution are gated behind later slices. *(See
`Backend/pentest/` and the external agent in `agents/kali_pentest_agent/`.)*

### 🧠 The orchestration spine (foundation)
The reusable substrate every capability is built on:

- **M3 human-gated runtime** — `WorkflowApprovalRecord` / `pending_approval` (the approval gates).
- **Provenance** — `ActionReceipt` immutable receipts (lineage & audit).
- **Contracts** — structured-output validation for every LLM/tool call.
- **Connectors** — a pluggable registry for collectors and tools.
- **Durable workflows** — Temporal + Celery for collect → tag → graph pipelines.
- **Real-time** — Django Channels + Redis for live output and chat.

The spine also still powers the platform's heritage capabilities (conversational agent,
double-entry finance ledger, integrations) that now serve as primitives rather than the headline.

---

## 🛠️ Tech stack

- **Core**: Python 3.11, Django 6 (ASGI)
- **Real-time**: Django Channels + Redis (WebSockets)
- **AI orchestration**: MCP router (Model Context Protocol), structured-output contracts
- **Workflows / async**: Temporal, Celery & Celery Beat
- **Database**: PostgreSQL
- **Frontend**: React 19 + Vite + TypeScript (`frontend/`) — domain-workspace shell
  (`intel`, `security`, …)
- **External agent**: standalone FastAPI Kali agent (`agents/kali_pentest_agent/`)

---

## ⚡ Quick start (Docker)

```bash
git clone <this-repo> mathia && cd mathia
cp .env.example .env          # add API keys: Anthropic, etc.
docker-compose up --build
docker-compose exec web python Backend/manage.py migrate
```

App at http://localhost:8000 · frontend dev server: `cd frontend && npm install && npm run dev`.

---

## 🚀 Railway deployment

This repo ships a `Dockerfile` and an entrypoint that runs migrations and `collectstatic`.

1. Create a Railway project and connect this repo.
2. Add PostgreSQL and Redis plugins (Railway injects `DATABASE_URL` and `REDIS_URL`).
3. Set required environment variables:
   - `DJANGO_SECRET_KEY`
   - `DJANGO_DEBUG=false`
   - `DJANGO_ALLOWED_HOSTS=yourapp.up.railway.app`
   - `DJANGO_CSRF_TRUSTED_ORIGINS=https://yourapp.up.railway.app`
4. (Optional) Uploads in production: `R2_ENABLED=true` + all `R2_*` vars (see `Backend/Backend/settings.py`).

Service start commands (Railway service settings):

```bash
sh /app/scripts/railway/web.sh             # web
sh /app/scripts/railway/celery_worker.sh   # celery worker
sh /app/scripts/railway/celery_beat.sh     # celery beat
sh /app/scripts/railway/temporal_worker.sh # temporal worker (if used)
```

For worker/beat/temporal services set `SKIP_MIGRATIONS=1` to avoid repeated migrations.

The **Kali pentest agent** runs as its own process/container — see
`agents/kali_pentest_agent/README.md` (disabled by default; token-gated).

---

## 🧪 Testing

```bash
# Django suite (hermetic test settings)
cd Backend && python manage.py test --settings=Backend.settings_test

# External agent unit tests
python -m unittest discover -s agents/kali_pentest_agent/tests

# Security scan (CI gate)
bandit -r . -x ./tests,./venv --skip B101 -ll -ii

# Frontend
cd frontend && npm run typecheck && npm run lint
```

CI (`.github/workflows/main.yml`) runs flake8, Bandit, the Django suite, and the agent tests
on every PR.

---

**© 2026 Mathia Project.**
