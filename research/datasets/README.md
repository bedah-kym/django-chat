# Datasets

Ground-truth and evaluation corpora for SIGNET. Each entry follows the pattern:
**what** / **labels** / **how to obtain** / **license** / **eval-plug** (how it
wires into `Backend/signet/eval/`).

---

## 1. Stanford IO — Labeled IO Datasets (arXiv 2411.10609)

**What.** 26 Twitter information-operation campaigns from 16 state actors
(Russia, China, Iran, Venezuela, Cuba, UAE, Qatar, Egypt, Bangladesh, Armenia,
Thailand, Spain, Catalonia, Ghana/Nigeria, Ecuador), each with:
- IO posts (verified by the platform as part of a state-sponsored campaign)
- Control posts (organic accounts discussing the same hashtags in the same
  timeframe), labelled `is_control=True`.

13M+ posts, 303k+ accounts. Anonymised (hashed PII), pre-split into 703
CSV/TSV files of 50K rows each.

**Labels.** Binary: `is_control` (False = IO, True = organic control). The IO
side is the ground truth for coordination detection — these accounts *were*
coordinated inauthentic behaviour confirmed by the platform's own investigation.

**Fields (per post).** `postid`, `post_text`, `application_name`, `post_language`,
`in_reply_to_postid`, `in_reply_to_accountid`, `post_time`, `accountid`,
`account_profile_description`, `follower_count`, `following_count`,
`account_creation_date`, `is_repost`, `reposted_accountid`, `reposted_postid`,
`hashtags`, `urls`, `account_mentions`, `is_control`.

**How to obtain.** Download from Zenodo: <https://doi.org/10.5281/zenodo.14141549>.
Segmented into campaign-level archives; each campaign is self-contained.
**Human action required:** download the campaign(s) of interest (files are
~500 MB–2 GB per campaign) and place them under `research/datasets/stanford_io/`
(create the folder). The loader (`dataset_loaders.py`) expects a directory of
CSV/TSV files.

**License.** Not explicitly stated in the paper; Zenodo record indicates
open-access. PII is one-way hashed. Researchers must comply with the platform's
terms and refrain from re-identification.

**Eval-plug.** `run_cross_validation.py --dataset stanford_io --data-dir <path>`
- Imports IO posts as synthetic `CollectedPost` rows with the dataset's
  `hashtags`, `urls`, `post_time`, `accountid` fields.
- Creates `PostClassification` rows for IO posts with `coordinated_inauthentic`
  at confidence 0.80 (simulating what the per-post tagger would produce).
- Runs `compute_coordination()` on the whole dataset.
- Scores clusters against the IO account labels: accounts in a cluster that are
  IO-labelled → TP; accounts in a cluster that are control-labelled → FP.
  Reports precision / recall / F1 at the account level.
- **Limitation:** this is a Twitter dataset on SIGNET's Reddit pipeline.
  Coordination is computed on the dataset's own fields; the pipeline code is
  exercised but the platform mismatch means results calibrate the *algorithm*,
  not the collector.

---

## 2. PesaCheck — Rated-Claims Corpus

**What.** Africa's largest fact-checking initiative (Kenya, Tanzania, Uganda,
12+ countries). Publishes rated fact-checks with primary-source evidence:
one atomic claim per check, verified against primary documents, assigned one
of 8 standardised labels. The closest external ground truth for SIGNET's
`political_disinfo` tag.

**Labels.** 8 standardised PesaCheck ratings:
`False`, `Satire`, `Partly False`, `False Headline`, `Missing Context`,
`Hoax`, `Not Eligible`, `Inconclusive`.
For SIGNET eval, these map to `political_disinfo` as:
- **Positive (political_disinfo):** `False`, `False Headline`, `Hoax`
- **Negative (not political_disinfo):** `Satire`, `Not Eligible`
- **Ambiguous (excluded from scoring):** `Partly False`, `Missing Context`,
  `Inconclusive`

**Expected format.** One claim per row: the claim text (or headline), the URL
of the fact-check, the PesaCheck rating label, and the date. The loader accepts
JSON (array of objects) or CSV.

**How to obtain.** PesaCheck ratings are published at <https://pesacheck.org/>.
A structured corpus is not publicly downloadable as a single file; the expected
path is:
1. **Manual scraping or a Code for Africa data request.** Contact
   Code for Africa / ANCIR for a structured export of rated claims.
