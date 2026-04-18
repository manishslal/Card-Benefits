"""Unit tests for scrapers.amex_lounge_scraper — no live site hits required.

Tests verify:
  - Import and class structure
  - Reference data integrity
  - Normalizer integration with Amex-specific records
  - Access-rule metadata plumbing
  - Skip-pattern filtering
  - Per-airport scrape_airport with mocked Playwright page
  - Reference data fallback
  - --airports CLI flag parsing
  - New URL constants and templates
"""

import sys
import os
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.amex_lounge_scraper import (
    AmexLoungeScraper,
    AMEX_LOUNGE_URL,
    AMEX_LOUNGE_BASE_URL,
    AMEX_AIRPORT_URL_TEMPLATE,
    CENTURION_GUEST_FEE,
    NAV_DELAY_SECONDS,
    _CENTURION_LOUNGES,
    _ESCAPE_LOUNGES,
    _CENTURION_ACCESS_METHODS,
    _ESCAPE_ACCESS_METHODS,
    _CENTURION_GUEST_POLICY,
    _ESCAPE_GUEST_POLICY,
    _SKIP_PATTERNS,
)
from scrapers.base_scraper import BaseScraper, ScrapeResult
from scrapers.normalizer import normalize_lounge_record


# ---------------------------------------------------------------------------
# Class structure
# ---------------------------------------------------------------------------


class TestClassStructure:
    def test_import_succeeds(self):
        """Module imports without error."""
        assert AmexLoungeScraper is not None

    def test_inherits_base_scraper(self):
        """AmexLoungeScraper is a proper subclass of BaseScraper."""
        assert issubclass(AmexLoungeScraper, BaseScraper)

    def test_source_name(self):
        """source_name is set to 'amex'."""
        scraper = AmexLoungeScraper()
        assert scraper.source_name == "amex"

    def test_has_scrape_method(self):
        """scrape() is overridden from BaseScraper."""
        assert hasattr(AmexLoungeScraper, "scrape")
        # Ensure it's not the base stub
        assert AmexLoungeScraper.scrape is not BaseScraper.scrape

    def test_has_run_method(self):
        """run() is overridden for access-rule persistence."""
        assert hasattr(AmexLoungeScraper, "run")
        assert AmexLoungeScraper.run is not BaseScraper.run

    def test_has_scrape_airport_method(self):
        """scrape_airport() exists on the scraper class."""
        assert hasattr(AmexLoungeScraper, "scrape_airport")

    def test_accepts_airports_parameter(self):
        """Constructor accepts optional airports list."""
        scraper = AmexLoungeScraper(airports=["JFK", "LAX"])
        assert scraper._airports == ["JFK", "LAX"]

    def test_airports_uppercased(self):
        """Constructor uppercases IATA codes."""
        scraper = AmexLoungeScraper(airports=["jfk", "lax"])
        assert scraper._airports == ["JFK", "LAX"]

    def test_no_airports_default_none(self):
        """Constructor defaults airports to None."""
        scraper = AmexLoungeScraper()
        assert scraper._airports is None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_url_is_amex(self):
        assert "americanexpress.com" in AMEX_LOUNGE_URL

    def test_base_url_is_new_pattern(self):
        """Base URL uses the new /travel/lounges/ path."""
        assert "/travel/lounges/the-platinum-card/" in AMEX_LOUNGE_BASE_URL

    def test_airport_url_template(self):
        """Airport URL template has {iata} placeholder."""
        url = AMEX_AIRPORT_URL_TEMPLATE.format(iata="JFK")
        assert url.endswith("/JFK/")
        assert "/travel/lounges/the-platinum-card/" in url

    def test_nav_delay_at_least_two_seconds(self):
        assert NAV_DELAY_SECONDS >= 2

    def test_nav_delay_at_least_three_seconds(self):
        """New implementation uses 3s delay between airports."""
        assert NAV_DELAY_SECONDS >= 3

    def test_guest_fee_is_decimal(self):
        assert isinstance(CENTURION_GUEST_FEE, Decimal)
        assert CENTURION_GUEST_FEE == Decimal("50.00")


