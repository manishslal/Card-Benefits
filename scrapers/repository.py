import json
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from .database import get_cursor
from .models import AccessRuleWithMethod, LoungeWithRules

logger = logging.getLogger(__name__)


def _generate_id() -> str:
    """Generate a unique ID compatible with Prisma's CUID format."""
    return 'cl' + uuid.uuid4().hex[:23]  # ~25 chars, starts with cl like CUID


def upsert_airport(iata_code: str, name: str, city: str, timezone: str) -> str:
    """Upsert an airport. Returns airport_id."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO lounge_airports (id, iata_code, name, city, timezone, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (iata_code) DO UPDATE SET
                name = EXCLUDED.name,
                city = EXCLUDED.city,
                timezone = EXCLUDED.timezone
            RETURNING id
        """, (_generate_id(), iata_code, name, city, timezone))
        return cur.fetchone()['id']


def upsert_terminal(airport_id: str, name: str, is_airside: bool = True) -> str:
    """Upsert a terminal. Returns terminal_id."""
    with get_cursor() as cur:
        # Check if terminal exists for this airport+name
        cur.execute("""
            SELECT id FROM lounge_terminals
            WHERE airport_id = %s AND name = %s
        """, (airport_id, name))
        existing = cur.fetchone()
        if existing:
            cur.execute("""
                UPDATE lounge_terminals SET is_airside = %s WHERE id = %s RETURNING id
            """, (is_airside, existing['id']))
            return cur.fetchone()['id']
        else:
            new_id = _generate_id()
            cur.execute("""
                INSERT INTO lounge_terminals (id, airport_id, name, is_airside, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                RETURNING id
            """, (new_id, airport_id, name, is_airside))
            return cur.fetchone()['id']


def upsert_lounge(terminal_id: str, name: str, operator: Optional[str] = None,
                  location_details: Optional[str] = None,
                  operating_hours: Optional[dict] = None,
                  amenities: Optional[dict] = None,
                  is_restaurant_credit: bool = False,
                  may_deny_entry: bool = False,
                  source_url: Optional[str] = None,
                  image_url: Optional[str] = None,
                  venue_type: str = "lounge") -> str:
    """Upsert a lounge. Returns lounge_id. Sets last_verified_at = NOW()."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id FROM lounges WHERE terminal_id = %s AND name = %s
        """, (terminal_id, name))
        existing = cur.fetchone()
        if existing:
            cur.execute("""
                UPDATE lounges SET
                    operator = %s, location_details = %s,
                    operating_hours = %s::jsonb, amenities = %s::jsonb,
                    is_restaurant_credit = %s, may_deny_entry = %s,
                    source_url = %s, image_url = %s, venue_type = %s,
                    last_verified_at = NOW()
                WHERE id = %s RETURNING id
            """, (operator, location_details,
                  json.dumps(operating_hours) if operating_hours is not None else None,
                  json.dumps(amenities) if amenities is not None else None,
                  is_restaurant_credit, may_deny_entry,
                  source_url, image_url, venue_type, existing['id']))
            return cur.fetchone()['id']
        else:
            new_id = _generate_id()
            cur.execute("""
                INSERT INTO lounges (id, terminal_id, name, operator, location_details,
                    operating_hours, amenities, is_restaurant_credit, may_deny_entry,
                    source_url, image_url, venue_type,
                    last_verified_at, created_at)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id
            """, (new_id, terminal_id, name, operator, location_details,
                  json.dumps(operating_hours) if operating_hours is not None else None,
                  json.dumps(amenities) if amenities is not None else None,
                  is_restaurant_credit, may_deny_entry,
                  source_url, image_url, venue_type))
            return cur.fetchone()['id']


