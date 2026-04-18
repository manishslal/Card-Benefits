"""Priority Pass lounge scraper.

Scrapes the Priority Pass website for US airport lounges using Playwright.
Searches by IATA code, extracts lounge cards from results, and links each
lounge to the "Priority Pass Select" access method.

The site uses a two-step search interaction:
  1. Click the search trigger button to reveal the search overlay/input.
  2. Type the IATA code into the now-visible input field.

All DOM interactions use CSS selectors (not stored ElementHandles) to avoid
"Element is not attached to the DOM" errors when elements are re-rendered.

Usage:
    python scrapers/run_priority_pass.py --dry-run
    python scrapers/run_priority_pass.py --airports JFK LAX MIA
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from urllib.parse import urlparse, parse_qs, unquote

from playwright.async_api import Page, TimeoutError as PlaywrightTimeout

from .base_scraper import BaseScraper, ScrapeResult
from .database import get_cursor
from .normalizer import normalize_lounge_record
from .repository import upsert_lounge_access_rule
from .us_airports import US_AIRPORTS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.prioritypass.com/en-GB/airport-lounges"
DELAY_BETWEEN_AIRPORTS = 3  # seconds minimum between airport searches
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

# Regex for restaurant/dining credit detection.
_RESTAURANT_RE = re.compile(r"restaurant|dining\s*credit", re.IGNORECASE)


def _classify_venue_type(name: str) -> str:
    """Classify venue type from lounge name keywords."""
    name_lower = name.lower()
    if any(kw in name_lower for kw in ['spa', 'massage', 'relax']):
        return 'spa'
    if any(kw in name_lower for kw in ['sleep', 'nap', 'rest pod', 'rest suite', 'snooze', 'pod']):
        return 'sleep'
    if any(kw in name_lower for kw in ['game', 'gaming', 'play']):
        return 'gaming'
    if any(kw in name_lower for kw in ['dine', 'dining', 'restaurant', 'bistro', 'cafe', 'café', 'bar & grill', 'eatery']):
        return 'dining'
    if any(kw in name_lower for kw in ['wellness', 'fitness', 'gym']):
        return 'wellness'
    return 'lounge'

# -- Step 1: The search trigger button (visible on initial page load).
# Clicking this reveals the search input overlay.
_SEARCH_TRIGGER_SELECTOR = "#find-lounges-and-more"
_SEARCH_TRIGGER_FALLBACK = '[data-testid="open-search-button"]'

# -- Step 2: The text input (appears AFTER clicking the trigger).
_SEARCH_INPUT_SELECTOR = 'input[data-testid="lounge-search-input"]'
_SEARCH_INPUT_FALLBACK = 'input[aria-label="lounge-search"]'

# Selectors tried in order when looking for the search input (legacy compat).
_SEARCH_INPUT_SELECTORS = [
    _SEARCH_INPUT_SELECTOR,
    _SEARCH_INPUT_FALLBACK,
    'input[placeholder*="airport" i]',
    'input[type="search"]',
]

# -- Step 3: Autocomplete suggestion results.
_AUTOCOMPLETE_SELECTORS = [
    '[class*="LoungeSearchResults_item"]',
    'a[class*="LoungeSearchResults_content"]',
    '[role="option"]',
    '[role="listbox"] li',
    '[class*="suggestion"]',
    '[class*="autocomplete"] li',
]

# -- Cookie consent banner dismiss button.
_COOKIE_ACCEPT_SELECTOR = "#onetrust-accept-btn-handler"

# -- Lounge cards on the airport page.
_LOUNGE_CARD_SELECTORS = [
    '[data-testid*="lounge"]',
    '[class*="LoungeCard"]:not(span)',  # container cards, not badge spans
    '[class*="lounge-card"]',
    "article",  # broadest fallback last
]

# -- Lounge name inside a card.
_NAME_SELECTORS = ["h4", "h3", "h2", '[class*="name"]', '[class*="title"]']

# -- Terminal info inside a card.
_TERMINAL_SELECTORS = [
    '[data-testid="outlet-card-terminal"]',
    '[class*="terminal"]',
]

# -- Operating hours inside a card.
_HOURS_SELECTORS = [
    '[class*="hours"]',
    '[class*="time"]',
    '[class*="schedule"]',
]

# -- Amenities inside a card.
_AMENITY_SELECTORS = [
    '[class*="amenit"] li',
    '[class*="feature"] li',
    '[class*="facility"] li',
]


class PriorityPassScraper(BaseScraper):
    """Scrape Priority Pass lounges by searching for each IATA code."""

    source_name = "priority_pass"

    def __init__(self) -> None:
        super().__init__()
        self.airport_codes: Optional[list[str]] = None
        self._cookie_dismissed: bool = False
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    # ------------------------------------------------------------------
    # Lifecycle override — custom user agent + access rule persistence
    # ------------------------------------------------------------------

    async def run(
        self,
        dry_run: bool = False,
        airport_codes: Optional[list[str]] = None,
    ) -> ScrapeResult:
        """Run the scraper with custom user agent, then persist access rules.

        The base-class ``run()`` handles browser lifecycle, scrape-run
        tracking, and lounge upserts.  This override:
        1. Stores *airport_codes* for ``scrape()`` to consume.
        2. Delegates to ``super().run()`` for the standard lifecycle.
        3. Links each scraped lounge to "Priority Pass Select".
        """
        self.airport_codes = airport_codes
        result = await super().run(dry_run=dry_run)

        if not dry_run and result.records:
            self._persist_access_rules(result.records)

        return result

    # ------------------------------------------------------------------
    # Core scrape implementation
    # ------------------------------------------------------------------

    async def scrape(self) -> ScrapeResult:
        """Search Priority Pass for each IATA code, extract lounge cards."""
        result = ScrapeResult(
            source_name=self.source_name,
            scraped_at=datetime.now(timezone.utc),
        )

        # Determine which IATA codes to process.
        codes = self._get_iata_codes()
        if not codes:
            self.logger.warning("No IATA codes to process")
            return result

        self.logger.info("Processing %d airport(s): %s", len(codes), codes)

        page: Optional[Page] = None
        try:
            # Set custom user agent on the browser context created by
            # BaseScraper.run() before opening any pages.
            if hasattr(self, "_context") and self._context:
                # Playwright contexts are immutable after creation, but
                # new_page() inherits from the context.  We monkey-patch
                # via route to set the UA header on every request.
                await self._context.set_extra_http_headers(
                    {"User-Agent": USER_AGENT}
                )

            page = await self.new_page()
            await page.set_extra_http_headers({"User-Agent": USER_AGENT})
            await page.add_init_script(f"""
                Object.defineProperty(navigator, 'userAgent', {{
                    get: () => '{USER_AGENT}'
                }});
            """)

            # Navigate to the base URL once to establish session cookies.
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            for iata_code in codes:
                try:
                    records, errors = await self.scrape_airport(page, iata_code)
                    result.records.extend(records)
                    result.errors.extend(errors)
                    self.logger.info(
                        "[%s] Found %d lounge(s)", iata_code, len(records)
                    )
                except Exception as exc:
                    msg = f"[{iata_code}] {exc}"
                    self.logger.error(msg)
                    result.errors.append(msg)

                await asyncio.sleep(DELAY_BETWEEN_AIRPORTS)

        except Exception as exc:
            msg = f"Fatal error during Priority Pass scrape: {exc}"
            self.logger.error(msg)
            result.errors.append(msg)
        finally:
            if page is not None:
                await page.close()

        return result

    # ------------------------------------------------------------------
    # Per-airport scraping
    # ------------------------------------------------------------------

    async def scrape_airport(
        self, page: Page, iata_code: str
    ) -> tuple[list[dict], list[str]]:
        """Search for an airport by IATA code and extract lounge cards.

        Uses a two-step search flow:
          1. Click the search trigger button to reveal the search overlay.
          2. Type the IATA code into the now-visible text input.

        All DOM interactions use CSS selectors (via ``page.click()``,
        ``page.fill()``, etc.) rather than stored ElementHandle references
        to prevent "Element is not attached to the DOM" errors.

        Returns a tuple of (normalised lounge records, error messages).
        """
        errors: list[str] = []

        # Step 1 — Navigate back to the search page.
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)

        # Step 1a — Dismiss cookie consent banner if present.
        await self._dismiss_cookie_banner(page)

        # Step 2 — Click the search trigger button to reveal the input.
        trigger_clicked = False
        for trigger_sel in (_SEARCH_TRIGGER_SELECTOR, _SEARCH_TRIGGER_FALLBACK):
            try:
                el = await page.query_selector(trigger_sel)
                if el:
                    await page.click(trigger_sel)
                    trigger_clicked = True
                    self.logger.debug(
                        "[%s] Clicked search trigger: %s", iata_code, trigger_sel
                    )
                    break
            except Exception:
                continue

        if not trigger_clicked:
            msg = f"[{iata_code}] Search trigger button not found"
            self.logger.error(msg)
            return [], [msg]

        # Step 3 — Wait for the search input to appear, then type.
        search_input_sel = None
        for selector in _SEARCH_INPUT_SELECTORS:
            try:
                await page.wait_for_selector(
                    selector, state="visible", timeout=5000
                )
                search_input_sel = selector
                break
            except PlaywrightTimeout:
                continue

        if not search_input_sel:
            msg = f"[{iata_code}] Search input not found"
            self.logger.error(msg)
            return [], [msg]

        # Use selector-based fill/type — never store an ElementHandle.
        await page.fill(search_input_sel, "")
        await page.wait_for_timeout(300)
        await page.type(search_input_sel, iata_code, delay=150)
        await page.wait_for_timeout(2500)

        # Step 4 — Handle autocomplete suggestions.
        suggestions = []
        best_selector = ""
        for selector in _AUTOCOMPLETE_SELECTORS:
            suggestions = await page.query_selector_all(selector)
            # Filter to only visible suggestions.
            visible = []
            for s in suggestions:
                try:
                    if await s.is_visible():
                        visible.append(s)
                except Exception:
                    pass
            if visible:
                suggestions = visible
                best_selector = selector
                break
        else:
            suggestions = []

        if not suggestions:
            msg = f"[{iata_code}] No autocomplete results"
            self.logger.error(msg)
            return [], [msg]

        # Pick the best suggestion — prefer one mentioning the IATA code.
        chosen = suggestions[0]
        best_index = 0
        for idx, suggestion in enumerate(suggestions):
            text = (await suggestion.text_content() or "").upper()
            if iata_code.upper() in text:
                chosen = suggestion
                best_index = idx
                break
        else:
            # No suggestion contained the IATA code; use first and warn.
            first_text = await suggestions[0].text_content() or ""
            self.logger.warning(
                "[%s] No suggestion contains IATA code, using first: '%s'",
                iata_code,
                first_text.strip(),
            )

        # Navigate via href or text-based click — avoids stale ElementHandle.
        href = await chosen.evaluate('el => el.querySelector("a")?.href || ""')
        if href:
            self.logger.debug("[%s] Navigating to suggestion href: %s", iata_code, href)
            await page.goto(href, wait_until="domcontentloaded", timeout=60000)
        else:
            # Fallback: get suggestion text and click by text
            suggestion_text = (await chosen.text_content() or "").strip()
            if suggestion_text:
                await page.click(f"text={suggestion_text}")
            else:
                # Last resort: click the nth suggestion using a selector
                await page.click(f"{best_selector} >> nth={best_index}")
        await page.wait_for_timeout(5000)

        # Step 5 — Verify we landed on a results page.
        current_url = page.url
        looks_like_search = current_url.rstrip("/") == BASE_URL.rstrip("/")
        if looks_like_search:
            msg = f"[{iata_code}] Unexpected redirect: {current_url}"
            self.logger.error(msg)
            return [], [msg]

        # Step 6 — Extract lounge cards.
        cards = []
        for selector in _LOUNGE_CARD_SELECTORS:
            cards = await page.query_selector_all(selector)
            if cards:
                self.logger.debug(
                    "[%s] Found %d card(s) via %s", iata_code, len(cards), selector,
                )
                break

        if not cards:
            msg = f"[{iata_code}] No lounge cards found"
            self.logger.warning(msg)
            return [], [msg]

        records: list[dict] = []
        for card in cards:
            try:
                record = await self.extract_lounge_data(card, iata_code)
                if record and record.get("lounge_name"):
                    records.append(record)
            except Exception as exc:
                msg = f"[{iata_code}] Card extraction error: {exc}"
                self.logger.warning(msg)
                errors.append(msg)

        return records, errors

    # ------------------------------------------------------------------
    # Cookie banner helper
    # ------------------------------------------------------------------

    async def _dismiss_cookie_banner(self, page: Page) -> None:
        """Dismiss the OneTrust cookie consent banner if present."""
        if self._cookie_dismissed:
            return
        try:
            btn = await page.query_selector(_COOKIE_ACCEPT_SELECTOR)
            if btn:
                await page.click(_COOKIE_ACCEPT_SELECTOR)
                await page.wait_for_timeout(500)
                self._cookie_dismissed = True
                self.logger.debug("Cookie consent banner dismissed")
        except Exception:
            pass  # Banner may not be present; that's fine.

    # ------------------------------------------------------------------
    # Card-level data extraction
    # ------------------------------------------------------------------

    async def extract_lounge_data(
        self,
        card,
        iata_code: str,
    ) -> dict:
        """Extract lounge information from a single card element.

        Returns a normalised dict ready for DB upsert.
        """
        # Airport metadata from US_AIRPORTS lookup.
        airport_meta = US_AIRPORTS.get(iata_code.upper(), {})

        raw: dict = {
            "airport_iata": iata_code.upper(),
            "airport_name": airport_meta.get("name", ""),
            "airport_timezone": airport_meta.get("timezone", ""),
            "airport_city": airport_meta.get("city", ""),
            "lounge_name": "",
            "terminal_name": "",
            "location_details": "",
            "lounge_operator": "Priority Pass",
            "operating_hours": "",
            "amenities": [],
            "is_restaurant_credit": False,
            "may_deny_entry": False,
        }

        # --- Lounge name ---
        for selector in _NAME_SELECTORS:
            el = await card.query_selector(selector)
            if el:
                text = (await el.text_content() or "").strip()
                if text:
                    raw["lounge_name"] = text
                    break

        # --- Terminal ---
        # First try elements with terminal-related classes / data-testid.
        for selector in _TERMINAL_SELECTORS:
            el = await card.query_selector(selector)
            if el:
                text = (await el.text_content() or "").strip()
                if text:
                    raw["terminal_name"] = text
                    break

        # Fallback: scan full card text for "Terminal ..." pattern.
        if not raw["terminal_name"]:
            card_text = (await card.text_content() or "")
            m = re.search(
                r"Terminal\s+([A-Za-z0-9]+(?:\s*[-/]\s*[A-Za-z0-9]+)?)",
                card_text,
            )
            if m:
                raw["terminal_name"] = f"Terminal {m.group(1)}"

        # --- Location details ---
        for selector in ['[class*="location"]', '[class*="address"]']:
            el = await card.query_selector(selector)
            if el:
                text = (await el.text_content() or "").strip()
                if text:
                    raw["location_details"] = text
                    break

        # --- Operating hours ---
        # First try known class selectors.
        for selector in _HOURS_SELECTORS:
            el = await card.query_selector(selector)
            if el:
                text = (await el.text_content() or "").strip()
                if text:
                    raw["operating_hours"] = text
                    break

        # Fallback: extract from inner text using "Hours:" pattern.
        if not raw["operating_hours"]:
            inner_text = (await card.text_content() or "")
            m = re.search(r"Hours:\s*([^\n]+)", inner_text)
            if m:
                hours_val = m.group(1).strip()
                if hours_val:
                    raw["operating_hours"] = f"Hours: {hours_val}"

        # --- Amenities ---
        amenities: list[str] = []
        for selector in _AMENITY_SELECTORS:
            items = await card.query_selector_all(selector)
            if items:
                for item in items:
                    text = (await item.text_content() or "").strip()
                    if text:
                        amenities.append(text)
                break
        raw["amenities"] = amenities

        # --- Restaurant credit detection ---
        full_text = (await card.text_content() or "").lower()
        if _RESTAURANT_RE.search(full_text):
            raw["is_restaurant_credit"] = True

        # --- Source URL — from parent <a> wrapping the card ---
        source_url = ""
        # The <a> wraps the <article>, so check parentElement
        parent_href = await card.evaluate(
            'el => el.parentElement?.tagName === "A"'
            " ? el.parentElement.href"
            ' : (el.closest("a")?.href || "")'
        )
        if parent_href:
            if parent_href.startswith("/"):
                source_url = f"https://www.prioritypass.com{parent_href}"
            else:
                source_url = parent_href
        # Fallback: also check inside the card (for any future layout changes)
        if not source_url:
            link_el = await card.query_selector("a[href]")
            if link_el:
                href = await link_el.get_attribute("href")
                if href:
                    source_url = (
                        f"https://www.prioritypass.com{href}"
                        if href.startswith("/")
                        else href
                    )
        raw["source_url"] = source_url

        # --- Image URL — extract actual CDN URL from Next.js image wrapper ---
        image_url = ""
        img_el = await card.query_selector(
            'img[data-testid="outlet-card-image"], img[src], img[srcset]'
        )
        if img_el:
            src = await img_el.get_attribute("src") or ""
            # Next.js wraps images: /_next/image?url=<encoded_url>&w=...
            # Extract the actual CDN URL.
            if "/_next/image" in src and "url=" in src:
                parsed = urlparse(src)
                qs = parse_qs(parsed.query)
                if "url" in qs:
                    image_url = unquote(qs["url"][0])
            if not image_url:
                # Fallback: use src as-is, make absolute
                image_url = src
            if image_url and image_url.startswith("/"):
                image_url = f"https://www.prioritypass.com{image_url}"
        raw["image_url"] = image_url

        # --- Venue type — classify from lounge name ---
        venue_type = _classify_venue_type(raw["lounge_name"])
        raw["venue_type"] = venue_type

        # --- Enhanced operating hours extraction ---
        if not raw["operating_hours"]:
            for selector in ['[class*="hours"]', '[class*="Hours"]', '[class*="time"]', '[data-testid*="hours"]']:
                el = await card.query_selector(selector)
                if el:
                    hours_text = (await el.text_content() or "").strip()
                    if hours_text:
                        raw["operating_hours"] = hours_text
                        break
            if not raw["operating_hours"]:
                # Try to find text containing time patterns like "07:00" or "Hours:"
                all_text = await card.text_content() or ""
                hours_match = re.search(
                    r'(?:hours?|open|times?)[:\s]*(\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})',
                    all_text, re.IGNORECASE,
                )
                if hours_match:
                    raw["operating_hours"] = hours_match.group(0)

        return normalize_lounge_record(raw)

    # ------------------------------------------------------------------
    # Access-rule persistence
    # ------------------------------------------------------------------

    def _persist_access_rules(self, records: list[dict]) -> None:
        """Link all scraped lounges to the Priority Pass Select access method.

        Called after ``super().run()`` has already upserted
        airport → terminal → lounge rows.
        """
        rules_created = 0

        with get_cursor() as cur:
            # Find the Priority Pass Select access method.
            cur.execute(
                "SELECT id FROM lounge_access_methods WHERE name = %s",
                ("Priority Pass Select",),
            )
            row = cur.fetchone()
            if not row:
                self.logger.error(
                    "Priority Pass Select access method not found in DB"
                )
                return
            access_method_id = row["id"]

            for record in records:
                iata = record.get("airport_iata", "")
                lounge_name = record.get("lounge_name", "")
                if not iata or not lounge_name:
                    continue

                # Look up the lounge by airport IATA + lounge name.
                cur.execute(
                    """
                    SELECT l.id FROM lounges l
                    JOIN lounge_terminals lt ON lt.id = l.terminal_id
                    JOIN lounge_airports la ON la.id = lt.airport_id
                    WHERE la.iata_code = %s AND l.name = %s
                    """,
                    (iata, lounge_name),
                )
                lounge_row = cur.fetchone()
                if not lounge_row:
                    self.logger.warning(
                        "Lounge not found for access rule: %s - %s",
                        iata,
                        lounge_name,
                    )
                    continue

                try:
                    upsert_lounge_access_rule(
                        lounge_id=lounge_row["id"],
                        access_method_id=access_method_id,
                        entry_cost=Decimal("0.00"),
                    )
                    rules_created += 1
                except Exception as exc:
                    self.logger.error(
                        "Access rule upsert failed for %s / %s: %s",
                        iata,
                        lounge_name,
                        exc,
                    )

        self.logger.info("Access rules created/updated: %d", rules_created)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_iata_codes(self) -> list[str]:
        """Return the list of IATA codes to scrape.

        Uses explicitly provided codes if available, otherwise queries
        the ``lounge_airports`` table for all seeded codes.
        """
        if self.airport_codes:
            return [c.upper() for c in self.airport_codes]

        try:
            with get_cursor() as cur:
                cur.execute(
                    "SELECT iata_code FROM lounge_airports ORDER BY iata_code"
                )
                return [row["iata_code"] for row in cur.fetchall()]
        except Exception as exc:
            self.logger.error("Failed to query airport codes from DB: %s", exc)
            return []
