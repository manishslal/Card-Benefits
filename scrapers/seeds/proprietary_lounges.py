#!/usr/bin/env python3
"""Seed proprietary lounge data (Capital One, Chase Sapphire, Delta Sky Club, United Club).

Idempotent — safe to run multiple times. Uses upsert functions from
scrapers.repository so re-runs update rather than duplicate.

Usage:
    python3 scrapers/seeds/proprietary_lounges.py
"""
import json
import logging
import sys
import uuid
from decimal import Decimal
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup — allow running as `python3 scrapers/seeds/proprietary_lounges.py`
# from the project root.
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from scrapers.repository import (
    upsert_airport,
    upsert_terminal,
    upsert_lounge,
    upsert_access_method,
    upsert_lounge_access_rule,
)
from scrapers.database import get_cursor
from scrapers.us_airports import US_AIRPORTS

logger = logging.getLogger(__name__)

# ── Airports that must exist in lounge_airports ──────────────────────────────
# ATL, CLT, DEN, DFW, JFK, LAS, LAX, MCO, MIA, ORD are already seeded.
# We call upsert for all referenced airports (idempotent) so the script is
# self-contained.
REQUIRED_AIRPORTS = [
    "ATL", "BOS", "CLT", "DEN", "DFW", "DTW", "EWR", "IAD", "IAH",
    "JFK", "LAS", "LAX", "MSP", "ORD", "PHL", "PHX", "SEA", "SFO", "SLC",
]

# ── Access methods ───────────────────────────────────────────────────────────
ACCESS_METHODS = [
    {"name": "Capital One Venture X", "category": "Credit Card", "provider": "Capital One"},
    {"name": "Capital One Venture X Business", "category": "Credit Card", "provider": "Capital One"},
    {"name": "Capital One Venture", "category": "Credit Card", "provider": "Capital One"},
    {"name": "Capital One Lounge Day Pass", "category": "Day Pass", "provider": "Capital One"},
    {"name": "Chase Sapphire Reserve", "category": "Credit Card", "provider": "Chase"},
    {"name": "Chase Sapphire Lounge Day Pass", "category": "Day Pass", "provider": "Chase"},
    # Priority Pass Select is referenced by JFK; it should already exist but
    # we upsert defensively.
    {"name": "Priority Pass Select", "category": "Lounge Network", "provider": "Priority Pass"},
    # Delta Sky Club access methods
    {"name": "Delta Sky Club Membership", "category": "Membership", "provider": "Delta"},
    {"name": "Delta Reserve Amex", "category": "Credit Card", "provider": "American Express"},
    {"name": "Delta Sky Club Day Pass", "category": "Day Pass", "provider": "Delta"},
    # United Club access methods
    {"name": "United Club Membership", "category": "Membership", "provider": "United"},
    {"name": "United Club Infinite Card", "category": "Credit Card", "provider": "Chase"},
    {"name": "United Club Day Pass", "category": "Day Pass", "provider": "United"},
]

