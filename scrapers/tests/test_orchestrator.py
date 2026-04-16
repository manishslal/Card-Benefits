"""Tests for scrapers.run_lounge_scrapers (Orchestrator CLI).

All tests use mocks — no live DB or browser connection required.
"""

import sys
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.run_lounge_scrapers import (
    SourceRunResult,
    VALID_SOURCES,
    SCRAPER_REGISTRY,
    aggregate_results,
    filter_records_by_airports,
    format_stale_report,
    main,
    parse_args,
    print_header,
    print_source_result,
    print_summary,
    record_aggregate_run,
    run_single_scraper,
    validate_sources,
)
from scrapers.base_scraper import ScrapeResult


# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_scrape_result(
    source: str = "test",
    records: list[dict] | None = None,
    errors: list[str] | None = None,
) -> ScrapeResult:
    """Convenience factory for ScrapeResult."""
    return ScrapeResult(
        source_name=source,
        scraped_at=datetime.now(timezone.utc),
        records=records if records is not None else [],
        errors=errors if errors is not None else [],
    )


def _mock_registry(outcomes: dict[str, ScrapeResult | Exception]) -> dict:
    """Build a fake SCRAPER_REGISTRY from {name: ScrapeResult | Exception}."""
    registry: dict[str, type] = {}
    for name, outcome in outcomes.items():
        mock_cls = MagicMock()
        if isinstance(outcome, Exception):
            mock_cls.return_value.run = AsyncMock(side_effect=outcome)
        else:
            mock_cls.return_value.run = AsyncMock(return_value=outcome)
        registry[name] = mock_cls
    return registry


# ---------------------------------------------------------------------------
# 1. CLI argument parsing
# ---------------------------------------------------------------------------


class TestParseArgs:
    """--sources, --dry-run, --airports, --report-stale are parsed correctly."""

    def test_defaults(self):
        args = parse_args([])
        assert args.sources is None
        assert args.dry_run is False
        assert args.airports is None
        assert args.report_stale is False
        assert args.verbose is False

    def test_sources_single(self):
        args = parse_args(["--sources", "amex"])
        assert args.sources == ["amex"]

    def test_sources_multiple(self):
        args = parse_args(["--sources", "amex", "oneworld"])
        assert args.sources == ["amex", "oneworld"]

    def test_dry_run_flag(self):
        args = parse_args(["--dry-run"])
        assert args.dry_run is True

    def test_airports(self):
        args = parse_args(["--airports", "JFK", "ORD", "ATL"])
        assert args.airports == ["JFK", "ORD", "ATL"]

    def test_report_stale_flag(self):
        args = parse_args(["--report-stale"])
        assert args.report_stale is True

    def test_verbose_short(self):
        args = parse_args(["-v"])
        assert args.verbose is True

    def test_verbose_long(self):
        args = parse_args(["--verbose"])
        assert args.verbose is True

    def test_combined_flags(self):
        args = parse_args([
            "--sources", "amex", "oneworld",
            "--dry-run",
            "--airports", "JFK",
            "-v",
        ])
        assert args.sources == ["amex", "oneworld"]
        assert args.dry_run is True
        assert args.airports == ["JFK"]
        assert args.verbose is True


# ---------------------------------------------------------------------------
# 2. Source-name validation
# ---------------------------------------------------------------------------


class TestValidateSources:
    """Invalid source names are detected; valid ones pass through."""

    def test_all_valid(self):
        assert validate_sources(["amex", "oneworld"]) == []

    def test_single_invalid(self):
        invalid = validate_sources(["amex", "bogus"])
        assert invalid == ["bogus"]

    def test_multiple_invalid(self):
        invalid = validate_sources(["bogus", "fake"])
        assert set(invalid) == {"bogus", "fake"}

    def test_empty_list_is_valid(self):
        assert validate_sources([]) == []

    def test_all_registry_keys_are_valid(self):
        assert validate_sources(list(SCRAPER_REGISTRY.keys())) == []

    def test_registry_has_expected_sources(self):
        expected = {"priority_pass", "amex", "star_alliance", "oneworld"}
        assert set(VALID_SOURCES) == expected


# ---------------------------------------------------------------------------
# 3. Error isolation — one failure must not stop others
# ---------------------------------------------------------------------------


