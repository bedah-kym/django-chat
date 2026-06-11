# Social Intelligence Platform — Implementation Plan

> Multi-agent ultraplan synthesized 2026-06-06 from the three apivot design docs
> (`intelligence_system_design.md`, `data_quality_framework.md`, `platform_api_reference.md`)
> and a survey of the existing Mathia/Kazi codebase for reuse.

## 1. Executive Summary

We are building a **Social Intelligence Platform (SIP)**: a system that collects public social-media posts, classifies them for manipulation/disinformation patterns using versioned LLM tagging, stores the results as an account/post/narrative graph, and surfaces ranked intelligence to a human operator. The product evolves in two phases. **Phase 1 (MVP) is a personal X-timeline triage tool** that lets one operator make informed mute/unfollow decisions, backed by confidence-scored tags and human review. Phase 2 expands to multi-platform narrative tracking, audience segmentation, and coordinated-behavior detection.

**The core bet:** the hard, trust-critical parts of this product — durable multi-step pipelines, human-gated approval, immutable provenance, structured-output validation, versioned contracts — are *exactly* the spine Mathia already ships (the M3 human-gated runtime, the connector foundation, the orchestration/contracts layer). We are not building an intelligence platform from scratch; we are mounting a tagging-and-graph workload onto a proven orchestration backbone. By the reuse analysis, roughly **~7,000 LOC plug-and-play + ~5,500 LOC extend** comes from Mathia, leaving the genuinely new surface to the graph layer, the collectors, and the operator-facing ranking. The platform's long-term credibility rests on **trustworthiness of immutable, versioned, human-audited data — not velocity of tagging.** Every architectural decision below is subordinate to that.

**Three load-bearing assumptions that gate the whole build:**
1. LLM tagging latency is acceptable for triage UX (target <10s/batch; mitigated by small batches + async — this is **not** a real-time path).
2. X API Basic-tier rate limits sustain Phase 1 volume (single operator, ~1 timeline).
3. Apache AGE query performance holds at Phase 1 scale (10K–50K nodes). **This is the riskiest reuse decision and has an explicit fallback (§4).**

---

## 2. Architecture & Phased Roadmap

### Runtime spine

```
X Collector (Node or Python/tweepy)
   → Redis queue (durable, normalized payload schema v1.0)
   → Celery consumer (dedup, entity extract)
   → LLM tagging (Claude Sonnet, versioned prompt + structured output)
   → confidence tier + grounding validation
   → graph writer (Postgres + AGE; relational edge table → graph via activity)
   → Triage/ranking API → operator UI (Django admin, Phase 1)
                        ↘ human-review gates (M3 approval runtime) feed back into tag eligibility
```

Durable orchestration (collection → tagging → graph) runs on **Temporal via Mathia's `DynamicUserWorkflow`**, with Celery as the async task layer and the deferred-execution fallback when Temporal is unavailable.

### Phase 1 MVP scope (explicit)

**In:** X only; single operator; collector → queue → tag → graph → ranked triage API → Django-admin review UI; confidence tiers; human-review gates for medium/low confidence; immutable lineage; AGE graph at 10K–50K nodes.

**Out (deferred to Phase 2), decided:** multi-platform collectors; narrative clustering/versioning; audience segmentation; coordinated-behavior/network mapping; publication export; operator-trained classifiers; full graph history/diff; custom (non-admin) frontend; East-African regional dataset.

### Milestone sequence & critical path

The two source roadmaps disagree on duration (one 12-week end-to-end, one 8-week tagging-only). **Decision: 12-week Phase 1**, with the tagging pipeline (the 8-week plan) running as a parallel workstream inside it, not sequentially after collection.

| Milestone | Weeks | Critical-path output |
|---|---|---|
| M1 Collector + queue | 1–3 | Normalized posts landing in Redis; rate-limit handling |
| M2 Consumer + LLM tagging | 3–6 | Dedup + Claude tagging + structured-output validation + confidence tiers (parallel with M1 tail) |
| M3 Graph schema + writer | 6–8 | Postgres+AGE populated via relational-edge → graph activity; **AGE go/no-go decision at end of W8** |
| M4 Triage API + ranking | 8–10 | `GET /accounts/ranked`; review endpoint |
| M5 UI + review gates + harden | 10–12 | Django-admin triage + M3-mapped review queue; eval harness; deploy |

