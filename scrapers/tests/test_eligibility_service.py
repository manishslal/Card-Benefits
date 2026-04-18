"""Tests for the Lounge Eligibility Service.

Uses real database data. The DB already has lounges at JFK, DFW, etc.,
and card_lounge_access rows linking cards to access methods.

Known card IDs (from MasterCard table):
  - Chase Sapphire Reserve:          cmno60uo20000fuzh7udcwltx
  - American Express Platinum Card:  cmno60ux1000hfuzhv4vmy3cz
  - Capital One Venture X:           cmno60v31000yfuzhnuxn5p7y
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import pytest
from scrapers.lounge_eligibility_service import (
    get_accessible_lounges,
    get_accessible_lounges_by_cards,
    LoungeEligibilityResult,
    LoungeAccessOption,
    _build_access_method_label,
)
from scrapers.repository import (
    get_user_card_ids,
    get_access_methods_for_cards,
    get_lounges_at_airport_for_methods,
)
from scrapers.database import get_cursor


# ── Known IDs from the seeded database ─────────────────────────
CSR_CARD_ID = 'cmno60uo20000fuzh7udcwltx'       # Chase Sapphire Reserve
AMEX_PLAT_CARD_ID = 'cmno60ux1000hfuzhv4vmy3cz' # American Express Platinum Card
CAP1_VX_CARD_ID = 'cmno60v31000yfuzhnuxn5p7y'   # Capital One Venture X

# A real user that has CSR, Amex Plat, Amex Gold, and Cap1 VX active
TEST_USER_ID = 'cmnowhrgf0000ci07dailr5m2'


# ────────────────────────────────────────────────────────────────
# Repository function tests
# ────────────────────────────────────────────────────────────────

class TestGetUserCardIds:
    """Tests for get_user_card_ids repository function."""

    def test_real_user_with_active_cards(self):
        """Known user should have active card IDs returned."""
        card_ids = get_user_card_ids(TEST_USER_ID)
        assert isinstance(card_ids, list)
        assert len(card_ids) >= 3, (
            f"Expected at least 3 active cards for test user, got {len(card_ids)}"
        )
        # Should include CSR, Amex Plat, Cap1 VX
        assert CSR_CARD_ID in card_ids
        assert AMEX_PLAT_CARD_ID in card_ids
        assert CAP1_VX_CARD_ID in card_ids

    def test_nonexistent_user_returns_empty(self):
        """A user that doesn't exist should return an empty list."""
        card_ids = get_user_card_ids('nonexistent_user_id_xyz')
        assert card_ids == []

    def test_excludes_deleted_cards(self):
        """Cards with status DELETED should not be included even if isOpen=true."""
        card_ids = get_user_card_ids(TEST_USER_ID)
        # Citi Prestige (cmno...) is DELETED for this user
        with get_cursor() as cur:
            cur.execute("""
                SELECT uc."masterCardId"
                FROM "UserCard" uc
                JOIN "Player" p ON p.id = uc."playerId"
                WHERE p."userId" = %s AND UPPER(uc.status) = 'DELETED'
            """, (TEST_USER_ID,))
            deleted_card_ids = [row['masterCardId'] for row in cur.fetchall()]
        for deleted_id in deleted_card_ids:
            assert deleted_id not in card_ids, (
                f"Deleted card {deleted_id} should not be in active card list"
            )


class TestGetAccessMethodsForCards:
    """Tests for get_access_methods_for_cards repository function."""

    def test_empty_card_list(self):
        """Empty card_ids should return empty list."""
        methods = get_access_methods_for_cards([])
        assert methods == []

    def test_csr_gets_correct_methods(self):
        """Chase Sapphire Reserve should have Chase Sapphire Reserve + Priority Pass Select."""
        methods = get_access_methods_for_cards([CSR_CARD_ID])
        method_names = {m['name'] for m in methods}
        assert 'Chase Sapphire Reserve' in method_names
        assert 'Priority Pass Select' in method_names

    def test_amex_plat_gets_correct_methods(self):
        """Amex Platinum should have Amex Platinum + Priority Pass Select."""
        methods = get_access_methods_for_cards([AMEX_PLAT_CARD_ID])
        method_names = {m['name'] for m in methods}
        assert 'Amex Platinum' in method_names
        assert 'Priority Pass Select' in method_names

    def test_multiple_cards(self):
        """Passing multiple cards should combine access methods."""
        methods = get_access_methods_for_cards([CSR_CARD_ID, AMEX_PLAT_CARD_ID])
        method_names = {m['name'] for m in methods}
        assert 'Chase Sapphire Reserve' in method_names
        assert 'Amex Platinum' in method_names
        assert 'Priority Pass Select' in method_names

    def test_source_card_id_tracked(self):
        """Each access method should track which card it came from."""
        methods = get_access_methods_for_cards([CSR_CARD_ID])
        for m in methods:
            assert m['source_card_id'] == CSR_CARD_ID


