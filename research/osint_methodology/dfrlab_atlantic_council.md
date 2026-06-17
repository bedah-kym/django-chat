# DFRLab (Atlantic Council Digital Forensic Research Lab)

**What it is.** The most influential open-source OSINT/disinformation operation in the West. Sits inside the Atlantic Council. Co-founded the Election Integrity Partnership with Stanford's Internet Observatory. Operationalised the practice of *open-source disinformation forensics* as a discipline — taking academic methods and producing publication-ready investigations on weekly cadence.

**Why it's in here.** DFRLab is the closest *operational model* (vs Stanford IO's methodological model) of what an intelligence platform that runs continuously and produces public outputs looks like. Their published investigations are also the most useful "have we found something real" check for SIGNET's outputs — if SIGNET surfaces a Kenya-relevant pattern that DFRLab has independently published on, you've cross-validated.

## Mission (from their own framing)

> "Operationalised the study of disinformation by exposing falsehoods and fake news, documenting human rights abuses, and building digital resilience worldwide."

The framing is significant — they treat disinformation analysis as a *discipline*, with published methods, replicable investigations, and trained analysts. Not "social listening." Not "trends dashboards." Investigations.

## Africa-relevant work

DFRLab has expanding Africa coverage:
- The Atlantic Council's broader Africa Center has examined how five key African countries (including **Kenya**) are shaping regulatory frameworks for digital rights, AI policy, and bridging policy gaps.
- A major published report on West African disinformation specifically ([Atlantic Council, In-depth research](https://www.atlanticcouncil.org/in-depth-research-reports/report/disinformation-west-africa/)).
- The **2022 Kenyan election** is documented in their analytical work as a case of an "emerging marketplace for influence operations where hashtags and tweets carry a price tag, and a vast supply of digital entrepreneurs stand ready to monetize their social networks." This is the *operational* finding most important to internalise: Kenyan disinformation is a *market*, not just a campaign.

## Method (synthesized from their publication style)

DFRLab investigations typically combine:
1. **Hash and tag tracking** — manual + tooled identification of suspicious hashtags spiking outside organic ranges.
2. **Cross-platform tracing** — following the same narrative across X / Telegram / Facebook / TikTok to identify the seed and the amplifiers.
3. **Account-level forensics** — creation date, posting cadence, profile-image reuse (often reverse-image-search hits to stock photos), follower-pattern analysis.
4. **Attribution** — they explicitly try to name the funder/operator behind a campaign, not just describe it. This is harder than detection but is the value-add.
5. **Public-record-grade output** — every claim is sourceable, every chart has a reproducible underlying dataset.

## Africa-wide framing (2023–24 data, via Africa Center, broadly DFRLab-aligned)

- **189 documented disinformation campaigns in Africa in 2023** — roughly 4× the 2022 number.
- Domestic political actors deploying targeted disinformation is the *fastest growing* category.
- Foreign actors account for ~60% of documented campaigns (Russia leading, then China, UAE, Saudi Arabia, Qatar).
- Russia: 80 campaigns across 22+ African countries; ~40% of all documented African disinformation campaigns.

## What SIGNET should borrow

1. **The "marketplace" framing.** A 2022 Kenyan election finding from this ecosystem is that disinformation isn't only ideologically motivated — it's *commercially* organised. "Digital entrepreneurs" monetise their networks by selling access. SIGNET's `SignetAccount.tier` model implicitly assumes accounts are ideological actors; the market framing implies some are *mercenaries* with shifting alignments. Worth modelling.
2. **Investigation-grade output.** DFRLab's value is publishing — not dashboarding. If SIGNET's day-30 deliverable is "a written intel report" (per the soak plan), DFRLab is the format model: a single coordinated narrative, with named accounts, sourced screenshots, reproducible data, and a public-record-grade chain of evidence.
3. **Cross-platform tracing as the standard.** Reddit-only SIGNET is methodologically incomplete by DFRLab standards. The argument for adding X (or starting it as the next phase) is straight from their methodology: a single-platform view always misses where the campaign actually lives.
4. **Attribution as the goal, not detection.** SIGNET currently stops at "this content has these manipulation tags." DFRLab keeps going: *who pays for this, who runs it, what's the chain?* That's a much harder problem and not solvable by tagger alone — but the SIGNET data, once accumulated, is *substrate* for that kind of investigation.

## Cross-validation hits to look for during the soak

When SIGNET surfaces a coordinated cluster, check:
- Has DFRLab published on this actor / hashtag / narrative?
- Does DFRLab's published method cite the same evidence shape SIGNET found?
- Where DFRLab and SIGNET disagree, which is more likely right — a 2-person human-checked DFRLab investigation, or SIGNET's LLM-tagged narrative cluster?

The answer is almost always "DFRLab, by a wide margin" — but the cases where SIGNET *agrees* with their published findings are credibility-building. The cases where SIGNET surfaces something they haven't covered are leads for newsroom partnerships.

## Sources

- [DFRLab home](https://dfrlab.org/)
- [DFRLab research index](https://dfrlab.org/research/)
- [Atlantic Council — DFRLab program page](https://www.atlanticcouncil.org/programs/digital-forensic-research-lab/)
- [The disinformation landscape in West Africa and beyond — Atlantic Council](https://www.atlanticcouncil.org/in-depth-research-reports/report/disinformation-west-africa/)
- [Africa Tackles Online Disinformation Campaigns During Major Election Year — Dark Reading](https://www.darkreading.com/cyberattacks-data-breaches/africa-tackles-online-disinformation-campaigns-during-major-election-year)
