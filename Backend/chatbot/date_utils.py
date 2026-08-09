"""
Date/time utility for Mathia — localized date awareness with hallucination guard.

Uses a two-pass approach:
  1. LLM extracts structured date from natural language
  2. Deterministic parser validates/corrects the extraction

Always returns dates in the user's timezone and a clear format (DD/MM/YYYY).
"""
from __future__ import annotations

import logging
from datetime import datetime, date, timedelta
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Preferred date format for display
DATE_FORMAT = "%d/%m/%Y"
DATETIME_FORMAT = "%d/%m/%Y %H:%M"


def get_local_now(timezone_str: str = "Africa/Nairobi") -> datetime:
    """Get the current datetime in the given timezone."""
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo  # type: ignore

    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = ZoneInfo("Africa/Nairobi")

    from django.utils import timezone
    return timezone.now().astimezone(tz)


def format_date(dt: datetime, fmt: str = DATE_FORMAT) -> str:
    """Format a datetime for user display."""
    return dt.strftime(fmt)


def format_for_system_prompt(timezone_str: str = "Africa/Nairobi") -> str:
    """
    Build a date-awareness block for the LLM system prompt.

    Example output:
      CURRENT DATE: 09/08/2026 (Sunday)
      CURRENT TIME: 18:45 EAT (Africa/Nairobi)
      DATE FORMAT: DD/MM/YYYY
    """
    now = get_local_now(timezone_str)
    tz_abbr = _tz_abbreviation(timezone_str)

    return (
        f"CURRENT DATE: {now.strftime(DATE_FORMAT)} ({now.strftime('%A')})\n"
        f"CURRENT TIME: {now.strftime('%H:%M')} {tz_abbr} ({timezone_str})\n"
        f"DATE FORMAT: DD/MM/YYYY\n"
        f"When users say 'tomorrow', 'next Friday', or '8th of August this year', "
        f"resolve it relative to the current date above. "
        f"Always output dates in DD/MM/YYYY format."
    )


def parse_with_guard(
    llm_output: str,
    timezone_str: str = "Africa/Nairobi",
) -> Tuple[Optional[datetime], bool, str]:
    """
    Parse an LLM-extracted date with deterministic validation.

    Args:
        llm_output: The date string from the LLM (e.g. "2026-08-10 15:00")
        timezone_str: User's IANA timezone

    Returns:
        (parsed_datetime, is_confident, explanation)
        - parsed_datetime: The validated datetime (or None)
        - is_confident: True if LLM and parser agree
        - explanation: Human-readable note about the parsing
    """
    if not llm_output or not llm_output.strip():
        return None, False, "No date provided"

    parsed = _try_parse(llm_output)

    if parsed is None:
        # Try dateparser as second attempt
        try:
            import dateparser
            now = get_local_now(timezone_str)
            dp_result = dateparser.parse(
                llm_output,
                settings={"RELATIVE_BASE": now, "TIMEZONE": timezone_str}
            )
            if dp_result:
                return dp_result, False, f"Parsed '{llm_output}' as {format_date(dp_result)} (deterministic fallback — LLM output was unparseable)"
        except ImportError:
            pass
        return None, False, f"Could not parse date from: {llm_output}"

    # Validate against dateparser for hallucination guard
    try:
        import dateparser
        now = get_local_now(timezone_str)
        dp_result = dateparser.parse(
            llm_output,
            settings={"RELATIVE_BASE": now, "TIMEZONE": timezone_str}
        )
        if dp_result:
            # Check if they agree within 24 hours
            diff = abs((parsed - dp_result).total_seconds())
            if diff < 86400:  # within 24 hours
                return parsed, True, f"Confirmed: {format_date(parsed)}"
            else:
                # Use the deterministic parser's result
                logger.warning(
                    "Date hallucination detected: LLM=%s parser=%s diff=%.1fh",
                    format_date(parsed), format_date(dp_result), diff / 3600
                )
                return dp_result, False, (
                    f"Corrected date to {format_date(dp_result)} "
                    f"(LLM suggested {format_date(parsed)} which seemed incorrect)"
                )
    except ImportError:
        pass

    return parsed, True, f"Parsed: {format_date(parsed)}"


def _try_parse(text: str) -> Optional[datetime]:
    """Try multiple date formats."""
    formats = [
        "%Y-%m-%d %H:%M",     # 2026-08-10 15:00
        "%Y-%m-%dT%H:%M:%S",  # 2026-08-10T15:00:00
        "%Y-%m-%d",            # 2026-08-10
        "%d/%m/%Y %H:%M",     # 10/08/2026 15:00
        "%d/%m/%Y",            # 10/08/2026
        "%d-%m-%Y %H:%M",     # 10-08-2026 15:00
        "%d-%m-%Y",            # 10-08-2026
        "%B %d, %Y %H:%M",    # August 10, 2026 15:00
        "%B %d, %Y",           # August 10, 2026
        "%d %B %Y %H:%M",     # 10 August 2026 15:00
        "%d %B %Y",            # 10 August 2026
    ]
    text = text.strip()
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _tz_abbreviation(timezone_str: str) -> str:
    """Get a short abbreviation for a timezone."""
    abbrevs = {
        "Africa/Nairobi": "EAT",
        "Africa/Addis_Ababa": "EAT",
        "Africa/Dar_es_Salaam": "EAT",
        "Africa/Kampala": "EAT",
        "Africa/Lagos": "WAT",
        "Africa/Johannesburg": "SAST",
        "Africa/Cairo": "EET",
        "Europe/London": "GMT",
        "Europe/Paris": "CET",
        "America/New_York": "EST",
        "America/Chicago": "CST",
        "America/Denver": "MST",
        "America/Los_Angeles": "PST",
        "Asia/Dubai": "GST",
        "Asia/Kolkata": "IST",
    }
    return abbrevs.get(timezone_str, timezone_str.split("/")[-1].upper())


def validate_timezone(tz_str: str) -> Tuple[bool, str]:
    """Validate an IANA timezone string. Returns (is_valid, canonical_name)."""
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo

    try:
        tz = ZoneInfo(tz_str)
        return True, str(tz)
    except Exception:
        # Try common alternatives
        common = {
            "eat": "Africa/Nairobi",
            "east africa": "Africa/Nairobi",
            "nairobi": "Africa/Nairobi",
            "kenya": "Africa/Nairobi",
            "wat": "Africa/Lagos",
            "west africa": "Africa/Lagos",
            "lagos": "Africa/Lagos",
            "gmt": "Europe/London",
            "london": "Europe/London",
            "est": "America/New_York",
            "new york": "America/New_York",
            "pst": "America/Los_Angeles",
            "la": "America/Los_Angeles",
            "los angeles": "America/Los_Angeles",
            "ist": "Asia/Kolkata",
            "india": "Asia/Kolkata",
            "dubai": "Asia/Dubai",
            "uae": "Asia/Dubai",
        }
        canonical = common.get(tz_str.lower().strip())
        if canonical:
            return True, canonical
        return False, f"Unknown timezone: {tz_str}. Try: Nairobi, London, New_York, Dubai, etc."