class TestErrorIsolation:

    def test_failure_does_not_stop_subsequent_scrapers(self):
        ok = _make_scrape_result(
            "good",
            records=[{"airport_iata": "JFK", "lounge_name": "Nice"}],
        )
        registry = _mock_registry({
            "bad": ConnectionError("boom"),
            "good": ok,
        })

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            r_bad = run_single_scraper("bad", dry_run=True)
            r_good = run_single_scraper("good", dry_run=True)

        assert r_bad.failed is True
        assert "ConnectionError" in r_bad.failure_message
        assert r_good.failed is False
        assert r_good.records_scraped == 1

    def test_all_failures_captured(self):
        registry = _mock_registry({
            "a": RuntimeError("fail-a"),
            "b": TimeoutError("fail-b"),
        })

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            r_a = run_single_scraper("a", dry_run=True)
            r_b = run_single_scraper("b", dry_run=True)

        assert r_a.failed and r_b.failed
        assert "RuntimeError" in r_a.failure_message
        assert "TimeoutError" in r_b.failure_message

    def test_failed_scraper_has_zero_records(self):
        registry = _mock_registry({"x": ValueError("oops")})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            outcome = run_single_scraper("x", dry_run=True)

        assert outcome.records_scraped == 0
        assert outcome.records_upserted == 0

    def test_elapsed_time_recorded_on_failure(self):
        registry = _mock_registry({"x": ValueError("oops")})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            outcome = run_single_scraper("x", dry_run=True)

        assert outcome.elapsed_seconds >= 0


# ---------------------------------------------------------------------------
# 4. Summary / aggregation
# ---------------------------------------------------------------------------


class TestAggregateResults:

    def test_sums_all_fields(self):
        results = [
            SourceRunResult("a", records_scraped=10, records_upserted=9, error_count=1),
            SourceRunResult("b", records_scraped=20, records_upserted=20, error_count=0),
        ]
        agg = aggregate_results(results)
        assert agg["total_scraped"] == 30
        assert agg["total_upserted"] == 29
        assert agg["total_errors"] == 1
        assert agg["failed_sources"] == []

    def test_identifies_failed_sources(self):
        results = [
            SourceRunResult("ok", records_scraped=5, records_upserted=5),
            SourceRunResult("fail", failed=True, failure_message="boom"),
        ]
        agg = aggregate_results(results)
        assert agg["failed_sources"] == ["fail"]
        assert agg["total_scraped"] == 5

    def test_empty_results_list(self):
        agg = aggregate_results([])
        assert agg["total_scraped"] == 0
        assert agg["total_upserted"] == 0
        assert agg["total_errors"] == 0
        assert agg["failed_sources"] == []

    def test_all_failed(self):
        results = [
            SourceRunResult("x", failed=True, failure_message="x"),
            SourceRunResult("y", failed=True, failure_message="y"),
        ]
        agg = aggregate_results(results)
        assert set(agg["failed_sources"]) == {"x", "y"}
        assert agg["total_scraped"] == 0


# ---------------------------------------------------------------------------
# 5. Airport filtering of results
# ---------------------------------------------------------------------------


class TestFilterRecordsByAirports:

    def test_keeps_matching_records(self):
        records = [
            {"airport_iata": "JFK", "lounge_name": "A"},
            {"airport_iata": "ORD", "lounge_name": "B"},
            {"airport_iata": "LAX", "lounge_name": "C"},
        ]
        filtered = filter_records_by_airports(records, ["JFK", "ORD"])
        assert len(filtered) == 2
        assert {r["airport_iata"] for r in filtered} == {"JFK", "ORD"}

    def test_case_insensitive_codes(self):
        records = [{"airport_iata": "JFK", "lounge_name": "A"}]
        assert len(filter_records_by_airports(records, ["jfk"])) == 1

    def test_no_match_returns_empty(self):
        records = [{"airport_iata": "JFK", "lounge_name": "A"}]
        assert filter_records_by_airports(records, ["LAX"]) == []

    def test_empty_records(self):
        assert filter_records_by_airports([], ["JFK"]) == []

    def test_missing_iata_key_excluded(self):
        records = [{"lounge_name": "No Airport"}]
        assert filter_records_by_airports(records, ["JFK"]) == []

    def test_filters_applied_in_run_single_scraper(self):
        result = _make_scrape_result(
            "test",
            records=[
                {"airport_iata": "JFK", "lounge_name": "JFK Lounge"},
                {"airport_iata": "LAX", "lounge_name": "LAX Lounge"},
                {"airport_iata": "ORD", "lounge_name": "ORD Lounge"},
            ],
        )
        registry = _mock_registry({"test": result})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            outcome = run_single_scraper(
                "test", dry_run=True, airport_codes=["JFK", "ORD"],
            )

        assert outcome.records_scraped == 2


