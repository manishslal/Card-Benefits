"""Unit tests for scrapers.lounge_detail_fetcher — pure-function extraction logic.

These tests exercise the deterministic helpers without launching Playwright
or hitting any live pages.
"""

import asyncio
import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.lounge_detail_fetcher import (
    _detect_airside,
    _extract_gate_proximity,
    _extract_access_conditions,
    batch_fetch_all,
    _log_batch_run,
)
from scrapers.priority_pass_scraper import _classify_venue_type


# ---------------------------------------------------------------------------
# _detect_airside
# ---------------------------------------------------------------------------


class TestDetectAirside:
    def test_airside_keyword(self):
        assert _detect_airside("the lounge is airside near gate b12") is True

    def test_after_security(self):
        assert _detect_airside("located after security") is True

    def test_past_security(self):
        assert _detect_airside("past security checkpoint") is True

    def test_landside_keyword(self):
        assert _detect_airside("landside area of the terminal") is False

    def test_before_security(self):
        assert _detect_airside("located before security") is False

    def test_pre_security(self):
        assert _detect_airside("pre-security location") is False

    def test_both_keywords_airside_first(self):
        """When both 'airside' and 'landside' appear, airside wins (checked first)."""
        assert _detect_airside("airside lounge with landside overflow") is True

    def test_neither_keyword(self):
        assert _detect_airside("a lovely comfortable lounge with drinks") is None

    def test_empty_string(self):
        assert _detect_airside("") is None


# ---------------------------------------------------------------------------
# _extract_gate_proximity
# ---------------------------------------------------------------------------


class TestExtractGateProximity:
    def test_near_gate_single(self):
        result = _extract_gate_proximity("Located Near Gate B22 in Terminal 3")
        assert result is not None
        assert "B22" in result

    def test_between_gates_range(self):
        result = _extract_gate_proximity("Between Gates A1-A5, next to the restroom")
        assert result is not None
        assert "A1" in result
        assert "A5" in result

    def test_opposite_gate(self):
        result = _extract_gate_proximity("Opposite Gate C10")
        assert result is not None
        assert "C10" in result

    def test_no_gate_info(self):
        assert _extract_gate_proximity("A wonderful lounge with food and drinks") is None

    def test_near_terminal(self):
        result = _extract_gate_proximity("Near terminal B concourse")
        assert result is not None
        assert "terminal" in result.lower()

    def test_empty_string(self):
        assert _extract_gate_proximity("") is None


# ---------------------------------------------------------------------------
# _extract_access_conditions
# ---------------------------------------------------------------------------


class TestExtractAccessConditions:
    def test_boarding_pass(self):
        conditions = _extract_access_conditions(
            "Please show your boarding pass at reception",
            "please show your boarding pass at reception",
        )
        assert conditions.get("requires_boarding_pass") is True

    def test_max_stay_hours(self):
        conditions = _extract_access_conditions(
            "Maximum 3 hours stay",
            "maximum 3 hours stay",
        )
        assert conditions["max_stay_hours"] == 3

    def test_max_stay_hr_abbreviation(self):
        conditions = _extract_access_conditions(
            "Max: 4 hr per visit",
            "max: 4 hr per visit",
        )
        assert conditions["max_stay_hours"] == 4

    def test_guest_fee_dollar(self):
        conditions = _extract_access_conditions(
            "Guests $35 per person",
            "guests $35 per person",
        )
        assert conditions["guest_fee"] == "35"

    def test_guest_fee_with_cents(self):
        conditions = _extract_access_conditions(
            "Each guest costs USD 27.50",
            "each guest costs usd 27.50",
        )
        assert conditions["guest_fee"] == "27.50"

    def test_guest_fee_gbp(self):
        conditions = _extract_access_conditions(
            "Guests welcome for £20.00 per visit",
            "guests welcome for £20.00 per visit",
        )
        assert conditions["guest_fee"] == "20.00"

    def test_guest_fee_regex_not_too_greedy(self):
        """A long gap between 'guest' and the currency symbol should NOT match."""
        long_text = "guest " + "x" * 60 + " $99"
        conditions = _extract_access_conditions(long_text, long_text.lower())
        # No conditions extracted → returns None (prevents empty {} overwriting DB)
        assert conditions is None or "guest_fee" not in conditions

    def test_pre_booking_required_true(self):
        conditions = _extract_access_conditions(
            "You must pre-book your visit",
            "you must pre-book your visit",
        )
        assert conditions["pre_booking_required"] is True

    def test_pre_booking_advance_booking(self):
        conditions = _extract_access_conditions(
            "Advance booking is recommended",
            "advance booking is recommended",
        )
        assert conditions["pre_booking_required"] is True

    def test_pre_booking_not_set_when_absent(self):
        """pre_booking_required should NOT be set at all when text doesn't mention booking."""
        conditions = _extract_access_conditions(
            "A nice lounge with food",
            "a nice lounge with food",
        )
        # No conditions extracted → returns None (prevents empty {} overwriting DB)
        assert conditions is None or "pre_booking_required" not in conditions

    def test_guest_limit(self):
        conditions = _extract_access_conditions(
            "Up to 2 guests allowed",
            "up to 2 guests allowed",
        )
        assert conditions["guest_limit"] == 2

    def test_card_restrictions(self):
        conditions = _extract_access_conditions(
            "Access with specific card only",
            "access with specific card only",
        )
        assert conditions.get("has_card_restrictions") is True

    def test_empty_text(self):
        conditions = _extract_access_conditions("", "")
        # Empty input → no conditions → returns None (prevents empty {} overwriting DB)
        assert conditions is None


