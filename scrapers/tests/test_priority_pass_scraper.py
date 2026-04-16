"""Unit tests for scrapers.priority_pass_scraper — new search-based implementation.

Tests exercise class structure, constants, data extraction, error handling,
access-rule persistence, and the run() override.  They do NOT hit the live
Priority Pass website or a real database.
"""

import asyncio
import sys
import os
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from playwright.async_api import TimeoutError as PlaywrightTimeout

from scrapers.priority_pass_scraper import (
    PriorityPassScraper,
    BASE_URL,
    DELAY_BETWEEN_AIRPORTS,
    USER_AGENT,
    _SEARCH_TRIGGER_SELECTOR,
    _SEARCH_INPUT_SELECTOR,
    _COOKIE_ACCEPT_SELECTOR,
    _classify_venue_type,
)
from scrapers.base_scraper import BaseScraper, ScrapeResult


# ---------------------------------------------------------------------------
# Helpers — reusable mock factories
# ---------------------------------------------------------------------------


def _make_mock_card(
    name: str = "The Lounge",
    terminal_text: str = "",
    location_text: str = "",
    hours_text: str = "",
    amenity_texts: list[str] | None = None,
    full_text: str = "",
):
    """Build a mock Playwright ElementHandle behaving like a lounge card."""
    card = AsyncMock()

    # query_selector returns different elements depending on the selector.
    async def _qs(selector: str):
        el = AsyncMock()
        if any(s in selector for s in ("h2", "h3", "name", "title")):
            el.text_content = AsyncMock(return_value=name)
            return el
        if "terminal" in selector:
            if terminal_text:
                el.text_content = AsyncMock(return_value=terminal_text)
                return el
            return None
        if "location" in selector:
            if location_text:
                el.text_content = AsyncMock(return_value=location_text)
                return el
            return None
        if "address" in selector:
            if location_text:
                el.text_content = AsyncMock(return_value=location_text)
                return el
            return None
        if "hours" in selector or "time" in selector or "schedule" in selector:
            if hours_text:
                el.text_content = AsyncMock(return_value=hours_text)
                return el
            return None
        return None

    card.query_selector = AsyncMock(side_effect=_qs)

    # query_selector_all for amenity lists.
    async def _qsa(selector: str):
        if amenity_texts and "amenit" in selector:
            items = []
            for t in amenity_texts:
                item = AsyncMock()
                item.text_content = AsyncMock(return_value=t)
                items.append(item)
            return items
        return []

    card.query_selector_all = AsyncMock(side_effect=_qsa)

    # Full card text used for restaurant detection & terminal fallback.
    card.text_content = AsyncMock(return_value=full_text or name)

    return card


# ---------------------------------------------------------------------------
# 1. Class structure
# ---------------------------------------------------------------------------


class TestClassStructure:
    def test_extends_base_scraper(self):
        assert issubclass(PriorityPassScraper, BaseScraper)

    def test_source_name_set(self):
        scraper = PriorityPassScraper()
        assert scraper.source_name == "priority_pass"

    def test_scrape_is_coroutine(self):
        assert asyncio.iscoroutinefunction(PriorityPassScraper.scrape)

    def test_scrape_airport_is_coroutine(self):
        assert asyncio.iscoroutinefunction(PriorityPassScraper.scrape_airport)

    def test_extract_lounge_data_is_coroutine(self):
        assert asyncio.iscoroutinefunction(PriorityPassScraper.extract_lounge_data)

    def test_initial_airport_codes_none(self):
        scraper = PriorityPassScraper()
        assert scraper.airport_codes is None

    def test_initial_cookie_dismissed_flag(self):
        scraper = PriorityPassScraper()
        assert scraper._cookie_dismissed is False


# ---------------------------------------------------------------------------
# 2. Constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_base_url(self):
        assert BASE_URL == "https://www.prioritypass.com/en-GB/airport-lounges"

    def test_delay_between_airports(self):
        assert DELAY_BETWEEN_AIRPORTS == 3

    def test_user_agent(self):
        assert "Chrome/122" in USER_AGENT
        assert "Macintosh" in USER_AGENT


# ---------------------------------------------------------------------------
# 3. extract_lounge_data
# ---------------------------------------------------------------------------


