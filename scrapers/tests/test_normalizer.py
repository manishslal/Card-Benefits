"""Unit tests for scrapers.normalizer — pure functions, no DB required."""

import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.normalizer import (
    normalize_lounge_record,
    parse_operating_hours,
    normalize_amenities,
)


# ---------------------------------------------------------------------------
# Operating hours
# ---------------------------------------------------------------------------


class TestParseOperatingHours:
    def test_normalize_hours_12h_format(self):
        """12-hour 'Monday-Friday: 6:00am-10:00pm' → mon-fri 06:00-22:00."""
        result = parse_operating_hours("Monday-Friday: 6:00am-10:00pm")
        expected_days = ["mon", "tue", "wed", "thu", "fri"]
        for day in expected_days:
            assert day in result, f"Missing day: {day}"
            assert result[day] == ["06:00-22:00"], f"Wrong hours for {day}: {result[day]}"
        # Weekend should NOT be present
        assert "sat" not in result
        assert "sun" not in result

    def test_normalize_hours_24h_format(self):
        """24-hour 'Mon-Fri 0600-2200' → mon-fri 06:00-22:00."""
        result = parse_operating_hours("Mon-Fri 0600-2200")
        for day in ["mon", "tue", "wed", "thu", "fri"]:
            assert day in result
            assert result[day] == ["06:00-22:00"]
        assert "sat" not in result
        assert "sun" not in result

    def test_normalize_hours_daily(self):
        """'Daily: 6am-10pm' → all 7 days with 06:00-22:00."""
        result = parse_operating_hours("Daily: 6am-10pm")
        all_days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        assert set(result.keys()) == set(all_days)
        for day in all_days:
            assert result[day] == ["06:00-22:00"]

    def test_normalize_hours_multiple_segments(self):
        """'Mon-Fri 0600-2200, Sat-Sun 0700-2000' → separate weekday/weekend hours."""
        result = parse_operating_hours("Mon-Fri 0600-2200, Sat-Sun 0700-2000")
        for day in ["mon", "tue", "wed", "thu", "fri"]:
            assert result[day] == ["06:00-22:00"], f"Weekday {day} mismatch"
        for day in ["sat", "sun"]:
            assert result[day] == ["07:00-20:00"], f"Weekend {day} mismatch"

    def test_normalize_hours_24h_colon_format(self):
        """'Mon-Fri 06:00-22:00' with colons."""
        result = parse_operating_hours("Mon-Fri 06:00-22:00")
        for day in ["mon", "tue", "wed", "thu", "fri"]:
            assert result[day] == ["06:00-22:00"]

    def test_normalize_hours_midnight_boundary(self):
        """12am should map to 00:00."""
        result = parse_operating_hours("Daily: 12:00am-11:59pm")
        assert result["mon"] == ["00:00-23:59"]

    def test_normalize_hours_noon(self):
        """12pm should map to 12:00."""
        result = parse_operating_hours("Daily: 12:00pm-6:00pm")
        assert result["mon"] == ["12:00-18:00"]


# ---------------------------------------------------------------------------
# Amenities
# ---------------------------------------------------------------------------