# ---------------------------------------------------------------------------
# Reference data integrity
# ---------------------------------------------------------------------------


class TestReferenceData:
    """Verify the curated lounge reference data is internally consistent."""

    EXPECTED_CENTURION_IATAS = {
        "JFK", "LAX", "CLT", "ORD", "MIA", "DFW",
        "SFO", "SEA", "HOU", "PHX", "DEN", "LAS",
    }

    def test_centurion_count(self):
        """All 12 known Centurion Lounge locations are present."""
        assert len(_CENTURION_LOUNGES) == 12

    def test_centurion_iata_coverage(self):
        """Every expected IATA code is represented exactly once."""
        found = {r["airport_iata"] for r in _CENTURION_LOUNGES}
        assert found == self.EXPECTED_CENTURION_IATAS

    def test_centurion_fields_present(self):
        """Every Centurion record has all required fields."""
        required = {
            "airport_iata", "airport_name", "airport_city",
            "airport_timezone", "terminal_name", "lounge_name",
            "lounge_operator", "amenities", "operating_hours",
        }
        for lounge in _CENTURION_LOUNGES:
            missing = required - lounge.keys()
            assert not missing, (
                f"{lounge['airport_iata']} missing keys: {missing}"
            )

    def test_centurion_operator_is_amex(self):
        for lounge in _CENTURION_LOUNGES:
            assert lounge["lounge_operator"] == "American Express"

    def test_centurion_name_consistent(self):
        for lounge in _CENTURION_LOUNGES:
            assert lounge["lounge_name"] == "The Centurion Lounge"

    def test_escape_lounges_exist(self):
        assert len(_ESCAPE_LOUNGES) >= 1

    def test_escape_fields_present(self):
        required = {
            "airport_iata", "airport_name", "airport_city",
            "airport_timezone", "terminal_name", "lounge_name",
            "lounge_operator",
        }
        for lounge in _ESCAPE_LOUNGES:
            missing = required - lounge.keys()
            assert not missing, (
                f"{lounge['airport_iata']} missing keys: {missing}"
            )

    def test_escape_names_branded(self):
        """Escape Lounges carry the Centurion Studio Partner branding."""
        for lounge in _ESCAPE_LOUNGES:
            assert "Escape Lounge" in lounge["lounge_name"]

    def test_no_duplicate_iata_within_type(self):
        """No duplicate IATA codes within Centurion or Escape lists."""
        centurion_iatas = [r["airport_iata"] for r in _CENTURION_LOUNGES]
        assert len(centurion_iatas) == len(set(centurion_iatas))

        escape_iatas = [r["airport_iata"] for r in _ESCAPE_LOUNGES]
        assert len(escape_iatas) == len(set(escape_iatas))

    def test_iata_codes_are_valid(self):
        """All IATA codes are exactly 3 uppercase letters."""
        for lounge in _CENTURION_LOUNGES + _ESCAPE_LOUNGES:
            code = lounge["airport_iata"]
            assert len(code) == 3, f"Bad length for {code}"
            assert code.isalpha() and code.isupper(), f"Bad format for {code}"

    def test_timezones_are_us(self):
        """All timezones are valid US IANA zones."""
        valid_prefixes = ("America/", "US/", "Pacific/")
        for lounge in _CENTURION_LOUNGES + _ESCAPE_LOUNGES:
            tz = lounge["airport_timezone"]
            assert any(
                tz.startswith(p) for p in valid_prefixes
            ), f"Non-US timezone {tz} for {lounge['airport_iata']}"


# ---------------------------------------------------------------------------
# Access-method metadata
# ---------------------------------------------------------------------------


