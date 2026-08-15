"""
HackerOne customer API client (program owner / bug bounty program management).

Docs: https://api.hackerone.com/getting-started
- JSON:API responses, HTTPS only.
- HTTP Basic auth: token identifier = username, token value = password.
- Rate limits: reads 600/min (reports 300/min), writes 25/20s.

This module is intentionally synchronous (uses ``requests``) so it can be
called directly from DRF views and Celery tasks. Network access only happens
behind :meth:`HackerOneClient`; callers that need async can wrap with
``asgiref.sync.sync_to_async``.
"""

import logging
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Pagination + retry safety limits.
PAGE_SIZE = 100
MAX_PAGES = 100
MAX_RETRIES = 4
RETRY_STATUS_CODES = {429, 500, 502, 503, 504}


class HackerOneClientError(Exception):
    """Raised for HackerOne API errors (bad status or malformed response)."""

    def __init__(self, message, status_code=None, response_body=None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


def is_configured():
    """True when the integration is enabled and API credentials are present."""
    if not getattr(settings, 'HACKERONE_ENABLED', False):
        return False
    return bool(
        getattr(settings, 'HACKERONE_API_TOKEN_ID', '')
        and getattr(settings, 'HACKERONE_API_TOKEN_VALUE', '')
    )


def _get_attr(resource, key, default=None):
    """Read ``resource['attributes'][key]`` defensively for JSON:API resources."""
    if not isinstance(resource, dict):
        return default
    attrs = resource.get('attributes') or {}
    if not isinstance(attrs, dict):
        return default
    return attrs.get(key, default)


def _get_relationship_id(resource, name):
    """Return the id of a JSON:API relationship, or None."""
    if not isinstance(resource, dict):
        return None
    rel = (resource.get('relationships') or {}).get(name) or {}
    data = rel.get('data')
    if isinstance(data, dict):
        return data.get('id')
    if isinstance(data, list) and data:
        return data[0].get('id') if isinstance(data[0], dict) else None
    return None


def _get_relationship_attr(resource, name, key, default=None):
    """Read a nested attribute from a relationship's inlined data, or None."""
    if not isinstance(resource, dict):
        return default
    rel = (resource.get('relationships') or {}).get(name) or {}
    data = rel.get('data')
    if isinstance(data, dict):
        return _get_attr(data, key, default)
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return _get_attr(data[0], key, default)
    return default


class HackerOneClient:
    """Thin, retrying client over the HackerOne customer REST API."""

    def __init__(self, base_url=None, token_id=None, token_value=None, timeout=30):
        self.base_url = (base_url or getattr(settings, 'HACKERONE_API_BASE_URL', '')
                         or 'https://api.hackerone.com/v1').rstrip('/')
        self.token_id = token_id if token_id is not None else getattr(settings, 'HACKERONE_API_TOKEN_ID', '')
        self.token_value = token_value if token_value is not None else getattr(settings, 'HACKERONE_API_TOKEN_VALUE', '')
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'User-Agent': 'Mathia-HackerOne-Integration/0.1',
        })
        self.session.auth = (self.token_id, self.token_value)

    # -- low-level request -------------------------------------------------
    def _request(self, method, path, params=None, json_body=None):
        url = f"{self.base_url}/{path.lstrip('/')}"
        retries = 0
        while True:
            try:
                resp = self.session.request(
                    method, url, params=params, json=json_body, timeout=self.timeout,
                )
            except requests.RequestException as exc:
                # Network-level error: retry with backoff, then give up.
                if retries < MAX_RETRIES:
                    retries += 1
                    time.sleep(min(2 ** retries, 8))
                    continue
                raise HackerOneClientError(f"HackerOne request failed: {exc}") from exc

            if resp.status_code in RETRY_STATUS_CODES and retries < MAX_RETRIES:
                retries += 1
                backoff = min(2 ** retries, 8)
                retry_after = resp.headers.get('Retry-After')
                if retry_after and retry_after.isdigit():
                    backoff = min(int(retry_after), 30)
                logger.warning("HackerOne %s %s -> %s, retrying in %ss (%d/%d)",
                               method, url, resp.status_code, backoff, retries, MAX_RETRIES)
                time.sleep(backoff)
                continue

            if resp.status_code >= 400:
                raise HackerOneClientError(
                    f"HackerOne API error {resp.status_code} on {method} {url}",
                    status_code=resp.status_code,
                    response_body=resp.text[:1000],
                )
            return resp

    # -- resources ---------------------------------------------------------
    def get_programs(self):
        """Return all programs the API token can access (list of resource dicts)."""
        items, _ = self._paginate('GET', '/me/programs')
        return items

    def get_reports(self, program_handle):
        """Return all reports for a program handle.

        HackerOne's report index is ``GET /v1/reports`` and requires a
        ``filter[program][]`` parameter (there is no ``/me/reports`` route).
        """
        if not program_handle:
            return []
        items, _ = self._paginate(
            'GET', '/reports', extra_params={'filter[program][]': program_handle},
        )
        return items

    def get_campaigns(self, program_id):
        """Return all bounty campaigns for a program (numeric id)."""
        if not program_id:
            return []
        items, _ = self._paginate('GET', f'/programs/{program_id}/campaigns')
        return items

    def get_structured_scopes(self, program_id):
        """Return structured scopes for a program (numeric id)."""
        if not program_id:
            return []
        items, _ = self._paginate('GET', f'/programs/{program_id}/structured_scopes')
        return items

    def get_organizations(self):
        """Return the organizations the token can access."""
        items, _ = self._paginate('GET', '/me/organizations')
        return items

    def get_org_members(self, organization_id):
        """Return members of an organization (numeric id)."""
        if not organization_id:
            return []
        items, _ = self._paginate('GET', f'/organizations/{organization_id}/members')
        return items

    def get_assets(self, organization_id):
        """Return assets of an organization (numeric id)."""
        if not organization_id:
            return []
        items, _ = self._paginate('GET', f'/organizations/{organization_id}/assets')
        return items

    def get_report(self, report_id):
        """Fetch a single report by id, returning the resource dict or None."""
        resp = self._request('GET', f"/reports/{report_id}")
        payload = resp.json()
        data = payload.get('data')
        if not data:
            raise HackerOneClientError(f"HackerOne report {report_id} not found", status_code=404)
        return data

    def create_report(self, program_handle, title, vulnerability_information, impact,
                      severity=None, source='api', weakness_id=None):
        """
        Create/import a report into a program.

        Required attributes per HackerOne docs: title, vulnerability_information,
        impact, source. Returns the created report resource dict.
        """
        attributes = {
            'title': title,
            'vulnerability_information': vulnerability_information,
            'impact': impact,
            'source': source,
        }
        body = {
            'data': {
                'type': 'report',
                'attributes': attributes,
                'relationships': {},
            },
        }
        if severity:
            attributes['severity_rating'] = severity
        if weakness_id:
            body['data']['relationships']['weakness'] = {
                'data': {'type': 'weakness', 'id': str(weakness_id)},
            }

        resp = self._request('POST', f"/programs/{program_handle}/reports", json_body=body)
        payload = resp.json()
        data = payload.get('data')
        if not data:
            raise HackerOneClientError(
                "HackerOne create_report returned no data",
                status_code=resp.status_code,
                response_body=resp.text[:1000],
            )
        return data

    # -- helpers -----------------------------------------------------------
    def _paginate(self, method, path, extra_params=None):
        """Fetch all pages of a JSON:API collection. Returns (items, total_pages)."""
        items = []
        page = 1
        for page in range(1, MAX_PAGES + 1):
            params = dict(extra_params or {})
            params['page[number]'] = page
            params['page[size]'] = PAGE_SIZE
            resp = self._request(method, path, params=params)
            payload = resp.json()
            data = payload.get('data') or []
            if isinstance(data, dict):  # single resource instead of a list
                items.append(data)
                break
            items.extend(data)
            # Stop when the last page is shorter than the requested size.
            if len(data) < PAGE_SIZE:
                break
        return items, page
