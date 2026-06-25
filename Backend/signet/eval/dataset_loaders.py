"""
Dataset loaders for SIGNET cross-validation (Chunk 2).

Each loader wraps one external benchmark corpus — Stanford IO (arXiv 2411.10609),
PesaCheck rated claims, and EIP 2020/2022 — and returns a normalised internal
representation that the eval harness can score against SIGNET's pipeline.

All loaders expect the human to have downloaded the corpus first.
See `research/datasets/README.md` for per-dataset download instructions.
"""
from __future__ import annotations

import logging
import csv
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Set

logger = logging.getLogger(__name__)


# ── Internal representation ────────────────────────────────────────────────


@dataclass
class LabeledAccount:
    """One account from an external dataset with IO/control label."""
    account_id: str
    is_io: bool  # True = coordinated/IO, False = organic control
    campaign: str = ''


@dataclass
class LabeledPost:
    """One post from an external dataset with all SIGNET-relevant fields."""
    post_id: str
    account_id: str
    text: str
    posted_at: str  # ISO-8601
    hashtags: List[str] = field(default_factory=list)
    urls: List[str] = field(default_factory=list)
    campaign: str = ''
    is_io: bool = False


@dataclass
class LabeledClaim:
    """One claim from PesaCheck with a truth rating."""
    claim_id: str
    text: str
    rating: str  # one of PesaCheck's 8 labels
    url: str = ''
    date: str = ''


# ── PesaCheck rating → political_disinfo mapping ────────────────────────────


_PESACHECK_POSITIVE = {'False', 'False Headline', 'Hoax'}
_PESACHECK_NEGATIVE = {'Satire', 'Not Eligible'}
_PESACHECK_AMBIGUOUS = {'Partly False', 'Missing Context', 'Inconclusive'}


def pesacheck_is_political_disinfo(rating: str) -> Optional[bool]:
    """Map a PesaCheck rating to political_disinfo binary.

    Returns True/False for clear cases, None for ambiguous ratings
    (excluded from scoring).
    """
    r = rating.strip()
    if r in _PESACHECK_POSITIVE:
        return True
    if r in _PESACHECK_NEGATIVE:
        return False
    return None


# ── Abstract base ───────────────────────────────────────────────────────────


class BaseDatasetLoader:
    """Abstract loader. Subclasses implement _iter_rows and _parse_row."""

    name: str = 'base'

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        if not self.data_dir.exists():
            raise FileNotFoundError(
                f'Dataset directory not found: {self.data_dir}. '
                f'See research/datasets/README.md for download instructions.'
            )

    def _iter_files(self, suffix: str = '.csv') -> Iterator[Path]:
        for f in sorted(self.data_dir.rglob(f'*{suffix}')):
            if f.suffix.lower() == suffix:
                yield f

    # ── Subclass interface ──

    def load_posts(self) -> List[LabeledPost]:
        raise NotImplementedError

    def load_accounts(self) -> List[LabeledAccount]:
        raise NotImplementedError

    def validate(self) -> Dict[str, Any]:
        """Return a dict with count, errors list, and any dataset-specific stats."""
        raise NotImplementedError


# ── Stanford IO loader ──────────────────────────────────────────────────────