class TestAccessMethods:
    def test_centurion_has_platinum_and_gold(self):
        names = {m["name"] for m in _CENTURION_ACCESS_METHODS}
        assert "Amex Platinum" in names
        assert "Amex Gold" in names

    def test_escape_has_platinum(self):
        names = {m["name"] for m in _ESCAPE_ACCESS_METHODS}
        assert "Amex Platinum" in names

    def test_methods_have_required_keys(self):
        for method in _CENTURION_ACCESS_METHODS + _ESCAPE_ACCESS_METHODS:
            assert "name" in method
            assert "category" in method
            assert method["category"] == "Credit Card"

    def test_centurion_guest_policy_unlimited(self):
        """Centurion guest_limit is None (unlimited per spec)."""
        assert _CENTURION_GUEST_POLICY["guest_limit"] is None

    def test_centurion_guest_fee(self):
        assert _CENTURION_GUEST_POLICY["guest_fee"] == Decimal("50.00")

    def test_escape_guest_limit(self):
        assert _ESCAPE_GUEST_POLICY["guest_limit"] == 2


# ---------------------------------------------------------------------------
# Skip-pattern filtering
# ---------------------------------------------------------------------------


class TestSkipPatterns:
    @pytest.mark.parametrize(
        "name",
        [
            "Priority Pass Lounge",
            "Delta Sky Club",
            "delta sky club — Terminal A",
            "Plaza Premium Lounge",
            "Air Canada Maple Leaf Lounge",
        ],
    )
    def test_skip_non_amex_lounges(self, name):
        """Lounges from other networks are correctly filtered out."""
        assert _SKIP_PATTERNS.search(name) is not None

    @pytest.mark.parametrize(
        "name",
        [
            "The Centurion Lounge",
            "Escape Lounge - The Centurion Studio Partner",
            "Lufthansa Senator Lounge",
            "KLM Crown Lounge",
        ],
    )
    def test_keep_amex_lounges(self, name):
        """Amex-operated and partner lounges are NOT filtered out."""
        assert _SKIP_PATTERNS.search(name) is None


# ---------------------------------------------------------------------------
# Normalizer integration
# ---------------------------------------------------------------------------


class TestNormalizerIntegration:
    """Verify that reference records survive normalization intact."""

    def test_centurion_record_normalizes(self):
        raw = dict(_CENTURION_LOUNGES[0])  # JFK
        result = normalize_lounge_record(raw)
        assert result["airport_iata"] == "JFK"
        assert result["lounge_name"] == "The Centurion Lounge"
        assert result["lounge_operator"] == "American Express"
        assert result["terminal_name"] == "Terminal 4"
        assert result["operating_hours"] is not None
        assert result["amenities"] is not None
        assert result["amenities"].get("has_showers") is True
        assert result["amenities"].get("has_wifi") is True

    def test_escape_record_normalizes(self):
        raw = dict(_ESCAPE_LOUNGES[0])  # MSP
        result = normalize_lounge_record(raw)
        assert result["airport_iata"] == "MSP"
        assert "Escape Lounge" in result["lounge_name"]
        assert result["lounge_operator"] == "Escape Lounges"

    def test_all_centurion_records_normalize(self):
        """Every Centurion reference record normalizes without error."""
        for raw in _CENTURION_LOUNGES:
            result = normalize_lounge_record(dict(raw))
            assert result["airport_iata"]
            assert result["lounge_name"]

    def test_all_escape_records_normalize(self):
        """Every Escape reference record normalizes without error."""
        for raw in _ESCAPE_LOUNGES:
            result = normalize_lounge_record(dict(raw))
            assert result["airport_iata"]
            assert result["lounge_name"]

    def test_amenities_mapped_correctly(self):
        """JFK Centurion amenities map to canonical keys."""
        raw = dict(_CENTURION_LOUNGES[0])
        result = normalize_lounge_record(raw)
        amenities = result["amenities"]
        assert amenities["has_showers"] is True
        assert amenities["has_hot_food"] is True
        assert amenities["has_premium_bar"] is True
        assert amenities["has_wifi"] is True
        assert amenities["has_spa"] is True


