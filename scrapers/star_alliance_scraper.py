"""Star Alliance lounge scraper — reference data edition.

staralliance.com returns **403 Forbidden** on all pages (aggressive WAF/
Cloudflare bot detection).  Instead of attempting live extraction that will
always fail, this scraper uses curated reference data for known Star Alliance
member-airline lounges at major US airports.

The browser context is still set up with a realistic user-agent for
consistency with other scrapers, but it is not used for page navigation.

Access rules always include ``{"requires_same_day_flight": true}`` since this
is universally true for airline-owned/operated lounges.
"""

import logging
import re
from datetime import datetime, timezone

from scrapers.base_scraper import BaseScraper, ScrapeResult
from scrapers.repository import upsert_access_method, upsert_lounge_access_rule
from scrapers.database import get_cursor
from scrapers.us_airports import US_AIRPORTS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

# Regex to extract a 3-letter IATA code from text.
_IATA_RE = re.compile(r"\b([A-Z]{3})\b")


# ---------------------------------------------------------------------------
# Reference data — curated Star Alliance member-airline lounges at US airports
# ---------------------------------------------------------------------------

_REFERENCE_LOUNGES: dict[str, list[dict]] = {
    "JFK": [
        {"name": "Lufthansa Senator Lounge", "terminal": "Terminal 1", "operator": "Lufthansa", "access_text": "first class business class"},
        {"name": "Lufthansa Business Lounge", "terminal": "Terminal 1", "operator": "Lufthansa", "access_text": "business class"},
        {"name": "Air Canada Maple Leaf Lounge", "terminal": "Terminal 1", "operator": "Air Canada", "access_text": "business class"},
        {"name": "Turkish Airlines Lounge", "terminal": "Terminal 1", "operator": "Turkish Airlines", "access_text": "business class"},
        {"name": "Korean Air KAL Business Class Lounge", "terminal": "Terminal 1", "operator": "Korean Air", "access_text": "business class"},
    ],
    "ORD": [
        {"name": "United Club - Terminal 1 Gate B6", "terminal": "Terminal 1", "operator": "United Airlines", "access_text": "business class"},
        {"name": "United Club - Terminal 1 Gate C16", "terminal": "Terminal 1", "operator": "United Airlines", "access_text": "business class"},
        {"name": "United Polaris Lounge", "terminal": "Terminal 1", "operator": "United Airlines", "access_text": "first class business class"},
        {"name": "Lufthansa Business Lounge", "terminal": "Terminal 5", "operator": "Lufthansa", "access_text": "business class"},
        {"name": "Lufthansa Senator Lounge", "terminal": "Terminal 5", "operator": "Lufthansa", "access_text": "first class business class"},
    ],
    "LAX": [
        {"name": "Star Alliance Lounge", "terminal": "Tom Bradley International Terminal", "operator": "Star Alliance", "access_text": "first class business class"},
        {"name": "United Club", "terminal": "Terminal 7", "operator": "United Airlines", "access_text": "business class"},
        {"name": "Air New Zealand Lounge", "terminal": "Tom Bradley International Terminal", "operator": "Air New Zealand", "access_text": "business class"},
    ],
    "ATL": [
        {"name": "The Club ATL (Star Alliance)", "terminal": "Concourse F", "operator": "Star Alliance", "access_text": "business class"},
    ],
    "DFW": [
        {"name": "United Club", "terminal": "Terminal E", "operator": "United Airlines", "access_text": "business class"},
    ],
    "DEN": [
        {"name": "United Club - Concourse B East", "terminal": "Concourse B", "operator": "United Airlines", "access_text": "business class"},
        {"name": "United Club - Concourse B West", "terminal": "Concourse B", "operator": "United Airlines", "access_text": "business class"},
    ],
    "MIA": [
        {"name": "Avianca VIP Lounge", "terminal": "Concourse J", "operator": "Avianca", "access_text": "business class"},
    ],
    "MCO": [],  # No Star Alliance-specific lounges
    "LAS": [],  # No Star Alliance-specific lounges
    "CLT": [],  # No Star Alliance-specific lounges
}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def _extract_iata(text: str) -> str:
    """Pull the first plausible IATA code out of *text*.

    Only returns codes found in the ``US_AIRPORTS`` lookup.
    Returns empty string if no known airport code is found.
    """
    candidates = _IATA_RE.findall(text.upper())
    for c in candidates:
        if c in US_AIRPORTS:
            return c
    return ""


def build_access_rules(lounge_name: str, access_text: str) -> list[dict]:
    """Derive access rules from lounge name and raw access-eligibility text.

    Every rule includes ``{"requires_same_day_flight": true}``.

    Returns a list of dicts, each with:
      - ``access_method``: canonical name from the DB
      - ``conditions``: JSONB-ready dict
      - ``notes``: human-readable note (optional)
    """
    rules: list[dict] = []
    lower_name = lounge_name.lower()
    lower_text = access_text.lower() if access_text else ""
    combined = f"{lower_name} {lower_text}"

    conditions = {"requires_same_day_flight": True}

    # Star Alliance Gold status — always applies for Star Alliance lounges
    rules.append({
        "access_method": "Star Alliance Gold",
        "conditions": {**conditions},
        "notes": "Star Alliance Gold status holders with same-day flight",
    })

    # First Class ticket holders
    if _mentions_first_class(combined):
        rules.append({
            "access_method": "First Class Ticket",
            "conditions": {**conditions},
            "notes": "Passengers with a First Class boarding pass on a Star Alliance carrier",
        })

    # Business Class ticket holders
    if _mentions_business_class(combined):
        rules.append({
            "access_method": "Business Class Ticket",
            "conditions": {**conditions},
            "notes": "Passengers with a Business Class boarding pass on a Star Alliance carrier",
        })

    # If neither First nor Business was explicitly mentioned, default to both
    # — most Star Alliance lounges admit both premium cabin passengers.
    method_names = {r["access_method"] for r in rules}
    if "First Class Ticket" not in method_names and "Business Class Ticket" not in method_names:
        rules.append({
            "access_method": "Business Class Ticket",
            "conditions": {**conditions},
            "notes": "Passengers with a Business Class boarding pass on a Star Alliance carrier",
        })

    return rules