class TestExtractLoungeData:
    @pytest.fixture
    def scraper(self):
        return PriorityPassScraper()

    @pytest.mark.asyncio
    async def test_basic_extraction(self, scraper):
        card = _make_mock_card(
            name="The Club JFK",
            terminal_text="Terminal 4",
            full_text="The Club JFK Terminal 4",
        )
        record = await scraper.extract_lounge_data(card, "JFK")

        assert record["lounge_name"] == "The Club JFK"
        assert record["airport_iata"] == "JFK"
        assert record["lounge_operator"] == "Priority Pass"
        assert record["terminal_name"] == "Terminal 4"

    @pytest.mark.asyncio
    async def test_airport_metadata_from_us_airports(self, scraper):
        card = _make_mock_card(name="Test Lounge")
        record = await scraper.extract_lounge_data(card, "LAX")

        assert record["airport_iata"] == "LAX"
        assert "Los Angeles" in record["airport_name"]
        assert record["airport_city"] == "Los Angeles"
        assert record["airport_timezone"] == "America/Los_Angeles"

    @pytest.mark.asyncio
    async def test_restaurant_credit_detection(self, scraper):
        card = _make_mock_card(
            name="Bistro Lounge",
            full_text="Enjoy a restaurant credit at this dining location",
        )
        record = await scraper.extract_lounge_data(card, "MIA")
        assert record["is_restaurant_credit"] is True

    @pytest.mark.asyncio
    async def test_no_restaurant_credit_for_normal_lounge(self, scraper):
        card = _make_mock_card(
            name="The Centurion Lounge",
            full_text="Welcome to The Centurion Lounge with premium beverages",
        )
        record = await scraper.extract_lounge_data(card, "JFK")
        assert record["is_restaurant_credit"] is False

    @pytest.mark.asyncio
    async def test_amenity_extraction(self, scraper):
        card = _make_mock_card(
            name="Skyview Lounge",
            amenity_texts=["Showers", "WiFi", "Hot meals"],
        )
        record = await scraper.extract_lounge_data(card, "DEN")
        # Amenities go through normalize_amenities — check the canonical keys.
        amenities = record.get("amenities")
        assert amenities is not None
        assert amenities.get("has_showers") is True
        assert amenities.get("has_wifi") is True
        assert amenities.get("has_hot_food") is True

    @pytest.mark.asyncio
    async def test_terminal_fallback_from_card_text(self, scraper):
        """When no terminal-class element, fall back to regex on card text."""
        card = _make_mock_card(
            name="Sky Lounge",
            terminal_text="",  # no terminal element
            full_text="Sky Lounge Terminal B Concourse West",
        )
        record = await scraper.extract_lounge_data(card, "ATL")
        assert "Terminal B" in record["terminal_name"]

    @pytest.mark.asyncio
    async def test_unknown_airport_empty_metadata(self, scraper):
        """IATA code not in US_AIRPORTS → empty metadata fields."""
        card = _make_mock_card(name="LHR Lounge")
        record = await scraper.extract_lounge_data(card, "LHR")
        assert record["airport_iata"] == "LHR"
        assert record["airport_name"] == ""

    @pytest.mark.asyncio
    async def test_normalize_integration(self, scraper):
        """The returned dict should have the canonical normalizer keys."""
        card = _make_mock_card(name="Test Lounge")
        record = await scraper.extract_lounge_data(card, "JFK")
        expected_keys = {
            "airport_iata", "airport_name", "airport_city",
            "airport_timezone", "terminal_name", "terminal_is_airside",
            "lounge_name", "lounge_operator", "location_details",
            "operating_hours", "amenities", "is_restaurant_credit",
            "may_deny_entry",
        }
        assert expected_keys.issubset(set(record.keys()))


# ---------------------------------------------------------------------------
# 4. scrape_airport error handling
# ---------------------------------------------------------------------------


