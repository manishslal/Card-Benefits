"""Unit tests for scrapers.oneworld_scraper — pure logic only, no live scraping."""

import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.oneworld_scraper import (
    OneworldScraper,
    build_access_rules,
    _extract_iata,
    US_AIRPORTS,
)
from scrapers.us_airports import US_AIRPORTS as SHARED_US_AIRPORTS
from scrapers.base_scraper import BaseScraper, ScrapeResult


# ---------------------------------------------------------------------------
# Class structure
# ---------------------------------------------------------------------------


class TestOneworldScraperClass:
    def test_import_ok(self):
        """Module imports without error."""
        assert OneworldScraper is not None

    def test_subclasses_base_scraper(self):
        """OneworldScraper inherits from BaseScraper."""
        assert issubclass(OneworldScraper, BaseScraper)

    def test_source_name(self):
        """source_name is set to 'oneworld'."""
        scraper = OneworldScraper()
        assert scraper.source_name == "oneworld"

    def test_nav_delay(self):
        """NAV_DELAY is at least 2 seconds (rate-limiting requirement)."""
        scraper = OneworldScraper()
        assert scraper.NAV_DELAY >= 2.0

    def test_has_scrape_method(self):
        """scrape() exists and is async."""
        import asyncio
        assert asyncio.iscoroutinefunction(OneworldScraper.scrape)


# ---------------------------------------------------------------------------
# IATA extraction
# ---------------------------------------------------------------------------


class TestExtractIata:
    def test_known_iata(self):
        """Known US IATA code extracted from text."""
        assert _extract_iata("Miami (MIA)") == "MIA"

    def test_multiple_candidates_prefers_known(self):
        """When text has multiple 3-letter codes, prefer known US airports."""
        assert _extract_iata("ABC / JFK terminal") == "JFK"

    def test_unknown_iata_returns_empty(self):
        """Unknown 3-letter code returns empty — only US_AIRPORTS codes are valid."""
        result = _extract_iata("ZZZ Airport")
        assert result == ""

    def test_no_iata_returns_empty(self):
        """No 3-letter uppercase token → empty string."""
        assert _extract_iata("no code here") == ""

    def test_common_words_not_returned(self):
        """Common English words like THE, AND, FOR are not false-positive IATA codes."""
        assert _extract_iata("THE FOX RAN") == ""

    def test_lowercase_common_words_not_returned(self):
        """Lowercase common words uppercased still don't match US airports."""
        assert _extract_iata("the fox ran") == ""

    def test_no_three_letter_words(self):
        """Text with no 3-letter words returns empty."""
        assert _extract_iata("go to an airport") == ""


# ---------------------------------------------------------------------------
# Access rule mapping
# ---------------------------------------------------------------------------


class TestBuildAccessRules:
    def test_always_includes_oneworld_emerald(self):
        """Every Oneworld lounge gets a Oneworld Emerald rule."""
        rules = build_access_rules("Flagship Lounge", "")
        methods = {r["access_method"] for r in rules}
        assert "Oneworld Emerald" in methods

    def test_requires_same_day_flight(self):
        """Every rule has requires_same_day_flight: true in conditions."""
        rules = build_access_rules("Flagship Lounge", "First Class and Business Class")
        for rule in rules:
            assert rule["conditions"]["requires_same_day_flight"] is True

    def test_first_class_detected(self):
        """'First Class' in text → First Class Ticket rule added."""
        rules = build_access_rules("Lounge", "First Class passengers welcome")
        methods = {r["access_method"] for r in rules}
        assert "First Class Ticket" in methods

    def test_business_class_detected(self):
        """'Business Class' in text → Business Class Ticket rule added."""
        rules = build_access_rules("Lounge", "Business Class passengers welcome")
        methods = {r["access_method"] for r in rules}
        assert "Business Class Ticket" in methods

    def test_both_classes_detected(self):
        """Both classes mentioned → both rules present."""
        rules = build_access_rules("Lounge", "First Class and Business Class")
        methods = {r["access_method"] for r in rules}
        assert "First Class Ticket" in methods
        assert "Business Class Ticket" in methods
        assert "Oneworld Emerald" in methods

    def test_default_business_when_none_mentioned(self):
        """When neither class is mentioned, Business Class is added as default."""
        rules = build_access_rules("Flagship Lounge", "")
        methods = {r["access_method"] for r in rules}
        assert "Business Class Ticket" in methods

    def test_minimum_two_rules(self):
        """Every lounge gets at least 2 access rules (alliance status + ticket class)."""
        rules = build_access_rules("Some Lounge", "")
        assert len(rules) >= 2

    def test_first_class_in_lounge_name(self):
        """'First Class' in lounge name triggers the rule."""
        rules = build_access_rules("First Class Lounge", "")
        methods = {r["access_method"] for r in rules}
        assert "First Class Ticket" in methods

    def test_rules_have_notes(self):
        """Every rule has a non-empty notes field."""
        rules = build_access_rules("Test Lounge", "Business Class")
        for rule in rules:
            assert rule.get("notes"), f"Missing notes on rule: {rule}"

    def test_oneworld_not_star_alliance(self):
        """Oneworld scraper produces Oneworld Emerald, not Star Alliance Gold."""
        rules = build_access_rules("Admirals Club", "")
        methods = {r["access_method"] for r in rules}
        assert "Oneworld Emerald" in methods
        assert "Star Alliance Gold" not in methods


