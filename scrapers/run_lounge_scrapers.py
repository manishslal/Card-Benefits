#!/usr/bin/env python3
"""Lounge Scraper Orchestrator — runs all (or selected) lounge scrapers in sequence.

Usage:
    python scrapers/run_lounge_scrapers.py                          # run all 4
    python scrapers/run_lounge_scrapers.py --sources amex oneworld  # subset
    python scrapers/run_lounge_scrapers.py --dry-run                # no DB writes
    python scrapers/run_lounge_scrapers.py --airports JFK ORD       # filter post-scrape
    python scrapers/run_lounge_scrapers.py --report-stale           # report only
"""

import argparse
import asyncio
import logging
import os
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

# Ensure project root is on sys.path for both script and module invocation.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers.base_scraper import ScrapeResult  # noqa: E402
from scrapers.priority_pass_scraper import PriorityPassScraper  # noqa: E402
from scrapers.amex_lounge_scraper import AmexLoungeScraper  # noqa: E402
from scrapers.star_alliance_scraper import StarAllianceScraper  # noqa: E402
from scrapers.oneworld_scraper import OneworldScraper  # noqa: E402

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scraper registry — insertion order = default execution order
# ---------------------------------------------------------------------------

SCRAPER_REGISTRY: dict[str, type] = {
    "priority_pass": PriorityPassScraper,
    "amex": AmexLoungeScraper,
    "star_alliance": StarAllianceScraper,
    "oneworld": OneworldScraper,
}

VALID_SOURCES: list[str] = list(SCRAPER_REGISTRY.keys())


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class SourceRunResult:
    """Outcome of running a single source scraper."""

    source_name: str
    records_scraped: int = 0
    records_upserted: int = 0
    error_count: int = 0
    elapsed_seconds: float = 0.0
    failed: bool = False
    failure_message: str = ""


# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    """Build and return the ArgumentParser (exposed for --help testing)."""
    parser = argparse.ArgumentParser(
        description="Lounge Scraper Orchestrator — run all or selected lounge scrapers",
    )
    parser.add_argument(
        "--sources",
        nargs="+",
        metavar="SRC",
        default=None,
        help=(
            "Run a subset of scrapers. "
            f"Valid values: {', '.join(VALID_SOURCES)}. "
            "Omit to run all."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Pass through to scrapers — scrape only, no DB writes.",
    )
    parser.add_argument(
        "--airports",
        nargs="+",
        metavar="IATA",
        help="Filter results by IATA code (e.g. --airports JFK ORD ATL).",
    )
    parser.add_argument(
        "--report-stale",
        action="store_true",
        help=(
            "Report stale lounges/rules (last_verified_at > 30 days or NULL). "
            "No scraping is performed."
        ),
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable DEBUG-level logging.",
    )
    return parser


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse CLI arguments.  Pass *argv* explicitly for testing."""
    return build_parser().parse_args(argv)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def validate_sources(sources: list[str]) -> list[str]:
    """Return any *invalid* source names (empty list = all valid)."""
    return [s for s in sources if s not in SCRAPER_REGISTRY]


# ---------------------------------------------------------------------------
# Post-scrape filtering
# ---------------------------------------------------------------------------


def filter_records_by_airports(
    records: list[dict],
    airport_codes: list[str],
) -> list[dict]:
    """Keep only records whose ``airport_iata`` is in *airport_codes* (case-insensitive)."""
    codes_upper = {c.upper() for c in airport_codes}
    return [
        r
        for r in records
        if r.get("airport_iata", "").upper() in codes_upper
    ]


# ---------------------------------------------------------------------------
# Running a single scraper
# ---------------------------------------------------------------------------


def run_single_scraper(
    source_name: str,
    dry_run: bool = False,
    airport_codes: Optional[list[str]] = None,
) -> SourceRunResult:
    """Run one scraper.  Never raises — failures are captured in the result."""
    scraper_cls = SCRAPER_REGISTRY[source_name]
    scraper = scraper_cls()

    outcome = SourceRunResult(source_name=source_name)
    t0 = time.monotonic()

    try:
        result: ScrapeResult = asyncio.run(scraper.run(dry_run=dry_run))

        # Post-scrape airport filter
        if airport_codes:
            original = len(result.records)
            result.records = filter_records_by_airports(
                result.records, airport_codes,
            )
            if original != len(result.records):
                logger.info(
                    "%s: filtered %d → %d records (airports=%s)",
                    source_name,
                    original,
                    len(result.records),
                    airport_codes,
                )

        outcome.records_scraped = len(result.records)
        outcome.error_count = len(result.errors)

        if dry_run:
            outcome.records_upserted = 0
        else:
            # Estimate upserted: total records minus upsert-specific failures.
            upsert_errors = sum(
                1 for e in result.errors if "upsert failed" in e.lower()
            )
            outcome.records_upserted = max(
                0, len(result.records) - upsert_errors,
            )

    except Exception as exc:
        outcome.failed = True
        outcome.failure_message = f"{type(exc).__name__}: {exc}"
        logger.error("Scraper %s failed: %s", source_name, exc, exc_info=True)

    outcome.elapsed_seconds = time.monotonic() - t0
    return outcome


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


def aggregate_results(results: list[SourceRunResult]) -> dict:
    """Compute totals across all source results."""
    return {
        "total_scraped": sum(r.records_scraped for r in results),
        "total_upserted": sum(r.records_upserted for r in results),
        "total_errors": sum(r.error_count for r in results),
        "failed_sources": [r.source_name for r in results if r.failed],
    }


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------


def print_header(
    sources: list[str],
    dry_run: bool,
    airport_codes: Optional[list[str]] = None,
) -> None:
    """Print the orchestrator banner."""
    mode = "dry-run" if dry_run else "live"
    print("\n=== Lounge Scraper Orchestrator ===")
    print(f"Sources: {', '.join(sources)}")
    print(f"Mode: {mode}")
    if airport_codes:
        print(f"Airport filter: {', '.join(airport_codes)}")
    print()


def print_source_result(
    index: int, total: int, result: SourceRunResult,
) -> None:
    """Print one source's result line."""
    tag = f"[{index}/{total}]"
    print(f"{tag} Running {result.source_name}...")
    if result.failed:
        print(f"  ✗ FAILED: {result.failure_message}")
    else:
        print(
            f"  ✓ {result.records_scraped} records scraped, "
            f"{result.records_upserted} upserted, "
            f"{result.error_count} errors "
            f"({result.elapsed_seconds:.1f}s)"
        )


def print_summary(
    results: list[SourceRunResult], total_time: float,
) -> None:
    """Print the final summary block."""
    agg = aggregate_results(results)
    print("\n=== Summary ===")
    print(
        f"Total: {agg['total_scraped']} records scraped, "
        f"{agg['total_upserted']} upserted, "
        f"{agg['total_errors']} errors"
    )
    if agg["failed_sources"]:
        print(f"Failed sources: {', '.join(agg['failed_sources'])}")
    print(f"Total time: {total_time:.1f}s")


def print_dry_run_detail(results: list[SourceRunResult]) -> None:
    """In dry-run mode, list what *would* be upserted per source."""
    print("\nDry-run — records that would be upserted:")
    for r in results:
        if not r.failed and r.records_scraped > 0:
            print(f"  {r.source_name}: {r.records_scraped} records")


# ---------------------------------------------------------------------------
# Stale-data report
# ---------------------------------------------------------------------------


def query_stale_lounges() -> list[dict]:
    """Return lounges not verified in 30+ days or never verified."""
    from scrapers.database import get_cursor

    with get_cursor() as cur:
        cur.execute("""
            SELECT l.name, l.operator, la.iata_code,
                   la.name as airport_name, l.last_verified_at
            FROM lounges l
            JOIN lounge_terminals lt ON l.terminal_id = lt.id
            JOIN lounge_airports la ON lt.airport_id = la.id
            WHERE l.last_verified_at < NOW() - INTERVAL '30 days'
               OR l.last_verified_at IS NULL
            ORDER BY la.iata_code, l.name
        """)
        return cur.fetchall()


def query_stale_rules() -> list[dict]:
    """Return access rules not verified in 30+ days or never verified."""
    from scrapers.database import get_cursor

    with get_cursor() as cur:
        cur.execute("""
            SELECT lar.id, l.name as lounge_name,
                   la.iata_code, lar.last_verified_at
            FROM lounge_access_rules lar
            JOIN lounges l ON lar.lounge_id = l.id
            JOIN lounge_terminals lt ON l.terminal_id = lt.id
            JOIN lounge_airports la ON lt.airport_id = la.id
            WHERE lar.last_verified_at < NOW() - INTERVAL '30 days'
               OR lar.last_verified_at IS NULL
            ORDER BY la.iata_code, l.name
        """)
        return cur.fetchall()


def format_stale_report(
    stale_lounges: list[dict],
    stale_rules: list[dict],
) -> str:
    """Build the formatted stale-data report string."""
    lines: list[str] = []
    lines.append("=== Stale Data Report ===")
    lines.append(
        "(lounges/rules not verified in 30+ days or never verified)\n"
    )

    # ── Lounges ──────────────────────────────────────────────────────
    if stale_lounges:
        lines.append(f"--- Stale Lounges ({len(stale_lounges)} total) ---")
        grouped: dict[str, list[dict]] = defaultdict(list)
        for row in stale_lounges:
            grouped[row["iata_code"]].append(row)
        for iata in sorted(grouped):
            entries = grouped[iata]
            airport_name = entries[0].get("airport_name", "")
            lines.append(
                f"\n  {iata} ({airport_name}) "
                f"— {len(entries)} stale lounge(s):"
            )
            for e in entries:
                v = e.get("last_verified_at")
                v_str = str(v.date()) if v else "never"
                op = e.get("operator") or "unknown operator"
                lines.append(
                    f"    • {e['name']} [{op}] — last verified: {v_str}"
                )
    else:
        lines.append("--- No stale lounges found ---")

    lines.append("")

    # ── Access rules ─────────────────────────────────────────────────
    if stale_rules:
        lines.append(
            f"--- Stale Access Rules ({len(stale_rules)} total) ---"
        )
        grouped_rules: dict[str, list[dict]] = defaultdict(list)
        for row in stale_rules:
            grouped_rules[row["iata_code"]].append(row)
        for iata in sorted(grouped_rules):
            entries = grouped_rules[iata]
            lines.append(f"\n  {iata} — {len(entries)} stale rule(s):")
            for e in entries:
                v = e.get("last_verified_at")
                v_str = str(v.date()) if v else "never"
                lines.append(
                    f"    • Rule for: {e['lounge_name']} "
                    f"— last verified: {v_str}"
                )
    else:
        lines.append("--- No stale access rules found ---")

    return "\n".join(lines)


def report_stale() -> None:
    """Query DB and print the stale-data report."""
    lounges = query_stale_lounges()
    rules = query_stale_rules()
    report = format_stale_report(lounges, rules)
    print(f"\n{report}")


# ---------------------------------------------------------------------------
# Aggregate scrape-run tracking
# ---------------------------------------------------------------------------


def record_aggregate_run(
    results: list[SourceRunResult],
    sources: list[str],
) -> None:
    """Write one aggregate entry to ``lounge_scrape_runs``."""
    from scrapers.repository import (
        start_scrape_run,
        complete_scrape_run,
        fail_scrape_run,
    )

    try:
        run_id = start_scrape_run("orchestrator")
        agg = aggregate_results(results)
        all_errors = [
            f"{r.source_name}: {r.failure_message}"
            for r in results
            if r.failed
        ]

        if len(agg["failed_sources"]) == len(sources):
            # Every source failed → mark the whole run as failed.
            fail_scrape_run(run_id, all_errors)
        else:
            complete_scrape_run(
                run_id,
                records_found=agg["total_scraped"],
                records_upserted=agg["total_upserted"],
                errors=all_errors or None,
            )
    except Exception as exc:
        logger.error("Failed to record aggregate scrape run: %s", exc)
        print(f"Warning: failed to record aggregate scrape run: {exc}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: Optional[list[str]] = None) -> None:
    args = parse_args(argv)

    # ── Logging ──────────────────────────────────────────────────────
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )

    # ── Report-stale exits early (no scraping) ───────────────────────
    if args.report_stale:
        report_stale()
        return

    # ── Resolve & validate sources ───────────────────────────────────
    sources = args.sources or list(SCRAPER_REGISTRY.keys())
    invalid = validate_sources(sources)
    if invalid:
        print(
            f"Error: invalid source(s): {', '.join(invalid)}\n"
            f"Valid sources: {', '.join(VALID_SOURCES)}"
        )
        sys.exit(2)

    # ── Normalize airport codes ──────────────────────────────────────
    airport_codes: Optional[list[str]] = None
    if args.airports:
        airport_codes = [
            a.upper() for a in args.airports if len(a) == 3 and a.isalpha()
        ]
        bad = [a for a in args.airports if len(a) != 3 or not a.isalpha()]
        if bad:
            print(
                f"Warning: ignoring invalid IATA code(s): {', '.join(bad)}"
            )
        if not airport_codes and args.airports:
            print(
                "Error: no valid IATA codes provided. "
                "Use 3-letter codes (e.g. JFK, ORD)."
            )
            sys.exit(2)
        if airport_codes:
            logger.info("Airport filter: %s", airport_codes)

    # ── Header ───────────────────────────────────────────────────────
    print_header(sources, args.dry_run, airport_codes)

    # ── Run scrapers sequentially ────────────────────────────────────
    results: list[SourceRunResult] = []
    t0 = time.monotonic()

    for idx, source in enumerate(sources, 1):
        outcome = run_single_scraper(
            source,
            dry_run=args.dry_run,
            airport_codes=airport_codes,
        )
        results.append(outcome)
        print_source_result(idx, len(sources), outcome)

    total_time = time.monotonic() - t0

    # ── Summary ──────────────────────────────────────────────────────
    print_summary(results, total_time)

    if args.dry_run:
        print_dry_run_detail(results)

    # ── Aggregate DB record (live mode only) ─────────────────────────
    if not args.dry_run:
        record_aggregate_run(results, sources)

    # ── Non-zero exit if any source failed ───────────────────────────
    if any(r.failed for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
