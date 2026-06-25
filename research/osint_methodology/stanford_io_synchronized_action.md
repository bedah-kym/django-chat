# Stanford Internet Observatory — Synchronized Action Framework

**What it is.** The academic methodology for detecting coordinated inauthentic behaviour (CIB) at scale, developed inside Stanford's Internet Observatory (SIO). Closest published equivalent of what SIGNET's `coordinated_inauthentic` and `astroturfing` tags are trying to do — but with proper network-graph methods rather than text-pattern recognition.

**Context.** SIO co-founded the **Election Integrity Partnership** in 2020 with the DFRLab and others to formalise CIB analysis. **Renée DiResta** is SIO's technical research manager (see her own file). The Observatory has been wound down since 2024 amid political pressure, but its published methods are the surviving canon.

## Core methodology

> "The SIO uses network-based approaches that are particularly useful for detecting sets of coordinating users by drawing connections between users when they both take coordinated actions, resulting in a user-to-user 'coordination network' where stronger connections indicate more frequent coordinated behavior between pairs of users."

The crucial framing: **CIB is a property of the network, not the post.** A single post in isolation can never be coordinated inauthentic. The signal lives in repeated co-occurrences across accounts.

## The Synchronized Action Framework

SIO published a "multi-view network-based synchronized action framework" that lets analysts study several coordination types simultaneously. The mechanics:

- For each user, derive a sequence of *actions* (shared links, identical phrases, same hashtag at near-identical timestamps).
- Build a **user-to-user graph** where edge weight = number of synchronized actions between that pair.
- Apply clustering / community detection to surface coordination clusters.
- Score each cluster against a baseline of organic behaviour to flag *inauthenticity*.

Key insight: synchronization across multiple action *types* (hashtag + posting time + content overlap + follow-graph) is much stronger evidence than any single type alone. False positives drop sharply when you require multi-axis agreement.

## Detection challenges (relevant to SIGNET)

- **Mass reporting** — coordinated networks weaponize the platforms' own moderation tools. SIO discovered networks that coordinated to mass-report opposition accounts. This is invisible to content analysis; only network/temporal data reveals it.
- **Multi-platform spread** — campaigns increasingly run across platforms (X seeds → Telegram amplifies → TikTok memes → mainstream press). Single-platform analysis misses the structure.
- **TikTok specifically** is a "video-first ecosystem" where existing CIB detection methods (built for text platforms) don't work. SIO's recent 2025 paper specifically addresses this gap.

## Critical gap relative to SIGNET's current architecture

SIGNET's `coordinated_inauthentic` and `astroturfing` tags are **applied to single posts based on text patterns**. SIO's published methodology says this is fundamentally the wrong unit of analysis — these phenomena only exist at the *graph* level.

This is the structural reason SIGNET's tagger has the subject-vs-technique confusion the eval revealed: there is no text signal for coordination strong enough to justify the tag from a single post. The tag will always either over-fire on rhetoric or under-fire on actually-coordinated-but-mundane content.

## What SIGNET should borrow

1. **Move coordination detection out of the per-post tagger and into the projector.** The `SignetEdge` table is already a user-to-user graph substrate. A scheduled job that computes synchronized-action edges (same hashtag within 5 min across N accounts, identical-text-overlap across accounts, etc.) and surfaces clusters as candidate `coordinated_inauthentic` *networks* — not posts — is much closer to the SIO method and much more defensible.
2. **Require multi-axis evidence** before firing the tag. A SIGNET "coordinated_inauthentic" finding should need: (a) account creation date clustering, *and* (b) posting time clustering, *and* (c) content overlap. Any one in isolation is too weak.
3. **Baseline against organic behaviour.** SIO's method scores against a baseline. SIGNET has no baseline today. The 30-day soak will produce the data to derive one — what does "normal" cadence and overlap look like in r/Kenya? That baseline is the substrate for honest coordination detection later.
4. **The platform stack matters.** Reddit-only is a real limitation for CIB detection because most genuine coordination happens on X and WhatsApp. The Stanford methodology assumes multi-platform observation. SIGNET will see only the *Reddit shadow* of campaigns that originate elsewhere.

## Related published work (worth a deeper read when relevant)

- Goodhart-style adversarial robustness — campaigns adapt to known detection methods, so detection has to keep evolving. SIO's published methods have a 1–2 year shelf life before operators adapt around them.
- Election Integrity Partnership reports — concrete case studies of CIB applied to US elections; tactics transfer to other contexts.

## Sources

- [The Stanford Internet Observatory and Covert Influence Operations — OODAloop](https://oodaloop.com/analysis/disruptive-technology/the-stanford-internet-observatory-and-covert-influence-operations/)
- [Synchronized Action Framework for Detection of Coordination on Social Media (ResearchGate)](https://www.researchgate.net/publication/358942123_Synchronized_Action_Framework_for_Detection_of_Coordination_on_Social_Media)
- [Labeled Datasets for Research on Information Operations (arXiv, 2024)](https://arxiv.org/pdf/2411.10609)
- [Coordinated Inauthentic Behavior on TikTok (arXiv, 2025)](https://arxiv.org/pdf/2505.10867)
- [Detecting Coordinated Activities Through Temporal, Multiplex, and Collaborative Analysis (arXiv, 2025)](https://arxiv.org/pdf/2512.19677)
- [Stanford IO and Social Links case study](https://blog.sociallinks.io/stanford-internet-observatory-and-social-links-a-research-case-unveiled/)
