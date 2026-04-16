#!/usr/bin/env python3
"""CLI entry point for Priority Pass scraper.

Usage:
    python scrapers/run_priority_pass.py              # full run (scrape + DB upserts)
    python scrapers/run_priority_pass.py --dry-run    # scrape only, skip DB writes
    python scrapers/run_priority_pass.py --airports JFK LAX MIA
    python -m scrapers.run_priority_pass --dry-run    # alternate invocation
"""

import argparse
import asyncio
import logging
import os
import sys

# Ensure the project root is importable when running as a script
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers.priority_pass_scraper import PriorityPassScraper


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape Priority Pass lounges for US airports"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run scrape without writing to the database",
    )
    parser.add_argument(
        "--airports",
        nargs="+",
        help="IATA codes to scrape (default: all seeded)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable DEBUG-level logging",
    )
    args = parser.parse_args()

    # Configure logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )

    scraper = PriorityPassScraper()
    result = asyncio.run(
        scraper.run(dry_run=args.dry_run, airport_codes=args.airports)
    )

    # ── Summary ──────────────────────────────────────────────────────
    # Count distinct airports from scraped records.
    airports_processed = len(
        {r.get("airport_iata", "") for r in result.records if r.get("airport_iata")}
    )

    print(f"\n{'=' * 50}")
    print(
        f"Priority Pass Scrape {'(DRY RUN) ' if args.dry_run else ''}Complete"
    )
    print(f"Airports processed: {airports_processed}")
    print(f"Records found: {len(result.records)}")
    print(f"Errors: {len(result.errors)}")

    if args.dry_run and result.records:
        print("\nWould upsert the following lounges:")
        for record in result.records:
            iata = record.get("airport_iata", "???")
            name = record.get("lounge_name", "unknown")
            terminal = record.get("terminal_name", "")
            venue = record.get("venue_type", "lounge")
            hours = record.get("operating_hours")
            url = record.get("source_url", "")
            hours_str = "hours: yes" if hours else "hours: no"
            url_str = "url: yes" if url else "url: no"
            print(f"  [{iata}] {name} — {terminal} — {venue} — {hours_str} — {url_str}")

    if result.errors:
        print("\nErrors encountered:")
        for err in result.errors:
            print(f"  {err}")

    print("=" * 50)

    # Exit with non-zero status if every record failed
    if result.errors and not result.records:
        sys.exit(1)


if __name__ == "__main__":
    main()