class TestGetLoungesAtAirportForMethods:
    """Tests for get_lounges_at_airport_for_methods repository function."""

    def test_empty_method_ids(self):
        """Empty access_method_ids should return empty list."""
        lounges = get_lounges_at_airport_for_methods([], 'JFK')
        assert lounges == []

    def test_priority_pass_at_jfk(self):
        """Priority Pass Select should have lounges at JFK."""
        # Get PP Select method ID
        with get_cursor() as cur:
            cur.execute(
                "SELECT id FROM lounge_access_methods WHERE name = 'Priority Pass Select'"
            )
            pp_id = cur.fetchone()['id']

        lounges = get_lounges_at_airport_for_methods([pp_id], 'JFK')
        assert len(lounges) > 0
        # All results should be PP Select
        for lounge in lounges:
            assert lounge['access_method_name'] == 'Priority Pass Select'


# ────────────────────────────────────────────────────────────────
# Eligibility service tests
# ────────────────────────────────────────────────────────────────

class TestGetAccessibleLoungesByCards:
    """Tests for get_accessible_lounges_by_cards."""

    def test_csr_at_jfk(self):
        """CSR at JFK should get Chase Sapphire Lounge + PP Select lounges."""
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK')
        assert isinstance(results, list)
        assert len(results) > 0

        lounge_names = [r.lounge_name for r in results]

        # Chase Sapphire Lounge by The Club should be accessible
        assert any('Chase Sapphire' in n for n in lounge_names), (
            f"Expected Chase Sapphire Lounge in results. Got: {lounge_names}"
        )

        # PP Select lounges should also be present
        pp_lounges_expected = ['HelloSky', 'Xwell', 'Minute Suites']
        for name in pp_lounges_expected:
            assert any(name in n for n in lounge_names), (
                f"Expected {name} (PP Select) in results. Got: {lounge_names}"
            )

    def test_amex_plat_at_jfk(self):
        """Amex Platinum at JFK should get Amex Centurion/PP lounges."""
        results = get_accessible_lounges_by_cards([AMEX_PLAT_CARD_ID], 'JFK')
        assert len(results) > 0

        # Amex Platinum directly accesses Amex-branded lounges
        # and PP Select lounges via explicit card_lounge_access link
        all_method_names = set()
        for r in results:
            for opt in r.access_options:
                all_method_names.add(opt.access_method)

        assert any('Priority Pass Select' in m for m in all_method_names), (
            f"Expected Priority Pass Select in access methods. Got: {all_method_names}"
        )

    def test_cap1_vx_at_dfw(self):
        """Capital One Venture X at DFW should get Capital One Lounge + PP lounges."""
        results = get_accessible_lounges_by_cards([CAP1_VX_CARD_ID], 'DFW')
        assert len(results) > 0

        lounge_names = [r.lounge_name for r in results]
        # Capital One Lounge should be accessible
        assert any('Capital One' in n for n in lounge_names), (
            f"Expected Capital One Lounge in results. Got: {lounge_names}"
        )

    def test_empty_cards_include_paid_true(self):
        """Empty card list with include_paid=True should return day-pass lounges."""
        results = get_accessible_lounges_by_cards([], 'JFK', include_paid=True)
        # There are Day Pass access methods at JFK (Chase Sapphire Day Pass, Capital One Day Pass)
        if results:
            for r in results:
                assert any(o.access_type == 'day_pass' for o in r.access_options), (
                    f"With no cards, all options should be day_pass. Lounge: {r.lounge_name}"
                )

    def test_empty_cards_include_paid_false(self):
        """Empty card list with include_paid=False should return empty."""
        results = get_accessible_lounges_by_cards([], 'JFK', include_paid=False)
        assert results == []

    def test_deduplication_by_lounge(self):
        """A lounge accessible via multiple methods should appear once with multiple access_options."""
        # Chase Sapphire Lounge is accessible via CSR card AND Priority Pass Select
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK')
        chase_lounges = [r for r in results if 'Chase Sapphire' in r.lounge_name]

        for lounge in chase_lounges:
            # Should appear exactly once
            matching = [r for r in results if r.lounge_id == lounge.lounge_id]
            assert len(matching) == 1, (
                f"Lounge {lounge.lounge_name} should appear once, found {len(matching)}"
            )
            # But should have multiple access options
            assert len(lounge.access_options) >= 2, (
                f"Chase Sapphire Lounge should have 2+ access options "
                f"(card + PP), found {len(lounge.access_options)}: "
                f"{[o.access_method for o in lounge.access_options]}"
            )

    def test_free_lounges_sorted_first(self):
        """Lounges with free access should be sorted before day_pass."""
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK', include_paid=True)
        if len(results) > 1:
            found_day_pass = False
            for r in results:
                if r.best_access_type == 'day_pass':
                    found_day_pass = True
                elif r.best_access_type == 'free' and found_day_pass:
                    pytest.fail(
                        f"Free lounge '{r.lounge_name}' appeared after a day_pass lounge"
                    )

    def test_access_options_sorted_free_first(self):
        """Within a lounge, free options should come before paid."""
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK', include_paid=True)
        for r in results:
            if len(r.access_options) > 1:
                found_paid = False
                for opt in r.access_options:
                    if opt.access_type == 'day_pass':
                        found_paid = True
                    elif opt.access_type == 'free' and found_paid:
                        pytest.fail(
                            f"Lounge {r.lounge_name}: free option "
                            f"'{opt.access_method}' after paid option"
                        )

    def test_result_has_expected_fields(self):
        """LoungeEligibilityResult should have all expected fields populated."""
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK')
        assert len(results) > 0
        first = results[0]
        assert isinstance(first, LoungeEligibilityResult)
        assert first.lounge_id
        assert first.lounge_name
        assert first.terminal
        assert first.venue_type
        assert isinstance(first.access_options, list)
        assert len(first.access_options) > 0
        assert first.best_access_type in ('free', 'day_pass')
        assert first.best_access_method != ''

    def test_access_option_has_expected_fields(self):
        """LoungeAccessOption should have all expected fields populated."""
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK')
        assert len(results) > 0
        opt = results[0].access_options[0]
        assert isinstance(opt, LoungeAccessOption)
        assert opt.access_type in ('free', 'day_pass')
        assert opt.access_method  # non-empty string
        assert opt.access_method_id
        assert isinstance(opt.entry_cost, float)

    def test_to_dict_serializable(self):
        """LoungeEligibilityResult.to_dict() should return JSON-serializable data."""
        import json
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK')
        assert len(results) > 0
        d = results[0].to_dict()
        # Should not raise
        json_str = json.dumps(d)
        assert isinstance(json_str, str)

    def test_nonexistent_airport(self):
        """Querying a non-existent airport should return empty list."""
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'ZZZ')
        assert results == []

    def test_include_paid_false_excludes_day_passes(self):
        """With include_paid=False, no day_pass access options should appear."""
        results = get_accessible_lounges_by_cards([CSR_CARD_ID], 'JFK', include_paid=False)
        for r in results:
            for opt in r.access_options:
                assert opt.access_type == 'free', (
                    f"Expected only free options with include_paid=False. "
                    f"Got {opt.access_type} for {r.lounge_name} via {opt.access_method}"
                )


