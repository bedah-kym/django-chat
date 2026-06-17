# Datasets

Placeholder. To be populated as datasets become available.

Candidate datasets to pull and document here:

- **PesaCheck's published fact-check corpus** — rated claims with primary sources. Closest external ground truth for SIGNET's `political_disinfo` tag.
- **Stanford Internet Observatory's released CIB datasets** — see `../osint_methodology/stanford_io_synchronized_action.md` for the [labeled IO datasets paper (arXiv)](https://arxiv.org/pdf/2411.10609). These are labelled coordination-detection benchmarks SIGNET's eventual graph-layer could be tested against.
- **Election Integrity Partnership 2020 + 2022 datasets** — released alongside their final reports. US-focused but methodologically transferable.
- **Africa Center mapping report's underlying campaign list** — not currently public as a structured dataset; worth a request.
- **2017 Kenyan election archived social-media snapshots** — if obtainable from academic sources (likely Stanford, Oxford OII), this is the highest-value Kenya-specific benchmark.
- **Mozilla / Internews / Code for Africa training datasets** for fact-checker tooling — they exist; need a request.

Each entry, when added, should follow the file pattern: what it is, what it labels, how to obtain, license, and how it could plug into a SIGNET evaluation (extend `Backend/signet/eval/run_tagging_eval.py` or a new comparison harness).
