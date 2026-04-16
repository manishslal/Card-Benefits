"""Normalize raw scraped lounge data into a canonical format for DB upserts.

This module is intentionally *pure* — no I/O, no database calls.  Every
function is deterministic given its inputs, making it trivial to unit-test.
"""

import re
import unicodedata
from typing import Optional


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


_VALID_DAY_KEYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
_VALID_AMENITY_KEYS = {
    "has_showers", "has_hot_food", "has_premium_bar", "has_wifi",
    "has_spa", "has_quiet_zone", "allows_pets",
}


def normalize_lounge_record(raw: dict) -> dict:
    """Standardise a raw scraped dict into a repository-ready dict.

    Keys in *raw* may use varied naming, casing, and formats depending on the
    scraper source.  This function maps them to the canonical schema expected
    by ``repository.upsert_*`` functions.
    """
    result: dict = {}

    # --- Airport fields ---
    result["airport_iata"] = _clean_iata(raw.get("airport_iata", raw.get("iata", "")))
    result["airport_name"] = _clean_str(raw.get("airport_name", raw.get("airport", "")))
    result["airport_city"] = _clean_str(raw.get("airport_city", raw.get("city", "")))
    result["airport_timezone"] = _clean_str(
        raw.get("airport_timezone", raw.get("timezone", "UTC"))
    )

    # --- Terminal ---
    result["terminal_name"] = _clean_str(
        raw.get("terminal_name", raw.get("terminal", "Main Terminal"))
    )
    result["terminal_is_airside"] = raw.get("terminal_is_airside", raw.get("is_airside", True))

    # --- Lounge ---
    result["lounge_name"] = _clean_str(raw.get("lounge_name", raw.get("name", "")))
    result["lounge_operator"] = _clean_str(
        raw.get("lounge_operator", raw.get("operator", ""))
    ) or None
    result["location_details"] = _clean_str(
        raw.get("location_details", raw.get("location", ""))
    ) or None

    # --- Operating hours ---
    raw_hours = raw.get("operating_hours", raw.get("hours", None))
    if isinstance(raw_hours, str):
        result["operating_hours"] = parse_operating_hours(raw_hours)
    elif isinstance(raw_hours, dict):
        result["operating_hours"] = {k: v for k, v in raw_hours.items() if k in _VALID_DAY_KEYS}
    else:
        result["operating_hours"] = None

    # --- Amenities ---
    raw_amenities = raw.get("amenities", None)
    if isinstance(raw_amenities, list):
        result["amenities"] = normalize_amenities(raw_amenities)
    elif isinstance(raw_amenities, dict):
        result["amenities"] = {k: v for k, v in raw_amenities.items() if k in _VALID_AMENITY_KEYS}
    else:
        result["amenities"] = None

    # --- Booleans ---
    result["is_restaurant_credit"] = bool(raw.get("is_restaurant_credit", False))
    result["may_deny_entry"] = bool(raw.get("may_deny_entry", False))

    # --- Passthrough fields (no normalization needed) ---
    result["source_url"] = _clean_str(raw.get("source_url", "")) or None
    result["image_url"] = _clean_str(raw.get("image_url", "")) or None
    result["venue_type"] = _clean_str(raw.get("venue_type", "")) or "lounge"

    return result


# ---------------------------------------------------------------------------
# Operating hours parsing
# ---------------------------------------------------------------------------

_DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Maps various abbreviations / full names → canonical 3-letter key.
_DAY_MAP: dict[str, str] = {}
for _d in _DAY_NAMES:
    _DAY_MAP[_d] = _d
_DAY_MAP.update({
    "monday": "mon", "tuesday": "tue", "wednesday": "wed",
    "thursday": "thu", "friday": "fri", "saturday": "sat", "sunday": "sun",
    "mo": "mon", "tu": "tue", "we": "wed", "th": "thu",
    "fr": "fri", "sa": "sat", "su": "sun",
})

