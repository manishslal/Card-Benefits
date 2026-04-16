"""Oneworld lounge finder scraper.

Scrapes https://www.oneworld.com/flight-options/oneworld-lounges filtered to United States.
Extracts lounge name, airline operator, airport IATA, terminal, and access rules
broken down by ticket class (First, Business) and status tier (Emerald).

Access rules always include ``{"requires_same_day_flight": true}`` since this
is universally true for airline-owned/operated lounges.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone

from scrapers.base_scraper import BaseScraper, ScrapeResult
from scrapers.us_airports import US_AIRPORTS

logger = logging.getLogger(__name__)

# Selector constants — isolated for easy maintenance when the site changes.
_COUNTRY_FILTER_SELECTOR = (
    'select[name="country"], '
    '[data-testid="country-filter"], '
    '#country-select'
)
_LOUNGE_CARD_SELECTOR = (
    '.lounge-card, .lounge-item, '
    '[data-testid="lounge-result"], '
    '.lounge-listing'
)
_LOUNGE_NAME_SELECTOR = '.lounge-name, .lounge-title, h3, h2'
_AIRLINE_SELECTOR = '.airline-name, .operator, .lounge-operator, .airline'
_AIRPORT_SELECTOR = '.airport-code, .iata-code, [data-iata], .airport'
_TERMINAL_SELECTOR = '.terminal, .terminal-info, .location'
_ACCESS_INFO_SELECTOR = '.access-info, .eligibility, .access-rules, .lounge-access'

_IATA_RE = re.compile(r"\b([A-Z]{3})\b")


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


class OneworldScraper(BaseScraper):
    """Scrape Oneworld lounge finder for US lounges.

    Target URL: https://www.oneworld.com/flight-options/oneworld-lounges
    """

    source_name = "oneworld"

    # Navigation delay between page loads (seconds).
    NAV_DELAY: float = 2.0

    async def scrape(self) -> ScrapeResult:
        """Navigate the Oneworld lounge finder, filter to US,
        and extract lounge records with access rules.
        """
        result = ScrapeResult(
            source_name=self.source_name,
            scraped_at=datetime.now(timezone.utc),
        )

        page = await self.new_page()

        try:
            url = "https://www.oneworld.com/flight-options/oneworld-lounges"
            await self.navigate_with_retry(page, url)
            await asyncio.sleep(self.NAV_DELAY)

            # --- Apply country filter ---
            await self._select_country(page, "United States")
            await asyncio.sleep(self.NAV_DELAY)

            # --- Wait for results to render ---
            await page.wait_for_selector(
                _LOUNGE_CARD_SELECTOR,
                timeout=15_000,
                state="attached",
            )

            # --- Scrape all visible lounge cards ---
            lounge_elements = await page.query_selector_all(_LOUNGE_CARD_SELECTOR)
            logger.info("Found %d lounge elements on page", len(lounge_elements))

            seen: set[tuple[str, str]] = set()
            for idx, el in enumerate(lounge_elements):
                try:
                    record = await self._parse_lounge_card(el)
                    if record:
                        key = (record["airport_iata"], record["lounge_name"])
                        if key not in seen:
                            seen.add(key)
                            result.records.append(record)
                except Exception as exc:
                    msg = f"Failed to parse lounge card {idx}: {exc}"
                    logger.warning(msg)
                    result.errors.append(msg)

            # --- Handle pagination ---
            await self._handle_pagination(page, result, seen)

        except Exception as exc:
            msg = f"Oneworld scrape error: {exc}"
            logger.error(msg)
            result.errors.append(msg)
        finally:
            await page.close()

        logger.info(
            "OneworldScraper finished: %d records, %d errors",
            len(result.records),
            len(result.errors),
        )
        return result

    # -- Private helpers --------------------------------------------------

    async def _select_country(self, page, country: str) -> None:
        """Apply the country filter on the lounge finder page."""
        try:
            # Try native <select> first
            select = await page.query_selector(_COUNTRY_FILTER_SELECTOR)
            if select:
                tag = await select.evaluate("el => el.tagName.toLowerCase()")
                if tag == "select":
                    await select.select_option(label=country)
                    return

            # Fallback: clickable dropdown / search input
            filter_input = await page.query_selector(
                'input[placeholder*="country" i], input[aria-label*="country" i]'
            )
            if filter_input:
                await filter_input.click()
                await filter_input.fill(country)
                await asyncio.sleep(1)
                option = await page.query_selector(
                    f'li:has-text("{country}"), [role="option"]:has-text("{country}")'
                )
                if option:
                    await option.click()
                    return

            # Last resort: URL parameter
            logger.info("Falling back to URL parameter for country filter")
            await self.navigate_with_retry(
                page,
                "https://www.oneworld.com/flight-options/oneworld-lounges?country=US",
            )
        except Exception as exc:
            logger.warning("Country filter failed, continuing without filter: %s", exc)

    async def _parse_lounge_card(self, el) -> dict | None:
        """Extract a lounge record dict from a single DOM card element."""
        text = (await el.inner_text()).strip()
        if not text:
            return None

        # Lounge name
        name_el = await el.query_selector(_LOUNGE_NAME_SELECTOR)
        lounge_name = (await name_el.inner_text()).strip() if name_el else text.split("\n")[0].strip()

        # Airline operator
        operator_el = await el.query_selector(_AIRLINE_SELECTOR)
        operator = (await operator_el.inner_text()).strip() if operator_el else None

        # Airport IATA
        iata = ""
        iata_el = await el.query_selector(_AIRPORT_SELECTOR)
        if iata_el:
            iata_attr = await iata_el.get_attribute("data-iata")
            if iata_attr:
                iata = iata_attr.strip().upper()
            else:
                iata = _extract_iata(await iata_el.inner_text())
        if not iata:
            iata = _extract_iata(text)

        if not iata:
            logger.debug("Skipping lounge with no IATA: %s", lounge_name)
            return None

        # Terminal
        terminal_el = await el.query_selector(_TERMINAL_SELECTOR)
        terminal = (await terminal_el.inner_text()).strip() if terminal_el else "Main Terminal"

        # Access eligibility text
        access_el = await el.query_selector(_ACCESS_INFO_SELECTOR)
        access_text = (await access_el.inner_text()).strip() if access_el else ""

        # Airport metadata from lookup
        airport_meta = US_AIRPORTS.get(iata, {"name": "", "city": ""})

        # Build access rules
        access_rules = build_access_rules(lounge_name, access_text)

        return {
            "airport_iata": iata,
            "airport_name": airport_meta["name"],
            "airport_city": airport_meta["city"],
            "airport_timezone": airport_meta.get("timezone", "America/New_York"),
            "terminal_name": terminal,
            "lounge_name": lounge_name,
            "lounge_operator": operator or "Oneworld",
            "access_rules": access_rules,
        }

    async def _handle_pagination(
        self, page, result: ScrapeResult, seen: set[tuple[str, str]]
    ) -> None:
        """Click through paginated results if present."""
        max_pages = 20  # safety cap
        for _ in range(max_pages):
            next_btn = await page.query_selector(
                'button:has-text("Next"), a:has-text("Next"), '
                '[aria-label="Next page"], .pagination-next'
            )
            if not next_btn:
                break
            is_disabled = await next_btn.get_attribute("disabled")
            if is_disabled is not None:
                break

            await next_btn.click()
            await asyncio.sleep(self.NAV_DELAY)
            await page.wait_for_selector(
                _LOUNGE_CARD_SELECTOR,
                timeout=10_000,
                state="attached",
            )

            lounge_elements = await page.query_selector_all(_LOUNGE_CARD_SELECTOR)
            for idx, el in enumerate(lounge_elements):
                try:
                    record = await self._parse_lounge_card(el)
                    if record:
                        key = (record["airport_iata"], record["lounge_name"])
                        if key not in seen:
                            seen.add(key)
                            result.records.append(record)
                except Exception as exc:
                    msg = f"Pagination parse error: {exc}"
                    logger.warning(msg)
                    result.errors.append(msg)
