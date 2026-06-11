# Social Intelligence Platform — Prototype Design & End Goals

**Classification:** Internal Working Document  
**Version:** 0.1 — Brainstorm Phase  
**Date:** April 2026

---

## 1. Executive Summary

This document outlines the architecture, prototype scope, and long-term goals for a hybrid relational-graph intelligence platform. The system ingests social media signals from X and Meta platforms via passive collection bots, processes them through an LLM orchestration layer, and stores the results in a dual-layer database — relational for attribute storage and analytics, graph for relationship traversal and network mapping.

The system is designed in two distinct phases: first as a personal feed intelligence tool, and later as a structured misinformation research platform.

---

## 2. Core Design Philosophy

The system treats every entity — accounts, posts, hashtags, narratives — not as isolated database records but as **interconnected nodes** whose intelligence value emerges from their relationships. An account is only partially understood by its own attributes; it is fully understood by what it connects to, amplifies, and influences.

The bots are passive sensors only. All intelligence processing, tagging, and storage happens in the backend. The bots never act on the platform — they only observe and forward.

---

## 3. System Components

### 3.1 Collection Layer — Bots (X and Meta)

The bots operate as lightweight, human-paced sentries. They are stateless — they carry no intelligence logic and make no decisions. Their sole responsibility is structured data collection and forwarding to the backend queue.

Each bot collects the following raw signals:

- Post content, timestamp, and engagement metrics
- Author metadata (handle, account age, follower/following counts)
- Hashtags, mentions, and linked URLs
- Reply and quote-tweet threads
- Audience response samples (top replies, sentiment surface)

Bot behaviour is deliberately rate-limited and irregular to avoid platform detection. Posting cadence, if any, is never automated.

### 3.2 Orchestration Layer — Django Backend

The Django backend serves as the central nervous system. It receives raw signals from the bots via a Redis/BullMQ queue, routes them through the LLM processing pipeline, and writes structured intelligence to the database.

The orchestration layer is responsible for:

- **Triage:** Determining whether an incoming signal warrants further processing.
- **Entity resolution:** Identifying whether an account, narrative, or hashtag is already known or new.
- **LLM tagging:** Classifying content across the narrative taxonomy (see Section 5).
- **Graph edge creation:** Establishing or updating relationships between nodes.
- **Profile maintenance:** Updating account and narrative profiles with new evidence.

Temporal handles durable, long-running workflows such as narrative spread tracking and account profile evolution. LangGraph handles the internal reasoning steps within individual agent tasks.

### 3.3 Database Layer — Hybrid Relational + Graph

The database is built on PostgreSQL with the Apache AGE extension, enabling both standard SQL queries and graph traversal queries (Cypher) within a single engine. This eliminates the operational overhead of maintaining two separate database systems.

**Relational side** stores:
- Account attributes and content history
- Post records and engagement snapshots
- Narrative metadata and timeline data
- Aggregated analytics and trend data

**Graph side** stores:
- Node definitions: `Account`, `Post`, `Hashtag`, `Narrative`, `AudienceSegment`
- Edge definitions: `AMPLIFIES`, `SEEDS`, `RESPONDS_TO`, `TAGGED_WITH`, `PART_OF_NETWORK`, `RESONATES_WITH`

The two layers share primary keys, allowing a query to retrieve relational attributes and graph relationships for the same entity in a single operation.

---

## 4. Node & Edge Taxonomy

### Nodes

| Node Type | Description |
|---|---|
| `Account` | Any tracked social media account |
| `Post` | Individual content unit (tweet, reel caption, thread) |
| `Hashtag` | Platform hashtag or trend keyword |
| `Narrative` | A tracked message, claim, or talking point |
| `AudienceSegment` | A behavioural cluster of accounts (not demographic) |
| `Source` | External URL or domain linked from posts |

### Edges

| Edge | From | To | Meaning |
|---|---|---|---|
| `SEEDS` | Account | Narrative | Account originated the narrative |
| `AMPLIFIES` | Account | Narrative / Post | Account spread content without originating it |
| `RESPONDS_TO` | Account | Post / Narrative | Account replied, quoted, or reacted |
| `TAGGED_WITH` | Post / Account | Hashtag | Association to a hashtag |
| `PART_OF_NETWORK` | Account | Account | Accounts with coordinated amplification behaviour |
| `RESONATES_WITH` | Narrative | AudienceSegment | Narrative found measurable traction in a segment |

---

## 5. LLM Tagging Taxonomy

All LLM classification outputs map to one or more of the following tag categories. These tags are applied to both nodes and edges.

**Manipulation Technique:** `red_pill_pipeline`, `firehose_falsehood`, `appeal_to_victimhood`, `false_equivalence`, `astroturfing`, `coordinated_inauthentic`

