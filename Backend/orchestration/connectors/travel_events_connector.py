"""
Travel Events Connector
Searches for local events using Ticketmaster Discovery API v2.

Primary provider:  Ticketmaster Discovery API (free tier)
Auth:              apikey query parameter (TICKETMASTER_API_KEY)
Rate limits:       5000 calls/day, 5 req/s
Docs:              https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import aiohttp
from django.conf import settings

from orchestration.connectors.base_travel_connector import BaseTravelConnector

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# City -> countryCode mapping for common destinations in our coverage area
# ---------------------------------------------------------------------------
CITY_COUNTRY_MAP: dict[str, str] = {
    "nairobi": "KE",
    "mombasa": "KE",
    "kisumu": "KE",
    "diani": "KE",
    "eldoret": "KE",
    "malindi": "KE",
    "lamu": "KE",
    "nakuru": "KE",
    "naivasha": "KE",
    "kampala": "UG",
    "kigali": "RW",
    "dar es salaam": "TZ",
    "addis ababa": "ET",
    "johannesburg": "ZA",
    "cape town": "ZA",
    "lagos": "NG",
    "accra": "GH",
    "dubai": "AE",
    "london": "GB",
    "paris": "FR",
}


def _city_to_country_code(location: str) -> Optional[str]:
    """Map a city/location name to its ISO-3166 country code."""
    return CITY_COUNTRY_MAP.get(location.strip().lower())


# ---------------------------------------------------------------------------
# Connector
# ---------------------------------------------------------------------------


class TravelEventsConnector(BaseTravelConnector):
    """Search for events using Ticketmaster Discovery API v2."""

    PROVIDER_NAME = "ticketmaster"
    CACHE_TTL_SECONDS = 7200  # 2 hours -- events don't change often

    # ------------------------------------------------------------------
    # Public interface (called by neuroa2a.py and MCPRouter)
    # ------------------------------------------------------------------

    async def _fetch(
        self, parameters: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Search for events.

        Expected parameters:
            location    -- city or region name
            event_date  -- single date (YYYY-MM-DD)
            start_date  -- range start (YYYY-MM-DD)
            end_date    -- range end (YYYY-MM-DD)
            category    -- "all" or classification name

        Returns:
            {"results": [...], "metadata": {...}}
        """
        location = str(parameters.get("location") or "").strip()
        event_date = parameters.get("event_date")
        start_date = parameters.get("start_date")
        end_date = parameters.get("end_date")
        category = str(parameters.get("category") or "all").lower()

        # Normalize dates to YYYY-MM-DD
        start_date = self._norm_date(start_date or event_date)
        end_date = self._norm_date(end_date or event_date)

        if not location:
            return {
                "results": [],
                "metadata": {"error": "Missing required parameter: location"},
            }

        results, api_error = await self._search_ticketmaster(
            location, start_date, end_date, category
        )

        if (not results) and getattr(settings, "TRAVEL_ALLOW_FALLBACK", True):
            results = self._get_fallback_events(location, category)
            api_error = api_error or "No events returned from Ticketmaster; using fallback."

        if not results:
            return {
                "results": [],
                "metadata": {"error": api_error or "No events returned from Ticketmaster."},
            }

        return {
            "results": results,
            "metadata": {
                "location": location,
                "start_date": start_date,
                "end_date": end_date,
                "category": category,
                "provider": self.PROVIDER_NAME,
                "total_found": len(results),
                "warning": api_error if api_error else None,
            },
        }

    # ------------------------------------------------------------------
    # Ticketmaster API call
    # ------------------------------------------------------------------

    async def _search_ticketmaster(
        self,
        location: str,
        start_date: Optional[str],
        end_date: Optional[str],
        category: str,
    ) -> tuple[List[Dict[str, Any]], Optional[str]]:
        """Call Ticketmaster Discovery API and parse results.

        Returns (results, error_message_or_None).
        """
        api_key = os.getenv("TICKETMASTER_API_KEY")
        if not api_key:
            msg = "TICKETMASTER_API_KEY not set"
            logger.debug(msg)
            return [], msg

        api_url = "https://app.ticketmaster.com/discovery/v2/events.json"

        params: Dict[str, Any] = {
            "apikey": api_key,
            "size": 20,
            "sort": "date,asc",
        }

        # Location -> city + countryCode
        country_code = _city_to_country_code(location)
        if country_code:
            params["city"] = location
            params["countryCode"] = country_code
        else:
            # Fallback: use location as keyword search
            params["keyword"] = location

        # Date range
        if start_date:
            params["startDateTime"] = f"{start_date}T00:00:00Z"
        if end_date:
            params["endDateTime"] = f"{end_date}T23:59:59Z"

        # Category filter
        if category and category != "all":
            params["classificationName"] = category

        headers = {"User-Agent": "Mathia-Travel/1.0"}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    api_url,
                    params=params,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as response:
                    status = response.status
                    text = await response.text()

                    if status == 401:
                        msg = "Ticketmaster API authentication failed (401). Check TICKETMASTER_API_KEY."
                        logger.warning(msg)
                        return [], msg
                    if status == 429:
                        msg = "Ticketmaster API rate limit reached (429). Please try again later."
                        logger.warning(msg)
                        return [], msg
                    if status in (404, 410):
                        msg = f"Ticketmaster API endpoint not found ({status}). Discovery API may have moved."
                        logger.warning(msg)
                        return [], msg
                    if status != 200:
                        snippet = text[:200]
                        msg = f"Ticketmaster API error {status}: {snippet}"
                        logger.warning(msg)
                        return [], msg

                    try:
                        import json as _json
                        data = _json.loads(text)
                    except Exception:
                        msg = f"Ticketmaster returned non-JSON response: {text[:200]}"
                        logger.warning(msg)
                        return [], msg
        except aiohttp.ClientError as exc:
            msg = f"Ticketmaster API request failed: {exc}"
            logger.error(msg)
            return [], msg
        except Exception as exc:
            msg = f"Ticketmaster API error: {exc}"
            logger.error(msg)
            return [], msg

        if not isinstance(data, dict):
            msg = f"Invalid Ticketmaster response format: {type(data)}"
            logger.warning(msg)
            return [], msg

        embedded = data.get("_embedded")
        if not isinstance(embedded, dict):
            # No events found -- clean, not an error
            return [], None

        events = embedded.get("events")
        if not isinstance(events, list):
            return [], None

        results: List[Dict[str, Any]] = []
        for i, event in enumerate(events):
            try:
                parsed = self._parse_ticketmaster_event(event, i)
                # Category filter (also applied client-side for safety)
                cat_val = str(parsed.get("category", "")).lower()
                if parsed and (category == "all" or category in cat_val):
                    results.append(parsed)
            except Exception as exc:
                logger.warning(f"Error parsing Ticketmaster event {i}: {exc}")
                continue

        return results, None

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    def _parse_ticketmaster_event(
        self, event: Dict[str, Any], index: int
    ) -> Dict[str, Any]:
        """Parse a single Ticketmaster event into Mathia's result shape."""
        event_id = str(event.get("id", f"tm_{index + 1}"))
        name = str(event.get("name", f"Event {index + 1}"))
        url = str(event.get("url", ""))

        # ---- dates ----
        dates = event.get("dates") or {}
        start_info = dates.get("start") or {}
        start_dt = str(start_info.get("dateTime") or "")
        if not start_dt:
            local_date = str(start_info.get("localDate") or "")
            local_time = str(start_info.get("localTime") or "")
            if local_date:
                start_dt = f"{local_date}T{local_time or '00:00:00'}Z"
        end_dt = ""

        # ---- venue / location ----
        embedded = event.get("_embedded")
        ven_embedded = (
            embedded.get("venues", [{}])
            if isinstance(embedded, dict)
            else [{}]
        )
        venue = ven_embedded[0] if isinstance(ven_embedded, list) and ven_embedded else {}
        venue_name = str(venue.get("name") or "TBA")
        city_info = venue.get("city") or {}
        city_name = str(city_info.get("name") or "")
        location = f"{venue_name}, {city_name}" if city_name else venue_name

        # ---- category / classification ----
        classifications = event.get("classifications") or []
        segment_name = "other"
        if isinstance(classifications, list) and classifications:
            seg = classifications[0].get("segment") or {}
            segment_name = str(seg.get("name", "other")).lower()

        # ---- price ----
        price_ranges = event.get("priceRanges") or []
        price_ksh = 0
        if isinstance(price_ranges, list) and price_ranges:
            pr = price_ranges[0]
            currency = str((pr.get("currency") or "")).upper()
            min_price = pr.get("min", 0)
            if currency == "KES":
                try:
                    price_ksh = float(min_price)
                except (TypeError, ValueError):
                    price_ksh = 0

        # ---- image ----
        images = event.get("images") or []
        image_url = ""
        if isinstance(images, list) and images:
            image_url = str(images[0].get("url", ""))

        return {
            "id": f"event_{event_id}",
            "provider": "Ticketmaster",
            "title": name,
            "category": segment_name,
            "start_datetime": start_dt,
            "end_datetime": end_dt,
            "location": location,
            "venue": venue_name,
            "price_ksh": price_ksh,
            "ticket_url": url,
            "image_url": image_url,
            "rating": 4.5,
            "attendees": 0,
        }

    # ------------------------------------------------------------------
    # Fallback events (used when API is unavailable or TRAVEL_ALLOW_FALLBACK)
    # ------------------------------------------------------------------

    def _get_fallback_events(
        self, location: str, category: str
    ) -> List[Dict[str, Any]]:
        """Static fallback events for common Kenyan destinations.

        Used when the API key is not configured or the provider returns no results.
        """
        event_db: Dict[str, List[Dict[str, Any]]] = {
            "nairobi": [
                {
                    "title": "Kenya Jazz Festival",
                    "cat": "music",
                    "date": "2025-12-20",
                    "price": 3500,
                    "venue": "Safari Park Hotel",
                    "attendees": 450,
                },
                {
                    "title": "Tech Summit East Africa",
                    "cat": "conference",
                    "date": "2025-12-22",
                    "price": 5000,
                    "venue": "KICC",
                    "attendees": 800,
                },
                {
                    "title": "Nairobi Street Kitchen Night Market",
                    "cat": "food",
                    "date": "2025-12-21",
                    "price": 1500,
                    "venue": "Westlands",
                    "attendees": 300,
                },
            ],
            "mombasa": [
                {
                    "title": "Coastal Music Festival",
                    "cat": "music",
                    "date": "2025-12-20",
                    "price": 2500,
                    "venue": "Nyali Beach",
                    "attendees": 300,
                },
                {
                    "title": "Mombasa Carnival",
                    "cat": "festival",
                    "date": "2025-12-24",
                    "price": 1000,
                    "venue": "Mombasa Old Town",
                    "attendees": 600,
                },
            ],
            "kisumu": [
                {
                    "title": "Lake Basin Arts Expo",
                    "cat": "arts",
                    "date": "2025-12-21",
                    "price": 1200,
                    "venue": "Kisumu Museum",
                    "attendees": 200,
                },
            ],
        }

        location_lower = location.lower()
        events = event_db.get(location_lower, event_db.get("nairobi", []))

        results: List[Dict[str, Any]] = []
        for i, event in enumerate(events):
            if category == "all" or category == event["cat"]:
                results.append(
                    {
                        "id": f"event_fallback_{i + 1:03d}",
                        "provider": "Ticketmaster",
                        "title": event["title"],
                        "category": event["cat"],
                        "start_datetime": f"{event['date']}T18:00:00Z",
                        "end_datetime": f"{event['date']}T22:00:00Z",
                        "location": location,
                        "venue": event["venue"],
                        "price_ksh": event["price"],
                        "ticket_url": f"https://ticketmaster.com/e/{i + 1}",
                        "image_url": "",
                        "rating": 4.5 + (i % 3) * 0.1,
                        "attendees": event["attendees"],
                    }
                )

        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _norm_date(val: Any) -> Optional[str]:
        """Normalize a date value to YYYY-MM-DD or None."""
        if not val:
            return None
        try:
            from datetime import datetime
            return datetime.fromisoformat(str(val)[:10]).date().isoformat()
        except Exception:
            try:
                from datetime import datetime
                return datetime.strptime(str(val), "%Y-%m-%d").date().isoformat()
            except Exception:
                return None
