import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from scrapers.repository import (
    upsert_airport, upsert_terminal, upsert_lounge,
    upsert_access_method, upsert_lounge_access_rule,
    get_lounges_by_airport, get_lounges_by_access_method,
    get_lounges_by_card, start_scrape_run, complete_scrape_run,
    update_lounge_detail, get_lounge_by_id,
)
from scrapers.database import get_cursor


class TestUpserts:
    def test_upsert_airport(self):
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        assert aid is not None
        # Idempotency: same IATA returns same ID
        aid2 = upsert_airport('TST', 'Test Airport Updated', 'Testville', 'America/New_York')
        assert aid == aid2

    def test_upsert_terminal(self):
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        assert tid is not None
        # Idempotency
        tid2 = upsert_terminal(aid, 'Terminal T', is_airside=False)
        assert tid == tid2

    def test_upsert_lounge_sets_verified_at(self):
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Lounge', operator='Test Operator')
        assert lid is not None
        # Verify last_verified_at is set
        with get_cursor() as cur:
            cur.execute("SELECT last_verified_at FROM lounges WHERE id = %s", (lid,))
            row = cur.fetchone()
            assert row['last_verified_at'] is not None

    def test_upsert_access_method(self):
        amid = upsert_access_method('Test Method', 'Credit Card', 'Test Provider')
        assert amid is not None
        amid2 = upsert_access_method('Test Method', 'Credit Card', 'Test Provider Updated')
        assert amid == amid2

    def test_upsert_lounge_idempotency(self):
        """Calling upsert_lounge twice with the same terminal+name returns the same ID."""
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid1 = upsert_lounge(tid, 'Test Idempotent Lounge', operator='Op1')
        lid2 = upsert_lounge(tid, 'Test Idempotent Lounge', operator='Op2')
        assert lid1 == lid2

    def test_upsert_access_rule_idempotency(self):
        """Calling upsert_lounge_access_rule twice with the same lounge+method returns the same ID."""
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Idempotent Rule Lounge')
        amid = upsert_access_method('Test Idempotent Method', 'Credit Card')
        rid1 = upsert_lounge_access_rule(lid, amid, guest_limit=2)
        rid2 = upsert_lounge_access_rule(lid, amid, guest_limit=5)
        assert rid1 == rid2

    def test_upsert_access_rule_sets_verified_at(self):
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Lounge')
        amid = upsert_access_method('Test Method', 'Credit Card')
        rid = upsert_lounge_access_rule(lid, amid, guest_limit=2, entry_cost=0)
        assert rid is not None
        with get_cursor() as cur:
            cur.execute("SELECT last_verified_at FROM lounge_access_rules WHERE id = %s", (rid,))
            row = cur.fetchone()
            assert row['last_verified_at'] is not None

    def test_zero_decimal_not_stored_as_null(self):
        """Ensure guest_fee=0 and entry_cost=0 are stored as 0, not NULL."""
        from decimal import Decimal
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Zero Fee Lounge')
        amid = upsert_access_method('Test Zero Fee Method', 'Credit Card')
        rid = upsert_lounge_access_rule(
            lid, amid,
            guest_limit=0,
            guest_fee=Decimal('0.00'),
            entry_cost=Decimal('0.00'),
            time_limit_hours=0,
        )
        with get_cursor() as cur:
            cur.execute("""
                SELECT guest_limit, guest_fee, entry_cost, time_limit_hours
                FROM lounge_access_rules WHERE id = %s
            """, (rid,))
            row = cur.fetchone()
            assert row['guest_limit'] == 0, f"guest_limit should be 0, got {row['guest_limit']}"
            assert row['guest_fee'] == Decimal('0.00'), f"guest_fee should be 0.00, got {row['guest_fee']}"
            assert row['entry_cost'] == Decimal('0.00'), f"entry_cost should be 0.00, got {row['entry_cost']}"
            assert row['time_limit_hours'] == 0, f"time_limit_hours should be 0, got {row['time_limit_hours']}"


    def test_upsert_lounge_with_enrichment_fields(self):
        """upsert_lounge with source_url, image_url, venue_type stores them correctly."""
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(
            tid, 'Enriched Lounge',
            operator='Test Op',
            source_url='https://example.com/lounge',
            image_url='https://example.com/img.jpg',
            venue_type='dining',
        )
        assert lid is not None
        with get_cursor() as cur:
            cur.execute(
                "SELECT source_url, image_url, venue_type FROM lounges WHERE id = %s",
                (lid,),
            )
            row = cur.fetchone()
            assert row['source_url'] == 'https://example.com/lounge'
            assert row['image_url'] == 'https://example.com/img.jpg'
            assert row['venue_type'] == 'dining'

    def test_upsert_lounge_enrichment_defaults(self):
        """Without enrichment args, source_url and image_url are None, venue_type is 'lounge'."""
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Default Enrichment Lounge')
        with get_cursor() as cur:
            cur.execute(
                "SELECT source_url, image_url, venue_type FROM lounges WHERE id = %s",
                (lid,),
            )
            row = cur.fetchone()
            assert row['source_url'] is None
            assert row['image_url'] is None
            assert row['venue_type'] == 'lounge'