2. **Fallback:** scrape the PesaCheck website's article listing and extract
   claim text + rating from each fact-check page.
3. Place the resulting file at `research/datasets/pesacheck/rated_claims.json`
   or `rated_claims.csv`.

**Human action required:** request or scrape the corpus; format as JSON or CSV.

**License.** PesaCheck content is published under a Creative Commons license
(typically CC BY 4.0). Verify per-article.

**Eval-plug.** `run_cross_validation.py --dataset pesacheck --data-dir <path>`
- Loads rated claims, maps PesaCheck label → `political_disinfo` binary.
- Runs the SIGNET tagger (`tag_post()`) on each claim text.
- Compares: PesaCheck `political_disinfo` label vs tagger's `political_disinfo`
  tag presence at any confidence.
- Reports precision / recall / F1.
- **Limitation:** PesaCheck rates *factual claims*, but SIGNET tags *technique*.
  A `political_disinfo` tag on a claim PesaCheck rated `False` is a match;
  a tag on a `Satire` claim is a false positive. This only validates the
  `political_disinfo` tag, not the full taxonomy.

---

## 3. Election Integrity Partnership (EIP) 2020 & 2022

**What.** The EIP (Stanford IO, DFRLab, Graphika, UW Center for an Informed
Public) published case-study reports on coordinated inauthentic behaviour
during the 2020 and 2022 US elections. The reports include narrative
descriptions of CIB campaigns with supporting data (hashtag clusters, account
lists, temporal patterns). US-focused but methodologically transferable —
the tactics (hashtag hijacking, coordinated posting, cross-platform spread)
are the same ones observed in East African contexts.

**Labels.** Qualitative: each case study describes whether a campaign
exhibited coordination, platform manipulation, foreign vs domestic origin,
and specific techniques. These are **not** per-post labels; they are
per-campaign expert assessments.

**Expected format.** The EIP published data alongside its reports. The loader
expects either:
- A JSON manifest mapping campaign name → list of account IDs + technique flags
- CSV files of account lists with campaign attribution

**How to obtain.**
1. EIP 2020 final report + data: <https://www.eipartnership.net/reports>
2. EIP 2022 final report + data: same portal
3. Stanford IO's published EIP datasets (linked from their GitHub, now archived)
4. Place extracted data at `research/datasets/eip/`.

**Human action required:** download the EIP reports, extract structured account
lists and campaign metadata from the published supplements.

**License.** EIP reports are publicly released. Data supplements vary — check
individual release notes. Stanford IO datasets are archived but were publicly
released.

**Eval-plug.** `run_cross_validation.py --dataset eip --data-dir <path>`
- Loads campaign-level labels (which accounts are in each campaign).
- Option A (has account-level SIGNET data): runs coordination on SIGNET's
  own collected posts and checks whether any surfaced cluster overlaps with
  an EIP-documented campaign. This is a cross-reference, not a precision test.
- Option B (qualitative): prints the EIP campaign descriptions alongside
  SIGNET's coordination output for manual analyst comparison. Reports
  "overlap found / not found" per campaign.
- **Limitation:** EIP data is Twitter-centric. Reddit-only SIGNET will rarely
  have direct overlap. The EIP harness is primarily a **qualitative sanity
  check** — "do SIGNET's clusters look anything like the campaigns documented
  by the EIP?" — not a quantitative benchmark.

---

## Candidate datasets (not yet incorporated)

- **Africa Center mapping report's underlying campaign list** — not public as
  structured data; worth a request.
- **2017 Kenyan election archived social-media snapshots** — highest-value
  Kenya-specific benchmark if obtainable from Stanford / Oxford OII.
- **Mozilla / Internews / Code for Africa training datasets** — exist; request
  needed.
- **Cambridge Analytica Kenya — the technical dataset** — never released
  publicly; highest-value benchmark in the field if any leaked subset surfaces.

---

### Cross-reference: eval harness files

| File | Purpose |
|---|---|
| `Backend/signet/eval/dataset_loaders.py` | Abstract loader + Stanford IO / PesaCheck / EIP concrete loaders |
| `Backend/signet/management/commands/run_cross_validation.py` | Management command: `--dataset <name> --data-dir <path> [--user <id>]` |
| `Backend/signet/management/commands/run_tagging_eval.py` | Existing golden-set eval (unchanged by Chunk 2) |
| `Backend/signet/eval/golden_set.json` | Existing 60-post golden set (unchanged) |