def update_lounge_detail(lounge_id: str, is_airside: Optional[bool] = None,
                         gate_proximity: Optional[str] = None,
                         amenities: Optional[dict] = None,
                         access_conditions: Optional[dict] = None) -> None:
    """Update lounge with detail-page data and set detail_last_fetched_at.

    Uses COALESCE so that passing None for a field preserves the existing
    database value instead of overwriting it with NULL.
    """
    with get_cursor() as cur:
        cur.execute("""
            UPDATE lounges SET
                is_airside = COALESCE(%s, is_airside),
                gate_proximity = COALESCE(%s, gate_proximity),
                amenities = COALESCE(%s::jsonb, amenities),
                access_conditions = COALESCE(%s::jsonb, access_conditions),
                detail_last_fetched_at = NOW()
            WHERE id = %s
        """, (is_airside, gate_proximity,
              json.dumps(amenities) if amenities is not None else None,
              json.dumps(access_conditions) if access_conditions is not None else None,
              lounge_id))

        rows_affected = cur.rowcount
        logger.info(
            "update_lounge_detail %s: %d row(s) affected, amenities=%s, airside=%s",
            lounge_id, rows_affected,
            f"{len(amenities)} keys" if amenities else "None",
            is_airside,
        )


def get_lounge_by_id(lounge_id: str) -> Optional[dict]:
    """Get a lounge by ID with all fields."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM lounges WHERE id = %s", (lounge_id,))
        return cur.fetchone()


def upsert_access_method(name: str, category: str, provider: Optional[str] = None,
                         grants_network_id: Optional[str] = None) -> str:
    """Upsert an access method. Returns access_method_id."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM lounge_access_methods WHERE name = %s", (name,))
        existing = cur.fetchone()
        if existing:
            cur.execute("""
                UPDATE lounge_access_methods SET
                    category = %s, provider = %s, grants_network_id = %s
                WHERE id = %s RETURNING id
            """, (category, provider, grants_network_id, existing['id']))
            return cur.fetchone()['id']
        else:
            new_id = _generate_id()
            cur.execute("""
                INSERT INTO lounge_access_methods (id, name, category, provider, grants_network_id, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (new_id, name, category, provider, grants_network_id))
            return cur.fetchone()['id']


def upsert_lounge_access_rule(lounge_id: str, access_method_id: str,
                               guest_limit: Optional[int] = None,
                               guest_fee: Optional[Decimal] = None,
                               guest_conditions: Optional[str] = None,
                               entry_cost: Optional[Decimal] = None,
                               time_limit_hours: Optional[int] = None,
                               conditions: Optional[dict] = None,
                               notes: Optional[str] = None) -> str:
    """Upsert an access rule. Returns rule_id. Sets last_verified_at = NOW()."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO lounge_access_rules (id, lounge_id, access_method_id,
                guest_limit, guest_fee, guest_conditions, entry_cost,
                time_limit_hours, conditions, notes, last_verified_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (lounge_id, access_method_id) DO UPDATE SET
                guest_limit = EXCLUDED.guest_limit,
                guest_fee = EXCLUDED.guest_fee,
                guest_conditions = EXCLUDED.guest_conditions,
                entry_cost = EXCLUDED.entry_cost,
                time_limit_hours = EXCLUDED.time_limit_hours,
                conditions = EXCLUDED.conditions,
                notes = EXCLUDED.notes,
                last_verified_at = NOW()
            RETURNING id
        """, (_generate_id(), lounge_id, access_method_id,
              guest_limit, guest_fee,
              guest_conditions, entry_cost,
              time_limit_hours, json.dumps(conditions) if conditions else None, notes))
        return cur.fetchone()['id']


def _build_lounge_with_rules(cur, lounge: dict) -> LoungeWithRules:
    """Helper: given a lounge row dict, fetch its access rules and build LoungeWithRules."""
    cur.execute("""
        SELECT lar.id as rule_id, lam.name as access_method_name,
               lam.category as access_method_category,
               lar.guest_limit, lar.guest_fee, lar.entry_cost,
               lar.time_limit_hours, lar.conditions, lar.notes
        FROM lounge_access_rules lar
        JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
        WHERE lar.lounge_id = %s
    """, (lounge['id'],))
    rules = [AccessRuleWithMethod(**r) for r in cur.fetchall()]

    return LoungeWithRules(
        id=lounge['id'],
        terminal_id=lounge['terminal_id'],
        name=lounge['name'],
        operator=lounge.get('operator'),
        location_details=lounge.get('location_details'),
        operating_hours=lounge.get('operating_hours'),
        amenities=lounge.get('amenities'),
        is_restaurant_credit=lounge.get('is_restaurant_credit', False),
        may_deny_entry=lounge.get('may_deny_entry', False),
        last_verified_at=lounge.get('last_verified_at'),
        source_url=lounge.get('source_url'),
        image_url=lounge.get('image_url'),
        venue_type=lounge.get('venue_type', 'lounge'),
        is_airside=lounge.get('is_airside'),
        gate_proximity=lounge.get('gate_proximity'),
        access_conditions=lounge.get('access_conditions'),
        detail_last_fetched_at=lounge.get('detail_last_fetched_at'),
        airport_iata=lounge.get('airport_iata'),
        airport_name=lounge.get('airport_name'),
        terminal_name=lounge.get('terminal_name'),
        access_rules=rules,
    )


def get_lounges_by_airport(iata_code: str) -> List[LoungeWithRules]:
    """Get all lounges at an airport with their access rules."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT l.*, la.iata_code as airport_iata, la.name as airport_name,
                   lt.name as terminal_name
            FROM lounges l
            JOIN lounge_terminals lt ON l.terminal_id = lt.id
            JOIN lounge_airports la ON lt.airport_id = la.id
            WHERE la.iata_code = %s
            ORDER BY lt.name, l.name
        """, (iata_code,))
        lounges = cur.fetchall()
        return [_build_lounge_with_rules(cur, l) for l in lounges]


def get_lounges_by_access_method(access_method_name: str) -> List[LoungeWithRules]:
    """Get all lounges accessible by a given access method."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT DISTINCT l.*, la.iata_code as airport_iata, la.name as airport_name,
                   lt.name as terminal_name
            FROM lounges l
            JOIN lounge_terminals lt ON l.terminal_id = lt.id
            JOIN lounge_airports la ON lt.airport_id = la.id
            JOIN lounge_access_rules lar ON lar.lounge_id = l.id
            JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
            WHERE lam.name = %s
            ORDER BY la.iata_code, lt.name, l.name
        """, (access_method_name,))
        lounges = cur.fetchall()
        return [_build_lounge_with_rules(cur, l) for l in lounges]


def get_lounges_by_card(card_id: str) -> List[LoungeWithRules]:
    """Get all lounges accessible by a given card.
    Traverses: card -> card_lounge_access -> access_method -> (+ network chain) -> access_rules -> lounges
    """
    with get_cursor() as cur:
        # Get all access method IDs for this card, including network grants
        cur.execute("""
            WITH RECURSIVE access_chain AS (
                -- Direct access methods for the card
                SELECT lam.id, lam.name, lam.grants_network_id
                FROM card_lounge_access cla
                JOIN lounge_access_methods lam ON cla.access_method_id = lam.id
                WHERE cla.card_id = %s

                UNION

                -- Follow the network chain (e.g., Amex Platinum -> Priority Pass Select)
                SELECT lam2.id, lam2.name, lam2.grants_network_id
                FROM access_chain ac
                JOIN lounge_access_methods lam2 ON ac.grants_network_id = lam2.id
            )
            SELECT DISTINCT l.*, la.iata_code as airport_iata, la.name as airport_name,
                   lt.name as terminal_name
            FROM access_chain ac
            JOIN lounge_access_rules lar ON lar.access_method_id = ac.id
            JOIN lounges l ON lar.lounge_id = l.id
            JOIN lounge_terminals lt ON l.terminal_id = lt.id
            JOIN lounge_airports la ON lt.airport_id = la.id
            ORDER BY la.iata_code, lt.name, l.name
        """, (card_id,))
        lounges = cur.fetchall()
        return [_build_lounge_with_rules(cur, l) for l in lounges]


# Eligibility engine queries


def get_user_card_ids(user_id: str) -> list[str]:
    """Get all MasterCard IDs for a user's active, open cards.
    Chain: User → Player → UserCard (isOpen=true, status ACTIVE) → masterCardId
    """
    with get_cursor() as cur:
        cur.execute("""
            SELECT DISTINCT uc."masterCardId"
            FROM "UserCard" uc
            JOIN "Player" p ON p.id = uc."playerId"
            WHERE p."userId" = %s
              AND uc."isOpen" = true
              AND (uc.status IS NULL OR UPPER(uc.status) = 'ACTIVE')
        """, (user_id,))
        return [row['masterCardId'] for row in cur.fetchall()]


def get_access_methods_for_cards(card_ids: list[str]) -> list[dict]:
    """Get all access methods for given cards, including network grants.

    Uses a recursive CTE to follow the grants_network_id chain so that
    a card linked to "Amex Platinum" (which grants "Priority Pass Select")
    also picks up the network method.

    Returns list of dicts with keys:
        id, name, category, provider, grants_network_id,
        source_card_id, is_network_grant
    """
    if not card_ids:
        return []
    with get_cursor() as cur:
        cur.execute("""
            WITH RECURSIVE access_chain AS (
                -- Direct access methods from card_lounge_access
                SELECT lam.id, lam.name, lam.category, lam.provider,
                       lam.grants_network_id,
                       cla.card_id as source_card_id,
                       false as is_network_grant
                FROM card_lounge_access cla
                JOIN lounge_access_methods lam ON cla.access_method_id = lam.id
                WHERE cla.card_id = ANY(%s)

                UNION

                -- Follow grants_network_id chain
                SELECT lam2.id, lam2.name, lam2.category, lam2.provider,
                       lam2.grants_network_id,
                       ac.source_card_id,
                       true as is_network_grant
                FROM access_chain ac
                JOIN lounge_access_methods lam2 ON ac.grants_network_id = lam2.id
            )
            SELECT DISTINCT ON (id, source_card_id) *
            FROM access_chain
        """, (card_ids,))
        return [dict(row) for row in cur.fetchall()]


def get_lounges_at_airport_for_methods(
    access_method_ids: list[str],
    iata_code: str,
    include_paid: bool = True,
) -> list[dict]:
    """Get all lounges at an airport accessible via given access methods.

    Returns full lounge details with access rule info.
    When include_paid=False, excludes rows with a non-zero entry_cost.
    """
    if not access_method_ids:
        return []
    with get_cursor() as cur:
        paid_filter = "" if include_paid else \
            "AND (lar.entry_cost IS NULL OR lar.entry_cost = 0)"
        cur.execute(f"""
            SELECT
                l.id as lounge_id,
                l.name as lounge_name,
                lt.name as terminal,
                l.venue_type,
                l.operating_hours,
                l.amenities,
                l.source_url,
                l.image_url,
                l.may_deny_entry,
                l.is_airside,
                l.gate_proximity,
                lar.access_method_id,
                lam.name as access_method_name,
                lam.category as access_method_category,
                lar.entry_cost,
                lar.guest_limit,
                lar.guest_fee,
                lar.guest_conditions,
                lar.conditions,
                lar.notes,
                lar.time_limit_hours
            FROM lounges l
            JOIN lounge_terminals lt ON l.terminal_id = lt.id
            JOIN lounge_airports la ON lt.airport_id = la.id
            JOIN lounge_access_rules lar ON lar.lounge_id = l.id
            JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
            WHERE la.iata_code = %s
              AND lar.access_method_id = ANY(%s)
              {paid_filter}
            ORDER BY l.name, lar.entry_cost NULLS FIRST
        """, (iata_code, access_method_ids))
        return [dict(row) for row in cur.fetchall()]


# Scrape run tracking


def start_scrape_run(source_name: str) -> str:
    """Record the start of a scrape run. Returns run_id."""
    with get_cursor() as cur:
        new_id = _generate_id()
        cur.execute("""
            INSERT INTO lounge_scrape_runs (id, source_name, started_at, status)
            VALUES (%s, %s, NOW(), 'running')
            RETURNING id
        """, (new_id, source_name))
        return cur.fetchone()['id']


def complete_scrape_run(run_id: str, records_found: int, records_upserted: int,
                        errors: Optional[list] = None) -> None:
    """Mark a scrape run as completed."""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE lounge_scrape_runs SET
                completed_at = NOW(),
                records_found = %s,
                records_upserted = %s,
                errors = %s,
                status = 'completed'
            WHERE id = %s
        """, (records_found, records_upserted,
              json.dumps(errors) if errors else None, run_id))


def fail_scrape_run(run_id: str, errors: list) -> None:
    """Mark a scrape run as failed."""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE lounge_scrape_runs SET
                completed_at = NOW(),
                errors = %s,
                status = 'failed'
            WHERE id = %s
        """, (json.dumps(errors), run_id))
