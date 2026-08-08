# Code for Africa — iLAB

**What it is.** The continent's largest digital forensic unit, sitting inside Code for Africa's ANCIR (African Network of Centres for Investigative Reporting). Network analysis + investigative journalism, not fact-checking. Led by **Allan Cheboi**. Teams across east, south, and west Africa.

**Why this is the most directly comparable work to SIGNET.** iLAB is doing exactly the thing the SIGNET pipeline is trying to do — surface coordinated disinformation networks at scale on African platforms — but with humans + bespoke tooling instead of an end-to-end LLM-tagged pipeline. Their methodological choices are the closest external reference for what "doing this seriously" looks like.

## Methodology

- **Identifying interconnected campaigns** rather than isolated false claims. They are looking for the *network*, not the individual lie. This is the same unit of analysis SIGNET uses (narratives, not posts).
- **NLP + sentiment analysis** for monitoring.
- **Social network mapping** to trace sock-puppet accounts and bot networks.
- **Attribution analysis** focused on de-anonymising the operators behind automated accounts and fake profiles.
- Research extending into **WhatsApp and Telegram**, where monitoring is much harder than open platforms.

## Documented exposures (East Africa relevant)

- **Kenya** — political disinformation campaigns coordinated across digital platforms during electoral periods.
- **Uganda** — an "elaborate web" of organised false narratives targeting the election cycle.
- **Sudan** — a sophisticated Russian-backed disinformation network operating on Facebook.

## Operating model — newsroom partnerships

> "Collaboration between newsrooms ... enables them to share resources, solutions and ideas."

iLAB does the digital research and identifies the problem; **local newsrooms publish the story.** They explicitly *don't* fact-check themselves — they hand the network analysis to journalists who already understand the local information environment.

## What SIGNET can borrow

- **Network analysis as the unit of work, not single-claim fact-checking** — already aligned. SIGNET's narrative/edge model is built around this.
- **Sock-puppet / bot detection methodology** — would slot into a future tag (`coordinated_inauthentic` becomes evidence-backed once you can show account creation dates, posting cadence, content overlap). The `SignetAccount.tier` + `SignetEdge` graph is the substrate.
- **The newsroom-partner model** is exactly the "human-eyes phase" the project plan calls for. Their model is: the pipeline finds the candidate, the journalist validates and publishes. SIGNET's review queue + the new tagger-evidence surface fit this collaboration shape cleanly.
- **Watching encrypted platforms is the unsolved frontier** — useful prior to know before scoping a future WhatsApp/Telegram tier.

## What to validate against iLAB's published work

When a SIGNET narrative or actor cluster surfaces during the soak, **check whether it appears in iLAB's published investigations.** If your top flagged accounts overlap with theirs, that's external confirmation. If they don't overlap, two possibilities — your method is finding something they missed, or you're surfacing noise. Both are decision-relevant signals.

## Sources

- [Code for Africa — Wikipedia](https://en.wikipedia.org/wiki/Code_for_Africa)
- [iLAB's fight against disinfo in the era of new technologies (Code for Africa, Medium)](https://medium.com/code-for-africa/ilabs-fight-against-disinfo-in-the-era-of-new-technologies-12e2f0541676)
- [Battling Disinformation with Code for Africa (Code for All)](https://codeforall.org/2023/02/28/code-for-africa-vs-disinformation/)
- [Code for Africa — Activity feed](https://medium.com/@CodeForAfrica/activity)
