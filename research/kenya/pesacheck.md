# PesaCheck

**What it is.** Africa's largest fact-checking initiative, originating in East Africa (Kenya, Tanzania, Uganda) and now operating in 12 countries across east and west Africa and the Sahel. Sits inside Code for Africa's ANCIR ecosystem. Started by verifying financial and statistical claims by public figures — hence the name (*pesa* = money). Closest fact-checking analogue to SIGNET's verification gap.

**Why this matters for SIGNET.** SIGNET classifies *technique* (manipulation patterns), not *truth*. The deferred Tier-2 "verification API" we discussed is essentially "consult a fact-checker." PesaCheck IS the fact-checker for East African political/financial claims. Their methodology and rated-claim database is the most plausible real-world source if/when SIGNET adds claim verification.

## Methodology — the three "Golden Rules"

> 1. **Only one fact per fact-check** — a single atomic claim, not a paragraph.
> 2. **Check every fact-check** — verify claims using **primary documents**, not secondary reporting.
> 3. **Draw a conclusion based on the facts** — assign a standardised label.

This is rigorous practice and matches what a defensible verification tier in SIGNET would have to look like: one claim, primary-source backing, standardised verdict.

## What they fact-check (and don't)

PesaCheck prioritises:
- Verifiable numerical claims (budgets, allocations, statistics)
- High-visibility statements generating public discussion
- Viral social media claims or frequently repeated assertions
- Claims provable through factual support
- Statements where numbers may be manipulated for partisan messaging

They explicitly **exclude opinions and future predictions** as ineligible. (Worth noting — SIGNET's tagger does NOT respect this distinction; it'll cheerfully apply manipulation tags to opinions. This is one of the reasons subject-vs-technique confusion is a persistent issue.)

## Rating labels

> **False · Satire · Partly False · False Headline · Missing Context · Hoax · Not Eligible · Inconclusive**

These eight labels are a more nuanced vocabulary than SIGNET's tier system. Note "Missing Context" and "False Headline" — both flag *partial* manipulation that SIGNET currently has no clean way to express. The latter (true-content-but-misleading-frame) is exactly the kind of dramatic-but-true case v2.2 (correctly) declines to tag.

## Tooling

- **Check** — claims management system (used widely across the IFCN network).
- **sourceAFRICA** — public archive of source documents.
- **Crowdtangle (deprecated), Meltwater, Primer.ai** — social listening at the front of the funnel.
- **WhatsApp tip-line** — real-world surfacing channel for viral claims. *Critical for the Kenyan context where WhatsApp is the dominant info layer.*
- **PesaYetu, TaxClock, Wajibisha / PromiseTracker** — structured-data products that let citizens interrogate budget and political-promise data.
- **DebunkBot** — internal AI tool for automating parts of the verification flow.

## Distinctive positioning

- **Operations in conflict zones** (Sahel) where most fact-checking infrastructure isn't viable.
- **Public-finance focus** — the original premise. Numbers in political speech are uniquely high-leverage to fact-check because they're cheaply verifiable and rhetorically powerful.

## What SIGNET can borrow / validate against

1. **The "one fact per check" rule** is the right design for a future SIGNET verification queue — when a high-tier `political_disinfo` post lands, the *atomic claim* (extracted via the existing emergent layer's `summary` field) is what gets queued for verification, not the post text. This is buildable today on top of the existing schema.
2. **The eight rating labels** are a better vocabulary than the current binary tier system if SIGNET ever surfaces verified claims to users. Adopt this directly rather than inventing.
3. **PesaCheck's flagged claims are a quasi-ground-truth set** — if SIGNET's `political_disinfo` flag fires on a post whose claim PesaCheck has rated, the rating is the ground truth. This is the cheapest external validation channel.
4. **Primary-source backing** — useful discipline for any future SIGNET "evidence" UI: link to the actual document, not just the post.
5. The **WhatsApp tip-line** model is worth knowing exists. SIGNET will not get into WhatsApp anytime soon (no API), but if/when you add a human-submission channel for posts of interest, PesaCheck's flow is the precedent.

## Sources

- [PesaCheck — Our Methodology](https://pesacheck.org/our-methodology/)
- [PesaCheck — Our Principles and funding](https://pesacheck.org/our-principles/)
- [PesaCheck home](https://pesacheck.org/)
- [Countering Disinformation — PesaCheck profile](https://counteringdisinformation.org/interventions/pesa-check)
- [Tools + Tech: What PesaCheck uses (Code for Africa, Medium)](https://medium.com/code-for-africa/tools-tech-what-pesacheck-uses-to-stem-the-tide-of-misinformation-dd710f979f4f)
- [Fighting fake news in Kenya and Senegal (The Conversation)](https://theconversation.com/fighting-fake-news-how-media-in-kenya-and-senegal-check-facts-251123)