class TestUpdateLoungeDetail:
    def test_update_lounge_detail_happy_path(self):
        """update_lounge_detail sets detail fields and detail_last_fetched_at."""
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Detail Lounge')
        update_lounge_detail(
            lid,
            is_airside=True,
            gate_proximity='Near Gate B22',
            amenities={'has_wifi': True, 'has_showers': True},
            access_conditions={'requires_boarding_pass': True, 'max_stay_hours': 3},
        )
        with get_cursor() as cur:
            cur.execute(
                "SELECT is_airside, gate_proximity, amenities, access_conditions, detail_last_fetched_at FROM lounges WHERE id = %s",
                (lid,),
            )
            row = cur.fetchone()
            assert row['is_airside'] is True
            assert row['gate_proximity'] == 'Near Gate B22'
            assert row['amenities']['has_wifi'] is True
            assert row['access_conditions']['requires_boarding_pass'] is True
            assert row['detail_last_fetched_at'] is not None

    def test_update_lounge_detail_with_none_values(self):
        """update_lounge_detail with None preserves existing values (COALESCE).

        On a freshly-created lounge the detail columns are already NULL,
        so passing None still results in NULL.
        """
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Detail None Lounge')
        update_lounge_detail(lid)
        with get_cursor() as cur:
            cur.execute(
                "SELECT is_airside, gate_proximity, amenities, access_conditions, detail_last_fetched_at FROM lounges WHERE id = %s",
                (lid,),
            )
            row = cur.fetchone()
            assert row['is_airside'] is None
            assert row['gate_proximity'] is None
            assert row['amenities'] is None
            assert row['access_conditions'] is None
            assert row['detail_last_fetched_at'] is not None  # always set

    def test_update_lounge_detail_preserves_existing_on_none(self):
        """COALESCE: calling update with None does NOT overwrite previously-set values."""
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Detail Preserve Lounge')
        # First call: set real values
        update_lounge_detail(
            lid,
            is_airside=True,
            gate_proximity='Near Gate C3',
            amenities={'has_wifi': True},
            access_conditions={'max_stay_hours': 4},
        )
        # Second call: pass None for every field — existing values must survive
        update_lounge_detail(lid)
        with get_cursor() as cur:
            cur.execute(
                "SELECT is_airside, gate_proximity, amenities, access_conditions FROM lounges WHERE id = %s",
                (lid,),
            )
            row = cur.fetchone()
            assert row['is_airside'] is True
            assert row['gate_proximity'] == 'Near Gate C3'
            assert row['amenities']['has_wifi'] is True
            assert row['access_conditions']['max_stay_hours'] == 4


class TestGetLoungeById:
    def test_get_lounge_by_id_found(self):
        """get_lounge_by_id returns dict when lounge exists."""
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Test Get By Id Lounge', operator='TestOp')
        result = get_lounge_by_id(lid)
        assert result is not None
        assert result['id'] == lid
        assert result['name'] == 'Test Get By Id Lounge'
        assert result['operator'] == 'TestOp'

    def test_get_lounge_by_id_not_found(self):
        """get_lounge_by_id returns None when lounge doesn't exist."""
        result = get_lounge_by_id('nonexistent_id_xyz')
        assert result is None