**Content Domain:** `political_disinfo`, `health_misinfo`, `economic_fear`, `identity_wedge`, `election_integrity`, `anti_institution`

**Spread Pattern:** `organic_viral`, `coordinated_amplified`, `celebrity_laundered`, `media_crossover`

**Audience Response:** `polarised`, `unified_amplification`, `counter_narrative_forming`, `ignored`, `mockery`

Tags are probabilistic — each carries a confidence score between 0 and 1. No tag is treated as binary ground truth until human-reviewed.

---

## 6. Prototype Scope (Phase 1)

The prototype targets a single, contained use case: **personal feed intelligence for the operator.** This keeps scope narrow, infrastructure minimal, and validates the core pipeline before expanding to research use cases.

### Objectives

- Ingest a personal X timeline and tag every account and post it contains.
- Build initial node profiles and graph edges from observed behaviour.
- Surface a ranked list of accounts by content quality, noise level, and narrative alignment.
- Enable the operator to make informed mute, unfollow, and list decisions based on graph-derived insight rather than surface impressions.

### Prototype Stack

| Component | Technology |
|---|---|
| Bot (X) | Node.js, X API Basic tier |
| Queue | Redis + BullMQ |
| Orchestration | Django + Celery |
| LLM | Claude API (claude-sonnet-4) |
| Database | PostgreSQL + Apache AGE |
| Graph Queries | Apache AGE (Cypher over Postgres) |
| Workflow Engine | Temporal (for multi-step tracking jobs) |
| Operator Interface | Django Admin (prototype) → custom dashboard later |

### Prototype Deliverables

1. Bot collector for X with structured payload forwarding to Redis queue.
2. Django consumer that processes queue items through the LLM tagger.
3. Account and post node creation with initial edge mapping.
4. Feed quality report: a ranked, tagged view of the operator's followed accounts.
5. Basic graph query interface for relationship exploration.

---

## 7. End Goals (Phase 2 — Intelligence Research Platform)

Once the prototype validates the core pipeline, the system expands into its full research capability.

### 7.1 Narrative Tracking

The system identifies emerging narratives in real time, tracks their evolution as the message mutates across accounts and platforms, and measures their spread velocity and eventual reach. Decay curves are tracked to understand which narratives sustain and which collapse.

### 7.2 Network Mapping

The graph layer builds influence topology maps — distinguishing true narrative seeds from amplification nodes, identifying coordinated inauthentic networks through edge pattern analysis, and surfacing the accounts with disproportionate real-world impact relative to their visible follower counts.

### 7.3 Audience Response Intelligence

The system moves beyond tracking what is posted to tracking how audiences respond over time. It measures whether repeated exposure to a narrative shifts the response sentiment of an audience segment, identifies the conditions under which counter-narratives succeed or fail, and builds a response playbook grounded in observed data.

### 7.4 Cross-Platform Expansion

Meta (Instagram, Facebook) signals are added via their Graph API. Over time, the system is designed to detect when a narrative originates on one platform and migrates to another — a key indicator of coordinated or well-resourced influence operations.

### 7.5 The Intelligence Asset

After sustained operation, the platform's primary value is not its real-time monitoring capability but its accumulated, proprietary dataset of labelled narratives, account behaviour histories, and audience response patterns specific to the Kenyan and East African information environment — a dataset that does not exist commercially at this level of granularity.

---

## 8. Data & Ethics Boundaries

The system is designed around the following firm constraints:

- **Passive collection only.** The bots never post, reply, like, or interact with any content.
- **No PII storage beyond what is publicly visible** on the platform at the time of collection.
- **No targeting of individuals.** The unit of study is narratives and networks, not private persons.
- **Human review gates** all high-confidence verdicts before any action is taken on the data.
- The system is an analytical tool. Any downstream use of its intelligence outputs is the sole responsibility of the operator.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| API tier limits restricting data volume | Start with operator's own timeline; expand scope incrementally |
| LLM tagging false positives at scale | Confidence scoring + human review queue for borderline cases |
| Graph schema rigidity as use cases evolve | Apache AGE allows schema-flexible node properties; plan for schema versioning |
| Platform policy changes (X, Meta) | Bot logic is fully decoupled from intelligence logic; swap collectors independently |
| Data volume outpacing infrastructure | Celery task prioritisation + Temporal rate controls manage throughput |

---

## 10. Immediate Next Steps

1. Finalise the PostgreSQL + Apache AGE schema for Phase 1 nodes and edges.
2. Build the X collector bot with structured payload specification.
3. Design the LLM tagger prompt with the Phase 1 taxonomy subset.
4. Stand up the Django consumer and validate the end-to-end pipeline on a small sample.
5. Produce the first feed intelligence report from live data.

---

*Document status: Working draft. All architectural decisions subject to revision based on prototype findings.*