# ---------------------------------------------------------------------------
# US airports lookup
# ---------------------------------------------------------------------------


class TestUSAirports:
    def test_major_hubs_present(self):
        """All major US hubs are in the lookup table."""
        for code in ["JFK", "LAX", "ORD", "SFO", "MIA", "ATL", "DFW", "SEA"]:
            assert code in US_AIRPORTS, f"Missing hub: {code}"

    def test_entries_have_name_and_city(self):
        """Every entry has a name and city."""
        for code, meta in US_AIRPORTS.items():
            assert meta["name"], f"{code} missing name"
            assert meta["city"], f"{code} missing city"

    def test_shared_module_import(self):
        """US_AIRPORTS is imported from the shared us_airports module."""
        assert US_AIRPORTS is SHARED_US_AIRPORTS

    def test_entries_have_timezone(self):
        """Every entry has a timezone field."""
        for code, meta in US_AIRPORTS.items():
            assert "timezone" in meta, f"{code} missing timezone"
            assert meta["timezone"], f"{code} has empty timezone"


# ---------------------------------------------------------------------------
# Timezone correctness
# ---------------------------------------------------------------------------


class TestTimezones:
    def test_jfk_eastern(self):
        assert US_AIRPORTS["JFK"]["timezone"] == "America/New_York"

    def test_ord_central(self):
        assert US_AIRPORTS["ORD"]["timezone"] == "America/Chicago"

    def test_den_mountain(self):
        assert US_AIRPORTS["DEN"]["timezone"] == "America/Denver"

    def test_lax_pacific(self):
        assert US_AIRPORTS["LAX"]["timezone"] == "America/Los_Angeles"

    def test_phx_arizona(self):
        assert US_AIRPORTS["PHX"]["timezone"] == "America/Phoenix"

    def test_hnl_hawaii(self):
        assert US_AIRPORTS["HNL"]["timezone"] == "Pacific/Honolulu"


# ---------------------------------------------------------------------------
# Pagination deduplication
# ---------------------------------------------------------------------------


class TestDeduplication:
    def test_duplicate_records_deduplicated(self):
        """Simulating pagination: same (iata, lounge_name) seen twice → only one kept."""
        seen: set[tuple[str, str]] = set()
        records: list[dict] = []

        # Simulate two pages returning the same lounge
        pages = [
            [{"airport_iata": "JFK", "lounge_name": "Admirals Club", "terminal_name": "T8"}],
            [{"airport_iata": "JFK", "lounge_name": "Admirals Club", "terminal_name": "T8"}],
        ]

        for page_records in pages:
            for record in page_records:
                key = (record["airport_iata"], record["lounge_name"])
                if key not in seen:
                    seen.add(key)
                    records.append(record)

        assert len(records) == 1

    def test_different_lounges_not_deduplicated(self):
        """Different lounges at same airport are not deduplicated."""
        seen: set[tuple[str, str]] = set()
        records: list[dict] = []

        page_records = [
            {"airport_iata": "JFK", "lounge_name": "Admirals Club"},
            {"airport_iata": "JFK", "lounge_name": "Flagship Lounge"},
        ]

        for record in page_records:
            key = (record["airport_iata"], record["lounge_name"])
            if key not in seen:
                seen.add(key)
                records.append(record)

        assert len(records) == 2
