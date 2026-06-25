# SIGNET — Research Reference Library

A working bibliography of the published research SIGNET should be **built on**, **measured against**, and **published with awareness of**. Each file is a synthesis: what the source says, what's quotable, where it agrees or disagrees with SIGNET's current design, and what to validate during the 30-day soak.

These are *external* references — they were not produced by the project. They exist to:

1. Keep the project honest. SIGNET is one team's pipeline; the people listed here have spent careers on these questions.
2. Provide cross-validation gates for soak findings. If SIGNET surfaces something none of them have noticed, that's either a real discovery or a methodology bug — both worth knowing.
3. Establish the framework SIGNET's outputs (reports, alerts, briefings) will be read against. Operators using SIGNET need this background; consumers of SIGNET-derived intel will assume it.

## Structure

```
research/
├── README.md                                  ← this file
├── kenya/                                     ← Kenya-specific work
│   ├── nyabola_digital_democracy.md           ← the canonical theorist
│   ├── cambridge_analytica_kenya.md           ← the historical baseline
│   ├── code_for_africa_ilab.md                ← the operational analogue
│   ├── pesacheck.md                           ← the verification analogue
│   └── cipesa_kenya_2024.md                   ← the infrastructure baseline
├── osint_methodology/                         ← How this is done elsewhere
│   ├── stanford_io_synchronized_action.md     ← the academic CIB method
│   ├── dfrlab_atlantic_council.md             ← the published-investigation model
│   └── africa_center_2024_mapping.md          ← the continent-scale numbers
├── academic/                                  ← Theory worth internalising
│   ├── diresta_invisible_rulers.md            ← the post-2020 actor framework
│   └── phillips_oxygen_of_amplification.md    ← amplification dynamics + ethics of publishing
└── datasets/                                  ← (empty for now — see "Open gaps")
```

## Suggested reading order

For someone new to the problem:

1. **`kenya/nyabola_digital_democracy.md`** — frame
2. **`kenya/cambridge_analytica_kenya.md`** — historical baseline you're being measured against
3. **`osint_methodology/africa_center_2024_mapping.md`** — current scale (the numbers)
4. **`academic/diresta_invisible_rulers.md`** — current actor model
5. **`academic/phillips_oxygen_of_amplification.md`** — what to do with what you find
6. **`osint_methodology/stanford_io_synchronized_action.md`** — the methodology gap SIGNET still has
7. **`kenya/code_for_africa_ilab.md`** + **`kenya/pesacheck.md`** — Kenyan operational analogues to consult
8. **`osint_methodology/dfrlab_atlantic_council.md`** — what published output looks like
9. **`kenya/cipesa_kenya_2024.md`** — infrastructure caveats

## How each source maps to SIGNET's design

| SIGNET surface | Source(s) to consult | Why |
|---|---|---|
| **`identity_wedge` tag** | Nyabola, CIPESA | Confirms ethnic axis is dominant; CIPESA's four-axis breakdown (ethnic/economic/demographic/ideological) is a finer-grained future taxonomy |
| **`political_disinfo` tag** | PesaCheck, Cambridge Analytica file | PesaCheck's rated-claims database is the closest external ground truth; CA case is the historical baseline |
| **`coordinated_inauthentic` / `astroturfing` tags** | Stanford IO, DFRLab, DiResta | All three converge on: this is a *network* property, not a post property. SIGNET's per-post tagging is structurally underpowered. The fix is graph-level analysis on `SignetEdge` |
| **`anti_institution` tag** | Nyabola, CIPESA | Use cautiously in Kenyan context — sometimes a defensible response to documented state misinformation, not a manipulation tag |
| **`red_pill_pipeline` tag** | DiResta, Phillips | The "awakening / hidden truth" framing IS the contemporary actor mechanic; SIGNET's blind spot on this is a real recall hole |
| **`SignetAccount` tier system** | DFRLab, DiResta | "Marketplace" finding — some accounts are mercenary, not ideological. Tier system needs an actor-type axis eventually |
| **`SignetNarrative` clustering** | iLAB, DFRLab | Both treat network of posts as the unit; aligned with SIGNET design |
| **Review queue / `SignetReviewItem`** | iLAB (newsroom model), Phillips (do-not-amplify ethics) | Reviewer needs both the evidence (now shipped) and an "amplification-stage" awareness (future enhancement) |
| **Verification gap (deferred Tier 2)** | PesaCheck | The natural integration is consulting PesaCheck's database when a `political_disinfo` candidate surfaces |
| **Safety/welfare guard** | Nyabola (marginalised speech), Phillips (harassment coverage) | Don't pathologise subaltern speech; cover harassment without rewarding harassers |

## Cross-validation gates for the 30-day soak

Concrete tests to run at day 30 against this reference set:

| Gate | Source it tests against | Pass condition |
|---|---|---|
| Domestic-actor majority | Africa Center 2024 | Most flagged actor clusters are Kenyan, not foreign |
| Ethnic-wedge dominance | Nyabola, CIPESA | When `identity_wedge` fires, the entities are ethnic groups (kikuyu, luo, kalenjin, etc.) more often than other identity types |
| Cambridge Analytica technique match | CA file | Sampling 2017-era archived posts (if obtainable) should surface a coherent `political_disinfo + identity_wedge + coordinated_inauthentic` cluster pointing at Odinga-targeted content |
| Volume calibration | Africa Center 2024 (9 Kenya campaigns/year ≈ 1 per 6 weeks) | SIGNET's flagged distinct-narrative count for 30 days is in the 0–2 range, not the 20+ range |
| Cross-validation hit | DFRLab, iLAB | At least one SIGNET-surfaced narrative cluster overlaps with published findings from either body |
| Population caveat | CIPESA | Any written intel report explicitly notes that only ~23% of Kenyans are on social media, so conclusions don't generalise to the population |

## Open gaps in this reference set

What's *not* in here that should be added when convenient:

- **2027 Kenyan election-specific work** — the 2022 work is the most recent; 2027 cycle will get its own research wave, currently nascent.
- **Russia / Wagner Africa playbook deep-dive** — Africa Center's overview is here but not a focused Wagner / Doppelganger-style operational analysis.
- **WhatsApp ecosystem research** — almost everything published on WhatsApp's role in Kenyan info ecology is in Nyabola's book or scattered news pieces; no canonical research collection exists because WhatsApp is genuinely hard to study.
- **Datasets** — the `datasets/` folder is empty. Worth populating later with: PesaCheck's published fact-check corpus, Stanford IO's released CIB datasets (linked in their methodology file), academic election-disinfo datasets. Each gives SIGNET potential evaluation ground truth.
- **Cambridge Analytica Kenya — the *technical* dataset.** It was never publicly released; if any leaked subset becomes accessible, it's the highest-value benchmark in the entire field.
- **Africa Centre for Strategic Studies' 2025 update** — when published, replaces the 2024 mapping file as the headline-numbers source.
- **The other half of this repo's domain** — the pentest / bug-bounty work that lives in the same MATHIA codebase. Research on responsible-disclosure norms and authorised offensive-security practice would belong in a parallel research tree.

## A note on these summaries

These files are syntheses of published material, not original research. Quoted passages are marked verbatim; everything else is paraphrase and interpretation by the maintainer. **Citations to URLs at the bottom of each file are mandatory** — go to the source for anything that's going to drive a decision. The summaries are decision-routing aids, not substitutes for reading.

When a summary becomes the basis for a SIGNET design change or a public report, **the source itself should be re-read end-to-end first.** This library is built to start conversations, not end them.