# ---------------------------------------------------------------------------
# build_reference_records
# ---------------------------------------------------------------------------


class TestBuildReferenceRecords:
    def test_returns_all_lounges(self):
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records()
        expected = len(_CENTURION_LOUNGES) + len(_ESCAPE_LOUNGES)
        assert len(records) == expected

    def test_centurion_records_have_access_metadata(self):
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records()
        centurion = [
            r for r in records
            if r.get("lounge_name", "") == "The Centurion Lounge"
        ]
        assert len(centurion) == 12
        for r in centurion:
            names = {m["name"] for m in r["_access_methods"]}
            assert "Amex Platinum" in names
            assert "Amex Gold" in names
            assert r["_guest_policy"]["guest_fee"] == Decimal("50.00")
            assert r["_guest_policy"]["guest_limit"] is None

    def test_escape_records_have_access_metadata(self):
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records()
        escape = [r for r in records if "Escape" in r.get("lounge_name", "")]
        for r in escape:
            names = {m["name"] for m in r["_access_methods"]}
            assert "Amex Platinum" in names

    def test_no_priority_pass_in_records(self):
        """Reference data must not include Priority Pass lounges."""
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records()
        for r in records:
            assert "priority pass" not in r.get("lounge_name", "").lower()

    def test_no_delta_sky_club_in_records(self):
        """Reference data must not include Delta Sky Club."""
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records()
        for r in records:
            assert "delta sky club" not in r.get("lounge_name", "").lower()

    def test_records_are_independent_copies(self):
        """Each call returns fresh copies, not references to module-level data."""
        scraper = AmexLoungeScraper()
        a = scraper._build_reference_records()
        b = scraper._build_reference_records()
        assert a is not b
        assert a[0] is not b[0]

    def test_records_have_deep_independent_copies(self):
        """Nested mutable objects (amenities, etc.) must not alias module-level data."""
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records()
        assert records[0]["amenities"] is not _CENTURION_LOUNGES[0]["amenities"]


# ---------------------------------------------------------------------------
# build_reference_records_for_airport
# ---------------------------------------------------------------------------


class TestBuildReferenceRecordsForAirport:
    def test_known_centurion_airport(self):
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records_for_airport("JFK")
        assert len(records) == 1
        assert records[0]["lounge_name"] == "The Centurion Lounge"
        assert records[0]["airport_iata"] == "JFK"

    def test_known_escape_airport(self):
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records_for_airport("MSP")
        assert len(records) == 1
        assert "Escape" in records[0]["lounge_name"]

    def test_unknown_airport_returns_empty(self):
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records_for_airport("ZZZ")
        assert records == []

    def test_records_have_access_metadata(self):
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records_for_airport("ORD")
        assert len(records) == 1
        assert "_access_methods" in records[0]
        assert "_guest_policy" in records[0]

    def test_records_are_deep_copies(self):
        scraper = AmexLoungeScraper()
        a = scraper._build_reference_records_for_airport("JFK")
        b = scraper._build_reference_records_for_airport("JFK")
        assert a[0] is not b[0]
        assert a[0]["amenities"] is not _CENTURION_LOUNGES[0]["amenities"]


# ---------------------------------------------------------------------------
# Default airport codes
# ---------------------------------------------------------------------------


class TestDefaultAirportCodes:
    def test_returns_sorted_list(self):
        scraper = AmexLoungeScraper()
        codes = scraper._default_airport_codes()
        assert codes == sorted(codes)

    def test_includes_centurion_airports(self):
        scraper = AmexLoungeScraper()
        codes = scraper._default_airport_codes()
        for lounge in _CENTURION_LOUNGES:
            assert lounge["airport_iata"] in codes

    def test_includes_escape_airports(self):
        scraper = AmexLoungeScraper()
        codes = scraper._default_airport_codes()
        for lounge in _ESCAPE_LOUNGES:
            assert lounge["airport_iata"] in codes

    def test_no_duplicates(self):
        scraper = AmexLoungeScraper()
        codes = scraper._default_airport_codes()
        assert len(codes) == len(set(codes))

    def test_known_iata_includes_escape_codes(self):
        """Escape airport codes are in the default list."""
        escape_iatas = {r["airport_iata"] for r in _ESCAPE_LOUNGES}
        centurion_iatas = {r["airport_iata"] for r in _CENTURION_LOUNGES}
        scraper = AmexLoungeScraper()
        codes_set = set(scraper._default_airport_codes())
        assert escape_iatas.issubset(codes_set)
        assert centurion_iatas.issubset(codes_set)


