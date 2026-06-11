# Data Quality Framework — Social Intelligence Platform

**Classification:** Internal Governance Document  
**Version:** 1.0  
**Date:** April 2026  
**Scope:** All data ingested, processed, stored, and queried within the intelligence platform pipeline.

---

## 1. Purpose and Principles

The long-term value of this platform rests entirely on the trustworthiness of its data. A system that monitors misinformation must itself be held to a higher standard of information integrity than the content it studies. This document defines the framework by which every stage of the pipeline — from raw collection through LLM processing to final storage and query — is governed, validated, and audited.

Three principles underpin all quality decisions in this framework.

**Provenance over convenience.** Every data point must carry a traceable record of where it came from, when it was collected, and what transformations it has undergone. Convenience shortcuts that obscure provenance are not acceptable, regardless of the operational pressure to take them.

**Explicit uncertainty over silent failure.** The pipeline must never silently discard, modify, or substitute data. When a processing step cannot produce a confident output, the system must record that uncertainty explicitly rather than defaulting to a best guess. An uncertain label stored as uncertain is an asset. An uncertain label stored as confident is a liability that compounds over time.

**Human authority over automated verdicts.** LLM outputs are analytical inputs, not final verdicts. No classification, tag, or relationship edge carries full system confidence until a defined human review gate has been passed. The degree to which human review is required scales with the sensitivity of the claim being made.

---

## 2. Pipeline Stages and Quality Responsibilities

The pipeline is divided into four stages. Each stage has defined quality responsibilities, failure modes, and acceptance criteria.

### Stage 1 — Collection (Bot Layer)

The collection layer is responsible for capturing raw platform data accurately and completely, without modification or interpretation. Quality at this stage is primarily about fidelity and completeness.

**Fidelity** means the collected payload must exactly represent what was present on the platform at the time of collection. No fields are omitted silently. If a field is unavailable due to API limitations, it is recorded as null with a reason code, not simply absent.

**Completeness** means every collected item must include a minimum viable payload before it is accepted into the queue. The minimum viable payload for any post is: platform identifier, author identifier, content text, timestamp, and engagement snapshot. Items that do not meet this threshold are rejected at the queue boundary and logged as collection failures, not silently dropped.

**Timestamping** must use UTC throughout the pipeline without exception. Platform-native timestamps are converted at the point of collection. The original platform timestamp is preserved alongside the UTC conversion.

**Deduplication** is enforced at the collection stage using platform-native post identifiers. Duplicate identifiers within a configurable time window are rejected with a duplicate log entry. This prevents a single viral post from inflating narrative reach metrics through repeated ingestion.

### Stage 2 — Queue and Transport (Redis/BullMQ)

The queue layer is responsible for guaranteed delivery and ordered processing. Quality here is about reliability and traceability.

Every queue item carries a pipeline run identifier that links it to a specific bot collection session. This allows any downstream anomaly to be traced back to a specific collection window. Failed queue items are not discarded; they are moved to a dead letter queue with a failure reason and timestamp, and are reviewed on a defined schedule.

Queue items must not be modified in transit. The queue is a transport mechanism only. Any system component that reads from the queue and attempts to enrich or modify the payload before processing has been completed is in violation of this framework.

### Stage 3 — LLM Processing (Orchestration Layer)

The LLM processing stage introduces the greatest potential for quality degradation in the pipeline. Language models are probabilistic systems, and their outputs must be treated accordingly. The following controls govern this stage.

**Prompt versioning** is mandatory. Every LLM call must reference a specific, versioned prompt template. Changes to prompt language, structure, or taxonomy are treated as schema changes — they require a version increment, documentation of the change, and a backward-compatibility assessment. Historical classifications are never retroactively relabelled without an explicit reprocessing decision that is itself logged.

**Confidence scoring** is required on every LLM output. No tag or classification is stored without an associated confidence score between 0 and 1. The pipeline defines three confidence tiers with distinct downstream handling.

| Tier | Score Range | Handling |
|---|---|---|
| High Confidence | 0.80 – 1.00 | Stored as provisional; eligible for use in analytics after 48-hour review window |
| Medium Confidence | 0.50 – 0.79 | Stored as provisional; flagged for human review before use in any downstream product |
| Low Confidence | 0.00 – 0.49 | Stored as uncertain; excluded from analytics and graph edge creation until reviewed |

**Structured output validation** is enforced before any LLM response is written to the database. The expected output schema is defined per prompt version. Responses that do not conform to the schema are rejected, logged, and the originating item is re-queued for a single retry. If the retry also fails schema validation, the item is moved to the human review queue with both LLM responses attached.

**Hallucination controls** are applied by requiring the LLM to ground every classification in a specific excerpt from the input content. Classifications that cannot be grounded — where the model produces a tag without referencing supporting evidence from the source material — are flagged for review regardless of confidence score.

**Model versioning** is tracked at the processing record level. When the underlying model is upgraded, the model version identifier is stored alongside all outputs it produces. This enables cohort analysis to assess whether model changes have introduced classification drift across comparable content.

### Stage 4 — Storage (PostgreSQL + Apache AGE)

The storage layer is responsible for preserving the integrity of both the relational and graph representations of the data.

**Immutability of raw records.** Raw ingestion records are never updated or deleted after their initial write, except through a formal data governance process. Updates to account profiles, narrative classifications, or graph edges are written as new versioned records, preserving the full history of how a node's understanding has evolved over time.

**Graph edge provenance.** Every edge in the graph carries a provenance record: the pipeline run that created it, the LLM confidence score that supported it, the prompt version that generated the classification, and the human review status. An edge without provenance is not a valid edge.