# Regex for 12-hour times like "6:00am", "10:00pm", "6am", "10pm"
_TIME_12H_RE = re.compile(
    r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", re.IGNORECASE
)

# Regex for 24-hour times like "0600", "22:00", "06:00"
_TIME_24H_RE = re.compile(r"(\d{2}):?(\d{2})")


def parse_operating_hours(text: str) -> dict[str, list[str]]:
    """Parse a human-readable hours string into canonical form.

    Supports formats like:
      - ``"Monday-Friday: 6:00am-10:00pm"``
      - ``"Daily: 6am-10pm"``
      - ``"Mon-Fri 0600-2200, Sat-Sun 0700-2000"``
      - ``"Mon-Fri 06:00-22:00"``
      - ``"Mon, Wed, Fri: 0600-2200"``

    Returns:
        Dict mapping lowercase day abbreviations to lists of ``"HH:MM-HH:MM"``
        ranges.  E.g. ``{"mon": ["06:00-22:00"], "tue": ["06:00-22:00"]}``.
    """
    result: dict[str, list[str]] = {}

    # Split on comma or semicolon to handle multiple segments
    segments = re.split(r"[,;]", text)

    # First pass: find a shared time range for segments that have days but no
    # time.  This handles "Mon, Wed, Fri: 0600-2200" where only the last
    # segment contains the time range.
    shared_time: Optional[str] = None
    for segment in segments:
        tr = _extract_time_range(segment.strip())
        if tr is not None:
            shared_time = tr

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        # Extract the time range first
        time_range = _extract_time_range(segment)

        # Extract the day range
        days = _extract_days(segment)

        if time_range is None:
            # No time in this segment — use the shared time if we found one,
            # but only if this segment actually references specific days
            # (not "daily" which would expand to all 7 via _extract_days).
            if shared_time is not None and days:
                time_range = shared_time
            else:
                continue

        for day in days:
            result.setdefault(day, []).append(time_range)

    return result


def _extract_time_range(segment: str) -> Optional[str]:
    """Pull the ``"HH:MM-HH:MM"`` range out of a segment string."""
    # Try 12-hour matches first
    matches_12 = _TIME_12H_RE.findall(segment)
    if len(matches_12) >= 2:
        t1 = _to_24h(matches_12[0])
        t2 = _to_24h(matches_12[1])
        return f"{t1}-{t2}"

    # Try 24-hour matches
    matches_24 = _TIME_24H_RE.findall(segment)
    if len(matches_24) >= 2:
        t1 = f"{matches_24[0][0]}:{matches_24[0][1]}"
        t2 = f"{matches_24[1][0]}:{matches_24[1][1]}"
        return f"{t1}-{t2}"

    return None


def _to_24h(match_groups: tuple) -> str:
    """Convert a 12-hour regex match ``(hour, minutes, am/pm)`` to ``HH:MM``."""
    hour = int(match_groups[0])
    minutes = int(match_groups[1]) if match_groups[1] else 0
    meridiem = match_groups[2].lower()

    if meridiem == "pm" and hour != 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minutes:02d}"


def _extract_days(segment: str) -> list[str]:
    """Determine which days are referenced in *segment*.

    Handles:
      - ``"Daily"`` → all 7 days
      - ``"Monday-Friday"`` → mon..fri
      - ``"Sat-Sun"`` → sat, sun
      - ``"Mon"`` (single day)
    """
    lower = segment.lower()

    # "daily" or "every day" → all 7
    if "daily" in lower or "every day" in lower or "everyday" in lower:
        return list(_DAY_NAMES)

    # Find all day tokens in order of appearance
    found: list[tuple[int, str]] = []
    for token, canonical in sorted(_DAY_MAP.items(), key=lambda x: -len(x[0])):
        # Use word-boundary-ish search to avoid sub-matches (e.g. "sun" in "sunday")
        pattern = re.compile(rf"\b{re.escape(token)}\b", re.IGNORECASE)
        m = pattern.search(lower)
        if m:
            # Avoid duplicates from e.g. "monday" AND "mon" matching
            if canonical not in [c for _, c in found]:
                found.append((m.start(), canonical))

    if not found:
        # No day info at all — assume daily
        return list(_DAY_NAMES)

    found.sort(key=lambda x: x[0])

    # Check for a range separator between days (e.g. "mon-fri", "monday to friday")
    if len(found) >= 2 and _has_range_separator(lower, found[0], found[1]):
        start_day = found[0][1]
        end_day = found[1][1]
        return _day_range(start_day, end_day)

    # Otherwise return the individually listed days
    return [canonical for _, canonical in found]