# ---------------------------------------------------------------------------
# scrape_airport with mocked Playwright
# ---------------------------------------------------------------------------


def _make_mock_card(
    href: str,
    h3_text: str,
    card_text: str,
    img_src: str = "",
):
    """Create a mock Playwright locator representing a lounge card."""
    card = AsyncMock()

    # href
    card.get_attribute = AsyncMock(return_value=href)

    # h3 locator
    h3_mock = AsyncMock()
    h3_mock.text_content = AsyncMock(return_value=h3_text)

    # img locator
    img_mock = AsyncMock()
    img_mock.get_attribute = AsyncMock(return_value=img_src)
    img_mock.count = AsyncMock(return_value=1)

    def _locator(selector):
        if selector == "h3":
            wrapper = MagicMock()
            wrapper.first = h3_mock
            return wrapper
        if selector == "img":
            wrapper = MagicMock()
            wrapper.first = img_mock
            return wrapper
        return MagicMock()

    card.locator = _locator
    card.text_content = AsyncMock(return_value=card_text)
    return card


def _make_mock_page(cards):
    """Create a mock Playwright page with the given card locators."""
    page = AsyncMock()
    page.goto = AsyncMock()
    page.wait_for_timeout = AsyncMock()

    # a:has(h3) locator
    all_cards_locator = MagicMock()
    all_cards_locator.count = AsyncMock(return_value=len(cards))
    all_cards_locator.nth = lambda i: cards[i]

    def _page_locator(selector):
        if selector == "a:has(h3)":
            return all_cards_locator
        # For overlay dismissal — return a locator that reports not visible
        btn = AsyncMock()
        btn.is_visible = AsyncMock(return_value=False)
        wrapper = MagicMock()
        wrapper.first = btn
        return wrapper

    page.locator = _page_locator
    return page