class TestNormalizeAmenities:
    def test_normalize_amenities_various_names(self):
        """Various raw amenity names → canonical keys."""
        raw = [
            "Showers Available",
            "Free Wi-Fi",
            "Hot meals",
            "Full bar",
            "Spa services",
            "Quiet zone",
        ]
        result = normalize_amenities(raw)
        assert result == {
            "has_showers": True,
            "has_wifi": True,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_spa": True,
            "has_quiet_zone": True,
        }

    def test_normalize_amenities_partial(self):
        """Only listed amenities appear in result — no false defaults."""
        result = normalize_amenities(["WiFi", "Showers"])
        assert result == {"has_wifi": True, "has_showers": True}
        assert "has_hot_food" not in result
        assert "has_spa" not in result

    def test_normalize_amenities_wifi_variants(self):
        """Wi-Fi, WiFi, Wifi, wireless → has_wifi."""
        for name in ["Wi-Fi", "WiFi", "Wifi", "Free Wi-Fi", "wireless"]:
            result = normalize_amenities([name])
            assert result == {"has_wifi": True}, f"Failed for: {name}"

    def test_normalize_amenities_hot_food_variants(self):
        """Hot meals, Hot Food, Buffet → has_hot_food."""
        for name in ["Hot meals", "Hot Food", "Buffet"]:
            result = normalize_amenities([name])
            assert result == {"has_hot_food": True}, f"Failed for: {name}"

    def test_normalize_amenities_bar_variants(self):
        """Full bar, Premium spirits, Cocktail bar → has_premium_bar."""
        for name in ["Full bar", "Premium spirits", "Cocktail bar"]:
            result = normalize_amenities([name])
            assert result == {"has_premium_bar": True}, f"Failed for: {name}"

    def test_normalize_amenities_empty_list(self):
        """Empty input → empty dict."""
        assert normalize_amenities([]) == {}

    def test_normalize_amenities_unrecognized(self):
        """Unrecognized amenities are silently dropped."""
        result = normalize_amenities(["Complimentary newspapers", "TV"])
        assert result == {}

    def test_negated_amenities_not_set(self):
        """Negated amenities (e.g. 'No showers') should be excluded."""
        result = normalize_amenities([
            "No showers",
            "Showers unavailable",
            "WiFi not available",
        ])
        assert result == {}, f"Expected empty dict but got {result}"

    def test_negated_mixed_with_positive(self):
        """Negated items excluded, positive items kept."""
        result = normalize_amenities([
            "No showers",
            "Free Wi-Fi",
            "Buffet",
            "Spa closed",
        ])
        assert result == {"has_wifi": True, "has_hot_food": True}


# ---------------------------------------------------------------------------
# Full record normalization
# ---------------------------------------------------------------------------