class StanfordIOLoader(BaseDatasetLoader):
    """Load the Stanford IO labelled IO datasets (arXiv 2411.10609).

    Expects a directory of CSV/TSV files downloaded from
    https://doi.org/10.5281/zenodo.14141549.

    Each file is a segment of 50K posts with columns matching the paper's schema.
    """

    name = 'stanford_io'

    # Files may be .csv, .tsv, or .txt with tab delimiters
    _FIELD_MAP = {
        'postid': 'post_id',
        'post_text': 'text',
        'accountid': 'account_id',
        'post_time': 'posted_at',
        'hashtags': 'hashtags',
        'urls': 'urls',
        'is_control': 'is_control',
    }

    def _guess_delimiter(self, path: Path) -> str:
        with open(path, 'r', encoding='utf-8-sig', errors='replace') as fh:
            first = fh.readline()
        if '\t' in first:
            return '\t'
        return ','

    def _parse_hashtags(self, raw: str) -> List[str]:
        if not raw or raw.strip() == '':
            return []
        # Stanford IO hashtags are JSON array strings like '["tag1","tag2"]'
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(h) for h in parsed if h]
        except (json.JSONDecodeError, TypeError):
            pass
        # Fallback: comma or space separated
        return [h.strip().lstrip('#') for h in raw.replace(',', ' ').split() if h.strip()]

    def _parse_urls(self, raw: str) -> List[str]:
        if not raw or raw.strip() == '':
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(u) for u in parsed if u]
        except (json.JSONDecodeError, TypeError):
            pass
        return [u.strip() for u in raw.split() if u.strip().startswith('http')]

    def load_posts(self) -> List[LabeledPost]:
        posts: List[LabeledPost] = []
        files = list(self._iter_files('.csv')) + list(self._iter_files('.tsv')) + list(self._iter_files('.txt'))
        if not files:
            logger.warning(f'No CSV/TSV files found in {self.data_dir}')
            return posts

        for fp in files:
            delim = self._guess_delimiter(fp)
            with open(fp, 'r', encoding='utf-8-sig', errors='replace') as fh:
                reader = csv.DictReader(fh, delimiter=delim)
                for row_index, row in enumerate(reader):
                    try:
                        account_id = row.get('accountid', '') or row.get('account_id', '')
                        post_id = row.get('postid', '') or row.get('post_id', '') or f'{fp.stem}-{row_index}'
                        is_control = row.get('is_control', 'True').strip().lower() in ('true', '1', 'yes')
                        posts.append(LabeledPost(
                            post_id=post_id,
                            account_id=account_id,
                            text=row.get('post_text', '') or '',
                            posted_at=row.get('post_time', ''),
                            hashtags=self._parse_hashtags(row.get('hashtags', '')),
                            urls=self._parse_urls(row.get('urls', '')),
                            campaign=self._campaign_from_dir(fp),
                            is_io=not is_control,
                        ))
                    except Exception:
                        continue

        logger.info(f'StanfordIOLoader: loaded {len(posts)} posts from {len(files)} files')
        return posts

    def _campaign_from_dir(self, filepath: Path) -> str:
        # Derive campaign name from parent directory or filename prefix
        parent = filepath.parent.name
        if parent and parent != self.data_dir.name:
            return parent
        # Try to extract from filename like "China_1_*.csv"
        stem = filepath.stem
        for campaign_prefix in [
            'Russia_1', 'Russia_2', 'Russia_3', 'Russia_4', 'Russia_5',
            'China_1', 'China_2', 'Iran_1', 'Iran_2', 'Iran_3', 'Iran_4', 'Iran_5', 'Iran_6',
            'Venezuela_1', 'Venezuela_2', 'Cuba', 'Egypt_UAE', 'UAE', 'Qatar',
            'Bangladesh', 'Armenia', 'Thailand', 'Spain', 'Catalonia',
            'Ghana_Nigeria', 'Ecuador',
        ]:
            if stem.startswith(campaign_prefix):
                return campaign_prefix
        return stem.split('_')[0] if '_' in stem else stem

    def load_accounts(self) -> List[LabeledAccount]:
        posts = self.load_posts()
        seen: Dict[str, LabeledAccount] = {}
        for p in posts:
            if p.account_id not in seen:
                seen[p.account_id] = LabeledAccount(
                    account_id=p.account_id,
                    is_io=p.is_io,
                    campaign=p.campaign,
                )
            # If any post for this account is labelled IO, mark the account IO
            elif p.is_io and not seen[p.account_id].is_io:
                seen[p.account_id].is_io = True
        return list(seen.values())

    def validate(self) -> Dict[str, Any]:
        posts = self.load_posts()
        accounts = {}
        io_posts = 0
        control_posts = 0
        campaigns: Set[str] = set()

        for p in posts:
            if p.is_io:
                io_posts += 1
            else:
                control_posts += 1
            campaigns.add(p.campaign)
            accounts[p.account_id] = p.is_io or accounts.get(p.account_id, False)

        io_accounts = sum(1 for v in accounts.values() if v)
        control_accounts = len(accounts) - io_accounts

        errors = []
        if not posts:
            errors.append('No posts loaded — check data_dir path and file contents')
        if io_posts + control_posts == 0:
            errors.append('Dataset appears empty')
        if io_accounts == 0:
            errors.append('No IO accounts found — is_control column may be inverted')

        return {
            'count': len(posts),
            'accounts': len(accounts),
            'io_posts': io_posts,
            'control_posts': control_posts,
            'io_accounts': io_accounts,
            'control_accounts': control_accounts,
            'campaigns': sorted(campaigns),
            'errors': errors,
        }


# ── PesaCheck loader ────────────────────────────────────────────────────────


