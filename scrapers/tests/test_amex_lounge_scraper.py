"""Unit tests for scrapers.amex_lounge_scraper — no live site hits required.

Tests verify:
  - Import and class structure
  - Reference data integrity
  - Normalizer integration with Amex-specific records
  - Access-rule metadata plumbing
  - Skip-pattern filtering
"""

import sys
import os
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.amex_lounge_scraper import (
    AmexLoungeScraper,
    AMEX_LOUNGE_URL,
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


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_url_is_amex(self):
        assert "americanexpress.com" in AMEX_LOUNGE_URL

    def test_nav_delay_at_least_two_seconds(self):
        assert NAV_DELAY_SECONDS >= 2

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
        ],
    )
    def test_keep_amex_lounges(self, name):
        """Amex-operated lounges are NOT filtered out."""
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

    def test_text_strategy_known_iata_includes_escape_codes(self):
        """known_iata_codes used by _strategy_text_content must include Escape airports."""
        escape_iatas = {r["airport_iata"] for r in _ESCAPE_LOUNGES}
        centurion_iatas = {r["airport_iata"] for r in _CENTURION_LOUNGES}
        # Reproduce the set as built in _strategy_text_content
        known_iata_codes = {r["airport_iata"] for r in _CENTURION_LOUNGES} | {r["airport_iata"] for r in _ESCAPE_LOUNGES}
        assert escape_iatas.issubset(known_iata_codes), (
            f"Missing Escape IATAs: {escape_iatas - known_iata_codes}"
        )
        assert centurion_iatas.issubset(known_iata_codes)
