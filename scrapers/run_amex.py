#!/usr/bin/env python3
"""CLI entry point for the Amex Global Lounge Collection scraper.

Usage:
    python scrapers/run_amex.py              # Full scrape with DB writes
    python scrapers/run_amex.py --dry-run    # Scrape only, no DB writes
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
        description="Scrape Amex Global Lounge Collection (Centurion & Escape Lounges)"
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
    args = parser.parse_args()

    # Configure logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    scraper = AmexLoungeScraper()
    result = asyncio.run(scraper.run(dry_run=args.dry_run))

    # Summary
    mode = "(DRY RUN) " if args.dry_run else ""
    print(f"\n{'='*60}")
    print(f"Amex Lounge Scrape {mode}Complete")
    print(f"  Records found : {len(result.records)}")
    print(f"  Errors        : {len(result.errors)}")
    if result.errors:
        for err in result.errors:
            print(f"    ⚠  {err}")
    print(f"{'='*60}")

    if args.dry_run and result.records:
        centurion = [
            r for r in result.records if "Centurion" in r.get("lounge_name", "")
        ]
        escape = [
            r for r in result.records if "Escape" in r.get("lounge_name", "")
        ]
        print(f"\nCenturion Lounges: {len(centurion)}")
        for r in centurion:
            print(f"  • {r.get('lounge_name', '?')} @ {r.get('airport_iata', '???')} ({r.get('terminal_name', '')})")
        print(f"\nEscape Lounges: {len(escape)}")
        for r in escape:
            print(f"  • {r.get('lounge_name', '?')} @ {r.get('airport_iata', '???')} ({r.get('terminal_name', '')})")

    # Exit with error code if scrape produced errors and no records
    if result.errors and not result.records:
        sys.exit(1)


if __name__ == "__main__":
    main()