**Critical path:** M1 → M2 → M3 → M4 → M5. The single biggest schedule risk is M3 (AGE); the W8 decision gate (§4) protects the rest of the path.

---

## 3. Reuse Map

REUSE = use as-is/configure; EXTEND = add fields/subclass; BUILD-NEW = no Mathia analog.

| New need | Existing Mathia module/path | Class | Gap to close |
|---|---|---|---|
| Durable collect→tag→graph workflow | `Backend/workflows/temporal_integration.py` (`DynamicUserWorkflow`, `start_workflow_execution`) | REUSE | Add platform trigger types (schedule/poll) + step signaling to graph writer |
| Human-review gates | `Backend/workflows/models.py` (`WorkflowApprovalRecord`); `temporal_integration.py` (`create/resolve_approval_record`) | REUSE | Add **batch review** (approve N records); auto-pass rule for high confidence |
| Provenance / lineage | `Backend/orchestration/models.py` (`ActionReceipt`); `action_receipts.py` | EXTEND | Add `source_raw_payload`, `collection_session_id`, `prompt_version`, `model_version`, `confidence_tier`; immutable ingestion record |
| Structured-output validation | `Backend/orchestration/contracts.py` (`validate_catalog_entry`, version constants) | EXTEND | Add `TaggingOutputContract` + confidence enum + retry→review escalation |
| Prompt & model versioning | `contracts.py` version constants | EXTEND | `PromptTemplateVersion` + `ModelVersionAudit`; stamp every tagging record |
| Pluggable collectors | `Backend/orchestration/base_connector.py`, `connector_registry.py` | REUSE | Add `platform`, `auth_strategy`, `rate_limit_policy`; subclass `XCollector(BaseConnector)` |
| Async batch queue | `Backend/workflows/tasks.py` (`replay_deferred_workflows`, `DeferredWorkflowExecution`, backoff) | REUSE | Rename/repoint to collection queue; preserve `collection_session_id` across retries |
| LLM tagging client | `Backend/orchestration/llm_client.py`; `intent_parser.py`; `tool_schemas.py` | EXTEND | `TaggingPromptBuilder` + `tag_social_content()` returning (tags, confidence, raw) |
| Telemetry + correction learning | `Backend/orchestration/telemetry.py` (`record_event`, `record_correction_signal`) | EXTEND | Log `tag_override` corrections (original vs operator confidence) |
| Security / sensitive data | `Backend/orchestration/security_policy.py` | EXTEND | PII rules (never classify accounts as persons; hash handles in logs; raw kept separately) |
| Immutable audit trail | `ActionReceipt` (append-only) | REUSE | New `ImmutableIngestionRecord`; versioned updates as new rows |
| Replay safety | `temporal_integration.py` (`build_replay_request`, `safe_to_replay`) | REUSE | Mark collection fetches non-replayable; tagging/graph writes idempotent |
| Graph mutation (Account/Post/Narrative/edges) | step-execution pattern only | BUILD-NEW | `GraphMutationActivity`: nodes + SEEDS/AMPLIFIES/TAGGED_WITH edges w/ confidence; idempotent on `platform_post_id` |
| AGE query interface | — | BUILD-NEW | `Backend/graph/` AGE client + Cypher builders |
| Narrative tracking/clustering | — | BUILD-NEW | **Phase 2** |
| Audience segmentation | — | BUILD-NEW | **Phase 2** |
| Feed ranking / triage report | — | BUILD-NEW | Ranking score + `GET /accounts/ranked` + admin view |
| Collection session lifecycle | `DeferredWorkflowExecution` | EXTEND | `CollectionSession` model for cohort/reprocess |
| Review queue management | `WorkflowApprovalRecord` + admin | EXTEND | `ReviewQueue` priority + bulk approve/reject endpoint |

---

## 4. Data Layer