def _mentions_first_class(text: str) -> bool:
    return bool(re.search(r"first\s*class|first\s*cabin", text))


def _mentions_business_class(text: str) -> bool:
    return bool(re.search(r"business\s*class|business\s*cabin", text))


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------


class StarAllianceScraper(BaseScraper):
    """Star Alliance lounge data from curated reference data.

    The staralliance.com site returns 403 Forbidden, so live extraction is not
    possible.  This scraper builds records from ``_REFERENCE_LOUNGES`` and
    enriches them with airport metadata from ``US_AIRPORTS``.
    """

    source_name = "star_alliance"

    def __init__(self, airports: list[str] | None = None):
        super().__init__()
        self._airports = [c.strip().upper() for c in airports] if airports else None

    async def scrape(self) -> ScrapeResult:
        """Build lounge records from reference data for each target airport."""
        # Set user-agent on context for consistency, even though we don't
        # navigate to any pages.
        if hasattr(self, "_context") and self._context:
            await self._context.set_extra_http_headers({"User-Agent": _USER_AGENT})

        airports = self._airports or sorted(_REFERENCE_LOUNGES.keys())

        result = ScrapeResult(
            source_name=self.source_name,
            scraped_at=datetime.now(timezone.utc),
        )

        for iata_code in airports:
            records = self._build_records_for_airport(iata_code)
            if records:
                result.records.extend(records)
                logger.info("[%s] %d reference lounges", iata_code, len(records))
            else:
                logger.warning("[%s] No reference data available", iata_code)

        logger.info(
            "StarAllianceScraper finished: %d records, %d errors",
            len(result.records),
            len(result.errors),
        )
        return result

    # -- run() override ---------------------------------------------------

    async def run(self, dry_run: bool = False, airport_codes: list[str] | None = None) -> ScrapeResult:
        """Override to persist access rules after the base upsert pass."""
        if airport_codes:
            self._airports = [c.strip().upper() for c in airport_codes]
        result = await super().run(dry_run=dry_run)
        if not dry_run and result.records:
            self._persist_access_rules(result.records)
        return result

    def _persist_access_rules(self, records: list[dict]) -> None:
        """Link upserted lounges to Star Alliance access methods."""
        rules_created = 0
        for record in records:
            iata = record.get("airport_iata", "")
            lounge_name = record.get("lounge_name", "")
            access_rules = record.get("access_rules", [])
            if not iata or not lounge_name or not access_rules:
                continue

            with get_cursor() as cur:
                cur.execute(
                    """SELECT l.id FROM lounges l
                       JOIN lounge_terminals lt ON lt.id = l.terminal_id
                       JOIN lounge_airports la ON la.id = lt.airport_id
                       WHERE la.iata_code = %s AND l.name = %s""",
                    (iata, lounge_name),
                )
                row = cur.fetchone()
                if not row:
                    logger.warning("Lounge not found for access rule: %s - %s", iata, lounge_name)
                    continue
                lounge_id = row["id"]

            for rule in access_rules:
                try:
                    method_id = upsert_access_method(
                        name=rule["access_method"],
                        category="Airline Alliance",
                        provider="Star Alliance",
                    )
                    upsert_lounge_access_rule(
                        lounge_id=lounge_id,
                        access_method_id=method_id,
                        conditions=rule.get("conditions"),
                        notes=rule.get("notes"),
                    )
                    rules_created += 1
                except Exception as exc:
                    logger.error(
                        "Access rule upsert failed for %s / %s: %s",
                        iata, lounge_name, exc,
                    )

        logger.info("Star Alliance access rules created/updated: %d", rules_created)

    # -- Private helpers --------------------------------------------------

    def _build_records_for_airport(self, iata_code: str) -> list[dict]:
        """Build normalized records from reference data for a single airport.

        Returns an empty list if the airport has no reference data.
        """
        ref_entries = _REFERENCE_LOUNGES.get(iata_code, [])
        if not ref_entries:
            return []

        airport_meta = US_AIRPORTS.get(iata_code, {
            "name": "",
            "city": "",
            "timezone": "America/New_York",
        })

        records: list[dict] = []
        for entry in ref_entries:
            access_rules = build_access_rules(entry["name"], entry.get("access_text", ""))

            records.append({
                "airport_iata": iata_code,
                "airport_name": airport_meta["name"],
                "airport_city": airport_meta["city"],
                "airport_timezone": airport_meta.get("timezone", "America/New_York"),
                "terminal_name": entry.get("terminal", "Main Terminal"),
                "lounge_name": entry["name"],
                "lounge_operator": entry.get("operator", "Star Alliance"),
                "venue_type": "lounge",
                "source_url": "",
                "image_url": "",
                "operating_hours": None,
                "access_rules": access_rules,
            })

        return records