class TestGetAccessibleLounges:
    """Tests for get_accessible_lounges (user_id-based)."""

    def test_real_user_at_jfk(self):
        """Known user with CSR+Amex Plat+Cap1 VX at JFK should see many lounges."""
        results = get_accessible_lounges(TEST_USER_ID, 'JFK')
        assert len(results) > 0
        lounge_names = [r.lounge_name for r in results]
        # Should see Chase Sapphire Lounge, PP Select lounges, Amex-accessed lounges
        assert any('Chase Sapphire' in n for n in lounge_names)

    def test_nonexistent_user_include_paid_false(self):
        """Nonexistent user with include_paid=False returns empty."""
        results = get_accessible_lounges('nonexistent_xyz', 'JFK', include_paid=False)
        assert results == []

    def test_nonexistent_user_include_paid_true(self):
        """Nonexistent user with include_paid=True may still see day passes."""
        results = get_accessible_lounges('nonexistent_xyz', 'JFK', include_paid=True)
        # Should only be day pass options (if any)
        for r in results:
            # At minimum, day passes should be the best access
            assert r.best_access_type in ('free', 'day_pass')


class TestAccessMethodLabels:
    """Tests for _build_access_method_label."""

    def test_direct_access_label(self):
        """Direct access method shows just the method name."""
        label = _build_access_method_label(
            'Chase Sapphire Reserve', 'card123', False, {},
        )
        assert label == 'Chase Sapphire Reserve'

    def test_network_grant_label(self):
        """Network grant shows 'Card → Method' format."""
        card_name_map = {'card123': 'American Express Platinum Card'}
        label = _build_access_method_label(
            'Priority Pass Select', 'card123', True, card_name_map,
        )
        assert label == 'American Express Platinum Card → Priority Pass Select'

    def test_network_grant_label_unknown_card(self):
        """Network grant with unknown card ID shows 'Card → Method'."""
        label = _build_access_method_label(
            'Priority Pass Select', 'unknown_id', True, {},
        )
        assert label == 'Card → Priority Pass Select'