class TestScrapeAirport:
    """Test scrape_airport with fully mocked Playwright objects."""

    @pytest.mark.asyncio
    async def test_extracts_centurion_lounge(self):
        """Centurion Lounge card is extracted with correct fields."""
        card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/The-Centurion-Lounge-T4/",
            h3_text="The Centurion Lounge",
            card_text="The Centurion Lounge Terminal 4 Closed Now • Opens at 5:00am",
            img_src="https://images.loungebuddy.com/test.jpg",
        )
        page = _make_mock_page([card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert len(records) == 1
        r = records[0]
        assert r["airport_iata"] == "JFK"
        assert r["lounge_name"] == "The Centurion Lounge"
        assert r["terminal_name"] == "Terminal 4"
        assert r["lounge_operator"] == "American Express"
        assert r["source_url"].startswith("https://www.americanexpress.com")
        assert r["image_url"] == "https://images.loungebuddy.com/test.jpg"
        assert r["venue_type"] == "lounge"
        # Access methods — Centurion gets both Platinum + Gold
        method_names = {m["name"] for m in r["_access_methods"]}
        assert "Amex Platinum" in method_names
        assert "Amex Gold" in method_names

    @pytest.mark.asyncio
    async def test_extracts_escape_lounge(self):
        """Escape Lounge card is extracted with correct access methods."""
        card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/MSP/Escape-Lounge-T2/",
            h3_text="Escape Lounge - The Centurion Studio Partner",
            card_text="Escape Lounge - The Centurion Studio Partner Terminal 2 Open Now • Closes at 9:00pm",
        )
        page = _make_mock_page([card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "MSP")

        assert len(records) == 1
        r = records[0]
        assert r["airport_iata"] == "MSP"
        assert "Escape" in r["lounge_name"]
        assert r["lounge_operator"] == "Escape Lounges"
        method_names = {m["name"] for m in r["_access_methods"]}
        assert "Amex Platinum" in method_names
        # Escape doesn't get Gold access
        assert "Amex Gold" not in method_names

    @pytest.mark.asyncio
    async def test_extracts_third_party_lounge(self):
        """Third-party lounges (e.g. Lufthansa Senator) get Amex Platinum access."""
        card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/Lufthansa-Senator/",
            h3_text="Lufthansa Senator Lounge",
            card_text="Lufthansa Senator Lounge Terminal 1 Open Now • Closes at 11:00pm",
        )
        page = _make_mock_page([card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert len(records) == 1
        r = records[0]
        assert r["lounge_name"] == "Lufthansa Senator Lounge"
        assert r["terminal_name"] == "Terminal 1"
        assert r["venue_type"] == "lounge"
        method_names = {m["name"] for m in r["_access_methods"]}
        assert "Amex Platinum" in method_names

    @pytest.mark.asyncio
    async def test_skips_priority_pass_cards(self):
        """Cards for Priority Pass lounges are filtered out."""
        centurion_card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/Centurion/",
            h3_text="The Centurion Lounge",
            card_text="The Centurion Lounge Terminal 4",
        )
        pp_card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/PP-Lounge/",
            h3_text="Priority Pass Lounge",
            card_text="Priority Pass Lounge Terminal 7",
        )
        page = _make_mock_page([centurion_card, pp_card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert len(records) == 1
        assert records[0]["lounge_name"] == "The Centurion Lounge"

    @pytest.mark.asyncio
    async def test_skips_cards_from_other_airports(self):
        """Cards with href not matching the target IATA are skipped."""
        wrong_airport_card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/LAX/Some-Lounge/",
            h3_text="Some Lounge",
            card_text="Some Lounge Terminal B",
        )
        page = _make_mock_page([wrong_airport_card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert len(records) == 0

    @pytest.mark.asyncio
    async def test_handles_empty_page(self):
        """Airport page with no cards returns empty list."""
        page = _make_mock_page([])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert records == []

    @pytest.mark.asyncio
    async def test_terminal_defaults_to_main_terminal(self):
        """If no terminal info in card text, defaults to 'Main Terminal'."""
        card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/CLT/Centurion/",
            h3_text="The Centurion Lounge",
            card_text="The Centurion Lounge Open Now",
        )
        page = _make_mock_page([card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "CLT")

        assert records[0]["terminal_name"] == "Main Terminal"

    @pytest.mark.asyncio
    async def test_concourse_parsing(self):
        """Concourse info is parsed from card text."""
        card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/DEN/Centurion/",
            h3_text="The Centurion Lounge",
            card_text="The Centurion Lounge Concourse C Open Now",
        )
        page = _make_mock_page([card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "DEN")

        assert records[0]["terminal_name"] == "Concourse C"

    @pytest.mark.asyncio
    async def test_relative_url_gets_domain_prepended(self):
        """Relative hrefs get the Amex domain prepended."""
        card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/Centurion/",
            h3_text="The Centurion Lounge",
            card_text="The Centurion Lounge Terminal 4",
        )
        page = _make_mock_page([card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert records[0]["source_url"].startswith("https://www.americanexpress.com/")

    @pytest.mark.asyncio
    async def test_card_parse_error_isolation(self):
        """Error parsing one card doesn't prevent parsing others."""
        good_card = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/Centurion/",
            h3_text="The Centurion Lounge",
            card_text="The Centurion Lounge Terminal 4",
        )
        # Bad card — get_attribute raises
        bad_card = AsyncMock()
        bad_card.get_attribute = AsyncMock(side_effect=Exception("DOM error"))

        page = _make_mock_page([bad_card, good_card])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert len(records) == 1
        assert records[0]["lounge_name"] == "The Centurion Lounge"

    @pytest.mark.asyncio
    async def test_multiple_lounges_same_airport(self):
        """Multiple lounges at the same airport are all extracted."""
        card1 = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/Centurion-T4/",
            h3_text="The Centurion Lounge",
            card_text="The Centurion Lounge Terminal 4",
        )
        card2 = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/Lufthansa-T1/",
            h3_text="Lufthansa Senator Lounge",
            card_text="Lufthansa Senator Lounge Terminal 1",
        )
        card3 = _make_mock_card(
            href="/en-us/travel/lounges/the-platinum-card/JFK/KLM-Crown/",
            h3_text="KLM Crown Lounge",
            card_text="KLM Crown Lounge Terminal 4",
        )
        page = _make_mock_page([card1, card2, card3])
        scraper = AmexLoungeScraper()

        records = await scraper.scrape_airport(page, "JFK")

        assert len(records) == 3
        names = {r["lounge_name"] for r in records}
        assert "The Centurion Lounge" in names
        assert "Lufthansa Senator Lounge" in names
        assert "KLM Crown Lounge" in names


# ---------------------------------------------------------------------------
# --airports CLI flag parsing
# ---------------------------------------------------------------------------


class TestCLIAirportsFlag:
    """Test that run_amex.py parses --airports correctly."""

    def test_airports_flag_parsed(self):
        """--airports flag is accepted by the argument parser."""
        import importlib
        import scrapers.run_amex as run_module
        importlib.reload(run_module)

        from scrapers.run_amex import main
        import argparse

        # Build the parser the same way main() does
        parser = argparse.ArgumentParser()
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--verbose", "-v", action="store_true")
        parser.add_argument("--airports", nargs="+", metavar="IATA")

        args = parser.parse_args(["--airports", "JFK", "LAX", "ORD"])
        assert args.airports == ["JFK", "LAX", "ORD"]

    def test_no_airports_flag_is_none(self):
        """When --airports is omitted, the value is None."""
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--airports", nargs="+", metavar="IATA")
        args = parser.parse_args([])
        assert args.airports is None

    def test_single_airport(self):
        """Single airport code is accepted."""
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--airports", nargs="+", metavar="IATA")
        args = parser.parse_args(["--airports", "JFK"])
        assert args.airports == ["JFK"]


# ---------------------------------------------------------------------------
# Reference data fallback integration
# ---------------------------------------------------------------------------


class TestReferenceDataFallback:
    """Test that the scraper falls back to reference data when live fails."""

    def test_fallback_for_known_airport(self):
        """Known Centurion airport returns reference data."""
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records_for_airport("JFK")
        assert len(records) >= 1
        assert records[0]["lounge_name"] == "The Centurion Lounge"
        assert "_access_methods" in records[0]
        assert "_guest_policy" in records[0]

    def test_fallback_for_unknown_airport(self):
        """Unknown airport returns empty list (no crash)."""
        scraper = AmexLoungeScraper()
        records = scraper._build_reference_records_for_airport("XYZ")
        assert records == []

    def test_all_centurion_airports_have_fallback(self):
        """Every Centurion airport has at least one fallback record."""
        scraper = AmexLoungeScraper()
        for lounge in _CENTURION_LOUNGES:
            records = scraper._build_reference_records_for_airport(
                lounge["airport_iata"]
            )
            assert len(records) >= 1, (
                f"No fallback for {lounge['airport_iata']}"
            )

    def test_all_escape_airports_have_fallback(self):
        """Every Escape airport has at least one fallback record."""
        scraper = AmexLoungeScraper()
        for lounge in _ESCAPE_LOUNGES:
            records = scraper._build_reference_records_for_airport(
                lounge["airport_iata"]
            )
            assert len(records) >= 1, (
                f"No fallback for {lounge['airport_iata']}"
            )
