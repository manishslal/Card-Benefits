"""Oneworld lounge scraper — live extraction + reference data fallback.

Scrapes https://www.oneworld.com/airport-lounge-results?location={IATA} for
each target airport.  The page renders server-side HTML with lounge cards in
``<article class="lounge" data-module="Lounge">`` elements.

Falls back to curated reference data when live extraction fails or returns
zero results.

Access rules always include ``{"requires_same_day_flight": true}`` since this
is universally true for airline-owned/operated lounges.
"""

import asyncio
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

BASE_URL = "https://www.oneworld.com/airport-lounge-results"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

# Minimum delay between airport page navigations (seconds).
NAV_DELAY = 3

# Regex to extract a 3-letter IATA code from text.
_IATA_RE = re.compile(r"\b([A-Z]{3})\b")

# Regex to extract terminal/concourse from subtitle text.
_TERMINAL_RE = re.compile(r"(Terminal\s+\w+|Concourse\s+\w+)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Reference data — fallback for when live extraction fails
# ---------------------------------------------------------------------------

_REFERENCE_LOUNGES: dict[str, list[dict]] = {
    "JFK": [
        {"name": "American Airlines Admirals Club - Concourse C", "terminal": "Terminal 8", "operator": "American Airlines", "access_text": "business class first class"},
        {"name": "British Airways and American Airlines Greenwich Lounge", "terminal": "Terminal 8", "operator": "British Airways", "access_text": "first class business class"},
        {"name": "British Airways and American Airlines Chelsea Lounge", "terminal": "Terminal 8", "operator": "British Airways", "access_text": "first class"},
        {"name": "British Airways and American Airlines Soho Lounge", "terminal": "Terminal 8", "operator": "British Airways", "access_text": "first class"},
    ],
    "ORD": [
        {"name": "American Airlines Admirals Club - Terminal 3", "terminal": "Terminal 3", "operator": "American Airlines", "access_text": "business class first class"},
        {"name": "American Airlines Flagship Lounge", "terminal": "Terminal 3", "operator": "American Airlines", "access_text": "first class"},
    ],
    "LAX": [
        {"name": "Alaska Lounge", "terminal": "Terminal 6", "operator": "Alaska Airlines", "access_text": "business class first class"},
        {"name": "American Airlines Admirals Club", "terminal": "Terminal 4", "operator": "American Airlines", "access_text": "business class first class"},
        {"name": "Qantas First Lounge", "terminal": "Tom Bradley International Terminal", "operator": "Qantas", "access_text": "first class"},
    ],
    "ATL": [
        {"name": "American Airlines Admirals Club", "terminal": "North Terminal", "operator": "American Airlines", "access_text": "business class first class"},
    ],
    "DFW": [
        {"name": "American Airlines Admirals Club - Terminal A", "terminal": "Terminal A", "operator": "American Airlines", "access_text": "business class first class"},
        {"name": "American Airlines Admirals Club - Terminal C", "terminal": "Terminal C", "operator": "American Airlines", "access_text": "business class first class"},
        {"name": "American Airlines Flagship Lounge", "terminal": "Terminal D", "operator": "American Airlines", "access_text": "first class"},
    ],
    "DEN": [
        {"name": "United Club (Oneworld eligible)", "terminal": "Concourse B", "operator": "United Airlines", "access_text": "business class"},
    ],
    "MIA": [
        {"name": "American Airlines Admirals Club - Concourse D", "terminal": "Concourse D", "operator": "American Airlines", "access_text": "business class first class"},
        {"name": "American Airlines Flagship Lounge", "terminal": "Concourse D", "operator": "American Airlines", "access_text": "first class"},
    ],
    "MCO": [],  # No Oneworld-specific lounges
    "LAS": [],  # No Oneworld-specific lounges
    "CLT": [
        {"name": "American Airlines Admirals Club", "terminal": "Concourse C", "operator": "American Airlines", "access_text": "business class first class"},
    ],
}

# Default airport set when --airports is not specified.
_DEFAULT_AIRPORTS = sorted(_REFERENCE_LOUNGES.keys())


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def _extract_iata(text: str) -> str:
    """Pull the first plausible IATA code out of *text*.

    Prefers codes found in the ``US_AIRPORTS`` lookup.
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
      - ``access_method``: canonical access method name from the DB
      - ``conditions``: JSONB-ready dict
      - ``notes``: human-readable note
    """
    rules: list[dict] = []
    lower_name = lounge_name.lower()
    lower_text = access_text.lower() if access_text else ""
    combined = f"{lower_name} {lower_text}"

    conditions = {"requires_same_day_flight": True}

    # Oneworld Emerald status — always applies for oneworld lounges
    rules.append({
        "access_method": "Oneworld Emerald",
        "conditions": {**conditions},
        "notes": "Oneworld Emerald status holders with same-day flight on a oneworld carrier",
    })

    # Oneworld Sapphire status — add if sapphire access is indicated
    if _mentions_sapphire(combined):
        rules.append({
            "access_method": "Oneworld Sapphire",
            "conditions": {**conditions},
            "notes": "Oneworld Sapphire status holders with same-day flight on a oneworld carrier",
        })

    # First Class ticket holders
    if _mentions_first_class(combined):
        rules.append({
            "access_method": "First Class Ticket",
            "conditions": {**conditions},
            "notes": "Passengers with a First Class boarding pass on a oneworld carrier",
        })

    # Business Class ticket holders
    if _mentions_business_class(combined):
        rules.append({
            "access_method": "Business Class Ticket",
            "conditions": {**conditions},
            "notes": "Passengers with a Business Class boarding pass on a oneworld carrier",
        })

    # Default: if neither First nor Business was explicitly mentioned, add
    # Business — most oneworld lounges admit Business and above.
    method_names = {r["access_method"] for r in rules}
    if "First Class Ticket" not in method_names and "Business Class Ticket" not in method_names:
        rules.append({
            "access_method": "Business Class Ticket",
            "conditions": {**conditions},
            "notes": "Passengers with a Business Class boarding pass on a oneworld carrier",
        })

    return rules


def _mentions_first_class(text: str) -> bool:
    return bool(re.search(r"first\s*class|first\s*cabin", text))


def _mentions_business_class(text: str) -> bool:
    return bool(re.search(r"business\s*class|business\s*cabin", text))


def _mentions_sapphire(text: str) -> bool:
    return bool(re.search(r"sapphire", text))


def _parse_terminal_from_subtitle(subtitle: str) -> str:
    """Extract terminal or concourse from a Oneworld lounge subtitle.

    Example subtitle:
      "(JFK) New York John F. Kennedy International Airport (JFK) Terminal 8"
    Returns: "Terminal 8"
    """
    match = _TERMINAL_RE.search(subtitle)
    return match.group(1) if match else "Main Terminal"


def _infer_operator(lounge_name: str) -> str:
    """Infer the lounge operator from the lounge name.

    Recognises the most common Oneworld-affiliated operators.
    """
    name_lower = lounge_name.lower()
    operators = [
        ("american airlines", "American Airlines"),
        ("british airways", "British Airways"),
        ("qantas", "Qantas"),
        ("cathay pacific", "Cathay Pacific"),
        ("qatar", "Qatar Airways"),
        ("japan airlines", "Japan Airlines"),
        ("alaska", "Alaska Airlines"),
        ("iberia", "Iberia"),
        ("finnair", "Finnair"),
        ("malaysia airlines", "Malaysia Airlines"),
        ("royal jordanian", "Royal Jordanian"),
        ("sri lankan", "SriLankan Airlines"),
        ("primeclass", "Primeclass"),
    ]
    for keyword, operator in operators:
        if keyword in name_lower:
            return operator
    return "Oneworld"


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------


class OneworldScraper(BaseScraper):
    """Scrape Oneworld lounge listings for US airports.

    Uses the per-airport URL pattern:
      https://www.oneworld.com/airport-lounge-results?location={IATA}

    Falls back to reference data when live extraction fails.
    """

    source_name = "oneworld"

    def __init__(self, airports: list[str] | None = None):
        super().__init__()
        self._airports = [c.strip().upper() for c in airports] if airports else None

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def scrape(self) -> ScrapeResult:
        """Scrape Oneworld lounge pages for each target airport."""
        result = ScrapeResult(
            source_name=self.source_name,
            scraped_at=datetime.now(timezone.utc),
        )

        airports = self._airports or _DEFAULT_AIRPORTS
        logger.info("Scraping %d airports: %s", len(airports), airports)

        # Set user-agent on the browser context before creating pages.
        if hasattr(self, "_context") and self._context:
            await self._context.set_extra_http_headers({"User-Agent": _USER_AGENT})

        page = await self.new_page()
        await page.set_extra_http_headers({"User-Agent": _USER_AGENT})

        try:
            for idx, iata_code in enumerate(airports):
                if idx > 0:
                    await asyncio.sleep(NAV_DELAY)

                try:
                    records = await self.scrape_airport(page, iata_code)

                    if records:
                        result.records.extend(records)
                        logger.info(
                            "[%s] Live extraction found %d records",
                            iata_code,
                            len(records),
                        )
                    else:
                        # Fall back to reference data
                        ref = self._build_reference_records(iata_code)
                        if ref:
                            result.records.extend(ref)
                            result.errors.append(
                                f"[{iata_code}] Live extraction failed, using reference data"
                            )
                            logger.warning(
                                "[%s] Live extraction yielded 0 records; "
                                "using %d reference records",
                                iata_code,
                                len(ref),
                            )
                        else:
                            logger.warning(
                                "[%s] No live or reference data available", iata_code
                            )

                except Exception as exc:
                    logger.error("[%s] Scrape error: %s", iata_code, exc)
                    # Attempt reference data fallback
                    ref = self._build_reference_records(iata_code)
                    if ref:
                        result.records.extend(ref)
                    result.errors.append(
                        f"[{iata_code}] Scrape error ({exc}); "
                        + ("used reference data" if ref else "no reference data available")
                    )
        finally:
            await page.close()

        logger.info(
            "OneworldScraper finished: %d records, %d errors",
            len(result.records),
            len(result.errors),
        )
        return result

    # ------------------------------------------------------------------
    # run() override — persist access rules after base upsert
    # ------------------------------------------------------------------

    async def run(self, dry_run: bool = False, airport_codes: list[str] | None = None) -> ScrapeResult:
        """Override to persist access rules after the base upsert pass."""
        if airport_codes:
            self._airports = [c.strip().upper() for c in airport_codes]
        result = await super().run(dry_run=dry_run)
        if not dry_run and result.records:
            self._persist_access_rules(result.records)
        return result

    def _persist_access_rules(self, records: list[dict]) -> None:
        """Link upserted lounges to Oneworld access methods."""
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
                        provider="Oneworld",
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

        logger.info("Oneworld access rules created/updated: %d", rules_created)

    # ------------------------------------------------------------------
    # Per-airport live extraction
    # ------------------------------------------------------------------

    async def scrape_airport(self, page, iata_code: str) -> list[dict]:
        """Scrape lounges from the Oneworld results page for *iata_code*.

        Returns a list of record dicts, or an empty list if the page has no
        lounge cards.
        """
        url = f"{BASE_URL}?location={iata_code}"
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(5000)

        # Select only real lounge articles (not the fast-track header)
        articles = await page.query_selector_all(
            'article.lounge[data-module="Lounge"]'
        )

        if not articles:
            logger.info("[%s] No lounge articles found on page", iata_code)
            return []

        records: list[dict] = []
        for art in articles:
            try:
                record = await self._parse_lounge_card(art, iata_code)
                if record:
                    records.append(record)
            except Exception as exc:
                logger.warning("[%s] Card parse error: %s", iata_code, exc)

        return records

    async def _parse_lounge_card(self, el, iata_code: str) -> dict | None:
        """Extract a lounge record from a single ``<article>`` element."""
        # -- Name --
        title_el = await el.query_selector("h3.lounge__title")
        lounge_name = ""
        if title_el:
            lounge_name = (await title_el.inner_text()).strip()
        if not lounge_name:
            return None

        # -- Terminal (from subtitle) --
        subtitle_el = await el.query_selector("h3.lounge__subtitle")
        subtitle_text = ""
        if subtitle_el:
            subtitle_text = (await subtitle_el.inner_text()).strip()
        terminal = _parse_terminal_from_subtitle(subtitle_text) if subtitle_text else "Main Terminal"

        # -- Access tiers (from tier badges) --
        tier_classes = []
        tier_els = await el.query_selector_all(".lounge__tier")
        for tier_el in tier_els:
            cls = await tier_el.get_attribute("class") or ""
            tier_classes.append(cls)

        # -- Access list --
        access_items: list[str] = []
        access_lis = await el.query_selector_all(
            ".lounge-details__access li"
        )
        for li in access_lis:
            text = (await li.inner_text()).strip()
            if text:
                access_items.append(text)

        # -- Airlines --
        airline_items: list[str] = []
        airline_lis = await el.query_selector_all(
            ".lounge-details__airlines li:not(.conditions)"
        )
        for li in airline_lis:
            text = (await li.inner_text()).strip()
            if text:
                airline_items.append(text)

        # -- Amenities --
        amenity_items: list[str] = []
        amenity_lis = await el.query_selector_all(
            ".lounge-details__amenities li"
        )
        for li in amenity_lis:
            text = (await li.inner_text()).strip()
            if text:
                amenity_items.append(text)

        # -- Build access text from access list and tier badges --
        access_text_parts = list(access_items)
        for cls in tier_classes:
            if "emerald" in cls:
                access_text_parts.append("Emerald Tier")
            if "sapphire" in cls:
                access_text_parts.append("Sapphire Tier")

        access_text = " ".join(access_text_parts).lower()

        # -- Operator --
        operator = _infer_operator(lounge_name)
        if operator == "Oneworld" and airline_items:
            # Use the first airline from the airline list
            operator = airline_items[0]

        # -- Airport metadata --
        airport_meta = US_AIRPORTS.get(iata_code, {
            "name": "",
            "city": "",
            "timezone": "America/New_York",
        })

        # -- Access rules --
        access_rules = build_access_rules(lounge_name, access_text)

        return {
            "airport_iata": iata_code,
            "airport_name": airport_meta["name"],
            "airport_city": airport_meta["city"],
            "airport_timezone": airport_meta.get("timezone", "America/New_York"),
            "terminal_name": terminal,
            "lounge_name": lounge_name,
            "lounge_operator": operator,
            "venue_type": "lounge",
            "source_url": f"{BASE_URL}?location={iata_code}",
            "image_url": "",
            "operating_hours": None,
            "access_rules": access_rules,
        }

    # ------------------------------------------------------------------
    # Reference data fallback
    # ------------------------------------------------------------------

    def _build_reference_records(self, iata_code: str) -> list[dict]:
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
                "lounge_operator": entry.get("operator", "Oneworld"),
                "venue_type": "lounge",
                "source_url": "",
                "image_url": "",
                "operating_hours": None,
                "access_rules": access_rules,
            })

        return records