# ── Capital One Lounges (3 locations) ────────────────────────────────────────
CAPITAL_ONE_LOUNGES = [
    {
        "iata_code": "DFW",
        "name": "Capital One Lounge",
        "terminal": "Terminal D",
        "operator": "Capital One",
        "location_details": "Near Gate D22",
        "is_airside": True,
        "operating_hours": {"daily": ["05:30-22:30"]},
        "amenities": {
            "has_showers": True,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
            "has_spa": True,
            "has_quiet_zone": True,
        },
        "venue_type": "lounge",
        "source_url": "https://www.capitalone.com/travel/lounges/dfw/",
        "may_deny_entry": False,
        "access_rules": [
            {
                "access_method": "Capital One Venture X",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Capital One Venture X Business",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Capital One Venture",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 0,
                "notes": "2 complimentary visits per year, then $45 per visit",
                "conditions": {"requires_same_day_flight": True, "annual_free_visits": 2, "overage_fee": 45.00},
            },
            {
                "access_method": "Capital One Lounge Day Pass",
                "entry_cost": Decimal("65.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "DEN",
        "name": "Capital One Lounge",
        "terminal": "Concourse A",
        "operator": "Capital One",
        "location_details": "Near Gate A37",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:00"]},
        "amenities": {
            "has_showers": True,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
            "has_spa": True,
            "has_quiet_zone": True,
        },
        "venue_type": "lounge",
        "source_url": "https://www.capitalone.com/travel/lounges/den/",
        "may_deny_entry": False,
        "access_rules": [
            {
                "access_method": "Capital One Venture X",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Capital One Venture X Business",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Capital One Venture",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 0,
                "notes": "2 complimentary visits per year, then $45 per visit",
                "conditions": {"requires_same_day_flight": True, "annual_free_visits": 2, "overage_fee": 45.00},
            },
            {
                "access_method": "Capital One Lounge Day Pass",
                "entry_cost": Decimal("65.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "IAD",
        "name": "Capital One Lounge",
        "terminal": "Main Terminal",
        "operator": "Capital One",
        "location_details": "Near Gate B75",
        "is_airside": True,
        "operating_hours": {"daily": ["05:30-22:00"]},
        "amenities": {
            "has_showers": True,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
            "has_spa": True,
            "has_quiet_zone": True,
        },
        "venue_type": "lounge",
        "source_url": "https://www.capitalone.com/travel/lounges/iad/",
        "may_deny_entry": False,
        "access_rules": [
            {
                "access_method": "Capital One Venture X",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Capital One Venture X Business",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Capital One Venture",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 0,
                "notes": "2 complimentary visits per year, then $45 per visit",
                "conditions": {"requires_same_day_flight": True, "annual_free_visits": 2, "overage_fee": 45.00},
            },
            {
                "access_method": "Capital One Lounge Day Pass",
                "entry_cost": Decimal("65.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
]

# ── Chase Sapphire Lounges (7 non-JFK locations) ────────────────────────────
CHASE_SAPPHIRE_LOUNGES = [
    {
        "iata_code": "BOS",
        "name": "Chase Sapphire Lounge by The Club",
        "terminal": "Terminal E",
        "operator": "Chase / Airport Dimensions",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:00"]},
        "venue_type": "lounge",
        "source_url": "https://theclubairportlounges.com/chase-sapphire/boston-logan/",
        "may_deny_entry": False,
        "amenities": {
            "has_showers": False,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
        },
        "access_rules": [
            {
                "access_method": "Chase Sapphire Reserve",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Chase Sapphire Lounge Day Pass",
                "entry_cost": Decimal("75.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "CLT",
        "name": "Chase Sapphire Lounge by The Club",
        "terminal": "Concourse B",
        "operator": "Chase / Airport Dimensions",
        "is_airside": True,
        "operating_hours": {"daily": ["06:00-21:00"]},
        "venue_type": "lounge",
        "source_url": "https://theclubairportlounges.com/chase-sapphire/charlotte/",
        "may_deny_entry": False,
        "amenities": {
            "has_showers": False,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
        },
        "access_rules": [
            {
                "access_method": "Chase Sapphire Reserve",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Chase Sapphire Lounge Day Pass",
                "entry_cost": Decimal("75.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "LAS",
        "name": "Chase Sapphire Lounge by The Club",
        "terminal": "Terminal 1 - D Gates",
        "operator": "Chase / Airport Dimensions",
        "is_airside": True,
        "operating_hours": {"daily": ["06:00-22:00"]},
        "venue_type": "lounge",
        "source_url": "https://theclubairportlounges.com/chase-sapphire/las-vegas/",
        "may_deny_entry": False,
        "amenities": {
            "has_showers": False,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
        },
        "access_rules": [
            {
                "access_method": "Chase Sapphire Reserve",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Chase Sapphire Lounge Day Pass",
                "entry_cost": Decimal("75.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "PHL",
        "name": "Chase Sapphire Lounge by The Club",
        "terminal": "Terminal B",
        "operator": "Chase / Airport Dimensions",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:00"]},
        "venue_type": "lounge",
        "source_url": "https://theclubairportlounges.com/chase-sapphire/philadelphia/",
        "may_deny_entry": False,
        "amenities": {
            "has_showers": False,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
        },
        "access_rules": [
            {
                "access_method": "Chase Sapphire Reserve",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Chase Sapphire Lounge Day Pass",
                "entry_cost": Decimal("75.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "PHX",
        "name": "Chase Sapphire Lounge by The Club",
        "terminal": "Terminal 4",
        "operator": "Chase / Airport Dimensions",
        "is_airside": True,
        "operating_hours": {"daily": ["04:30-22:00"]},
        "venue_type": "lounge",
        "source_url": "https://theclubairportlounges.com/chase-sapphire/phoenix/",
        "may_deny_entry": False,
        "amenities": {
            "has_showers": False,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
        },
        "access_rules": [
            {
                "access_method": "Chase Sapphire Reserve",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Chase Sapphire Lounge Day Pass",
                "entry_cost": Decimal("75.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "SEA",
        "name": "Chase Sapphire Lounge by The Club",
        "terminal": "Concourse B",
        "operator": "Chase / Airport Dimensions",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "venue_type": "lounge",
        "source_url": "https://theclubairportlounges.com/chase-sapphire/seattle/",
        "may_deny_entry": False,
        "amenities": {
            "has_showers": False,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
        },
        "access_rules": [
            {
                "access_method": "Chase Sapphire Reserve",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Chase Sapphire Lounge Day Pass",
                "entry_cost": Decimal("75.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
    {
        "iata_code": "SFO",
        "name": "Chase Sapphire Lounge by The Club",
        "terminal": "Terminal 1",
        "operator": "Chase / Airport Dimensions",
        "is_airside": True,
        "operating_hours": {"daily": ["05:30-22:00"]},
        "venue_type": "lounge",
        "source_url": "https://theclubairportlounges.com/chase-sapphire/san-francisco/",
        "may_deny_entry": False,
        "amenities": {
            "has_showers": False,
            "has_hot_food": True,
            "has_premium_bar": True,
            "has_wifi": True,
        },
        "access_rules": [
            {
                "access_method": "Chase Sapphire Reserve",
                "entry_cost": Decimal("0.00"),
                "guest_limit": 2,
                "guest_fee": Decimal("0.00"),
                "guest_conditions": "Guests must be traveling same day",
                "conditions": {"requires_same_day_flight": True},
            },
            {
                "access_method": "Chase Sapphire Lounge Day Pass",
                "entry_cost": Decimal("75.00"),
                "conditions": {"requires_same_day_flight": True},
            },
        ],
    },
]

# ── JFK Chase Sapphire (special case — already in DB from PP scraper) ────────
JFK_CHASE_SAPPHIRE = {
    "iata_code": "JFK",
    "name": "Chase Sapphire Lounge by The Club",
    "terminal": "Terminal 4",
    "operator": "Chase / Airport Dimensions",
    "is_airside": True,
    "operating_hours": {"daily": ["05:30-22:00"]},
    "venue_type": "lounge",
    "source_url": "https://theclubairportlounges.com/chase-sapphire/new-york-jfk/",
    "may_deny_entry": False,
    "amenities": {
        "has_showers": False,
        "has_hot_food": True,
        "has_premium_bar": True,
        "has_wifi": True,
    },
    "access_rules": [
        {
            "access_method": "Chase Sapphire Reserve",
            "entry_cost": Decimal("0.00"),
            "guest_limit": 2,
            "guest_fee": Decimal("0.00"),
            "guest_conditions": "Guests must be traveling same day",
            "conditions": {"requires_same_day_flight": True},
        },
        {
            "access_method": "Chase Sapphire Lounge Day Pass",
            "entry_cost": Decimal("75.00"),
            "conditions": {"requires_same_day_flight": True},
        },
        {
            "access_method": "Priority Pass Select",
            "entry_cost": Decimal("0.00"),
            "guest_limit": 2,
            "guest_fee": Decimal("0.00"),
            "conditions": {"requires_same_day_flight": True},
            "notes": "Also accessible via Priority Pass",
        },
    ],
}

# ── Delta Sky Club Lounges (10 hub locations) ────────────────────────────────
_DELTA_ACCESS_RULES = [
    {
        "access_method": "Delta Sky Club Membership",
        "entry_cost": Decimal("0.00"),
        "guest_limit": 2,
        "guest_fee": Decimal("50.00"),
        "guest_conditions": "Guests must be present with member",
        "conditions": {"requires_same_day_flight": True, "airline_must_be": ["DL", "DL Connection"]},
    },
    {
        "access_method": "Delta Reserve Amex",
        "entry_cost": Decimal("0.00"),
        "guest_limit": 2,
        "guest_fee": Decimal("50.00"),
        "guest_conditions": "Guests must be present with cardholder",
        "conditions": {"requires_same_day_flight": True, "airline_must_be": ["DL", "DL Connection"]},
    },
    {
        "access_method": "Delta Sky Club Day Pass",
        "entry_cost": Decimal("59.00"),
        "guest_limit": 0,
        "conditions": {"requires_same_day_flight": True, "airline_must_be": ["DL"]},
    },
]

_DELTA_BASE_AMENITIES = {
    "has_wifi": True,
    "has_hot_food": True,
    "has_premium_bar": True,
    "has_showers": True,
}

DELTA_SKY_CLUB_LOUNGES = [
    {
        "iata_code": "ATL",
        "name": "Delta Sky Club",
        "terminal": "Concourse B",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES, "has_quiet_zone": True},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "ATL",
        "name": "Delta Sky Club",
        "terminal": "Concourse A",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:30-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES, "has_quiet_zone": True},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "ATL",
        "name": "Delta Sky Club",
        "terminal": "Concourse E (International)",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES, "has_quiet_zone": True},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "JFK",
        "name": "Delta Sky Club",
        "terminal": "Terminal 4",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES, "has_quiet_zone": True},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "LAX",
        "name": "Delta Sky Club",
        "terminal": "Terminal 2",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["04:30-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES, "has_quiet_zone": True},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "DTW",
        "name": "Delta Sky Club",
        "terminal": "McNamara Terminal",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES, "has_quiet_zone": True},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "MSP",
        "name": "Delta Sky Club",
        "terminal": "Terminal 1 Concourse G",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES, "has_quiet_zone": True},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "SEA",
        "name": "Delta Sky Club",
        "terminal": "Concourse A",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "SLC",
        "name": "Delta Sky Club",
        "terminal": "Concourse A",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_DELTA_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
    {
        "iata_code": "BOS",
        "name": "Delta Sky Club",
        "terminal": "Terminal A",
        "operator": "Delta",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:30"]},
        "amenities": {**_DELTA_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.delta.com/us/en/delta-sky-club/overview",
        "may_deny_entry": True,
        "access_rules": _DELTA_ACCESS_RULES,
    },
]

# ── United Club Lounges (10 hub locations) ───────────────────────────────────
_UNITED_ACCESS_RULES = [
    {
        "access_method": "United Club Membership",
        "entry_cost": Decimal("0.00"),
        "guest_limit": 2,
        "guest_fee": Decimal("39.00"),
        "guest_conditions": "Guests must be present with member",
        "conditions": {"requires_same_day_flight": True},
    },
    {
        "access_method": "United Club Infinite Card",
        "entry_cost": Decimal("0.00"),
        "guest_limit": 2,
        "guest_fee": Decimal("39.00"),
        "guest_conditions": "Guests must be present with cardholder",
        "conditions": {"requires_same_day_flight": True},
    },
    {
        "access_method": "United Club Day Pass",
        "entry_cost": Decimal("59.00"),
        "guest_limit": 0,
        "conditions": {"requires_same_day_flight": True},
    },
]

_UNITED_BASE_AMENITIES = {
    "has_wifi": True,
    "has_hot_food": True,
    "has_premium_bar": True,
}

UNITED_CLUB_LOUNGES = [
    {
        "iata_code": "ORD",
        "name": "United Club",
        "terminal": "Terminal 1 Concourse B",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "ORD",
        "name": "United Club",
        "terminal": "Terminal 1 Concourse C",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:30-21:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "EWR",
        "name": "United Club",
        "terminal": "Terminal C",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES, "has_showers": True},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "IAH",
        "name": "United Club",
        "terminal": "Terminal E",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES, "has_showers": True},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "DEN",
        "name": "United Club",
        "terminal": "Concourse B",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "SFO",
        "name": "United Club",
        "terminal": "International Terminal",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES, "has_showers": True},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "LAX",
        "name": "United Club",
        "terminal": "Terminal 7",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["04:30-22:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "IAD",
        "name": "United Club",
        "terminal": "Concourse C",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:30-21:30"]},
        "amenities": {**_UNITED_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "LAS",
        "name": "United Club",
        "terminal": "Terminal 3",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-22:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
    {
        "iata_code": "BOS",
        "name": "United Club",
        "terminal": "Terminal B",
        "operator": "United",
        "is_airside": True,
        "operating_hours": {"daily": ["05:00-21:00"]},
        "amenities": {**_UNITED_BASE_AMENITIES},
        "venue_type": "lounge",
        "source_url": "https://www.united.com/en/us/fly/travel/airport/united-club.html",
        "may_deny_entry": True,
        "access_rules": _UNITED_ACCESS_RULES,
    },
]
# NOTE: Delta SkyMiles Reserve Amex card_id not yet in DB — add a link entry
# here once the card is seeded (e.g. card_id TBD → "Delta Reserve Amex").
# Same for United Club Infinite Card (card_id TBD → "United Club Infinite Card").
CARD_ACCESS_LINKS = [
    # Capital One Venture X → Capital One Venture X (may already exist)
    {"card_id": "cmno60v31000yfuzhnuxn5p7y", "access_method_name": "Capital One Venture X"},
    # Chase Sapphire Reserve → Chase Sapphire Reserve (may already exist)
    {"card_id": "cmno60uo20000fuzh7udcwltx", "access_method_name": "Chase Sapphire Reserve"},
]


# ── Counters ─────────────────────────────────────────────────────────────────
_counts = {
    "airports": 0,
    "access_methods": 0,
    "capital_one_lounges": 0,
    "chase_sapphire_lounges": 0,
    "delta_sky_club_lounges": 0,
    "united_club_lounges": 0,
    "access_rules": 0,
    "card_links": 0,
}


# ═════════════════════════════════════════════════════════════════════════════
# Seed functions
# ═════════════════════════════════════════════════════════════════════════════

def seed_airports() -> None:
    """Ensure all referenced airports exist in lounge_airports."""
    print("\n── Step A: Ensuring airports ──")
    for iata in REQUIRED_AIRPORTS:
        meta = US_AIRPORTS[iata]
        airport_id = upsert_airport(iata, meta["name"], meta["city"], meta["timezone"])
        logger.info("Airport %s → %s", iata, airport_id)
        _counts["airports"] += 1
    print(f"   Ensured {_counts['airports']} airports")


def seed_access_methods() -> dict[str, str]:
    """Ensure all needed access methods exist. Returns {name: id} mapping."""
    print("\n── Step B: Ensuring access methods ──")
    method_ids: dict[str, str] = {}
    for am in ACCESS_METHODS:
        mid = upsert_access_method(am["name"], am["category"], am.get("provider"))
        method_ids[am["name"]] = mid
        logger.info("Access method '%s' → %s", am["name"], mid)
        _counts["access_methods"] += 1
    print(f"   Ensured {_counts['access_methods']} access methods")
    return method_ids


def _apply_access_rules(lounge_id: str, rules: list[dict], method_ids: dict[str, str]) -> int:
    """Apply a list of access rules to a lounge. Returns count of rules applied."""
    count = 0
    for rule in rules:
        method_name = rule["access_method"]
        method_id = method_ids[method_name]
        rid = upsert_lounge_access_rule(
            lounge_id=lounge_id,
            access_method_id=method_id,
            guest_limit=rule.get("guest_limit"),
            guest_fee=rule.get("guest_fee"),
            guest_conditions=rule.get("guest_conditions"),
            entry_cost=rule.get("entry_cost"),
            conditions=rule.get("conditions"),
            notes=rule.get("notes"),
        )
        logger.info("  Rule %s (%s) → %s", method_name, rule.get("entry_cost", "free"), rid)
        count += 1
    return count


def _find_existing_lounge(iata: str, name_pattern: str) -> str | None:
    """Check if a lounge matching name_pattern already exists at this airport (e.g. from PP scraper)."""
    with get_cursor() as cur:
        cur.execute(
            """SELECT l.id FROM lounges l
               JOIN lounge_terminals lt ON lt.id = l.terminal_id
               JOIN lounge_airports la ON la.id = lt.airport_id
               WHERE la.iata_code = %s AND l.name LIKE %s
               LIMIT 1""",
            (iata, f"%{name_pattern}%"),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def seed_lounges(lounge_list: list[dict], label: str, method_ids: dict[str, str]) -> None:
    """Upsert lounge records and their access rules."""
    print(f"\n── Step: Seeding {label} lounges ──")
    count_key = label.lower().replace(" ", "_") + "_lounges"
    for entry in lounge_list:
        iata = entry["iata_code"]
        meta = US_AIRPORTS[iata]

        # Check if this lounge already exists (e.g. scraped by Priority Pass)
        existing_id = _find_existing_lounge(iata, entry["name"])
        if existing_id:
            logger.info("Found existing %s @ %s → %s — adding access rules only", entry["name"], iata, existing_id)
            print(f"   Found existing {entry['name']} @ {iata} — adding access rules only")
            lounge_id = existing_id
        else:
            airport_id = upsert_airport(iata, meta["name"], meta["city"], meta["timezone"])
            terminal_id = upsert_terminal(airport_id, entry["terminal"], is_airside=entry.get("is_airside", True))
            lounge_id = upsert_lounge(
                terminal_id=terminal_id,
                name=entry["name"],
                operator=entry.get("operator"),
                location_details=entry.get("location_details"),
                operating_hours=entry.get("operating_hours"),
                amenities=entry.get("amenities"),
                may_deny_entry=entry.get("may_deny_entry", False),
                source_url=entry.get("source_url"),
                venue_type=entry.get("venue_type", "lounge"),
            )
            logger.info("%s @ %s (%s) → %s", entry["name"], iata, entry["terminal"], lounge_id)

        rules_added = _apply_access_rules(lounge_id, entry["access_rules"], method_ids)
        _counts["access_rules"] += rules_added
        _counts[count_key] += 1

    print(f"   Upserted {_counts[count_key]} {label} lounges")


def handle_jfk_chase_sapphire(method_ids: dict[str, str]) -> None:
    """Special handling for JFK Chase Sapphire — update existing PP-scraped record.

    The Priority Pass scraper already created this lounge with the name
    'Chase Sapphire Lounge by The Club with Etihad Airways'. We rename it
    to the canonical name and add Chase-specific access rules alongside the
    existing Priority Pass rule.
    """
    print("\n── Step E: JFK Chase Sapphire (special case) ──")
    data = JFK_CHASE_SAPPHIRE

    # Try to find the existing lounge by name pattern at JFK
    existing_lounge_id = None
    with get_cursor() as cur:
        cur.execute("""
            SELECT l.id
            FROM lounges l
            JOIN lounge_terminals lt ON lt.id = l.terminal_id
            JOIN lounge_airports la ON la.id = lt.airport_id
            WHERE la.iata_code = 'JFK'
              AND l.name LIKE '%%Chase Sapphire%%'
        """)
        row = cur.fetchone()
        if row:
            existing_lounge_id = row["id"]

    if existing_lounge_id:
        logger.info("Found existing JFK Chase Sapphire lounge: %s — renaming", existing_lounge_id)
        print(f"   Found existing lounge {existing_lounge_id} — renaming & updating")

        # Rename and update metadata on the existing row
        with get_cursor() as cur:
            cur.execute("""
                UPDATE lounges SET
                    name = %s,
                    operator = %s,
                    operating_hours = %s,
                    amenities = %s,
                    may_deny_entry = %s,
                    source_url = %s,
                    venue_type = %s,
                    last_verified_at = NOW()
                WHERE id = %s
            """, (
                data["name"],
                data["operator"],
                json.dumps(data["operating_hours"]),
                json.dumps(data["amenities"]),
                data["may_deny_entry"],
                data["source_url"],
                data["venue_type"],
                existing_lounge_id,
            ))

        lounge_id = existing_lounge_id
    else:
        # Defensive: create from scratch if not found
        logger.warning("JFK Chase Sapphire lounge NOT found — creating fresh")
        print("   ⚠ Existing lounge not found — creating fresh")
        iata = data["iata_code"]
        meta = US_AIRPORTS[iata]
        airport_id = upsert_airport(iata, meta["name"], meta["city"], meta["timezone"])
        terminal_id = upsert_terminal(airport_id, data["terminal"], is_airside=data.get("is_airside", True))
        lounge_id = upsert_lounge(
            terminal_id=terminal_id,
            name=data["name"],
            operator=data.get("operator"),
            operating_hours=data.get("operating_hours"),
            amenities=data.get("amenities"),
            may_deny_entry=data.get("may_deny_entry", False),
            source_url=data.get("source_url"),
            venue_type=data.get("venue_type", "lounge"),
        )

    # Apply access rules (idempotent via ON CONFLICT)
    rules_added = _apply_access_rules(lounge_id, data["access_rules"], method_ids)
    _counts["access_rules"] += rules_added
    _counts["chase_sapphire_lounges"] += 1
    print(f"   JFK Chase Sapphire: lounge_id={lounge_id}, {rules_added} access rules applied")


def seed_card_access_links(method_ids: dict[str, str]) -> None:
    """Ensure card_lounge_access bridge rows exist."""
    print("\n── Step F: Ensuring card ↔ access method links ──")
    for link in CARD_ACCESS_LINKS:
        card_id = link["card_id"]
        method_name = link["access_method_name"]
        method_id = method_ids[method_name]

        with get_cursor() as cur:
            cur.execute("""
                SELECT id FROM card_lounge_access
                WHERE card_id = %s AND access_method_id = %s
            """, (card_id, method_id))
            existing = cur.fetchone()

        if existing:
            logger.info("Card link %s → %s already exists (%s)", card_id, method_name, existing["id"])
            print(f"   Link {method_name} already exists — skipping")
        else:
            new_id = "cl" + uuid.uuid4().hex[:23]
            with get_cursor() as cur:
                cur.execute("""
                    INSERT INTO card_lounge_access (id, card_id, access_method_id, created_at)
                    VALUES (%s, %s, %s, NOW())
                """, (new_id, card_id, method_id))
            logger.info("Created card link %s → %s (%s)", card_id, method_name, new_id)
            print(f"   Created link: {method_name} → {new_id}")

        _counts["card_links"] += 1

    print(f"   Ensured {_counts['card_links']} card links")


def print_summary() -> None:
    """Print a summary of all seed operations."""
    print("\n" + "=" * 60)
    print("SEED SUMMARY")
    print("=" * 60)
    print(f"  Airports ensured:               {_counts['airports']}")
    print(f"  Access methods ensured:          {_counts['access_methods']}")
    print(f"  Capital One lounges upserted:    {_counts['capital_one_lounges']}")
    print(f"  Chase Sapphire lounges upserted: {_counts['chase_sapphire_lounges']}")
    print(f"  Delta Sky Club lounges upserted: {_counts['delta_sky_club_lounges']}")
    print(f"  United Club lounges upserted:    {_counts['united_club_lounges']}")
    print(f"  Access rules created:            {_counts['access_rules']}")
    print(f"  Card links ensured:              {_counts['card_links']}")
    print("=" * 60)


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    print("=" * 60)
    print("Proprietary Lounge Seed — Capital One, Chase Sapphire,")
    print("                          Delta Sky Club & United Club")
    print("=" * 60)

    seed_airports()
    method_ids = seed_access_methods()
    seed_lounges(CAPITAL_ONE_LOUNGES, "Capital One", method_ids)
    seed_lounges(CHASE_SAPPHIRE_LOUNGES, "Chase Sapphire", method_ids)
    handle_jfk_chase_sapphire(method_ids)
    seed_lounges(DELTA_SKY_CLUB_LOUNGES, "Delta Sky Club", method_ids)
    seed_lounges(UNITED_CLUB_LOUNGES, "United Club", method_ids)
    seed_card_access_links(method_ids)

    print_summary()
    print("\n✅ Seed complete!")


if __name__ == "__main__":
    main()
