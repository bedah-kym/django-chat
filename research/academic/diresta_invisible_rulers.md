# Renée DiResta — *Invisible Rulers* (2024)

**Who.** Technical research manager at Stanford's Internet Observatory until its 2024 wind-down. Spent a decade analysing geopolitical campaigns from Russia, China, Iran, and on health misinformation and voting-related rumours. The most recognisable individual researcher in the open-source disinformation space.

**Book.** *Invisible Rulers: The People Who Turn Lies into Reality* (Hachette / PublicAffairs, 2024).

**Why she's in here.** DiResta is the canonical theorist of the *current* (post-2020) information environment — where the threat has shifted from "foreign troll farms" to "domestic niche propagandists who use the platforms exactly as designed." That shift is the core background reading for understanding what SIGNET will actually surface.

## Core thesis

> "Today, small communities of propagandists increasingly shape public opinion and control our relationship to the truth, and our shared reality has splintered into discrete bespoke realities driven by algorithms, influencers, and curated content."

The "invisible rulers" are not state-sponsored troll farms (the 2016–2018 frame). They are *influencer networks*, *anti-institution communities*, *fringe-to-mainstream amplification chains*, and increasingly *AI-generated content factories*. They operate within the platforms' terms of service, optimise for engagement, and are nearly impossible to "take down" because they're not violating rules.

## The four key actor types DiResta identifies

1. **Anti-vaccine zealots** — the canonical case study; she's been tracking the anti-vax network since pre-COVID.
2. **AI-driven image manipulators** — using generative AI to manufacture perception of reality (fake protest photos, deepfaked "leaked" documents).
3. **Niche-to-mainstream amplifiers** — content that originates in fringe communities (4chan, fringe Telegram channels) and is laundered into mainstream discourse through influencer networks. (This is also Whitney Phillips's framework — see her file.)
4. **Algorithm-aware propagandists** — actors who understand platform recommendation systems and optimise for them. Their content "works" because it games the algorithm, not because it persuades on merit.

## What this means for SIGNET's threat model

The dominant disinformation actors SIGNET will encounter on Reddit r/Kenya / r/Nairobi are **not** primarily:
- Russian state actors (though they exist)
- Bot farms (though they exist)
- Single bad-actor accounts (rare)

They are more likely to be:
- **Domestic political operatives** running influencer networks (the CA-style pattern, now indigenised)
- **Mercenary "digital entrepreneurs"** who DFRLab documented in the 2022 Kenya election — accounts that *sell* amplification to whoever pays
- **Genuine-but-fringe communities** that the algorithm boosts because their content engages strongly
- **AI-generated content** increasing in volume — fabricated images, fabricated quotes, fabricated documents

SIGNET's `red_pill_pipeline` tag, despite its blind spots, is the most directly DiResta-aligned tag in the taxonomy — it targets the *recruitment/awakening* framing that her "invisible rulers" use as their core mechanic.

## DiResta's methodological contribution

She helped codify the modern framework where CIB analysis treats:
- **Network behaviour** as more reliable signal than content classification
- **Cross-platform tracking** as the unit of analysis (not single-platform)
- **Engagement patterns** as the leading indicator (a post that engages 10x organic baseline is the signal, regardless of content)
- **Attribution** as the long pole — knowing "this is coordinated" is much easier than knowing "this is funded by X"

## What SIGNET should borrow

1. **Stop treating "single bad actor" as the primary threat model.** SIGNET's current per-account tier system assumes individual actors. The real signal is *networks* — accounts that act together. The `SignetEdge` table is where this lives.
2. **Watch for algorithm-gamed content.** A post in r/Kenya that gets unusually high engagement compared to the baseline for its sub is itself a signal worth tagging — independent of its content. SIGNET has no "engagement anomaly" tag today; worth adding as a future emergent tag.
3. **Plan for AI-generated content.** The "manufactured perception" thread will be visible in the soak data within months. SIGNET's tagger has no detector for AI-generated text and never will be reliable for that — but a post whose images return zero reverse-image-search hits (or whose images are obvious AI artifacts) is a signal a downstream system could surface.
4. **Read the book.** Genuinely. The framework saves you from reinventing it.

## Connection to Stanford IO

DiResta IS Stanford IO's intellectual centre of gravity. Read her book and the SIO methodology files together — they're complementary halves of the same project.

## Sources

- [Invisible Rulers — Hachette Book Group](https://www.hachettebookgroup.com/titles/renee-diresta/invisible-rulers/9781541703377/)
- [Invisible Rulers — Amazon](https://www.amazon.com/Invisible-Rulers-People-Turn-Reality/dp/1541703375)
- [Invisible Rulers — Bookshop.org](https://bookshop.org/p/books/invisible-rulers-the-people-who-turn-lies-into-reality-renee-diresta/20664632)
- [Invisible Rulers — Porchlight Books overview](https://www.porchlightbooks.com/products/invisible-rulers-renee-diresta-9781541703377)
- [Book Review — Tillamook County Pioneer](https://www.tillamookcountypioneer.net/book-review-invisible-rulers-by-renee-diresta/)