class TestNormalizeLoungeRecord:
    def test_normalize_strings_cleaned(self):
        """Extra whitespace, unicode NBSP → clean output."""
        raw = {
            "airport_iata": "  jfk  ",
            "airport_name": "John\u00a0F.\u00a0Kennedy  International   Airport",
            "airport_city": "  New   York  ",
            "airport_timezone": "America/New_York",
            "terminal_name": " Terminal  4 ",
            "lounge_name": "  The   Centurion\u00a0Lounge  ",
            "lounge_operator": "  American   Express  ",
        }
        result = normalize_lounge_record(raw)
        assert result["airport_iata"] == "JFK"
        assert result["airport_name"] == "John F. Kennedy International Airport"
        assert result["airport_city"] == "New York"
        assert result["terminal_name"] == "Terminal 4"
        assert result["lounge_name"] == "The Centurion Lounge"
        assert result["lounge_operator"] == "American Express"

    def test_full_record_with_hours_and_amenities(self):
        """Full pipeline: raw hours string + amenity list → structured output."""
        raw = {
            "iata": "LAX",
            "airport": "Los Angeles International Airport",
            "city": "Los Angeles",
            "timezone": "America/Los_Angeles",
            "terminal": "Terminal B",
            "name": "Star Alliance Lounge",
            "operator": "Star Alliance",
            "location": "Near Gate 40",
            "hours": "Daily: 5:30am-11:00pm",
            "amenities": ["Showers", "WiFi", "Buffet"],
            "is_restaurant_credit": False,
            "may_deny_entry": True,
        }
        result = normalize_lounge_record(raw)
        assert result["airport_iata"] == "LAX"
        assert result["airport_name"] == "Los Angeles International Airport"
        assert result["lounge_name"] == "Star Alliance Lounge"
        assert result["location_details"] == "Near Gate 40"
        assert result["may_deny_entry"] is True

        # Hours → all 7 days
        hours = result["operating_hours"]
        assert len(hours) == 7
        assert hours["mon"] == ["05:30-23:00"]

        # Amenities
        amenities = result["amenities"]
        assert amenities["has_showers"] is True
        assert amenities["has_wifi"] is True
        assert amenities["has_hot_food"] is True

    def test_missing_optional_fields_default_gracefully(self):
        """Minimal input → sensible defaults, no KeyError."""
        raw = {
            "airport_iata": "ORD",
            "lounge_name": "Test Lounge",
        }
        result = normalize_lounge_record(raw)
        assert result["airport_iata"] == "ORD"
        assert result["lounge_name"] == "Test Lounge"
        assert result["lounge_operator"] is None
        assert result["location_details"] is None
        assert result["operating_hours"] is None
        assert result["amenities"] is None
        assert result["is_restaurant_credit"] is False
        assert result["may_deny_entry"] is False
        assert result["terminal_name"] == "Main Terminal"

    def test_alternate_key_names(self):
        """Scraper using alternate key names (iata, name, etc.) maps correctly."""
        raw = {
            "iata": "SFO",
            "airport": "San Francisco International",
            "city": "San Francisco",
            "terminal": "International Terminal G",
            "name": "United Club",
            "operator": "United Airlines",
        }
        result = normalize_lounge_record(raw)
        assert result["airport_iata"] == "SFO"
        assert result["airport_name"] == "San Francisco International"
        assert result["airport_city"] == "San Francisco"
        assert result["terminal_name"] == "International Terminal G"
        assert result["lounge_name"] == "United Club"
        assert result["lounge_operator"] == "United Airlines"

    def test_source_url_passthrough(self):
        """source_url is passed through after cleaning."""
        raw = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
            "source_url": "  https://example.com/lounge  ",
        }
        result = normalize_lounge_record(raw)
        assert result["source_url"] == "https://example.com/lounge"

    def test_source_url_empty_becomes_none(self):
        """Empty source_url becomes None."""
        raw = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
            "source_url": "",
        }
        result = normalize_lounge_record(raw)
        assert result["source_url"] is None

    def test_image_url_passthrough(self):
        """image_url is passed through after cleaning."""
        raw = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
            "image_url": "https://example.com/img.jpg",
        }
        result = normalize_lounge_record(raw)
        assert result["image_url"] == "https://example.com/img.jpg"

    def test_image_url_missing_becomes_none(self):
        """Missing image_url defaults to None."""
        raw = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
        }
        result = normalize_lounge_record(raw)
        assert result["image_url"] is None

    def test_venue_type_passthrough(self):
        """venue_type is passed through after cleaning."""
        raw = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
            "venue_type": "dining",
        }
        result = normalize_lounge_record(raw)
        assert result["venue_type"] == "dining"

    def test_venue_type_defaults_to_lounge(self):
        """Missing or empty venue_type defaults to 'lounge'."""
        raw = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
        }
        result = normalize_lounge_record(raw)
        assert result["venue_type"] == "lounge"

        raw_empty = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
            "venue_type": "",
        }
        result2 = normalize_lounge_record(raw_empty)
        assert result2["venue_type"] == "lounge"

    def test_dict_amenity_passthrough_validates_keys(self):
        """Dict amenities with non-canonical keys → only canonical keys kept."""
        raw = {
            "airport_iata": "JFK",
            "lounge_name": "Test Lounge",
            "amenities": {
                "has_showers": True,
                "has_wifi": True,
                "bogus_key": True,
                "has_pool": False,
            },
        }
        result = normalize_lounge_record(raw)
        assert "has_showers" in result["amenities"]
        assert "has_wifi" in result["amenities"]
        assert "bogus_key" not in result["amenities"]
        assert "has_pool" not in result["amenities"]

    def test_dict_hours_passthrough_validates_keys(self):
        """Dict hours with bad day keys → only valid day keys kept."""
        raw = {
            "airport_iata": "LAX",
            "lounge_name": "Test Lounge",
            "operating_hours": {
                "mon": ["06:00-22:00"],
                "tue": ["06:00-22:00"],
                "holiday": ["10:00-16:00"],
                "xmas": ["closed"],
            },
        }
        result = normalize_lounge_record(raw)
        hours = result["operating_hours"]
        assert "mon" in hours
        assert "tue" in hours
        assert "holiday" not in hours
        assert "xmas" not in hours

    def test_comma_separated_individual_days(self):
        """'Mon, Wed, Fri: 0600-2200' → all three days should have hours."""
        result = parse_operating_hours("Mon, Wed, Fri: 0600-2200")
        assert "mon" in result, "Missing mon"
        assert "wed" in result, "Missing wed"
        assert "fri" in result, "Missing fri"
        for day in ["mon", "wed", "fri"]:
            assert result[day] == ["06:00-22:00"], f"Wrong hours for {day}: {result[day]}"
        # Other days should NOT be present
        for day in ["tue", "thu", "sat", "sun"]:
            assert day not in result, f"Unexpected day {day} in result"