def _has_range_separator(text: str, a: tuple[int, str], b: tuple[int, str]) -> bool:
    """Check if there is a '-', '–', 'to', or 'through' between two day tokens."""
    between = text[a[0]:b[0]]
    return bool(re.search(r"[-–]|(?:\bto\b)|(?:\bthrough\b)", between))


def _day_range(start: str, end: str) -> list[str]:
    """Return a list of day abbreviations from *start* to *end* inclusive."""
    si = _DAY_NAMES.index(start)
    ei = _DAY_NAMES.index(end)
    if ei >= si:
        return _DAY_NAMES[si : ei + 1]
    # Wrap around (e.g. fri-mon)
    return _DAY_NAMES[si:] + _DAY_NAMES[: ei + 1]


# ---------------------------------------------------------------------------
# Amenity normalization
# ---------------------------------------------------------------------------

# Mapping from lowercase keyword → canonical amenity key.
# Order matters: longer / more specific patterns checked first.
_AMENITY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"shower", re.I), "has_showers"),
    (re.compile(r"wi-?fi|wifi|wireless", re.I), "has_wifi"),
    (re.compile(r"hot\s*(food|meal)|buffet|hot\s*meals?", re.I), "has_hot_food"),
    (re.compile(r"(full|premium|cocktail)\s*bar|premium\s*spirits?", re.I), "has_premium_bar"),
    (re.compile(r"\bspa\b|massage", re.I), "has_spa"),
    (re.compile(r"quiet\s*(zone|room|area)|rest\s*area", re.I), "has_quiet_zone"),
    (re.compile(r"pet|dog|animal", re.I), "allows_pets"),
]


_NEGATION_RE = re.compile(
    r"\b(no|not|without|unavailable|closed|n/a|none)\b", re.IGNORECASE
)


def normalize_amenities(raw_list: list[str]) -> dict[str, bool]:
    """Map a list of free-text amenity descriptions to canonical boolean keys.

    Only keys that are explicitly found are included (no false defaults).
    Negated amenities (e.g. "No showers", "WiFi not available") are skipped.
    """
    result: dict[str, bool] = {}
    for item in raw_list:
        cleaned = _clean_str(item)
        if _NEGATION_RE.search(cleaned):
            continue  # Skip negated amenities
        for pattern, key in _AMENITY_PATTERNS:
            if pattern.search(cleaned):
                result[key] = True
                break  # one canonical key per input item
    return result


# ---------------------------------------------------------------------------
# String utilities
# ---------------------------------------------------------------------------


def _clean_str(value: Optional[str]) -> str:
    """Strip, normalize unicode, collapse whitespace."""
    if not value:
        return ""
    # NFC normalization for consistent unicode representation
    s = unicodedata.normalize("NFC", value)
    # Collapse any runs of whitespace (including non-breaking spaces) to single space
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _clean_iata(value: str) -> str:
    """Normalise an IATA code to exactly 3 uppercase ASCII letters."""
    cleaned = _clean_str(value).upper().strip()
    # Keep only alpha characters
    cleaned = re.sub(r"[^A-Z]", "", cleaned)
    return cleaned[:3]