**Stack: PostgreSQL 14+ as the system of record; Apache AGE as the graph engine embedded in the same Postgres.** Relational tables hold immutable raw ingestion, versioned entities (Account/Post/Narrative), LLM audit (prompt version, call log, classification), and **relational "edge" tables** (`account_narrative_link`, `post_narrative_link`, `account_account_link`). The graph is derived from these edge tables, not authored directly.

**Key schema principles (decided, non-negotiable):**
- **Immutability:** raw ingestion rows never update; a DB trigger raises on UPDATE. Changes create new versioned rows. Deletes archive, not destroy.
- **Shared keys:** graph nodes carry the relational PK (`account.id`, `post.id`), enforcing cross-layer referential integrity.
- **Provenance is first-class:** every classification/edge stores `prompt_version`, `model_version`, `llm_call_id`, `confidence`, `confidence_tier`, `review_status`.
- **Confidence tier is computed** (`high ≥0.80`, `medium 0.50–0.79`, `low <0.50`), not free-typed.

**One contradiction to resolve — how the graph gets written.** The data-graph memo proposes **Postgres triggers calling Cypher** to auto-sync nodes/edges on relational insert. The architecture/LLM memos route writes through a **Temporal `GraphMutationActivity`**. **Decision: use the explicit activity, not triggers.** Triggers couple ingestion latency to graph writes, are hard to make idempotent/replay-safe, and hide failures from the workflow's observability. The activity path is consistent with Mathia's replay-safety model and keeps the graph write as a visible, retryable step. Triggers are rejected for Phase 1.

### AGE viability call

**Decision: adopt AGE for Phase 1, scoped to MATCH/CREATE + shallow traversal + subgraph reads, with a hard go/no-go gate at end of Week 8.** AGE is the right default because it is in-Postgres (one datastore, ACID with the relational writes, no second cluster to operate). Its weaknesses are real and bounded: aggregations, full-text, path-finding, and deep multi-hop are immature.

**Enforceable usage rule:** AGE for relationship reads and edge creation; **SQL/materialized views for all aggregation and ranking**; Postgres FTS for text search. Do not put ranking math in Cypher.

**Fallback (decided, two-stage):**
1. **Primary fallback (cheap, Phase 1):** if AGE p99 >1s at 10K–50K nodes for the triage queries, **precompute rankings in a Celery job and serve from a Redis/Postgres cache.** This defers real graph querying without adding infrastructure and keeps Phase 1 shippable.
2. **Structural fallback (Phase 2 only, if graph becomes the bottleneck at scale):** dedicated graph engine (Neo4j, or JanusGraph+Cassandra per the data memo) via async ETL from Postgres. **We do not stand up Cassandra/JanusGraph in Phase 1** — that is over-engineering for a single-operator MVP.

---

## 5. LLM Tagging & Quality Gates

**Model & call shape:** Claude Sonnet for routine tagging (Haiku as load-shed fallback, Opus reserved for publication-review amendments in Phase 2). Temperature ~0.2, small batches (start at **5**, raise toward 10–20 only if latency holds), strict token budget. Tagging is **async** — never on a user-blocking path.

**Structured output + validation:** prompts are versioned schema contracts (`TaggingPromptVersion`, e.g. `post_tagger/1.2`). Output is JSON validated in three stages: (1) JSON parse, (2) JSON-schema, (3) semantic — including the **grounding-excerpt requirement**: any tag at confidence ≥0.70 must include a verbatim excerpt from the post, validated against source text (exact or ≥0.90 fuzzy). On validation failure: one retry with an explicit grounding instruction; on second failure, escalate to the human-review queue. Invalid output never silently becomes data.

**Confidence tiers → eligibility:**
- **High (≥0.80):** stored; eligible for ranking after a short auto-review window if unflagged.
- **Medium (0.50–0.79):** stored provisional; **blocked from analytics until reviewed** (7-day window).
- **Low (<0.50):** stored uncertain; never eligible until reviewed; archived if untouched.

