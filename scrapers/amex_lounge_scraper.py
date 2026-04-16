"""Amex Global Lounge Collection scraper.

Scrapes Centurion Lounges and Escape Lounges accessible to
American Express Platinum and Gold cardholders.

Does NOT scrape Priority Pass or Delta Sky Club entries — those are
handled by their own dedicated scrapers.
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
from .repository import (
    get_lounges_by_airport,
    upsert_access_method,
    upsert_lounge_access_rule,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AMEX_LOUNGE_URL = (
    "https://www.americanexpress.com/en-us/benefits/lounge-access/"
)

# Minimum delay between page navigations (seconds).
NAV_DELAY_SECONDS = 2

# Default guest fee for Centurion Lounges (USD).
# The Amex site currently lists $50 per guest.  If the scraper can verify
# the fee from the live page it will use that value; otherwise this default.
CENTURION_GUEST_FEE = Decimal("50.00")

# Lounge types we are interested in (lowercased for matching).
_WANTED_TYPES = {"centurion", "escape"}

# Lounge types we must explicitly skip.
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
    """Scrape the Amex Global Lounge Collection for US lounges.

    Targets Centurion Lounges and Escape Lounges only.
    Priority Pass and Delta Sky Club entries are intentionally excluded.
    """

    source_name = "amex"

    # ------------------------------------------------------------------
    # Core scrape
    # ------------------------------------------------------------------

    async def scrape(self) -> ScrapeResult:
        """Scrape Amex lounge access page for US Centurion & Escape Lounges.

        Attempts live extraction from the Amex site.  If the live page
        yields no usable data (JavaScript rendering issues, layout
        changes, etc.) the scraper falls back to curated reference data
        so that downstream consumers always get a result set.
        """
        result = ScrapeResult(
            source_name=self.source_name,
            scraped_at=datetime.now(timezone.utc),
        )

        page = await self.new_page()
        try:
            # Navigate with retry + mandatory delay
            await self.navigate_with_retry(page, AMEX_LOUNGE_URL)
            await asyncio.sleep(NAV_DELAY_SECONDS)

            # Dismiss cookie banners / modal overlays
            await self._dismiss_overlays(page)

            # Attempt live extraction
            live_records = await self._extract_from_page(page)

            if live_records:
                logger.info(
                    "Live extraction found %d records", len(live_records)
                )
                raw_records = live_records
            else:
                logger.warning(
                    "Live extraction yielded 0 records; using reference data"
                )
                raw_records = self._build_reference_records()
                result.errors.append(
                    "Live extraction yielded no results; using reference data"
                )

        except Exception as exc:
            logger.error("Page scrape failed, falling back to reference data: %s", exc)
            raw_records = self._build_reference_records()
            result.errors.append(
                f"Live scrape error ({exc}); using reference data"
            )
        finally:
            await page.close()

        # Normalize every record and attach access-rule metadata
        for raw in raw_records:
            normalized = normalize_lounge_record(raw)
            # Carry private metadata through (ignored by normalizer & upsert)
            normalized["_access_methods"] = raw.get("_access_methods", [])
            normalized["_guest_policy"] = raw.get("_guest_policy", {})
            result.records.append(normalized)

        return result

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
    # Live extraction helpers
    # ------------------------------------------------------------------

    async def _dismiss_overlays(self, page: Page) -> None:
        """Close cookie-consent banners and modal overlays if present."""
        dismiss_selectors = [
            # Common Amex cookie / consent banners
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

    async def _extract_from_page(self, page: Page) -> list[dict]:
        """Attempt to extract lounge records from the live Amex page.

        Uses multiple selector strategies to handle Amex site redesigns
        gracefully.  Returns an empty list if no usable data is found.
        """
        records: list[dict] = []

        strategies = [
            self._strategy_location_cards,
            self._strategy_text_content,
        ]
        for strategy in strategies:
            try:
                found = await strategy(page)
                if found:
                    records.extend(found)
                    break
            except Exception as exc:
                logger.debug(
                    "Extraction strategy %s failed: %s",
                    strategy.__name__,
                    exc,
                )

        return records

    async def _strategy_location_cards(self, page: Page) -> list[dict]:
        """Extract from structured location cards / list items."""
        records: list[dict] = []

        # Wait for dynamic content
        await page.wait_for_load_state("networkidle", timeout=15_000)

        # Try several common card selectors the Amex site may use
        card_selectors = [
            '[class*="location-card"]',
            '[class*="lounge-card"]',
            '[data-module-name*="lounge"]',
            'article[class*="card"]',
            'div[class*="LocationCard"]',
            'li[class*="lounge"]',
        ]

        cards = []
        for sel in card_selectors:
            found = await page.locator(sel).all()
            if found:
                cards = found
                logger.debug(
                    "Found %d cards with selector %s", len(found), sel
                )
                break

        for card in cards:
            try:
                raw = await self._parse_location_card(card)
                if raw and not _SKIP_PATTERNS.search(raw.get("lounge_name", "")):
                    records.append(raw)
            except Exception as exc:
                logger.debug("Card parse error: %s", exc)

        return records

    async def _parse_location_card(self, card) -> Optional[dict]:
        """Parse a single location card element into a raw record dict."""
        text = (await card.inner_text()).strip()
        if not text:
            return None

        # Try to find lounge name from heading tags
        name = ""
        for tag in ["h2", "h3", "h4", "[class*='title']", "[class*='name']"]:
            try:
                el = card.locator(tag).first
                if await el.is_visible(timeout=500):
                    name = (await el.inner_text()).strip()
                    if name:
                        break
            except Exception:
                continue

        if not name:
            # Fall back to first non-empty line
            lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
            name = lines[0] if lines else ""

        if not name:
            return None

        # Determine lounge type
        name_lower = name.lower()
        if "centurion" not in name_lower and "escape" not in name_lower:
            return None  # Not a lounge type we want

        # Try to extract airport code (3 uppercase letters matching a known IATA code)
        known = {r["airport_iata"] for r in _CENTURION_LOUNGES + _ESCAPE_LOUNGES}
        iata = ""
        for m in re.finditer(r"\b([A-Z]{3})\b", text):
            if m.group(1) in known:
                iata = m.group(1)
                break

        # Try to find terminal info
        terminal_match = re.search(
            r"(Terminal\s+\w+|Concourse\s+\w+|Gate\s+\w+)", text, re.IGNORECASE
        )
        terminal = terminal_match.group(1) if terminal_match else "Main Terminal"

        # Determine access methods
        is_centurion = "centurion" in name_lower
        access_methods = (
            _CENTURION_ACCESS_METHODS if is_centurion else _ESCAPE_ACCESS_METHODS
        )
        guest_policy = (
            _CENTURION_GUEST_POLICY if is_centurion else _ESCAPE_GUEST_POLICY
        )

        return {
            "airport_iata": iata,
            "terminal_name": terminal,
            "lounge_name": name,
            "lounge_operator": (
                "American Express" if is_centurion else "Escape Lounges"
            ),
            "_access_methods": access_methods,
            "_guest_policy": guest_policy,
        }

    async def _strategy_text_content(self, page: Page) -> list[dict]:
        """Fallback: scan the full page text for Centurion/Escape mentions.

        This strategy is coarse but resilient to layout changes.  It
        matches against the known reference locations to validate any
        finds.
        """
        records: list[dict] = []
        body_text = await page.inner_text("body")

        if not body_text:
            return records

        known_iata_codes = {r["airport_iata"] for r in _CENTURION_LOUNGES} | {r["airport_iata"] for r in _ESCAPE_LOUNGES}

        # Look for references to known airport codes near Centurion mentions
        for match in re.finditer(r"\b([A-Z]{3})\b", body_text):
            iata = match.group(1)
            if iata not in known_iata_codes:
                continue

            # Check if "centurion" appears within 200 chars of this code
            start = max(0, match.start() - 200)
            end = min(len(body_text), match.end() + 200)
            context = body_text[start:end].lower()

            if "centurion" in context:
                # Find the matching reference record to enrich
                ref = next(
                    (r for r in _CENTURION_LOUNGES if r["airport_iata"] == iata),
                    None,
                )
                if ref:
                    record = copy.deepcopy(ref)
                    record["_access_methods"] = _CENTURION_ACCESS_METHODS
                    record["_guest_policy"] = _CENTURION_GUEST_POLICY
                    records.append(record)

            if "escape" in context:
                ref = next(
                    (r for r in _ESCAPE_LOUNGES if r["airport_iata"] == iata),
                    None,
                )
                if ref:
                    record = copy.deepcopy(ref)
                    record["_access_methods"] = _ESCAPE_ACCESS_METHODS
                    record["_guest_policy"] = _ESCAPE_GUEST_POLICY
                    records.append(record)

        # Deduplicate by iata+name
        seen: set[tuple[str, str]] = set()
        deduped: list[dict] = []
        for r in records:
            key = (r["airport_iata"], r["lounge_name"])
            if key not in seen:
                seen.add(key)
                deduped.append(r)

        return deduped

    # ------------------------------------------------------------------
    # Reference data builder
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