class TestScrapeAirportErrors:
    @pytest.fixture
    def scraper(self):
        return PriorityPassScraper()

    @pytest.mark.asyncio
    async def test_search_input_not_found(self, scraper):
        """When no search input is found after clicking trigger, return error."""
        page = AsyncMock()
        page.goto = AsyncMock()
        page.wait_for_timeout = AsyncMock()
        page.click = AsyncMock()

        # query_selector returns the trigger button (so click succeeds)
        # but wait_for_selector for input always times out.
        async def _qs(selector: str):
            if selector == _SEARCH_TRIGGER_SELECTOR:
                return AsyncMock()  # trigger found
            if selector == _COOKIE_ACCEPT_SELECTOR:
                return None  # no cookie banner
            return None

        page.query_selector = AsyncMock(side_effect=_qs)
        page.wait_for_selector = AsyncMock(
            side_effect=PlaywrightTimeout("Timeout")
        )

        records, errors = await scraper.scrape_airport(page, "JFK")
        assert records == []
        assert any("Search input not found" in e for e in errors)

    @pytest.mark.asyncio
    async def test_search_trigger_not_found(self, scraper):
        """When the search trigger button is not found, return error."""
        page = AsyncMock()
        page.goto = AsyncMock()
        page.wait_for_timeout = AsyncMock()

        # query_selector returns None for everything
        page.query_selector = AsyncMock(return_value=None)

        records, errors = await scraper.scrape_airport(page, "JFK")
        assert records == []
        assert any("Search trigger button not found" in e for e in errors)

    @pytest.mark.asyncio
    async def test_no_autocomplete_results(self, scraper):
        """When autocomplete returns no suggestions, should return empty."""
        page = AsyncMock()
        page.goto = AsyncMock()
        page.wait_for_timeout = AsyncMock()
        page.click = AsyncMock()
        page.fill = AsyncMock()
        page.type = AsyncMock()

        async def _qs(selector: str):
            if selector == _SEARCH_TRIGGER_SELECTOR:
                return AsyncMock()  # trigger found
            if selector == _COOKIE_ACCEPT_SELECTOR:
                return None
            return None

        page.query_selector = AsyncMock(side_effect=_qs)
        page.wait_for_selector = AsyncMock()  # input found OK
        # No autocomplete suggestions.
        page.query_selector_all = AsyncMock(return_value=[])

        records, errors = await scraper.scrape_airport(page, "JFK")
        assert records == []
        assert any("No autocomplete results" in e for e in errors)

    @pytest.mark.asyncio
    async def test_still_on_search_page_returns_empty(self, scraper):
        """If URL doesn't change after clicking suggestion, return empty."""
        page = AsyncMock()
        page.goto = AsyncMock()
        page.wait_for_timeout = AsyncMock()
        page.click = AsyncMock()
        page.fill = AsyncMock()
        page.type = AsyncMock()
        page.url = BASE_URL  # didn't navigate away

        async def _qs(selector: str):
            if selector == _SEARCH_TRIGGER_SELECTOR:
                return AsyncMock()  # trigger found
            if selector == _COOKIE_ACCEPT_SELECTOR:
                return None
            return None

        page.query_selector = AsyncMock(side_effect=_qs)
        page.wait_for_selector = AsyncMock()  # input found OK

        # Return one visible suggestion.
        suggestion = AsyncMock()
        suggestion.text_content = AsyncMock(return_value="JFK Airport")
        suggestion.is_visible = AsyncMock(return_value=True)  # visible
        suggestion.evaluate = AsyncMock(return_value="")  # no href

        async def _qsa(selector):
            if 'LoungeSearchResults_item' in selector:
                return [suggestion]
            return []

        page.query_selector_all = AsyncMock(side_effect=_qsa)

        records, errors = await scraper.scrape_airport(page, "JFK")
        assert records == []
        assert any("Unexpected redirect" in e for e in errors)


# ---------------------------------------------------------------------------
# 4b. Cookie banner dismissal
# ---------------------------------------------------------------------------


class TestCookieBannerDismissal:
    @pytest.mark.asyncio
    async def test_cookie_banner_dismissed_only_once(self):
        """Cookie banner should only be dismissed once per scraper instance."""
        scraper = PriorityPassScraper()
        page = AsyncMock()
        page.query_selector = AsyncMock(return_value=AsyncMock())
        page.click = AsyncMock()
        page.wait_for_timeout = AsyncMock()

        # First call dismisses.
        await scraper._dismiss_cookie_banner(page)
        assert scraper._cookie_dismissed is True
        assert page.click.call_count == 1

        # Second call skips — no additional click.
        page.click.reset_mock()
        await scraper._dismiss_cookie_banner(page)
        assert page.click.call_count == 0

    @pytest.mark.asyncio
    async def test_cookie_banner_not_present(self):
        """When no cookie banner exists, flag stays False."""
        scraper = PriorityPassScraper()
        page = AsyncMock()
        page.query_selector = AsyncMock(return_value=None)

        await scraper._dismiss_cookie_banner(page)
        assert scraper._cookie_dismissed is False


# ---------------------------------------------------------------------------
# 5. _persist_access_rules
# ---------------------------------------------------------------------------