**Referential integrity enforcement.** Graph edges may only be created between nodes that exist in the relational layer. The relational layer is the system of record; the graph layer is a derived representation. Orphaned graph nodes — nodes with no corresponding relational record — are treated as a critical pipeline error.

---

## 3. Human Review Gates

Human review is structured as a tiered system based on the sensitivity and downstream impact of the data in question.

**Gate 1 — Routine Review.** All medium-confidence LLM classifications are reviewed within a seven-day window. The reviewer confirms, rejects, or amends the classification and records a reason. This gate is primarily a quality assurance function.

**Gate 2 — Sensitive Content Review.** Any classification that tags an account with coordination or inauthenticity signals, or that attributes a narrative to a specific seed account, requires review before the classification is used in any output or report. This gate protects against the system making consequential attributions based on model error.

**Gate 3 — Publication Review.** Any intelligence output derived from this system that is intended to be shared outside the operator — with a third party, a research partner, or a media organisation — requires a full provenance audit before release. This audit confirms that all supporting data points have passed Gate 1 or Gate 2, and that the confidence of the overall finding is accurately represented in the output.

---

## 4. Audit and Lineage

Every data point in the system must be traceable from its final stored form back to the original platform signal. The following lineage metadata is maintained throughout the pipeline.

Each processing record stores the platform source and post identifier, the collection timestamp and bot session identifier, the queue item identifier and ingestion timestamp, the prompt version and model version used, the raw LLM response and structured output, the confidence score and tier, the human review status and reviewer identifier where applicable, and the final stored classification with its version history.

This lineage enables two critical audit capabilities. Forward tracing allows an operator to take any narrative or account tag in the database and see precisely what evidence chain produced it. Backward tracing allows an operator to take any raw post and see every classification, edge, and profile update it contributed to. Without both directions of tracing, the system cannot be defended, corrected, or trusted.

---

## 5. Consistency Standards

Consistency failures are the most insidious form of quality degradation because they are invisible in individual records and only emerge at the analytical layer where they corrupt aggregate findings.

**Taxonomy consistency** is enforced by treating the tag taxonomy as a versioned schema. Tags are never added, modified, or deprecated informally. Any taxonomy change follows a change control process: proposal, impact assessment on existing classifications, approval, version increment, and documentation. Reclassification of existing records under a new taxonomy version is an explicit pipeline operation, not an implicit one.

**Cross-platform consistency** requires that equivalent entities from different platforms are resolved to common standards before storage. Account identifiers, timestamp formats, and engagement metric definitions vary across X and Meta. Platform-specific fields are preserved in a raw metadata column, and normalised fields follow a platform-agnostic schema.

**Temporal consistency** means that snapshots of account attributes and narrative engagement metrics are always taken at defined intervals, not on-demand. Ad-hoc snapshots taken at irregular intervals introduce sampling bias into time-series analysis. The pipeline defines a standard snapshot cadence per entity type and enforces it.

---

## 6. Monitoring and Alerting

The pipeline is instrumented with the following quality metrics, monitored continuously.

**Collection health** tracks the ratio of successful to failed collection attempts per bot session, the rate of minimum viable payload failures, and the volume of deduplicated items per session. Anomalies in collection volume — both unexpected drops and unexpected spikes — trigger alerts, as both may indicate platform-side changes or bot detection events.

**Processing health** tracks LLM response latency, schema validation failure rate, confidence score distribution per prompt version, and the volume of items in the dead letter and human review queues. A sustained shift in the confidence score distribution for a given prompt version is a signal that either the input data characteristics have changed or the prompt has degraded in effectiveness.

**Storage health** tracks orphaned graph nodes, edges without provenance, and records missing required lineage fields. These are treated as critical errors requiring immediate investigation, not routine maintenance items.

---

## 7. Periodic Quality Reviews

Beyond continuous monitoring, the framework requires scheduled quality reviews at three intervals.

A monthly review examines the human review queue backlog, the rate of reviewer amendments to LLM classifications, and any emerging patterns in low-confidence outputs that may indicate prompt degradation or taxonomy gaps.

A quarterly review assesses the overall consistency of classifications across the taxonomy, compares classification distributions between model versions if an upgrade has occurred, and evaluates whether the defined confidence thresholds remain appropriately calibrated.

An annual review conducts a full lineage audit on a random sample of stored records, reviews the taxonomy for completeness and relevance, and produces a data quality report that documents the overall trustworthiness of the corpus for research or partnership purposes.

---

## 8. Data Correction Policy

Errors will occur. The framework's response to errors is as important as its prevention mechanisms.

When a quality error is identified — whether through monitoring, human review, or external challenge — the correction process follows a defined sequence. The affected records are identified through backward tracing. The root cause is documented. Corrected records are written as new versions, preserving the erroneous version in the history with an error flag and correction reference. Any downstream analytical outputs or reports that relied on the erroneous records are assessed for material impact and, where necessary, revised.

Corrections are never silent. Every correction generates an audit log entry that is retained indefinitely. The integrity of the system depends not on the absence of errors but on the transparency with which they are identified, corrected, and documented.

---

## 9. Summary of Quality Standards

| Dimension | Standard |
|---|---|
| Provenance | Every record traceable to source in both directions |
| Confidence | All LLM outputs scored; tier determines downstream handling |
| Immutability | Raw records never modified; updates written as versioned records |
| Taxonomy | Versioned; changes follow change control process |
| Human review | Three-gate system scaled to classification sensitivity |
| Audit | Full lineage metadata retained indefinitely |
| Corrections | Versioned, documented, and audited; never silent |

---

*This framework is a living document. It is reviewed and updated quarterly in line with the pipeline's quarterly quality review cycle. All revisions are versioned and dated.*