class TestQueries:
    def test_get_lounges_by_airport(self):
        # Seed test data
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        upsert_lounge(tid, 'Query Test Lounge')
        results = get_lounges_by_airport('TST')
        assert len(results) > 0
        assert results[0].airport_iata == 'TST'

    def test_get_lounges_by_access_method(self):
        aid = upsert_airport('TST', 'Test Airport', 'Testville', 'America/New_York')
        tid = upsert_terminal(aid, 'Terminal T')
        lid = upsert_lounge(tid, 'Method Test Lounge')
        amid = upsert_access_method('Test Query Method', 'Lounge Network')
        upsert_lounge_access_rule(lid, amid)
        results = get_lounges_by_access_method('Test Query Method')
        assert len(results) > 0

    def test_get_lounges_by_card_chain(self):
        """Tests the critical card -> access method -> network -> lounge chain.
        Self-contained: creates all required test data and cleans up afterward."""
        from scrapers.repository import _generate_id

        # 1. Create test airport → terminal → lounge
        aid = upsert_airport('CRD', 'Card Chain Airport', 'Chainville', 'UTC')
        tid = upsert_terminal(aid, 'Terminal CC')
        lid = upsert_lounge(tid, 'Card Chain Test Lounge', operator='Chain Op')

        # 2. Create an access method and link it to the lounge via an access rule
        amid = upsert_access_method('Test Card Chain Method', 'Credit Card', 'ChainProvider')
        upsert_lounge_access_rule(lid, amid, guest_limit=2)

        # 3. Insert a test card into MasterCard and a card_lounge_access row
        test_card_id = _generate_id()
        test_cla_id = _generate_id()
        with get_cursor() as cur:
            cur.execute("""
                INSERT INTO "MasterCard" (id, issuer, "cardName", "defaultAnnualFee", "cardImageUrl", "createdAt", "updatedAt")
                VALUES (%s, 'Test Issuer', 'Chain Test Card', 0, 'https://example.com/card.png', NOW(), NOW())
            """, (test_card_id,))
            cur.execute("""
                INSERT INTO card_lounge_access (id, card_id, access_method_id, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (test_cla_id, test_card_id, amid))

        try:
            # 4. Query and assert
            results = get_lounges_by_card(test_card_id)
            assert isinstance(results, list)
            assert len(results) >= 1, "Expected at least one lounge from the card chain"
            lounge_names = [r.name for r in results]
            assert 'Card Chain Test Lounge' in lounge_names
        finally:
            # 5. Clean up test-specific rows (access rules/lounges cleaned by session fixture)
            with get_cursor() as cur:
                cur.execute("DELETE FROM card_lounge_access WHERE id = %s", (test_cla_id,))
                cur.execute("DELETE FROM lounge_access_rules WHERE lounge_id = %s", (lid,))
                cur.execute("DELETE FROM lounges WHERE id = %s", (lid,))
                cur.execute("DELETE FROM lounge_terminals WHERE id = %s", (tid,))
                cur.execute("DELETE FROM lounge_airports WHERE iata_code = 'CRD'")
                cur.execute("DELETE FROM lounge_access_methods WHERE name = 'Test Card Chain Method'")
                cur.execute("""DELETE FROM "MasterCard" WHERE id = %s""", (test_card_id,))


class TestScrapeRuns:
    def test_scrape_run_lifecycle(self):
        run_id = start_scrape_run('test_source')
        assert run_id is not None
        complete_scrape_run(run_id, records_found=10, records_upserted=8, errors=['minor issue'])
        with get_cursor() as cur:
            cur.execute("SELECT * FROM lounge_scrape_runs WHERE id = %s", (run_id,))
            row = cur.fetchone()
            assert row['status'] == 'completed'
            assert row['records_found'] == 10
            assert row['completed_at'] is not None


# Cleanup after tests
@pytest.fixture(autouse=True, scope='session')
def cleanup():
    yield
    with get_cursor() as cur:
        cur.execute("DELETE FROM lounge_access_rules WHERE lounge_id IN (SELECT id FROM lounges WHERE name LIKE 'Test%%' OR name LIKE '%%Test%%')")
        cur.execute("DELETE FROM lounges WHERE name LIKE 'Test%%' OR name LIKE '%%Test%%' OR name LIKE '%%Enriched%%' OR name LIKE '%%Default%%' OR name LIKE '%%Detail%%' OR name LIKE '%%Query%%' OR name LIKE '%%Method%%' OR name LIKE '%%Preserve%%'")
        cur.execute("DELETE FROM lounge_terminals WHERE name LIKE 'Terminal T%%'")
        cur.execute("DELETE FROM lounge_airports WHERE iata_code = 'TST'")
        cur.execute("DELETE FROM lounge_access_methods WHERE name LIKE 'Test%%'")
        cur.execute("DELETE FROM lounge_scrape_runs WHERE source_name = 'test_source'")