class TestPersistAccessRules:
    def test_creates_access_rules_for_found_lounges(self):
        scraper = PriorityPassScraper()

        records = [
            {"airport_iata": "JFK", "lounge_name": "The Club JFK"},
            {"airport_iata": "LAX", "lounge_name": "Sky Lounge"},
        ]

        mock_cursor = MagicMock()
        # First call: find access method → returns row.
        # Subsequent calls alternate: find lounge → return row.
        mock_cursor.fetchone = MagicMock(
            side_effect=[
                {"id": "am-1"},          # access method
                {"id": "lounge-jfk-1"},  # JFK lounge
                {"id": "lounge-lax-1"},  # LAX lounge
            ]
        )

        with patch("scrapers.priority_pass_scraper.get_cursor") as mock_gc, \
             patch("scrapers.priority_pass_scraper.upsert_lounge_access_rule") as mock_upsert:
            mock_gc.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_gc.return_value.__exit__ = MagicMock(return_value=False)

            scraper._persist_access_rules(records)

            assert mock_upsert.call_count == 2
            # Verify correct lounge_id and access_method_id.
            mock_upsert.assert_any_call(
                lounge_id="lounge-jfk-1",
                access_method_id="am-1",
                entry_cost=Decimal("0.00"),
            )
            mock_upsert.assert_any_call(
                lounge_id="lounge-lax-1",
                access_method_id="am-1",
                entry_cost=Decimal("0.00"),
            )

    def test_no_access_method_found_logs_error(self):
        scraper = PriorityPassScraper()

        mock_cursor = MagicMock()
        mock_cursor.fetchone = MagicMock(return_value=None)  # no access method

        with patch("scrapers.priority_pass_scraper.get_cursor") as mock_gc, \
             patch("scrapers.priority_pass_scraper.upsert_lounge_access_rule") as mock_upsert:
            mock_gc.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_gc.return_value.__exit__ = MagicMock(return_value=False)

            scraper._persist_access_rules([
                {"airport_iata": "JFK", "lounge_name": "Test"},
            ])

            mock_upsert.assert_not_called()

    def test_lounge_not_found_skips_silently(self):
        scraper = PriorityPassScraper()

        mock_cursor = MagicMock()
        mock_cursor.fetchone = MagicMock(
            side_effect=[
                {"id": "am-1"},  # access method found
                None,            # lounge NOT found
            ]
        )

        with patch("scrapers.priority_pass_scraper.get_cursor") as mock_gc, \
             patch("scrapers.priority_pass_scraper.upsert_lounge_access_rule") as mock_upsert:
            mock_gc.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_gc.return_value.__exit__ = MagicMock(return_value=False)

            scraper._persist_access_rules([
                {"airport_iata": "JFK", "lounge_name": "Missing Lounge"},
            ])

            mock_upsert.assert_not_called()

    def test_skips_records_without_iata_or_name(self):
        scraper = PriorityPassScraper()

        mock_cursor = MagicMock()
        mock_cursor.fetchone = MagicMock(return_value={"id": "am-1"})

        with patch("scrapers.priority_pass_scraper.get_cursor") as mock_gc, \
             patch("scrapers.priority_pass_scraper.upsert_lounge_access_rule") as mock_upsert:
            mock_gc.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_gc.return_value.__exit__ = MagicMock(return_value=False)

            scraper._persist_access_rules([
                {"airport_iata": "", "lounge_name": "Test"},
                {"airport_iata": "JFK", "lounge_name": ""},
                {},
            ])

            mock_upsert.assert_not_called()


# ---------------------------------------------------------------------------
# 6. Airport codes — default vs explicit
# ---------------------------------------------------------------------------


class TestAirportCodes:
    def test_explicit_codes_used_when_provided(self):
        scraper = PriorityPassScraper()
        scraper.airport_codes = ["jfk", "lax"]
        codes = scraper._get_iata_codes()
        assert codes == ["JFK", "LAX"]

    def test_default_queries_db(self):
        scraper = PriorityPassScraper()
        scraper.airport_codes = None

        mock_cursor = MagicMock()
        mock_cursor.fetchall = MagicMock(
            return_value=[
                {"iata_code": "ATL"},
                {"iata_code": "DEN"},
                {"iata_code": "JFK"},
            ]
        )

        with patch("scrapers.priority_pass_scraper.get_cursor") as mock_gc:
            mock_gc.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_gc.return_value.__exit__ = MagicMock(return_value=False)

            codes = scraper._get_iata_codes()

        assert codes == ["ATL", "DEN", "JFK"]
        mock_cursor.execute.assert_called_once_with(
            "SELECT iata_code FROM lounge_airports ORDER BY iata_code"
        )

    def test_db_error_returns_empty(self):
        scraper = PriorityPassScraper()
        scraper.airport_codes = None

        with patch("scrapers.priority_pass_scraper.get_cursor") as mock_gc:
            mock_gc.side_effect = Exception("Connection refused")
            codes = scraper._get_iata_codes()

        assert codes == []


