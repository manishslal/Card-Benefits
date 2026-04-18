"""Unit tests for scrapers.star_alliance_scraper — pure logic only, no live scraping.

Tests cover:
  - Class structure and imports
  - airports constructor parameter
  - _build_records_for_airport() method
  - build_access_rules() logic
  - _extract_iata() helper
  - US_AIRPORTS lookup integrity
  - Reference data integrity
  - --airports CLI flag parsing
  - requires_same_day_flight on all access rules
"""

import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.star_alliance_scraper import (
    StarAllianceScraper,
    build_access_rules,
    _extract_iata,
    _REFERENCE_LOUNGES,
    _USER_AGENT,
)
from scrapers.us_airports import US_AIRPORTS
from scrapers.base_scraper import BaseScraper, ScrapeResult


# ---------------------------------------------------------------------------
# Class structure
# ---------------------------------------------------------------------------


class TestStarAllianceScraperClass:
    def test_import_ok(self):
        """Module imports without error."""
        assert StarAllianceScraper is not None

    def test_subclasses_base_scraper(self):
        """StarAllianceScraper inherits from BaseScraper."""
        assert issubclass(StarAllianceScraper, BaseScraper)

    def test_source_name(self):
        """source_name is set to 'star_alliance'."""
        scraper = StarAllianceScraper()
        assert scraper.source_name == "star_alliance"

    def test_has_scrape_method(self):
        """scrape() exists and is async."""
        import asyncio
        assert asyncio.iscoroutinefunction(StarAllianceScraper.scrape)

    def test_default_airports_is_none(self):
        """When no airports are passed, _airports is None."""
        scraper = StarAllianceScraper()
        assert scraper._airports is None

    def test_airports_parameter_uppercased(self):
        """Airport codes passed to constructor are uppercased."""
        scraper = StarAllianceScraper(airports=["jfk", "lax", "ord"])
        assert scraper._airports == ["JFK", "LAX", "ORD"]

    def test_airports_parameter_stored(self):
        """Airport codes are stored verbatim (after uppercasing)."""
        scraper = StarAllianceScraper(airports=["MIA", "ATL"])
        assert scraper._airports == ["MIA", "ATL"]


# ---------------------------------------------------------------------------
# IATA extraction
# ---------------------------------------------------------------------------


class TestExtractIata:
    def test_known_iata(self):
        """Known US IATA code extracted from text."""
        assert _extract_iata("Los Angeles (LAX)") == "LAX"

    def test_multiple_candidates_prefers_known(self):
        """When text has multiple 3-letter codes, prefer known US airports."""
        # "ABC" is not in US_AIRPORTS, "SFO" is.
        assert _extract_iata("ABC / SFO terminal") == "SFO"

    def test_unknown_iata_returns_empty(self):
        """Unknown 3-letter code returns empty — only US_AIRPORTS codes are valid."""
        result = _extract_iata("XYZ Airport")
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
    def test_always_includes_star_alliance_gold(self):
        """Every Star Alliance lounge gets a Star Alliance Gold rule."""
        rules = build_access_rules("United Club", "")
        methods = {r["access_method"] for r in rules}
        assert "Star Alliance Gold" in methods

    def test_requires_same_day_flight(self):
        """Every rule has requires_same_day_flight: true in conditions."""
        rules = build_access_rules("United Club", "First Class and Business Class")
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
        assert "Star Alliance Gold" in methods

    def test_default_business_when_none_mentioned(self):
        """When neither class is mentioned, Business Class is added as default."""
        rules = build_access_rules("United Club", "")
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


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------


class TestReferenceData:
    def test_reference_lounges_not_empty(self):
        """Reference data has entries for at least one airport."""
        non_empty = {k: v for k, v in _REFERENCE_LOUNGES.items() if v}
        assert len(non_empty) >= 5

    def test_jfk_has_lounges(self):
        """JFK has reference lounges."""
        assert len(_REFERENCE_LOUNGES.get("JFK", [])) > 0

    def test_empty_airports_present(self):
        """Airports known to have no Star Alliance lounges are listed with empty lists."""
        assert "MCO" in _REFERENCE_LOUNGES
        assert _REFERENCE_LOUNGES["MCO"] == []

    def test_reference_entries_have_required_keys(self):
        """Each reference entry has name, terminal, operator, access_text."""
        for iata, entries in _REFERENCE_LOUNGES.items():
            for entry in entries:
                assert "name" in entry, f"{iata} entry missing 'name'"
                assert "terminal" in entry, f"{iata} entry missing 'terminal'"
                assert "operator" in entry, f"{iata} entry missing 'operator'"
                assert "access_text" in entry, f"{iata} entry missing 'access_text'"


