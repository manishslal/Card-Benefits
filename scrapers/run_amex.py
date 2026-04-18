#!/usr/bin/env python3
"""CLI entry point for the Amex Global Lounge Collection scraper.

Usage:
    python scrapers/run_amex.py                          # Full scrape, all airports
    python scrapers/run_amex.py --dry-run                # Scrape only, no DB writes
    python scrapers/run_amex.py --airports JFK LAX ORD   # Specific airports only
    python scrapers/run_amex.py --airports JFK --dry-run # Combine flags
"""

import argparse
import asyncio
import logging
import os
import sys

# Ensure the project root is on sys.path so `scrapers` resolves as a package
# regardless of how the script is invoked (e.g. `python scrapers/run_amex.py`).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers.amex_lounge_scraper import AmexLoungeScraper


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape Amex Global Lounge Collection (Centurion, Escape, and partner lounges)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run scrape without writing to the database",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug-level logging",
    )
    parser.add_argument(
        "--airports",
        nargs="+",
        metavar="IATA",
        help="Space-separated IATA codes. If omitted, uses all seeded airports.",
    )
    args = parser.parse_args()

    # Configure logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    scraper = AmexLoungeScraper(airports=args.airports)
    result = asyncio.run(scraper.run(dry_run=args.dry_run))

    # Collect unique airports from results
    airports_seen = {r.get("airport_iata", "???") for r in result.records}

    # Summary
    mode = "(DRY RUN) " if args.dry_run else ""
    print(f"\n{'='*50}")
    print(f"Amex Lounge Scrape {mode}Complete")
    print(f"Airports processed: {len(airports_seen)}")
    print(f"Records found: {len(result.records)}")
    print(f"Errors: {len(result.errors)}")

    if args.dry_run and result.records:
        print(f"\nWould upsert the following lounges:")
        for r in result.records:
            iata = r.get("airport_iata", "???")
            name = r.get("lounge_name", "?")
            terminal = r.get("terminal_name", "")
            # Determine access label
            methods = r.get("_access_methods", [])
            access_label = methods[0]["name"] if methods else "Amex"
            print(f"  [{iata}] {name} — {terminal} — {access_label}")

    if result.errors:
        print(f"\nErrors encountered:")
        for err in result.errors:
            print(f"  ⚠  {err}")

    print(f"{'='*50}")

    # Exit with error code if scrape produced errors and no records
    if result.errors and not result.records:
        sys.exit(1)


if __name__ == "__main__":
    main()
