# Whitney Phillips — *The Oxygen of Amplification* (Data & Society, 2018)

**What it is.** A 128-page Data & Society report by Whitney Phillips (now Associate Professor at Syracuse) that fundamentally reframed the question of how to *report on* manipulation without amplifying it. The single most influential piece of work on amplification dynamics.

**Why this is in here.** SIGNET is in the business of *finding* manipulation. The downstream question — *what should be done with what we find* — is genuinely unsettled, and Phillips's framework is the canonical answer for journalism. Any SIGNET-derived report or alert sits inside this problem. If SIGNET surfaces a fringe narrative and an operator publishes about it, did the operator make the fringe narrative *more* visible than it would otherwise have been?

## Structure of the report

Three interlocking parts:
1. **Historical overview** — how news media interacted with far-right manipulators during the 2015–2018 period; how trolling and meme culture leveraged journalism's own incentives against itself.
2. **Consequences** — what reporting on problematic information actually does (often: amplifies it), and what structural features of journalism make this hard to avoid (deadlines, page-view incentives, fairness norms).
3. **Tactical guide** — concrete recommendations on establishing newsworthiness, handling false claims, covering harassment and manipulators.

## The amplification pipeline

Phillips's most-cited contribution is the pipeline model:

> "Disinformation often starts on anonymous platforms like 4chan and Discord, moves into closed or semi-closed groups, onto conspiracy communities on Reddit or YouTube, then onto open social networks like Twitter and Facebook, and unfortunately often moves into professional media."

Six stages of amplification, each *broader* and *more authoritative* than the last:
1. **Anonymous origins** (4chan, fringe Telegram, Discord servers)
2. **Closed / semi-closed groups** (private Facebook groups, invite-only Discords, WhatsApp groups)
3. **Conspiracy-adjacent communities** (specific subreddits, YouTube channels, fringe substacks)
4. **Open social** (X/Twitter, Facebook, Instagram, TikTok)
5. **Influencer / podcast laundering** (the "I'm just asking questions" tier)
6. **Mainstream professional media**

Each step adds *legitimacy*, not just reach. The framing shift between step 3 and step 4 — where something stops being "what they're saying on Reddit" and becomes "what's trending on X" — is where the manipulation actually does its work.

## The core insight

Manipulators don't always need to reach step 6. **Sometimes the goal is to get journalists to legitimise step 3 by writing about it.** Phillips's interview material captures journalists describing the trap: they know covering a fringe story will amplify it, but the page-view economy and competitive pressure force them to.

This is why the report's title is what it is — *attention itself* is the oxygen propagandists need. Cutting off oxygen is harder than fighting back, but it's often the only effective response.

## Phillips's "better practices" (the tactical guide, summarised)

- **Establishing newsworthiness** — strict criteria for whether a fringe claim deserves coverage at all. Most don't.
- **Handling objectively false information** — don't repeat the claim in the headline. Don't quote the misinformation verbatim. Structure pieces so the *correction* is the primary message, not the rebuttal.
- **Covering online harassment** — don't name harassers in ways that reward them. Distinguish "the harassment matters" from "the harasser is interesting."
- **Covering manipulators** — Phillips is strict here: many should not be covered at all. Coverage is a resource, and giving it to bad actors costs.

## What this means for SIGNET

SIGNET is *inside* this problem in two ways:

### 1. SIGNET as a producer of "coverage"

When SIGNET surfaces a narrative and a reviewer decides to write a report, brief an analyst, or alert a journalist — that's a Phillips-relevant decision. Some SIGNET findings should *not* be acted on, because action would amplify. The implicit assumption inside the project — that finding manipulation is good and surfacing it is better — runs straight into her critique. A SIGNET-equipped operator needs Phillips's framework to know *when not to publish*.

### 2. SIGNET as a measurer of the pipeline

SIGNET sees Reddit (step 3-4 of the pipeline, roughly). It does *not* see step 1 (anonymous origins) or step 2 (closed groups), and it sees step 4 (open social) only insofar as X content gets discussed on Reddit. This is a structural limit:

- SIGNET catches narratives at the *amplification* stage, not the *seeding* stage.
- "Where did this come from?" is mostly unanswerable from Reddit data alone.
- The reverse — *what step 4 platforms will pick this up?* — is also mostly invisible.

Adding X (the next-phase plan) gives partial visibility into step 4. Closed groups (step 2) and anonymous origins (step 1) are likely permanently out of reach.

## What SIGNET should borrow

1. **Build "do not amplify" criteria into the review queue UX.** A reviewer marking a finding as `approved` should have an explicit "publish-safe? / hold? / quiet-watch?" axis. Currently the queue only has decision (approve/reject/amend); it doesn't capture whether the *finding itself* should be disseminated.
2. **Track the amplification stage explicitly.** A future emergent field on `SignetNarrative` could carry an "amplification_stage" estimate (1–6 per Phillips), so reviewers see whether a narrative is still at the fringe (don't amplify) vs already at open social (covering it is reactive, not generative).
3. **Read this report in full.** It's free, public, and short. Anyone who's going to *use* SIGNET output to inform action needs the framework.

## Where Phillips is now

Phillips's recent work (with collaborators like Ryan Milner) extends the framework into the "weirder oxygen / weirder amplification" era — addressing how the post-2020 environment, with influencer politics and platform-native propaganda, has made even her 2018 prescriptions partially obsolete. The follow-up is in the "weirder oxygen" essay.

## Sources

- [The Oxygen of Amplification — Data & Society (full report PDF, 2018)](https://datasociety.net/wp-content/uploads/2018/05/FULLREPORT_Oxygen_of_Amplification_DS.pdf)
- [The Oxygen of Amplification — Data & Society library page](https://datasociety.net/library/oxygen-of-amplification/)
- [Weirder Oxygen and Weirder Amplification — Data & Society Points (follow-up)](https://datasociety.net/points/weirder-oxygen-and-weirder-amplification)
- [Whitney Phillips on amplification (Columbia Journalism Review interview)](https://www.cjr.org/the_new_gatekeepers/disinformation-whitney-phillips.php)
- [5 Lessons for Reporting in an Age of Disinformation — First Draft](https://firstdraftnews.org/articles/5-lessons-for-reporting-in-an-age-of-disinformation/)
- [Algorithmic Displacement of Social Trust — Knight First Amendment Institute](https://knightcolumbia.org/content/algorithmic-displacement-of-social-trust)
- [The platforming is the point — academic follow-up paper (ResearchGate)](https://www.researchgate.net/publication/391018830_The_platforming_is_the_point_News_media_'the_oxygen_of_amplification'_and_interviewing_the_far-right)
- [The Oxygen of Amplification — MediaWell SSRC index](https://mediawell.ssrc.org/news-items/the-oxygen-of-amplification-data-society/)