# ---------------------------------------------------------------------------
# _build_records_for_airport
# ---------------------------------------------------------------------------


class TestBuildRecordsForAirport:
    def setup_method(self):
        self.scraper = StarAllianceScraper()

    def test_known_airport_returns_records(self):
        """JFK returns non-empty list of records."""
        records = self.scraper._build_records_for_airport("JFK")
        assert len(records) > 0

    def test_unknown_airport_returns_empty(self):
        """Airport not in reference data returns empty list."""
        records = self.scraper._build_records_for_airport("ZZZ")
        assert records == []

    def test_empty_airport_returns_empty(self):
        """Airport with empty reference list returns empty list."""
        records = self.scraper._build_records_for_airport("MCO")
        assert records == []

    def test_record_has_all_required_fields(self):
        """Each record has all fields expected by _upsert_lounge_record."""
        records = self.scraper._build_records_for_airport("JFK")
        required_fields = [
            "airport_iata", "airport_name", "airport_city", "airport_timezone",
            "terminal_name", "lounge_name", "lounge_operator",
            "venue_type", "source_url", "image_url", "operating_hours",
            "access_rules",
        ]
        for rec in records:
            for field in required_fields:
                assert field in rec, f"Record missing field '{field}': {rec.get('lounge_name')}"

    def test_venue_type_is_lounge(self):
        """All records have venue_type 'lounge'."""
        records = self.scraper._build_records_for_airport("JFK")
        for rec in records:
            assert rec["venue_type"] == "lounge"

    def test_source_url_is_empty(self):
        """source_url is empty since there's no live page."""
        records = self.scraper._build_records_for_airport("JFK")
        for rec in records:
            assert rec["source_url"] == ""

    def test_image_url_is_empty(self):
        """image_url is empty since there are no images from reference data."""
        records = self.scraper._build_records_for_airport("JFK")
        for rec in records:
            assert rec["image_url"] == ""

    def test_operating_hours_is_none(self):
        """operating_hours is None since reference data has no hours."""
        records = self.scraper._build_records_for_airport("JFK")
        for rec in records:
            assert rec["operating_hours"] is None

    def test_access_rules_require_same_day_flight(self):
        """Every access rule on every record requires same-day flight."""
        records = self.scraper._build_records_for_airport("JFK")
        for rec in records:
            for rule in rec["access_rules"]:
                assert rule["conditions"]["requires_same_day_flight"] is True

    def test_airport_metadata_populated(self):
        """Airport name, city, timezone come from US_AIRPORTS."""
        records = self.scraper._build_records_for_airport("JFK")
        rec = records[0]
        assert rec["airport_iata"] == "JFK"
        assert "Kennedy" in rec["airport_name"]
        assert rec["airport_city"] == "New York"
        assert rec["airport_timezone"] == "America/New_York"

    def test_ord_records(self):
        """ORD returns the expected number of lounges."""
        records = self.scraper._build_records_for_airport("ORD")
        assert len(records) == len(_REFERENCE_LOUNGES["ORD"])


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
# CLI argument parsing
# ---------------------------------------------------------------------------


class TestCLIParsing:
    def test_airports_flag_parsed(self):
        """--airports flag is parsed correctly by the run script."""
        from scrapers.run_star_alliance import _build_parser
        parser = _build_parser()
        args = parser.parse_args(["--airports", "JFK", "ORD", "LAX"])
        assert args.airports == ["JFK", "ORD", "LAX"]

    def test_airports_flag_omitted(self):
        """When --airports is not given, it defaults to None."""
        from scrapers.run_star_alliance import _build_parser
        parser = _build_parser()
        args = parser.parse_args([])
        assert args.airports is None

    def test_dry_run_flag(self):
        """--dry-run is parsed correctly."""
        from scrapers.run_star_alliance import _build_parser
        parser = _build_parser()
        args = parser.parse_args(["--dry-run"])
        assert args.dry_run is True

    def test_verbose_flag(self):
        """-v flag is parsed correctly."""
        from scrapers.run_star_alliance import _build_parser
        parser = _build_parser()
        args = parser.parse_args(["-v"])
        assert args.verbose is True

    def test_combined_flags(self):
        """--dry-run, --airports, and -v can be combined."""
        from scrapers.run_star_alliance import _build_parser
        parser = _build_parser()
        args = parser.parse_args(["--dry-run", "--airports", "JFK", "-v"])
        assert args.dry_run is True
        assert args.airports == ["JFK"]
        assert args.verbose is True
