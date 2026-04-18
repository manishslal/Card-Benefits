"""Amex Global Lounge Collection scraper.

Scrapes ALL lounges accessible to American Express Platinum cardholders
via the Amex Global Lounge Collection — including Centurion Lounges,
Escape Lounges, and third-party partner lounges (e.g. Lufthansa Senator).

Does NOT scrape Priority Pass or Delta Sky Club entries — those are
handled by their own dedicated scrapers.

IMPORTANT: The Amex site blocks ``eval()`` via Content Security Policy.
All DOM interaction MUST use Playwright locators, ``query_selector()``,
``get_attribute()``, and ``text_content()`` — never ``page.evaluate()``.
"""

import asyncio
import copy
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from playwright.async_api import Page

from .base_scraper import BaseScraper, ScrapeResult
from .normalizer import normalize_lounge_record
from .priority_pass_scraper import _classify_venue_type
from .repository import (
    get_lounges_by_airport,
    upsert_access_method,
    upsert_lounge_access_rule,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AMEX_LOUNGE_BASE_URL = (
    "https://www.americanexpress.com/en-us/travel/lounges/the-platinum-card/"
)
AMEX_AIRPORT_URL_TEMPLATE = (
    "https://www.americanexpress.com/en-us/travel/lounges/the-platinum-card/{iata}/"
)

# Keep the old constant name as an alias so existing imports (tests, etc.)
# continue to resolve.  The new canonical URL is AMEX_LOUNGE_BASE_URL.
AMEX_LOUNGE_URL = AMEX_LOUNGE_BASE_URL

# User-agent string — Amex may block default Playwright UA.
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

# Minimum delay between airport page navigations (seconds).
NAV_DELAY_SECONDS = 3

# Default guest fee for Centurion Lounges (USD).
CENTURION_GUEST_FEE = Decimal("50.00")

# Regex to parse terminal / concourse info from card text.
_TERMINAL_RE = re.compile(r"(Terminal\s+\w+|Concourse\s+\w+)", re.IGNORECASE)

# Regex to extract hours text from card (e.g. "Open Now • Closes at 11:00pm").
_HOURS_RE = re.compile(
    r"((?:Open|Closed)\s+Now\s*[•·\-–—]\s*(?:Opens|Closes)\s+at\s+\d{1,2}:\d{2}\s*[ap]m)",
    re.IGNORECASE,
)

# Lounge names we must explicitly skip — these belong to other scrapers.
_SKIP_PATTERNS = re.compile(
    r"priority\s*pass|delta\s*sky\s*club|plaza\s*premium|air\s*canada",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Reference data — authoritative US Centurion Lounge locations
# ---------------------------------------------------------------------------

_CENTURION_LOUNGES: list[dict] = [
    {
        "airport_iata": "JFK",
        "airport_name": "John F. Kennedy International Airport",
        "airport_city": "New York",
        "airport_timezone": "America/New_York",
        "terminal_name": "Terminal 4",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 6:00am-11:00pm",
    },
    {
        "airport_iata": "LAX",
        "airport_name": "Los Angeles International Airport",
        "airport_city": "Los Angeles",
        "airport_timezone": "America/Los_Angeles",
        "terminal_name": "Tom Bradley International Terminal",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 6:00am-11:00pm",
    },
    {
        "airport_iata": "CLT",
        "airport_name": "Charlotte Douglas International Airport",
        "airport_city": "Charlotte",
        "airport_timezone": "America/New_York",
        "terminal_name": "Main Terminal",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": ["Showers", "Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 6:00am-9:00pm",
    },
    {
        "airport_iata": "ORD",
        "airport_name": "O'Hare International Airport",
        "airport_city": "Chicago",
        "airport_timezone": "America/Chicago",
        "terminal_name": "Terminal 3",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 5:30am-10:30pm",
    },
    {
        "airport_iata": "MIA",
        "airport_name": "Miami International Airport",
        "airport_city": "Miami",
        "airport_timezone": "America/New_York",
        "terminal_name": "Concourse D",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 5:30am-10:30pm",
    },
    {
        "airport_iata": "DFW",
        "airport_name": "Dallas/Fort Worth International Airport",
        "airport_city": "Dallas",
        "airport_timezone": "America/Chicago",
        "terminal_name": "Terminal D",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 5:30am-10:30pm",
    },
    {
        "airport_iata": "SFO",
        "airport_name": "San Francisco International Airport",
        "airport_city": "San Francisco",
        "airport_timezone": "America/Los_Angeles",
        "terminal_name": "Terminal 3",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 5:30am-11:00pm",
    },
    {
        "airport_iata": "SEA",
        "airport_name": "Seattle-Tacoma International Airport",
        "airport_city": "Seattle",
        "airport_timezone": "America/Los_Angeles",
        "terminal_name": "Concourse B",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 5:00am-11:00pm",
    },
    {
        "airport_iata": "HOU",
        "airport_name": "William P. Hobby Airport",
        "airport_city": "Houston",
        "airport_timezone": "America/Chicago",
        "terminal_name": "Terminal A",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": ["Showers", "Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:30am-10:30pm",
    },
    {
        "airport_iata": "PHX",
        "airport_name": "Phoenix Sky Harbor International Airport",
        "airport_city": "Phoenix",
        "airport_timezone": "America/Phoenix",
        "terminal_name": "Terminal 4",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 5:00am-11:00pm",
    },
    {
        "airport_iata": "DEN",
        "airport_name": "Denver International Airport",
        "airport_city": "Denver",
        "airport_timezone": "America/Denver",
        "terminal_name": "Concourse C",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 5:00am-11:00pm",
    },
    {
        "airport_iata": "LAS",
        "airport_name": "Harry Reid International Airport",
        "airport_city": "Las Vegas",
        "airport_timezone": "America/Los_Angeles",
        "terminal_name": "Concourse D",
        "lounge_name": "The Centurion Lounge",
        "lounge_operator": "American Express",
        "amenities": [
            "Showers",
            "Hot meals",
            "Premium bar",
            "WiFi",
            "Spa services",
        ],
        "operating_hours": "Daily: 6:00am-11:00pm",
    },
]

# ---------------------------------------------------------------------------
# Reference data — Escape Lounges (Centurion Studio Partner) accessible
# to Amex Platinum.  Only US locations.
# ---------------------------------------------------------------------------

_ESCAPE_LOUNGES: list[dict] = [
    {
        "airport_iata": "MSP",
        "airport_name": "Minneapolis-Saint Paul International Airport",
        "airport_city": "Minneapolis",
        "airport_timezone": "America/Chicago",
        "terminal_name": "Terminal 2",
        "lounge_name": "Escape Lounge - The Centurion Studio Partner",
        "lounge_operator": "Escape Lounges",
        "amenities": ["Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:00am-9:00pm",
    },
    {
        "airport_iata": "RNO",
        "airport_name": "Reno-Tahoe International Airport",
        "airport_city": "Reno",
        "airport_timezone": "America/Los_Angeles",
        "terminal_name": "Concourse B",
        "lounge_name": "Escape Lounge - The Centurion Studio Partner",
        "lounge_operator": "Escape Lounges",
        "amenities": ["Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:00am-8:00pm",
    },
    {
        "airport_iata": "OAK",
        "airport_name": "Oakland International Airport",
        "airport_city": "Oakland",
        "airport_timezone": "America/Los_Angeles",
        "terminal_name": "Terminal 1",
        "lounge_name": "Escape Lounge - The Centurion Studio Partner",
        "lounge_operator": "Escape Lounges",
        "amenities": ["Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:00am-9:00pm",
    },
    {
        "airport_iata": "SMF",
        "airport_name": "Sacramento International Airport",
        "airport_city": "Sacramento",
        "airport_timezone": "America/Los_Angeles",
        "terminal_name": "Terminal B",
        "lounge_name": "Escape Lounge - The Centurion Studio Partner",
        "lounge_operator": "Escape Lounges",
        "amenities": ["Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:30am-9:00pm",
    },
    {
        "airport_iata": "CVG",
        "airport_name": "Cincinnati/Northern Kentucky International Airport",
        "airport_city": "Cincinnati",
        "airport_timezone": "America/New_York",
        "terminal_name": "Concourse B",
        "lounge_name": "Escape Lounge - The Centurion Studio Partner",
        "lounge_operator": "Escape Lounges",
        "amenities": ["Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:00am-8:00pm",
    },
    {
        "airport_iata": "BWI",
        "airport_name": "Baltimore/Washington International Airport",
        "airport_city": "Baltimore",
        "airport_timezone": "America/New_York",
        "terminal_name": "Concourse D",
        "lounge_name": "Escape Lounge - The Centurion Studio Partner",
        "lounge_operator": "Escape Lounges",
        "amenities": ["Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:00am-9:00pm",
    },
    {
        "airport_iata": "BNA",
        "airport_name": "Nashville International Airport",
        "airport_city": "Nashville",
        "airport_timezone": "America/Chicago",
        "terminal_name": "Concourse C",
        "lounge_name": "Escape Lounge - The Centurion Studio Partner",
        "lounge_operator": "Escape Lounges",
        "amenities": ["Hot meals", "Premium bar", "WiFi"],
        "operating_hours": "Daily: 5:00am-8:30pm",
    },
]

# ---------------------------------------------------------------------------
# Access-method templates
# ---------------------------------------------------------------------------

_CENTURION_ACCESS_METHODS: list[dict] = [
    {
        "name": "Amex Platinum",
        "category": "Credit Card",
        "provider": "American Express",
        "notes": "Complimentary access for Platinum Card Members",
    },
    {
        "name": "Amex Gold",
        "category": "Credit Card",
        "provider": "American Express",
        "notes": "Access available for Gold Card Members",
    },
]

_ESCAPE_ACCESS_METHODS: list[dict] = [
    {
        "name": "Amex Platinum",
        "category": "Credit Card",
        "provider": "American Express",
        "notes": "Complimentary access for Platinum Card Members",
    },
]

_CENTURION_GUEST_POLICY: dict = {
    "guest_limit": None,  # Unlimited (per spec)
    "guest_fee": CENTURION_GUEST_FEE,
    "guest_conditions": "Guests must be accompanied by Centurion/Platinum Card Member",
}

_ESCAPE_GUEST_POLICY: dict = {
    "guest_limit": 2,
    "guest_fee": CENTURION_GUEST_FEE,
    "guest_conditions": "Up to 2 guests per Card Member",
}


# ===================================================================
# Scraper
# ===================================================================


class AmexLoungeScraper(BaseScraper):
    """Scrape the Amex Global Lounge Collection for accessible lounges.

    Navigates per-airport pages on the new Amex travel site and extracts
    every lounge card.  Falls back to curated reference data for airports
    where live extraction fails.

    CRITICAL: No ``page.evaluate()`` — the Amex site blocks ``eval()``
    via Content Security Policy.  Use locators/query_selector only.
    """

    source_name = "amex"

    def __init__(self, airports: Optional[list[str]] = None) -> None:
        super().__init__()
        self._airports: Optional[list[str]] = (
            [code.upper() for code in airports] if airports else None
        )

    # ------------------------------------------------------------------
    # Core scrape — iterates airports
    # ------------------------------------------------------------------

    async def scrape(self) -> ScrapeResult:
        """Scrape Amex lounge pages for each target airport.

        If ``self._airports`` is set, only those IATA codes are visited.
        Otherwise the scraper uses reference data IATA codes (Centurion +
        Escape locations) as the default airport list.
        """
        result = ScrapeResult(
            source_name=self.source_name,
            scraped_at=datetime.now(timezone.utc),
        )

        airports = self._airports or self._default_airport_codes()
        logger.info("Scraping %d airports: %s", len(airports), airports)

        # Set user-agent on the browser context before creating pages.
        if hasattr(self, "_context") and self._context:
            await self._context.set_extra_http_headers(
                {"User-Agent": _USER_AGENT}
            )

        page = await self.new_page()
        await page.set_extra_http_headers({"User-Agent": _USER_AGENT})
        try:
            for idx, iata_code in enumerate(airports):
                if idx > 0:
                    await asyncio.sleep(NAV_DELAY_SECONDS)

                try:
                    live_records = await self.scrape_airport(page, iata_code)

                    if live_records:
                        logger.info(
                            "[%s] Live extraction found %d records",
                            iata_code,
                            len(live_records),
                        )
                        for raw in live_records:
                            normalized = normalize_lounge_record(raw)
                            normalized["_access_methods"] = raw.get("_access_methods", [])
                            normalized["_guest_policy"] = raw.get("_guest_policy", {})
                            result.records.append(normalized)
                    else:
                        # Fallback to reference data for this airport
                        fallback = self._build_reference_records_for_airport(iata_code)
                        if fallback:
                            logger.warning(
                                "[%s] Live extraction yielded 0 records; "
                                "using %d reference records",
                                iata_code,
                                len(fallback),
                            )
                            result.errors.append(
                                f"[{iata_code}] Live extraction yielded no results; "
                                "using reference data"
                            )
                            for raw in fallback:
                                normalized = normalize_lounge_record(raw)
                                normalized["_access_methods"] = raw.get("_access_methods", [])
                                normalized["_guest_policy"] = raw.get("_guest_policy", {})
                                result.records.append(normalized)
                        else:
                            logger.warning(
                                "[%s] No live or reference data available", iata_code
                            )
                            result.errors.append(
                                f"[{iata_code}] No live or reference data available"
                            )

                except Exception as exc:
                    logger.error(
                        "[%s] Scrape failed, trying reference fallback: %s",
                        iata_code,
                        exc,
                    )
                    fallback = self._build_reference_records_for_airport(iata_code)
                    if fallback:
                        for raw in fallback:
                            normalized = normalize_lounge_record(raw)
                            normalized["_access_methods"] = raw.get("_access_methods", [])
                            normalized["_guest_policy"] = raw.get("_guest_policy", {})
                            result.records.append(normalized)
                    result.errors.append(
                        f"[{iata_code}] Scrape error ({exc}); "
                        + ("used reference data" if fallback else "no reference data available")
                    )

        finally:
            await page.close()

        return result

    # ------------------------------------------------------------------
    # Per-airport scrape
    # ------------------------------------------------------------------

    async def scrape_airport(self, page: Page, iata_code: str) -> list[dict]:
        """Scrape a single airport page and return raw record dicts.

        Args:
            page: An open Playwright page.
            iata_code: 3-letter IATA code (e.g. ``"JFK"``).

        Returns:
            List of raw record dicts ready for normalization, or empty list.
        """
        url = AMEX_AIRPORT_URL_TEMPLATE.format(iata=iata_code)
        logger.info("[%s] Navigating to %s", iata_code, url)

        await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        await page.wait_for_timeout(5_000)  # JS render time

        await self._dismiss_overlays(page)

        # Find lounge card links — each card is an <a> wrapping an <h3>
        all_cards = page.locator("a:has(h3)")
        card_count = await all_cards.count()
        logger.debug("[%s] Found %d card candidates", iata_code, card_count)

        records: list[dict] = []
        iata_path_segment = f"/the-platinum-card/{iata_code}/".lower()

        for i in range(card_count):
            card = all_cards.nth(i)
            try:
                raw = await self._parse_airport_card(card, iata_code, iata_path_segment)
                if raw is not None:
                    records.append(raw)
            except Exception as exc:
                logger.debug("[%s] Card %d parse error: %s", iata_code, i, exc)

        return records

    # ------------------------------------------------------------------
    # Card parsing (CSP-safe — no eval)
    # ------------------------------------------------------------------

    async def _parse_airport_card(
        self,
        card,
        iata_code: str,
        iata_path_segment: str,
    ) -> Optional[dict]:
        """Parse a single lounge card ``<a>`` element.

        Returns a raw record dict or ``None`` if the card should be skipped.
        """
        # Filter: only cards whose href belongs to this airport
        href = (await card.get_attribute("href")) or ""
        if iata_path_segment not in href.lower():
            return None

        # Lounge name from <h3>
        h3 = card.locator("h3").first
        name = ((await h3.text_content()) or "").strip()
        if not name:
            return None

        # Skip lounges from other networks
        if _SKIP_PATTERNS.search(name):
            return None

        # Full card text for terminal / hours extraction
        card_text = ((await card.text_content()) or "").strip()

        # Terminal
        terminal_match = _TERMINAL_RE.search(card_text)
        terminal = terminal_match.group(1) if terminal_match else "Main Terminal"

        # Hours
        hours_match = _HOURS_RE.search(card_text)
        hours_raw = hours_match.group(1) if hours_match else ""

        # The live-scraped hours text is usually a real-time status string
        # like "Open Now • Closes at 11:00pm" which the normalizer can't
        # parse into structured operating hours.  Fall back to reference
        # data for known Centurion / Escape lounges.
        if not hours_raw or hours_raw.startswith(("Open", "Closed")):
            ref_hours = self._get_reference_hours(name, iata_code)
            if ref_hours:
                hours_raw = ref_hours

        # Image URL
        image_url = ""
        img = card.locator("img").first
        try:
            if await img.count() if hasattr(img, "count") else True:
                image_url = (await img.get_attribute("src")) or ""
        except Exception:
            pass

        # Source URL — prepend domain if relative
        source_url = href
        if source_url.startswith("/"):
            source_url = f"https://www.americanexpress.com{source_url}"

        # Venue type
        venue_type = _classify_venue_type(name)

        # Access methods + guest policy
        # Check "escape" first because Escape Lounge names also contain
        # "Centurion" (e.g. "Escape Lounge - The Centurion Studio Partner").
        name_lower = name.lower()
        is_escape = "escape" in name_lower
        is_centurion = "centurion" in name_lower and not is_escape

        if is_escape:
            access_methods = _ESCAPE_ACCESS_METHODS
            guest_policy = _ESCAPE_GUEST_POLICY
            operator = "Escape Lounges"
        elif is_centurion:
            access_methods = _CENTURION_ACCESS_METHODS
            guest_policy = _CENTURION_GUEST_POLICY
            operator = "American Express"
        else:
            # Third-party partner lounge (e.g. Lufthansa Senator)
            access_methods = _CENTURION_ACCESS_METHODS  # Amex Platinum access
            guest_policy = _CENTURION_GUEST_POLICY
            operator = ""  # Unknown operator — let normalizer handle

        return {
            "iata_code": iata_code,
            "airport_iata": iata_code,
            "airport_name": "",
            "airport_city": "",
            "airport_timezone": "UTC",
            "terminal_name": terminal,
            "lounge_name": name,
            "lounge_operator": operator,
            "operating_hours": hours_raw if hours_raw else None,
            "amenities": [],
            "is_restaurant_credit": False,
            "source_url": source_url,
            "image_url": image_url,
            "venue_type": venue_type,
            "_access_methods": access_methods,
            "_guest_policy": guest_policy,
        }

    # ------------------------------------------------------------------
    # Reference hours lookup
    # ------------------------------------------------------------------

    def _get_reference_hours(self, lounge_name: str, iata_code: str) -> Optional[str]:
        """Look up operating hours from reference data for a known lounge.

        Uses substring matching to handle slight name differences between
        the live-scraped card text and the curated reference data.
        """
        lounge_name_lower = lounge_name.lower()
        for ref_lounge in _CENTURION_LOUNGES + _ESCAPE_LOUNGES:
            if ref_lounge.get("airport_iata") != iata_code:
                continue
            ref_name_lower = ref_lounge.get("lounge_name", "").lower()
            if ref_name_lower in lounge_name_lower or lounge_name_lower in ref_name_lower:
                return ref_lounge.get("operating_hours")
        return None

    # ------------------------------------------------------------------
    # Lifecycle override — access rule persistence
    # ------------------------------------------------------------------

    async def run(self, dry_run: bool = False) -> ScrapeResult:
        """Run the scraper, then persist access rules to the DB.

        The base class ``run()`` handles browser lifecycle, scrape-run
        tracking, and lounge upserts.  This override adds a second pass
        that links each lounge to the appropriate Amex access methods.
        """
        result = await super().run(dry_run=dry_run)

        if not dry_run:
            self._persist_access_rules(result.records)

        return result

    # ------------------------------------------------------------------
    # Overlay dismissal (CSP-safe)
    # ------------------------------------------------------------------

    async def _dismiss_overlays(self, page: Page) -> None:
        """Close cookie-consent banners and modal overlays if present."""
        dismiss_selectors = [
            'button[id*="cookie" i]',
            'button[aria-label*="close" i]',
            'button[aria-label*="accept" i]',
            'button:has-text("Accept")',
            'button:has-text("Close")',
            '[data-testid="close-button"]',
            ".modal-close",
        ]
        for selector in dismiss_selectors:
            try:
                btn = page.locator(selector).first
                if await btn.is_visible(timeout=1_500):
                    await btn.click()
                    await asyncio.sleep(0.5)
            except Exception:
                pass  # Overlay not present — move on

    # ------------------------------------------------------------------
    # Default airport list
    # ------------------------------------------------------------------

    def _default_airport_codes(self) -> list[str]:
        """Return the default list of IATA codes to scrape.

        Uses the reference data (Centurion + Escape locations) as
        the canonical set of airports.  Returns a deduplicated,
        sorted list.
        """
        codes = {r["airport_iata"] for r in _CENTURION_LOUNGES} | {
            r["airport_iata"] for r in _ESCAPE_LOUNGES
        }
        return sorted(codes)

    # ------------------------------------------------------------------
    # Reference data builders
    # ------------------------------------------------------------------

    def _build_reference_records(self) -> list[dict]:
        """Produce raw record dicts from curated reference data.

        Each record is enriched with access-method and guest-policy
        metadata used by ``_persist_access_rules``.
        """
        records: list[dict] = []

        for lounge in _CENTURION_LOUNGES:
            record = copy.deepcopy(lounge)
            record["_access_methods"] = _CENTURION_ACCESS_METHODS
            record["_guest_policy"] = _CENTURION_GUEST_POLICY
            records.append(record)

        for lounge in _ESCAPE_LOUNGES:
            record = copy.deepcopy(lounge)
            record["_access_methods"] = _ESCAPE_ACCESS_METHODS
            record["_guest_policy"] = _ESCAPE_GUEST_POLICY
            records.append(record)

        return records

    def _build_reference_records_for_airport(self, iata_code: str) -> list[dict]:
        """Return reference records for a single airport, or empty list."""
        records: list[dict] = []

        for lounge in _CENTURION_LOUNGES:
            if lounge["airport_iata"] == iata_code:
                record = copy.deepcopy(lounge)
                record["_access_methods"] = _CENTURION_ACCESS_METHODS
                record["_guest_policy"] = _CENTURION_GUEST_POLICY
                records.append(record)

        for lounge in _ESCAPE_LOUNGES:
            if lounge["airport_iata"] == iata_code:
                record = copy.deepcopy(lounge)
                record["_access_methods"] = _ESCAPE_ACCESS_METHODS
                record["_guest_policy"] = _ESCAPE_GUEST_POLICY
                records.append(record)

        return records

    # ------------------------------------------------------------------
    # Access-rule persistence
    # ------------------------------------------------------------------

    def _persist_access_rules(self, records: list[dict]) -> None:
        """Create access rules linking upserted lounges to Amex access methods.

        Called after the base-class ``run()`` has already upserted
        airport → terminal → lounge rows.  This method looks up each
        lounge by airport + name, then creates the appropriate access
        rules.
        """
        rules_created = 0

        for record in records:
            access_methods = record.get("_access_methods", [])
            if not access_methods:
                continue

            iata = record.get("airport_iata", "")
            lounge_name = record.get("lounge_name", "")
            guest_policy = record.get("_guest_policy", {})

            if not iata or not lounge_name:
                continue

            # Find the lounge we just upserted
            try:
                lounges = get_lounges_by_airport(iata)
            except Exception as exc:
                logger.error(
                    "Failed to look up lounges at %s for access rules: %s",
                    iata,
                    exc,
                )
                continue

            lounge = next(
                (lg for lg in lounges if lg.name == lounge_name), None
            )
            if lounge is None:
                logger.warning(
                    "Lounge '%s' at %s not found for access rule linkage",
                    lounge_name,
                    iata,
                )
                continue

            for method_info in access_methods:
                try:
                    method_id = upsert_access_method(
                        name=method_info["name"],
                        category=method_info["category"],
                        provider=method_info.get("provider"),
                    )
                    upsert_lounge_access_rule(
                        lounge_id=lounge.id,
                        access_method_id=method_id,
                        guest_limit=guest_policy.get("guest_limit"),
                        guest_fee=guest_policy.get("guest_fee"),
                        guest_conditions=guest_policy.get("guest_conditions"),
                        notes=method_info.get("notes"),
                    )
                    rules_created += 1
                except Exception as exc:
                    logger.error(
                        "Access rule upsert failed for %s / %s: %s",
                        lounge_name,
                        method_info["name"],
                        exc,
                    )

        logger.info("Access rules created/updated: %d", rules_created)
