"""Lounge Eligibility Service

Determines which airport lounges a user can access based on their credit cards.

Usage:
    from scrapers.lounge_eligibility_service import get_accessible_lounges

    results = get_accessible_lounges(user_id="abc123", iata_code="JFK")
    for lounge in results:
        print(lounge.lounge_name, lounge.best_access_type)
"""
import json
import logging
from dataclasses import dataclass, field, asdict
from decimal import Decimal
from typing import Optional

from .repository import (
    get_user_card_ids,
    get_access_methods_for_cards,
    get_lounges_at_airport_for_methods,
)
from .database import get_cursor

logger = logging.getLogger(__name__)


@dataclass
class LoungeAccessOption:
    """One way a user can access a lounge (a lounge may have multiple)."""

    access_type: str           # "free" | "day_pass"
    access_method: str         # Human-readable, e.g. "Amex Platinum"
    access_method_id: str
    entry_cost: float
    guest_limit: Optional[int] = None
    guest_fee: Optional[float] = None
    guest_conditions: Optional[str] = None
    has_conditions: bool = False
    conditions: dict = field(default_factory=dict)
    notes: Optional[str] = None
    time_limit_hours: Optional[int] = None


@dataclass
class LoungeEligibilityResult:
    """A lounge with all access options available to the user."""

    lounge_id: str
    lounge_name: str
    terminal: str
    venue_type: str
    operating_hours: Optional[dict] = None
    amenities: Optional[dict] = None
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    may_deny_entry: bool = False
    is_airside: Optional[bool] = None
    gate_proximity: Optional[str] = None
    access_options: list[LoungeAccessOption] = field(default_factory=list)
    best_access_type: str = "day_pass"   # "free" if any option is free
    best_access_method: str = ""

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict."""
        d = asdict(self)
        # Convert Decimal to float for JSON serialization
        for opt in d.get('access_options', []):
            for key in ('entry_cost', 'guest_fee'):
                if isinstance(opt.get(key), Decimal):
                    opt[key] = float(opt[key])
        return d


def _build_access_method_label(
    method_name: str,
    source_card_id: str,
    is_network_grant: bool,
    card_name_map: dict,
) -> str:
    """Build human-readable access method label.

    Direct:  "Chase Sapphire Reserve"
    Network: "Amex Platinum → Priority Pass Select"
    """
    if is_network_grant:
        card_name = card_name_map.get(source_card_id, "Card")
        return f"{card_name} → {method_name}"
    return method_name


def get_accessible_lounges(
    user_id: str,
    iata_code: str,
    include_paid: bool = True,
) -> list[LoungeEligibilityResult]:
    """Get all lounges accessible to a user at a given airport.

    Args:
        user_id: The user's ID (from User table).
        iata_code: Airport IATA code (e.g. "JFK").
        include_paid: Whether to include day-pass options (default True).

    Returns:
        List of LoungeEligibilityResult grouped by lounge,
        each with all applicable access options, sorted so
        free lounges come first.
    """
    card_ids = get_user_card_ids(user_id)
    if not card_ids and not include_paid:
        return []

    return get_accessible_lounges_by_cards(card_ids, iata_code, include_paid)


def get_accessible_lounges_by_cards(
    card_ids: list[str],
    iata_code: str,
    include_paid: bool = True,
) -> list[LoungeEligibilityResult]:
    """Get all lounges accessible with specific cards at a given airport.

    Useful for the "what if I had this card" feature or when the caller
    already has the card IDs.
    """
    # Step 1: Build card name map for display labels
    card_name_map: dict[str, str] = {}
    if card_ids:
        with get_cursor() as cur:
            cur.execute(
                'SELECT id, "cardName" FROM "MasterCard" WHERE id = ANY(%s)',
                (card_ids,),
            )
            for row in cur.fetchall():
                card_name_map[row['id']] = row['cardName']

    # Step 2: Get all access methods for cards (including network grants)
    access_methods = get_access_methods_for_cards(card_ids)
    access_method_ids = list({am['id'] for am in access_methods})

    # Step 3: Also include day-pass methods at this airport if requested
    if include_paid:
        with get_cursor() as cur:
            cur.execute("""
                SELECT DISTINCT lar.access_method_id
                FROM lounge_access_rules lar
                JOIN lounges l ON lar.lounge_id = l.id
                JOIN lounge_terminals lt ON l.terminal_id = lt.id
                JOIN lounge_airports la ON lt.airport_id = la.id
                JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
                WHERE la.iata_code = %s AND lam.category = 'Day Pass'
            """, (iata_code,))
            for row in cur.fetchall():
                dp_id = row['access_method_id']
                if dp_id not in access_method_ids:
                    access_method_ids.append(dp_id)
                    access_methods.append({
                        'id': dp_id,
                        'name': None,  # will be filled from lounge query
                        'category': 'Day Pass',
                        'provider': None,
                        'grants_network_id': None,
                        'source_card_id': None,
                        'is_network_grant': False,
                    })

    if not access_method_ids:
        return []

    # Step 4: Get lounges at airport for all resolved access methods
    lounge_rows = get_lounges_at_airport_for_methods(
        access_method_ids, iata_code, include_paid=True,
    )

    # Step 5: Build method lookup for labeling
    method_lookup: dict[str, list[dict]] = {}
    for am in access_methods:
        method_lookup.setdefault(am['id'], []).append(am)

    # Step 6: Group by lounge and build results
    lounges_map: dict[str, LoungeEligibilityResult] = {}

    for row in lounge_rows:
        lid = row['lounge_id']
        entry_cost = float(row['entry_cost'] or 0)
        is_free = entry_cost == 0

        # Skip paid options when caller requested free-only
        if not include_paid and not is_free:
            continue

        # Parse conditions JSONB
        conditions = row.get('conditions') or {}
        if isinstance(conditions, str):
            conditions = json.loads(conditions)

        # Build human-readable label
        method_id = row['access_method_id']
        method_info_list = method_lookup.get(method_id, [])
        if method_info_list:
            mi = method_info_list[0]
            label = _build_access_method_label(
                row['access_method_name'],
                mi.get('source_card_id', ''),
                mi.get('is_network_grant', False),
                card_name_map,
            )
        else:
            label = row['access_method_name']

        option = LoungeAccessOption(
            access_type="free" if is_free else "day_pass",
            access_method=label,
            access_method_id=method_id,
            entry_cost=entry_cost,
            guest_limit=row.get('guest_limit'),
            guest_fee=(
                float(row['guest_fee'])
                if row.get('guest_fee') is not None
                else None
            ),
            guest_conditions=row.get('guest_conditions'),
            has_conditions=bool(conditions),
            conditions=conditions,
            notes=row.get('notes'),
            time_limit_hours=row.get('time_limit_hours'),
        )

        if lid not in lounges_map:
            # Parse JSONB fields
            oh = row.get('operating_hours')
            if isinstance(oh, str):
                oh = json.loads(oh)
            am = row.get('amenities')
            if isinstance(am, str):
                am = json.loads(am)

            lounges_map[lid] = LoungeEligibilityResult(
                lounge_id=lid,
                lounge_name=row['lounge_name'],
                terminal=row['terminal'],
                venue_type=row.get('venue_type', 'lounge'),
                operating_hours=oh,
                amenities=am,
                source_url=row.get('source_url'),
                image_url=row.get('image_url'),
                may_deny_entry=row.get('may_deny_entry', False),
                is_airside=row.get('is_airside'),
                gate_proximity=row.get('gate_proximity'),
            )

        lounges_map[lid].access_options.append(option)

    # Step 7: Set best access and sort
    results = list(lounges_map.values())
    for result in results:
        # Free options first, then by ascending entry cost
        result.access_options.sort(
            key=lambda o: (0 if o.access_type == "free" else 1, o.entry_cost),
        )
        if result.access_options:
            best = result.access_options[0]
            result.best_access_type = best.access_type
            result.best_access_method = best.access_method

    # Free lounges first, then alphabetical
    results.sort(
        key=lambda r: (0 if r.best_access_type == "free" else 1, r.lounge_name),
    )

    return results