**Human-review gates mapped to M3.** The three gates reuse `WorkflowApprovalRecord` + the create/resolve approval activities + signal-based `DynamicUserWorkflow` directly:
- **Gate 1 Routine** (medium confidence, 7-day timeout, fail-closed).
- **Gate 2 Sensitive** (low confidence + any coordination/seed-attribution verdict, 10-day, fail-closed).
- **Gate 3 Publication** (Phase 2; mandatory sign-off before any external output).

Reviewer actions: approve / reject / **amend** (amendment writes a new versioned record, never mutates the original). Operator authority always overrides the model.

**Eval harness (Phase 1, lightweight):** a 50–100 example golden set covering every tag category, with an 85%-tier-agreement release gate for any prompt/model change, plus a weekly cross-version **drift check** that alerts if agreement drops below 85%. This is the regression net for prompt and model upgrades.

---

## 6. Collection Layer & Legal/Ethics Strategy

**Phase 1 defensible path (decided): X API v2 Basic tier via official client (tweepy), single operator's timeline.** Official-API-only. No scraping in Phase 1. Normalize every platform response to a single **Collection Payload Schema v1.0** before it hits the queue, preserving the unmodified `raw_payload` for provenance. Rate limiting via a Redis sliding-window limiter per endpoint with exponential backoff; 429 pauses the affected collector, never hammers.

> Note: the two memos quote different Basic-tier cost/quota numbers ($100/mo vs. higher tiers, differing tweet caps). Treat the exact price/quota as **unverified** and confirm against current X API pricing before committing spend — see §7.

**Risk matrix (platform → Phase):**

| Platform | Path | Legal status | Ban risk | Phase |
|---|---|---|---|---|
| X / Twitter | Basic API v2 | TOS-compliant | Low | **1** |
| Reddit | PRAW/OAuth | TOS-compliant | Low | 1b |
| GitHub | REST/GraphQL | TOS-compliant | Low | 1b |
| Bluesky | AT Protocol | TOS-compliant | Low | 1b |
| Instagram / TikTok | Research API | Requires partnership/approval | Medium | 2 |
| LinkedIn/IG via wrappers (Proxycurl/HikerAPI) | Licensed wrapper | Wrapper absorbs TOS risk | Medium | 2 |
| Threads / BeReal / IG scraping | Reverse-eng/scrape | Grey→violating | High→Critical | **Never** |

**Enforceable constraints (code, not aspiration):**
- **Platform allow-list** enforced in the collector registry; non-allow-listed or never-allowed platforms are rejected at runtime.
- **Passive-only:** no posting, replying, liking, following — collection cannot interact.
- **No individual targeting:** unit of analysis is narratives/networks, not persons; classifying *accounts as people* is blocked.
- **Public data only; PII minimization:** only public profile metadata; restricted PII (email/phone/address) rejected before storage; handles hashed in logs, raw retained separately under access control.
- **Immutable, versioned, session-stamped** records throughout.

**Legal exposure (honest):** Low–Medium in US/EU/UK with official APIs + a published privacy policy + minimal-PII + retention limits; **Medium–High in East Africa (varies by country — requires legal review before any regional collection).** GDPR DPA required if EU residents' data is processed. CFAA risk is avoided specifically *because* Phase 1 is official-API-only.

---

## 7. Top Risks & Open Decisions (ranked)

1. **AGE performance at scale (highest).** *Recommendation:* ship on AGE with the §4 enforceable usage rule; hold the **Week-8 go/no-go**; fall back to precomputed Redis/Postgres ranking cache if p99 >1s. No second graph DB in Phase 1.
2. **LLM tag accuracy / false positives driving bad mute decisions.** *Recommendation:* this is *the* reason the human-review gates and confidence tiers exist — keep them load-bearing and non-bypassable; never let medium/low feed the operator unreviewed; collect corrections for Phase 2 tuning.
3. **X API cost/quota uncertainty (open decision).** *Recommendation:* before M1 spend, verify current Basic-tier price and tweet quota against live X pricing; size single-operator volume against it. Owner decision owed in Week 1.
4. **Tagging latency / queue backlog.** *Recommendation:* keep tagging async and off the UX path; start batch=5; add queue-depth alerting; Haiku as load-shed. Accept higher p99 in Phase 1.
5. **Collector ownership: Node vs Python (open decision).** The memos split — Node/BullMQ vs Python/Celery/tweepy. *Recommendation:* **build the collector in Python/tweepy as a `BaseConnector` subclass** to maximize Mathia reuse and avoid a second runtime/queue stack (BullMQ); use Redis+Celery, not BullMQ. Decision owed before M1.
6. **Graph write path** — resolved in §4 (activity, not triggers), but flagged here as a place where the source memos genuinely conflicted.
7. **East-Africa legal posture (open, Phase 2).** *Recommendation:* no regional collection until country-by-country legal review; explicitly out of Phase 1.