# ---------------------------------------------------------------------------
# 7. run() override
# ---------------------------------------------------------------------------


class TestRunOverride:
    @pytest.mark.asyncio
    async def test_run_calls_super_and_persist(self):
        """run() should call super().run() then _persist_access_rules."""
        scraper = PriorityPassScraper()

        fake_result = ScrapeResult(
            source_name="priority_pass",
            scraped_at=datetime.now(timezone.utc),
            records=[{"airport_iata": "JFK", "lounge_name": "Test"}],
        )

        with patch.object(
            BaseScraper, "run", new_callable=AsyncMock, return_value=fake_result
        ) as mock_super_run, patch.object(
            scraper, "_persist_access_rules"
        ) as mock_persist:
            result = await scraper.run(dry_run=False, airport_codes=["JFK"])

            mock_super_run.assert_awaited_once_with(dry_run=False)
            mock_persist.assert_called_once_with(fake_result.records)
            assert result is fake_result

    @pytest.mark.asyncio
    async def test_run_stores_airport_codes(self):
        """run() must store airport_codes before calling super()."""
        scraper = PriorityPassScraper()

        fake_result = ScrapeResult(
            source_name="priority_pass",
            scraped_at=datetime.now(timezone.utc),
            records=[],
        )

        with patch.object(
            BaseScraper, "run", new_callable=AsyncMock, return_value=fake_result
        ):
            await scraper.run(dry_run=True, airport_codes=["MIA", "ATL"])
            assert scraper.airport_codes == ["MIA", "ATL"]

    @pytest.mark.asyncio
    async def test_run_dry_run_skips_persist(self):
        """In dry_run mode, _persist_access_rules must NOT be called."""
        scraper = PriorityPassScraper()

        fake_result = ScrapeResult(
            source_name="priority_pass",
            scraped_at=datetime.now(timezone.utc),
            records=[{"airport_iata": "JFK", "lounge_name": "X"}],
        )

        with patch.object(
            BaseScraper, "run", new_callable=AsyncMock, return_value=fake_result
        ), patch.object(
            scraper, "_persist_access_rules"
        ) as mock_persist:
            await scraper.run(dry_run=True)
            mock_persist.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_no_records_skips_persist(self):
        """With zero records, _persist_access_rules must NOT be called."""
        scraper = PriorityPassScraper()

        fake_result = ScrapeResult(
            source_name="priority_pass",
            scraped_at=datetime.now(timezone.utc),
            records=[],
        )

        with patch.object(
            BaseScraper, "run", new_callable=AsyncMock, return_value=fake_result
        ), patch.object(
            scraper, "_persist_access_rules"
        ) as mock_persist:
            await scraper.run(dry_run=False)
            mock_persist.assert_not_called()


# ---------------------------------------------------------------------------
# 8. scrape() orchestrator tests
# ---------------------------------------------------------------------------


