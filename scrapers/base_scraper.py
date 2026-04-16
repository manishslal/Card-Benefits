"""Base scraper class for all lounge scrapers.

Handles Playwright browser lifecycle, retry logic, scrape-run tracking,
and the upsert chain for normalized lounge records.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser

from .repository import (
    start_scrape_run,
    complete_scrape_run,
    fail_scrape_run,
    upsert_airport,
    upsert_terminal,
    upsert_lounge,
)

logger = logging.getLogger(__name__)


@dataclass
class ScrapeResult:
    """Result of a single scrape run."""

    source_name: str
    scraped_at: datetime
    records: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class BaseScraper:
    """Base class for all lounge scrapers.

    Subclasses must:
      1. Set ``source_name`` as a class attribute (e.g. "priority_pass").
      2. Override ``scrape()`` to populate and return a ``ScrapeResult``.

    The ``run()`` method orchestrates the full lifecycle:
    browser setup → scrape → DB upserts → scrape-run tracking → cleanup.
    """

    source_name: str = ""  # Subclasses must override

    # -- Public API --------------------------------------------------------

    async def scrape(self) -> ScrapeResult:
        """Override in subclasses. Populate ``self.result`` and return it."""
        raise NotImplementedError("Subclasses must implement scrape()")

    async def run(self, dry_run: bool = False) -> ScrapeResult:
        """Main entry point.

        Args:
            dry_run: If True, skip writing to the database.

        Returns:
            A ``ScrapeResult`` with scraped records and any errors.
        """
        if not self.source_name:
            raise ValueError("source_name must be set by subclass")

        run_id: Optional[str] = None
        browser: Optional[Browser] = None
        pw_context = None
        records_upserted = 0

        try:
            # 1. Record scrape-run start (skip DB in dry_run)
            if not dry_run:
                run_id = start_scrape_run(self.source_name)
                logger.info(
                    "Scrape run started: source=%s run_id=%s",
                    self.source_name,
                    run_id,
                )

            # 2. Launch Playwright browser
            pw_context = await async_playwright().start()
            browser = await pw_context.chromium.launch(headless=True)
            self._browser = browser
            self._context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
            )
            self._context.set_default_timeout(30_000)  # 30 s

            logger.info("Browser launched for source=%s", self.source_name)

            # 3. Delegate to subclass scraper
            result = await self.scrape()

            logger.info(
                "Scrape complete: source=%s records=%d errors=%d",
                self.source_name,
                len(result.records),
                len(result.errors),
            )

            # 4. Persist to DB unless dry_run
            if not dry_run:
                for idx, record in enumerate(result.records):
                    try:
                        _upsert_lounge_record(record)
                        records_upserted += 1
                    except Exception as exc:
                        msg = f"Record {idx} upsert failed: {exc}"
                        logger.error(msg)
                        result.errors.append(msg)

            # 5. Mark run complete
            if run_id is not None:
                complete_scrape_run(
                    run_id,
                    records_found=len(result.records),
                    records_upserted=records_upserted,
                    errors=result.errors or None,
                )
                logger.info(
                    "Scrape run completed: run_id=%s upserted=%d",
                    run_id,
                    records_upserted,
                )

            return result

        except Exception as exc:
            logger.error(
                "Scrape run failed: source=%s error=%s",
                self.source_name,
                exc,
            )
            if run_id is not None:
                fail_scrape_run(run_id, [str(exc)])
            raise

        finally:
            # 6. Always clean up browser resources
            if browser is not None:
                await browser.close()
            if pw_context is not None:
                await pw_context.stop()

    # -- Helpers -----------------------------------------------------------

    async def new_page(self) -> Page:
        """Create a new browser page from the shared context."""
        return await self._context.new_page()

    async def navigate_with_retry(
        self,
        page: Page,
        url: str,
        retries: int = 3,
    ) -> None:
        """Navigate to *url* with exponential-backoff retries.

        Delays: 1 s, 2 s, 4 s between attempts.

        Args:
            page: Playwright page instance.
            url: Target URL.
            retries: Maximum number of attempts (default 3).

        Raises:
            ValueError: If *retries* is less than 1.
            The last encountered exception if all retries are exhausted.
        """
        if retries < 1:
            raise ValueError("retries must be >= 1")

        last_error: Optional[Exception] = None
        for attempt in range(1, retries + 1):
            try:
                await page.goto(url, wait_until="domcontentloaded")
                return
            except Exception as exc:
                last_error = exc
                if attempt < retries:
                    delay = 2 ** (attempt - 1)  # 1, 2, 4
                    logger.warning(
                        "Navigation to %s failed (attempt %d/%d), "
                        "retrying in %ds: %s",
                        url,
                        attempt,
                        retries,
                        delay,
                        exc,
                    )
                    await asyncio.sleep(delay)

        # All retries exhausted
        raise last_error  # type: ignore[misc]


# -- Module-level helpers --------------------------------------------------


def _upsert_lounge_record(record: dict) -> str:
    """Upsert a single normalized lounge record through the repository chain.

    Expects a dict with keys as produced by ``normalizer.normalize_lounge_record``.

    Returns:
        The lounge ID from the database.

    Raises:
        ValueError: If the IATA code is missing, wrong length, or non-alpha.
    """
    iata = record.get("airport_iata", "")
    if not iata or len(iata) != 3 or not iata.isalpha():
        raise ValueError(
            f"Invalid IATA code '{iata}' for lounge "
            f"'{record.get('lounge_name', 'unknown')}' — skipping"
        )

    airport_id = upsert_airport(
        iata_code=record["airport_iata"],
        name=record.get("airport_name", ""),
        city=record.get("airport_city", ""),
        timezone=record.get("airport_timezone", "UTC"),
    )

    terminal_id = upsert_terminal(
        airport_id=airport_id,
        name=record.get("terminal_name", "Main Terminal"),
        is_airside=record.get("terminal_is_airside", True),
    )

    lounge_id = upsert_lounge(
        terminal_id=terminal_id,
        name=record["lounge_name"],
        operator=record.get("lounge_operator"),
        location_details=record.get("location_details"),
        operating_hours=record.get("operating_hours"),
        amenities=record.get("amenities"),
        is_restaurant_credit=record.get("is_restaurant_credit", False),
        may_deny_entry=record.get("may_deny_entry", False),
        source_url=record.get("source_url"),
        image_url=record.get("image_url"),
        venue_type=record.get("venue_type", "lounge"),
    )

    return lounge_id