---

## 8. Immediate Next Steps (first ~2 weeks)

1. **Confirm X API tier** (price, quota, auth scopes) against live pricing; record the number; size single-operator volume. *(Risk #3 — do this first.)*
2. **Lock collector decision:** Python/tweepy `BaseConnector` subclass on Redis+Celery; no BullMQ/Node. *(Risk #5.)*
3. **Stand up the app skeleton:** create `Backend/social_intel/` Django app; add `ImmutableIngestionRecord`, `CollectionSession`, `Account`, `Post`, `PromptTemplateVersion`, `LLMTaggingOutput`/`PostClassification`, `TaggingApprovalRecord` models; generate migrations. Add the immutability UPDATE-blocking trigger on raw tables.
4. **Freeze Collection Payload Schema v1.0** and the **tag catalog v1** (categories + enums + per-category confidence thresholds + grounding flags).
5. **Implement the X collector** (timeline fetch + normalize + Redis enqueue) with the sliding-window rate limiter; land 1K test posts end-to-end into the queue.
6. **Wire the tagging activity:** `TaggingPromptBuilder` + `tag_social_content()` against Claude Sonnet, 3-stage structured-output validation + grounding check + confidence tiering; tag 100 posts end-to-end.
7. **Stand up Postgres + AGE** in dev; create the `social_intel` schema and the empty graph; write a throwaway 5K-node load + sample triage query to **get an early read on AGE latency** ahead of the Week-8 gate.
8. **Map review gates to M3:** subclass the approval workflow for Gate 1/Gate 2; expose pending-review items in Django admin with bulk approve/reject.
9. **Author the eval golden set** (50–100 labeled posts) and the 85%-agreement release check, so prompt v1 ships against a real bar.

The discipline to hold across all of it: **immutable raw data, versioned everything, human gates that cannot be bypassed.** That is what turns a tagging demo into an intelligence platform worth trusting.

---

## 9. Frontend Integration & Wiring

The UI is **mostly already built** — it lives on the **`frontend-v2`** branch (Vite + React + TypeScript), unmerged to master. It is a **domain-workspace shell**, not a single-page app.

### What exists on `frontend-v2`

- **Domain model** (`src/domains.ts`, `src/types/domain.ts`): a `DomainSwitcher` flips between registered domains. `DomainId = 'security' | 'social' | 'dev' | 'ops'`. Each `DomainConfig` has `{ id, label, description, icon, defaultRoute, featureNav[] }`. Routes are `/app/<domain>/...` (regex in `getDomainFromPathname`).
- **Security domain is fully drawn** — `features/pentest/` (`PentestPage`, `NewEngagementPage`, `EngagementWorkspace`, components `PhaseBar`, `LiveOutput`, `FindingCard`, **`ConfirmationGate`**) + `features/bugbounty/` (programs, reports, `ReportDraftModal`, `BountyTracker`). This is the front end for the pinned `docs/PENTEST_FEATURE_PLAN.md` backend.
- **`ConfirmationGate`** (`features/pentest/components/ConfirmationGate.tsx`) is the human-approval gate UI: renders `action`, `riskLevel`, `context`, `commandPreview` + Deny/Approve, bound to `ApprovalRequest` (`src/types/pentest.ts`). It maps 1:1 onto the M3 backend (`WorkflowApprovalRecord`, approve/reject). **This is the SIP→pentest authorization-gate UI — already a component.**
- **Shared primitives** (`src/components/ui/`): `PageScaffold`, `SectionHeader`, `MetricStrip`, `DenseList`, `StatusBadge`, `EntitySidebar`, `StatusBadge`. The `intel` domain reuses these directly.
- **`social` domain is a thin stub** described as outbound *"channels, campaigns, drafts, performance"* — i.e. social-media *management*, NOT the SIP. **Decision: SIP is its own new `intel` domain**, not folded into `social` (different concern, different ethics posture).

### The critical gap: the frontend is mock-driven

Every page renders from `src/mocks/*` (e.g. `PentestPage` imports `mockEngagements` from `@/mocks/pentest`). **There is no API/services layer, no data-fetching client, no real wiring to the backend.** So "wiring" is a real, shared workstream — not SIP-specific:

- Build a single `src/api/` layer once (HTTP client + auth, error handling; add react-query or equivalent), plus per-feature hooks (`useEngagements`, `useRankedAccounts`, …).
- The existing `src/types/*.ts` become the **API contract** — align them field-for-field with the backend `contracts.py` envelopes. Wiring = swap a `mocks/x` import for a `useX()` hook returning the same type.
- Real-time surfaces (live tool output, tagging progress, presence) ride the existing Django Channels WebSocket layer on master (`chatbot/consumers.py`).

### SIP `intel` domain — exact integration surface

1. `src/types/domain.ts`: add `'intel'` to `DomainId`.
2. `src/domains.ts`: add `domainConfigs.intel` (icon e.g. `Network`/`Radar`, `featureNav`: Feed Triage, Accounts, Narratives, **Review Queue**); add `'intel'` to `domainOrder`; extend the route regex in `getDomainFromPathname`.
3. `src/features/intel/`: `FeedTriagePage` (the ranked accounts view — reuse `MetricStrip` + `DenseList`), `AccountDetailPage`, `NarrativePage`, `ReviewQueuePage` (**reuse `ConfirmationGate` for the Gate-1/Gate-2 review actions**).
4. `src/types/intel.ts`: mirror the backend tagging/graph contracts (tags, confidence tier, provenance, review status).
5. `src/mocks/intel.ts` first (build UI against mocks), then swap to `src/api/intel.ts` hooks.

### Frontend reuse table

| SIP UI need | `frontend-v2` asset | Class |
|---|---|---|
| App shell, nav, domain switch | `components/layout/*`, `domains.ts` | REUSE (add `intel`) |
| Review-queue approve/deny gate | `features/pentest/components/ConfirmationGate.tsx` | REUSE (generalize `ApprovalRequest`) |
| Engagement/workspace layout pattern | `features/pentest/EngagementWorkspace.tsx` | REFERENCE for narrative/account workspace |
| Metric cards, dense lists, badges, scaffold | `components/ui/*` | REUSE |
| Data layer | — (mocks only today) | **BUILD-NEW (shared)** |
| Intel domain pages | — | BUILD-NEW |

### Visual spec: charts & sparklines

The graph is the headline viz but it's not the only one — and a few things in this plan (narrative decay curves §7.1, the eval-harness 85%-agreement drift check §5, AGE p99 latency at the Week-8 gate §4, collection health monitoring §6 / data-quality framework) are implicitly charts. The Phase-1 visual spec (live in `apivot/signet_preview.html`, codename **SIGNET**) handles this with inline sparklines rather than a separate analytics screen:

- **Detail-panel sparklines** — per node type: Account → 30-day posting cadence (bars); Narrative → 14-day reach curve (line+area, colored amber/brown for active/decaying); Hashtag → 14-day volume curve.
- **TREND · 7D column** in the FEED rows — each ranked row gets a 7-day sparkline so the operator reads *momentum*, not just current threat score. This is what makes triage feel like intelligence rather than a leaderboard.
- **Pulse animations** on the COLLECTING status dot and on ⚠ ALERT items in the activity feed — light realtime signal without a full live-update bus.

**Deferred to Phase 2:** a dedicated ANALYTICS view (5th left-rail icon) for collection health (ingestion rate, queue depth, rate-limit usage), LLM confidence histogram, prompt/model drift over time (the eval gate), and AGE p99 latency monitoring (the W8 go/no-go signal). Phase 1 keeps charts inline; full analytics screens are post-MVP.

The deterministic per-node mock generator in the preview file (`timeSeries(node, days)`) shows the data *shape* the SIP backend needs to expose — `GET /api/intel/{node_id}/timeseries?days=N` returning an integer array. Cheap to compute server-side from the immutable raw ingestion records.

---

## 10. Merge & Integration Roadmap

This sequences three currently-separate streams into one shippable system: **master** (the completed orchestration spine — M3 runtime, receipts, contracts, connectors), **`frontend-v2`** (the UI shell, unmerged + unwired), and the **new SIP backend** (unbuilt). The pentest backend (`docs/PENTEST_FEATURE_PLAN.md`) is a parallel consumer of the same spine.

> Branch/PR convention (matches the completed OSS port): cut `mathia/<topic>` branches from `origin/master`, PR, admin-merge. **Gotcha:** this repo has `push.default=upstream`; a branch whose upstream is `origin/master` will push *straight to master*. For each integration branch, set its own upstream (`git push -u origin mathia/<topic>:mathia/<topic>`) so PRs aren't bypassed.

| Stage | What | Depends on | Output |
|---|---|---|---|
| **I0 — Spine (done)** | OSS→master port complete: orchestration spine, M3 approval runtime, receipts, contracts, connector registry | — | ✅ on master (`f8f37d9`) |
| **I1 — Merge frontend-v2** | Reconcile `frontend-v2` with current master (notifications, room-linking, the Phase-3 consumers fixes), resolve conflicts, merge. This is the shell everything else hangs on. | I0 | UI shell on master, still mock-driven |
| **I2 — Frontend data layer** | Build `src/api/` client + hooks + auth; wire ONE existing domain (chat or ops) end-to-end to establish the mocks→API pattern; align `src/types/*` to `contracts.py`. | I1 | Reusable wiring pattern; first live domain |
| **I3 — SIP backend** | Build `Backend/social_intel/` per §2 milestones M1–M5 (collector → queue → tagging → AGE graph → triage API → review gates). AGE go/no-go at W8. Expose REST + WS endpoints typed to match `src/types/intel.ts`. | I0 (spine) | SIP API live; Phase-1 pipeline working |
| **I4 — Wire `intel` domain** | Add the `intel` domain (§9), build `features/intel/*` against mocks, then swap to `src/api/intel.ts`; reuse `ConfirmationGate` for the review queue. | I2 + I3 | SIP usable in the UI; operator triage + review |
| **I5 — Pentest backend + gated handoff** | Build `pentest_connector` (scope-guarded) + `bug_bounty_connector` + `PentestEngagementWorkflow` per `docs/PENTEST_FEATURE_PLAN.md`; wire the already-built `security` domain to it. Add the **gated `intel`→`security` handoff**: an analyst lead can *propose* an engagement, but the target only enters scope via an authorization record (own asset / signed engagement / bug-bounty scope), enforced in `pentest_connector` and surfaced through `ConfirmationGate`. | I4 | "Act on intel" — legally, behind the scope+approval gate |

**Critical path:** I0 → I1 → I2 → I4, with I3 running in parallel after I0 and rejoining at I4. I5 is last and is the only stage that touches active security tooling — it stays behind the scope guard described in §6 and the authorization boundary (intel never auto-targets; authorization comes from the asset owner, never from gathered intel).

**Immediate frontend/merge next steps (complements §8):**
1. Branch `mathia/frontend-v2-merge` from master; dry-run the merge; inventory conflicts (esp. `chatbot/`, notifications, the Phase-3 consumers changes). *(I1)*
2. Decide the data-fetching stack (react-query recommended) and scaffold `src/api/` + auth interceptor. *(I2)*
3. Reserve the `intel` `DomainId` + `domainConfigs.intel` stub now, so SIP UI work (I4) has a home the moment the backend (I3) exposes endpoints.