class PesaCheckLoader(BaseDatasetLoader):
    """Load a PesaCheck rated-claims corpus.

    Expects a JSON file (array of objects) or CSV at the given path.
    Each record must have at minimum: text, rating.
    Optional: id, url, date.
    """

    name = 'pesacheck'

    def load_claims(self) -> List[LabeledClaim]:
        claims: List[LabeledClaim] = []

        # Try JSON first
        json_paths = list(self.data_dir.glob('*.json'))
        for jp in json_paths:
            with open(jp, 'r', encoding='utf-8-sig') as fh:
                data = json.load(fh)
            if isinstance(data, list):
                for i, item in enumerate(data):
                    if isinstance(item, dict) and 'text' in item and 'rating' in item:
                        claims.append(LabeledClaim(
                            claim_id=item.get('id', item.get('claim_id', str(i))),
                            text=item['text'],
                            rating=item['rating'],
                            url=item.get('url', ''),
                            date=item.get('date', ''),
                        ))

        # Try CSV
        csv_paths = list(self.data_dir.glob('*.csv'))
        for cp in csv_paths:
            with open(cp, 'r', encoding='utf-8-sig', errors='replace') as fh:
                reader = csv.DictReader(fh)
                for i, row in enumerate(reader):
                    if 'text' in row and 'rating' in row:
                        claims.append(LabeledClaim(
                            claim_id=row.get('id', row.get('claim_id', str(i))),
                            text=row['text'],
                            rating=row['rating'],
                            url=row.get('url', ''),
                            date=row.get('date', ''),
                        ))

        logger.info(f'PesaCheckLoader: loaded {len(claims)} claims')
        return claims

    def load_posts(self) -> List[LabeledPost]:
        """Not applicable for PesaCheck — use load_claims()."""
        return []

    def load_accounts(self) -> List[LabeledAccount]:
        """Not applicable for PesaCheck."""
        return []

    def validate(self) -> Dict[str, any]:
        claims = self.load_claims()
        ratings = set(c.rating for c in claims)
        positive = sum(1 for c in claims if pesacheck_is_political_disinfo(c.rating) is True)
        negative = sum(1 for c in claims if pesacheck_is_political_disinfo(c.rating) is False)
        ambiguous = len(claims) - positive - negative

        errors = []
        if not claims:
            errors.append('No claims loaded — check data_dir path and file contents')
        unknown_ratings = ratings - _PESACHECK_POSITIVE - _PESACHECK_NEGATIVE - _PESACHECK_AMBIGUOUS
        if unknown_ratings:
            errors.append(f'Unknown rating labels: {unknown_ratings}')

        return {
            'count': len(claims),
            'ratings': sorted(ratings),
            'political_disinfo_positive': positive,
            'political_disinfo_negative': negative,
            'political_disinfo_ambiguous': ambiguous,
            'errors': errors,
        }


# ── EIP loader ──────────────────────────────────────────────────────────────


class EIPLoader(BaseDatasetLoader):
    """Load Election Integrity Partnership campaign data.

    Expects a JSON manifest file: {"campaigns": [{"name": ..., "accounts": [...], "techniques": [...]}]}
    or CSV files with columns: campaign, account_id.
    """

    name = 'eip'

    def load_accounts(self) -> List[LabeledAccount]:
        accounts: List[LabeledAccount] = []

        # Try JSON manifest
        for jp in self.data_dir.glob('*.json'):
            with open(jp, 'r', encoding='utf-8-sig') as fh:
                data = json.load(fh)
            campaigns = data.get('campaigns', []) if isinstance(data, dict) else data
            for c in campaigns:
                if isinstance(c, dict) and 'name' in c:
                    name = c['name']
                    for aid in c.get('accounts', []):
                        accounts.append(LabeledAccount(
                            account_id=str(aid), is_io=True, campaign=name,
                        ))

        # Try CSV
        for cp in self.data_dir.glob('*.csv'):
            with open(cp, 'r', encoding='utf-8-sig', errors='replace') as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    if 'campaign' in row and 'account_id' in row:
                        accounts.append(LabeledAccount(
                            account_id=row['account_id'],
                            is_io=True,
                            campaign=row['campaign'],
                        ))

        logger.info(f'EIPLoader: loaded {len(accounts)} accounts')
        return accounts

    def load_posts(self) -> List[LabeledPost]:
        return []

    def validate(self) -> Dict[str, Any]:
        accounts = self.load_accounts()
        campaigns = set(a.campaign for a in accounts)
        errors = []
        if not accounts:
            errors.append('No accounts loaded — check data_dir path and file contents')
        return {
            'count': len(accounts),
            'campaigns': sorted(campaigns),
            'errors': errors,
        }


# ── Registry ────────────────────────────────────────────────────────────────


LOADERS: Dict[str, type] = {
    'stanford_io': StanfordIOLoader,
    'pesacheck': PesaCheckLoader,
    'eip': EIPLoader,
}


def get_loader(name: str, data_dir: str) -> BaseDatasetLoader:
    if name not in LOADERS:
        raise ValueError(f'Unknown dataset: {name}. Available: {sorted(LOADERS)}')
    return LOADERS[name](data_dir)