# ---------------------------------------------------------------------------
# _classify_venue_type  (imported from priority_pass_scraper)
# ---------------------------------------------------------------------------


class TestClassifyVenueType:
    def test_spa_lounge(self):
        assert _classify_venue_type("Spa Lounge") == "spa"

    def test_massage_room(self):
        assert _classify_venue_type("Thai Massage Room") == "spa"

    def test_sleep_pod(self):
        assert _classify_venue_type("Snooze Cube") == "sleep"

    def test_rest_pod(self):
        assert _classify_venue_type("Rest Pod") == "sleep"

    def test_rest_suite(self):
        assert _classify_venue_type("Rest Suite") == "sleep"

    def test_gaming(self):
        assert _classify_venue_type("Gameway") == "gaming"

    def test_gaming_play(self):
        assert _classify_venue_type("Play Area") == "gaming"

    def test_restaurant_is_dining_not_sleep(self):
        """'Restaurant Lounge' must classify as dining, not sleep (L-1 regression)."""
        assert _classify_venue_type("Restaurant Lounge") == "dining"

    def test_bistro(self):
        assert _classify_venue_type("Le Bistro") == "dining"

    def test_cafe(self):
        assert _classify_venue_type("Café Milano") == "dining"

    def test_wellness(self):
        assert _classify_venue_type("Wellness Center") == "wellness"

    def test_default_lounge(self):
        assert _classify_venue_type("The Centurion Lounge") == "lounge"

    def test_plain_name(self):
        assert _classify_venue_type("Sky Club") == "lounge"

    def test_rest_in_restaurant_no_false_sleep(self):
        """The word 'rest' inside 'restaurant' must not trigger 'sleep' classification."""
        assert _classify_venue_type("Airport Restaurant & Bar") == "dining"


# ---------------------------------------------------------------------------
# batch_fetch_all
# ---------------------------------------------------------------------------


class TestBatchFetchAll:
    """Test the batch detail-fetch orchestrator with mocked DB + fetcher."""

    def test_empty_queue_returns_zero_total(self):
        """When no lounges need fetching, summary totals are all zero."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)

        with patch("scrapers.lounge_detail_fetcher.get_cursor", return_value=mock_cursor):
            with patch("scrapers.lounge_detail_fetcher._log_batch_run"):
                summary = asyncio.run(batch_fetch_all(batch_size=5, delay=0.0))

        assert summary["total"] == 0
        assert summary["success"] == 0
        assert summary["failed"] == 0
        assert summary["skipped"] == 0

    def test_successful_fetch_increments_success(self):
        """A successful fetch_lounge_detail result counts as success."""
        fake_lounges = [
            {"id": "lounge-1", "name": "Test Lounge", "source_url": "https://example.com"},
        ]
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = fake_lounges
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)

        fake_result = {"is_airside": True, "amenities": {"has_wifi": True}}

        with patch("scrapers.lounge_detail_fetcher.get_cursor", return_value=mock_cursor):
            with patch("scrapers.lounge_detail_fetcher.fetch_lounge_detail", new_callable=AsyncMock, return_value=fake_result):
                with patch("scrapers.lounge_detail_fetcher._log_batch_run"):
                    summary = asyncio.run(batch_fetch_all(batch_size=5, delay=0.0))

        assert summary["total"] == 1
        assert summary["success"] == 1
        assert summary["failed"] == 0

    def test_failed_fetch_increments_failed(self):
        """An exception during fetch counts as failed."""
        fake_lounges = [
            {"id": "lounge-1", "name": "Bad Lounge", "source_url": "https://broken.com"},
        ]
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = fake_lounges
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)

        async def _boom(*args, **kwargs):
            raise RuntimeError("network error")

        with patch("scrapers.lounge_detail_fetcher.get_cursor", return_value=mock_cursor):
            with patch("scrapers.lounge_detail_fetcher.fetch_lounge_detail", side_effect=_boom):
                with patch("scrapers.lounge_detail_fetcher._log_batch_run"):
                    summary = asyncio.run(batch_fetch_all(batch_size=5, delay=0.0))

        assert summary["total"] == 1
        assert summary["failed"] == 1
        assert len(summary["errors"]) == 1
        assert "Bad Lounge" in summary["errors"][0]

    def test_none_result_increments_skipped(self):
        """A None return from fetch_lounge_detail counts as skipped."""
        fake_lounges = [
            {"id": "lounge-1", "name": "No URL Lounge", "source_url": "https://x.com"},
        ]
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = fake_lounges
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)

        with patch("scrapers.lounge_detail_fetcher.get_cursor", return_value=mock_cursor):
            with patch("scrapers.lounge_detail_fetcher.fetch_lounge_detail", new_callable=AsyncMock, return_value=None):
                with patch("scrapers.lounge_detail_fetcher._log_batch_run"):
                    summary = asyncio.run(batch_fetch_all(batch_size=5, delay=0.0))

        assert summary["skipped"] == 1
        assert summary["success"] == 0

    def test_summary_keys(self):
        """Summary dict always has the expected keys."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)

        with patch("scrapers.lounge_detail_fetcher.get_cursor", return_value=mock_cursor):
            with patch("scrapers.lounge_detail_fetcher._log_batch_run"):
                summary = asyncio.run(batch_fetch_all(delay=0.0))

        assert set(summary.keys()) == {"total", "success", "failed", "skipped", "errors"}