# ---------------------------------------------------------------------------
# 6. Stale report query formatting
# ---------------------------------------------------------------------------


class TestFormatStaleReport:

    def test_stale_lounges_included(self):
        lounges = [
            {
                "name": "Sky Lounge",
                "operator": "Priority Pass",
                "iata_code": "JFK",
                "airport_name": "John F. Kennedy International",
                "last_verified_at": datetime(2024, 1, 15),
            },
            {
                "name": "Cloud Nine",
                "operator": None,
                "iata_code": "JFK",
                "airport_name": "John F. Kennedy International",
                "last_verified_at": None,
            },
        ]
        report = format_stale_report(lounges, [])
        assert "Stale Lounges (2 total)" in report
        assert "JFK" in report
        assert "Sky Lounge" in report
        assert "2024-01-15" in report
        assert "never" in report
        assert "unknown operator" in report  # None operator → fallback

    def test_stale_rules_included(self):
        rules = [
            {
                "id": "r1",
                "lounge_name": "United Club",
                "iata_code": "ORD",
                "last_verified_at": datetime(2024, 2, 1),
            },
        ]
        report = format_stale_report([], rules)
        assert "Stale Access Rules (1 total)" in report
        assert "ORD" in report
        assert "United Club" in report

    def test_no_stale_data(self):
        report = format_stale_report([], [])
        assert "No stale lounges found" in report
        assert "No stale access rules found" in report

    def test_grouped_and_sorted_by_iata(self):
        lounges = [
            {"name": "L1", "operator": "Op", "iata_code": "ORD",
             "airport_name": "O'Hare", "last_verified_at": None},
            {"name": "L2", "operator": "Op", "iata_code": "ATL",
             "airport_name": "Atlanta", "last_verified_at": None},
            {"name": "L3", "operator": "Op", "iata_code": "ATL",
             "airport_name": "Atlanta", "last_verified_at": None},
        ]
        report = format_stale_report(lounges, [])
        # ATL must appear before ORD (alphabetical sort)
        assert report.index("ATL") < report.index("ORD")
        assert "2 stale lounge(s)" in report  # ATL group count

    def test_lounge_counts_per_airport(self):
        lounges = [
            {"name": f"L{i}", "operator": "Op", "iata_code": "JFK",
             "airport_name": "JFK", "last_verified_at": None}
            for i in range(5)
        ]
        report = format_stale_report(lounges, [])
        assert "5 stale lounge(s)" in report


# ---------------------------------------------------------------------------
# 7. Output helpers (smoke tests via capsys)
# ---------------------------------------------------------------------------


class TestOutputFormatting:

    def test_print_header_live(self, capsys):
        print_header(["amex", "oneworld"], dry_run=False)
        out = capsys.readouterr().out
        assert "Lounge Scraper Orchestrator" in out
        assert "amex, oneworld" in out
        assert "Mode: live" in out

    def test_print_header_dry_run(self, capsys):
        print_header(["amex"], dry_run=True)
        out = capsys.readouterr().out
        assert "Mode: dry-run" in out

    def test_print_header_with_airports(self, capsys):
        print_header(["amex"], dry_run=False, airport_codes=["JFK", "ORD"])
        out = capsys.readouterr().out
        assert "JFK, ORD" in out

    def test_print_source_result_success(self, capsys):
        r = SourceRunResult(
            "amex",
            records_scraped=19,
            records_upserted=19,
            error_count=0,
            elapsed_seconds=1.1,
        )
        print_source_result(2, 4, r)
        out = capsys.readouterr().out
        assert "[2/4]" in out
        assert "amex" in out
        assert "✓" in out
        assert "19 records scraped" in out

    def test_print_source_result_failure(self, capsys):
        r = SourceRunResult(
            "star_alliance",
            failed=True,
            failure_message="ConnectionError: timeout",
        )
        print_source_result(3, 4, r)
        out = capsys.readouterr().out
        assert "[3/4]" in out
        assert "✗ FAILED" in out
        assert "ConnectionError" in out

    def test_print_summary(self, capsys):
        results = [
            SourceRunResult("a", records_scraped=10, records_upserted=9, error_count=1),
            SourceRunResult("b", failed=True, failure_message="err"),
        ]
        print_summary(results, total_time=3.5)
        out = capsys.readouterr().out
        assert "Summary" in out
        assert "10 records scraped" in out
        assert "Failed sources: b" in out
        assert "3.5s" in out


