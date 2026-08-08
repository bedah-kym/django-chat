# Stanford IO — Download & Run Instructions

## What to download

The Stanford Internet Observatory released labelled IO datasets covering 26
state-sponsored information-operation campaigns. Each campaign is a self-contained
archive of CSV/TSV files with both IO and control (organic) posts.

**Paper:** arXiv 2411.10609 — "Labeled Datasets for Research on Information Operations"
**Zenodo DOI:** https://doi.org/10.5281/zenodo.14141549

## Recommended first campaign

Start with the **smallest single campaign** to validate the loader and harness
quickly before downloading the full 13M-post corpus:

| Campaign | ~Posts | ~Accounts | Approx size |
|----------|--------|-----------|-------------|
| **Spain** | 119K | 3.4K | ~30 MB |
| **Russia_3** | 33K | 2.0K | ~10 MB |
| **Bangladesh** | 62K | 2.7K | ~15 MB |

Pick **Spain** or **Russia_3** — these are small enough to load in seconds and
exercise every code path (hashtags, URLs, timestamps, IO/control labels).

If you want a mid-size campaign with richer coordination patterns, **Catalonia**
(125K posts, 5K accounts, ~40 MB) is the next step up.

## Directory layout

After downloading, place the files under:

```
research/datasets/stanford_io/
├── Spain/
│   ├── Spain_000.csv
│   ├── Spain_001.csv
│   └── ...
├── Russia_3/
│   ├── Russia_3_000.csv
│   └── ...
└── ...
```

The loader recursively discovers all `.csv`/`.tsv`/`.txt` files in this tree
(via `rglob`). You can place files flat or in campaign-named subdirectories —
both work.

Each file is ~50K rows. Columns expected (per the paper's schema):

| Column | Loader field | Notes |
|--------|-------------|-------|
| `postid` | `post_id` | Unique per post |
| `post_text` | `text` | Anonymised post body |
| `accountid` | `account_id` | Hashed (linkable across posts) |
| `post_time` | `posted_at` | ISO-8601 |
| `hashtags` | `hashtags` | JSON array or comma-separated |
| `urls` | `urls` | JSON array or space-separated |
| `is_control` | `is_control` | `True` = organic, `False` = IO |

## How to download

### Option A: Zenodo web UI
1. Go to https://doi.org/10.5281/zenodo.14141549
2. Download one campaign archive (e.g. `Spain.zip`)
3. Unzip into `research/datasets/stanford_io/Spain/`

### Option B: Command line (if `wget`/`curl` available)
```bash
# Example: download Spain campaign (check Zenodo for exact filenames)
mkdir -p research/datasets/stanford_io/Spain
cd research/datasets/stanford_io/Spain
# URL from Zenodo record — replace with actual download URL
wget https://zenodo.org/records/14141549/files/Spain.zip
unzip Spain.zip
```

### Option C: Docker container
```bash
# Download into the container if the host has no direct web access
docker compose exec web sh -c "mkdir -p /app/research/datasets/stanford_io/Spain"
# Then copy from host:
docker cp Spain/. mathia-project-web-1:/app/research/datasets/stanford_io/Spain/
```

## Run the eval

Once files are in place, restart services and run:

```bash
# Restart after any backend Python changes
docker compose restart web celery_worker celery_beat

# Run against the whole stanford_io directory
docker compose exec -T web sh -c "cd /app/Backend && python manage.py run_cross_validation --dataset stanford_io --data-dir /app/research/datasets/stanford_io"

# Or target a specific campaign subdirectory
docker compose exec -T web sh -c "cd /app/Backend && python manage.py run_cross_validation --dataset stanford_io --data-dir /app/research/datasets/stanford_io/Spain"
```

## Expected output

The command prints:
1. **Validation stats** — post counts, IO/control breakdown, campaign names detected
2. **Ground truth** — number of IO vs control accounts
3. **Seeding report** — how many `CollectedPost` rows were created within the window
4. **Coordination result** — `clusters_upserted`, `edges_upserted` from `compute_coordination()`
5. **Metrics** — TP, FP, FN → precision, recall, F1 at the account level
6. **Cleanup confirmation** — `Cleanup complete.`

Example (will vary by campaign):
```
═══ Coordination Eval — Stanford IO ═══
IO accounts (ground truth):  76
Control accounts:            2,607
Clustered accounts (found):  12
True positives:   8
False positives:  4
False negatives:  68
Precision: 0.6667
Recall:    0.1053
F1:        0.1818
```

**Expected pattern:** Precision should be decent (accounts in clusters tend to be IO).
Recall will be low because SIGNET's coordination only catches tightly-synchronized
accounts (same text + same hashtag within 15 min). The dataset includes IO accounts
that coordinated over weeks with diverse text — those won't cluster.

## Cleanup verification

After a successful run, verify cleanup:
```bash
docker compose exec -T web sh -c "cd /app/Backend && python manage.py shell -c \"
from signet.models import CollectionSession, CollectedPost, SignetAccount, SignetCoordinationCluster, SignetEdge
print('sessions:', CollectionSession.objects.filter(platform__startswith='sio_eval_').count())
print('accounts:', SignetAccount.objects.filter(platform__startswith='sio_eval_').count())
print('edges:', SignetEdge.objects.filter(source_type='account',target_type='account',edge_type='PART_OF_NETWORK').count())
print('clusters:', SignetCoordinationCluster.objects.count())
\""
```

All should print 0.

## Files changed by this eval (all temporary — cleanup reverts)

| Table | What | Reverted? |
|-------|------|-----------|
| `signet_collectionsession` | 1 row (platform=`sio_eval_N`) | ✅ Deleted in finally |
| `signet_collectedpost` | N rows (windowed posts) | ✅ Deleted in finally |
| `signet_postclassification` | N rows (IO-labelled posts) | ✅ Deleted in finally |
| `signet_signetaccount` | N rows (eval handles) | ✅ Deleted in finally |
| `signet_signetcoordinationcluster` | Clusters from this run | ✅ Deleted in finally |
| `signet_signetedge` | account↔account PART_OF_NETWORK edges | ✅ Deleted in finally |

No live pipeline data is affected.