class TestScrapeOrchestrator:
    """Integration-level tests for the scrape() method.

    These mock scrape_airport (not its internals) to verify the orchestrator
    logic: collecting records, handling errors, and sleeping between airports.
    """

    @pytest.fixture
    def scraper(self):
        s = PriorityPassScraper()
        # Provide a mock browser context so scrape() can open a page.
        s._context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.url = "https://www.prioritypass.com/en-GB/airport-lounges"
        s._context.new_page = AsyncMock(return_value=mock_page)
        return s

    @pytest.mark.asyncio
    async def test_scrape_collects_records_from_multiple_airports(self, scraper):
        """Records from all airports are merged into result.records."""
        jfk_records = [{"lounge_name": "JFK Lounge", "airport_iata": "JFK"}]
        ord_records = [{"lounge_name": "ORD Lounge", "airport_iata": "ORD"}]

        async def fake_scrape_airport(page, iata_code):
            if iata_code == "JFK":
                return jfk_records, []
            return ord_records, []

        with patch.object(scraper, "_get_iata_codes", return_value=["JFK", "ORD"]), \
             patch.object(scraper, "scrape_airport", side_effect=fake_scrape_airport), \
             patch("scrapers.priority_pass_scraper.asyncio.sleep", new_callable=AsyncMock):
            result = await scraper.scrape()

        assert len(result.records) == 2
        names = {r["lounge_name"] for r in result.records}
        assert names == {"JFK Lounge", "ORD Lounge"}

    @pytest.mark.asyncio
    async def test_scrape_continues_after_airport_exception(self, scraper):
        """An exception on one airport must not prevent scraping the next."""
        ord_records = [{"lounge_name": "ORD Lounge", "airport_iata": "ORD"}]

        async def fake_scrape_airport(page, iata_code):
            if iata_code == "JFK":
                raise RuntimeError("JFK exploded")
            return ord_records, []

        with patch.object(scraper, "_get_iata_codes", return_value=["JFK", "ORD"]), \
             patch.object(scraper, "scrape_airport", side_effect=fake_scrape_airport), \
             patch("scrapers.priority_pass_scraper.asyncio.sleep", new_callable=AsyncMock):
            result = await scraper.scrape()

        assert len(result.records) == 1
        assert result.records[0]["lounge_name"] == "ORD Lounge"
        assert any("JFK" in e and "exploded" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_scrape_collects_errors_from_scrape_airport(self, scraper):
        """Errors returned by scrape_airport are collected in result.errors."""
        async def fake_scrape_airport(page, iata_code):
            return [], [f"[{iata_code}] No autocomplete results"]

        with patch.object(scraper, "_get_iata_codes", return_value=["JFK"]), \
             patch.object(scraper, "scrape_airport", side_effect=fake_scrape_airport), \
             patch("scrapers.priority_pass_scraper.asyncio.sleep", new_callable=AsyncMock):
            result = await scraper.scrape()

        assert "[JFK] No autocomplete results" in result.errors

    @pytest.mark.asyncio
    async def test_scrape_sleeps_between_airports(self, scraper):
        """asyncio.sleep(DELAY_BETWEEN_AIRPORTS) is called between airports."""
        async def fake_scrape_airport(page, iata_code):
            return [], []

        with patch.object(scraper, "_get_iata_codes", return_value=["JFK", "ORD", "LAX"]), \
             patch.object(scraper, "scrape_airport", side_effect=fake_scrape_airport), \
             patch("scrapers.priority_pass_scraper.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await scraper.scrape()

        # Sleep is called once per airport (after each, including last).
        assert mock_sleep.call_count == 3
        mock_sleep.assert_called_with(DELAY_BETWEEN_AIRPORTS)

    @pytest.mark.asyncio
    async def test_scrape_airport_happy_path(self):
        """Full happy path: trigger click → input → autocomplete → navigate → cards."""
        scraper = PriorityPassScraper()

        # Build a mock page that simulates every step succeeding.
        page = AsyncMock()
        page.goto = AsyncMock()
        page.wait_for_timeout = AsyncMock()
        page.click = AsyncMock()
        page.fill = AsyncMock()
        page.type = AsyncMock()
        page.url = "https://www.prioritypass.com/en-GB/lounges/jfk"

        # query_selector: trigger button found, cookie banner not found.
        async def _qs(selector):
            if selector == _SEARCH_TRIGGER_SELECTOR:
                return AsyncMock()  # trigger button exists
            if selector == _COOKIE_ACCEPT_SELECTOR:
                return None  # no cookie banner
            return None

        page.query_selector = AsyncMock(side_effect=_qs)
        # wait_for_selector: search input appears after trigger click.
        page.wait_for_selector = AsyncMock()

        # Autocomplete suggestion with a link (href returned via evaluate).
        suggestion = AsyncMock()
        suggestion.text_content = AsyncMock(return_value="JFK - John F. Kennedy")
        suggestion.is_visible = AsyncMock(return_value=True)  # visible
        suggestion.evaluate = AsyncMock(
            return_value="https://www.prioritypass.com/en-GB/lounges/jfk"
        )

        # Lounge card.
        card = _make_mock_card(name="JFK Terminal Lounge", terminal_text="Terminal 1")

        async def _qsa(selector):
            if 'LoungeSearchResults_item' in selector:
                return [suggestion]
            if selector == 'article':
                return [card]
            return []

        page.query_selector_all = AsyncMock(side_effect=_qsa)

        records, errors = await scraper.scrape_airport(page, "JFK")

        assert len(records) == 1
        assert records[0]["lounge_name"] == "JFK Terminal Lounge"
        assert errors == []