# ---------------------------------------------------------------------------
# 8. run_single_scraper edge cases
# ---------------------------------------------------------------------------


class TestRunSingleScraper:

    def test_dry_run_zero_upserted(self):
        result = _make_scrape_result(
            "test",
            records=[{"airport_iata": "JFK", "lounge_name": "Test"}],
        )
        registry = _mock_registry({"test": result})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            outcome = run_single_scraper("test", dry_run=True)

        assert outcome.records_upserted == 0
        assert outcome.records_scraped == 1

    def test_live_mode_estimates_upserted(self):
        result = _make_scrape_result(
            "test",
            records=[
                {"airport_iata": "JFK", "lounge_name": "A"},
                {"airport_iata": "LAX", "lounge_name": "B"},
                {"airport_iata": "ORD", "lounge_name": "C"},
            ],
            errors=["Record 1 upsert failed: bad data"],
        )
        registry = _mock_registry({"test": result})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            outcome = run_single_scraper("test", dry_run=False)

        assert outcome.records_scraped == 3
        assert outcome.records_upserted == 2  # 3 records − 1 upsert error
        assert outcome.error_count == 1

    def test_no_airport_filter_keeps_all(self):
        result = _make_scrape_result(
            "test",
            records=[
                {"airport_iata": "JFK", "lounge_name": "A"},
                {"airport_iata": "LAX", "lounge_name": "B"},
            ],
        )
        registry = _mock_registry({"test": result})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            outcome = run_single_scraper("test", dry_run=True)

        assert outcome.records_scraped == 2

    def test_elapsed_seconds_positive(self):
        result = _make_scrape_result("test")
        registry = _mock_registry({"test": result})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            outcome = run_single_scraper("test", dry_run=True)

        assert outcome.elapsed_seconds >= 0


# ---------------------------------------------------------------------------
# 9. All-invalid airport codes → sys.exit(2)
# ---------------------------------------------------------------------------


class TestAllInvalidAirportCodes:
    """When every --airports value is invalid, the orchestrator must exit(2)."""

    def test_all_invalid_airports_exits_with_code_2(self, capsys):
        """e.g. --airports 12 AB ABCD → all stripped → exit(2)."""
        with pytest.raises(SystemExit) as exc_info:
            main(["--airports", "12", "AB", "ABCD"])

        assert exc_info.value.code == 2
        captured = capsys.readouterr().out
        assert "no valid IATA codes provided" in captured

    def test_mixed_valid_and_invalid_keeps_only_valid(self, capsys):
        """e.g. --airports JFK 12 ORD AB → keeps JFK, ORD only."""
        ok_result = _make_scrape_result(
            "amex",
            records=[
                {"airport_iata": "JFK", "lounge_name": "JFK Centurion"},
                {"airport_iata": "ORD", "lounge_name": "ORD Centurion"},
                {"airport_iata": "LAX", "lounge_name": "LAX Centurion"},
            ],
        )
        registry = _mock_registry({"amex": ok_result})

        with patch.dict(
            "scrapers.run_lounge_scrapers.SCRAPER_REGISTRY", registry,
        ):
            # Should NOT exit — valid codes remain.
            main(["--sources", "amex", "--dry-run", "--airports", "JFK", "12", "ORD", "AB"])

        captured = capsys.readouterr().out
        # Warning about invalid codes should be printed
        assert "12" in captured
        assert "AB" in captured
        # The run should complete (header + summary printed)
        assert "Lounge Scraper Orchestrator" in captured
        assert "Summary" in captured


# ---------------------------------------------------------------------------
# 10. record_aggregate_run prints warning on failure
# ---------------------------------------------------------------------------


class TestRecordAggregateRunWarning:
    """M3: record_aggregate_run failure prints a warning to stdout."""

    def test_prints_warning_on_db_failure(self, capsys):
        results = [
            SourceRunResult("amex", records_scraped=5, records_upserted=5),
        ]
        with patch(
            "scrapers.repository.start_scrape_run",
            side_effect=RuntimeError("DB is down"),
        ):
            record_aggregate_run(results, ["amex"])

        captured = capsys.readouterr().out
        assert "Warning" in captured
        assert "DB is down" in captured
