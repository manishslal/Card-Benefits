#!/usr/bin/env python3
"""CLI entry point for the Oneworld lounge scraper.

Usage:
    python scrapers/run_oneworld.py                          # Full run, all airports
    python scrapers/run_oneworld.py --dry-run                # Scrape only, no DB writes
    python scrapers/run_oneworld.py --airports JFK LAX ORD   # Specific airports only
    python scrapers/run_oneworld.py --airports JFK --dry-run # Combine flags
"""

import argparse
import asyncio
import logging
import os
import sys

# Ensure the project root is on sys.path so ``scrapers`` resolves as a package
# regardless of how this script is invoked (e.g. ``python scrapers/run_oneworld.py``).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers.oneworld_scraper import OneworldScraper


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run_oneworld",
        description="Scrape Oneworld lounge listings for US airport lounges.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Scrape and print results without writing to the database.",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        default=False,
        help="Enable DEBUG-level logging.",
    )
    parser.add_argument(
        "--airports",
        nargs="+",
        metavar="IATA",
        default=None,
        help="Space-separated list of IATA codes to process. If omitted, processes all airports.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the Oneworld scraper.

    Returns 0 on success, 1 on failure.
    """
    parser = _build_parser()
    args = parser.parse_args(argv)

    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    scraper = OneworldScraper(airports=args.airports)
    result = asyncio.run(scraper.run(dry_run=args.dry_run))

    # Collect unique airports from results
    airports_seen = {r.get("airport_iata", "???") for r in result.records}

    # Summary
    mode = "(DRY RUN) " if args.dry_run else ""
    print(f"\n{'=' * 50}")
    print(f"Oneworld Scrape {mode}Complete")
    print(f"Airports processed: {len(airports_seen)}")
    print(f"Records found: {len(result.records)}")
    print(f"Errors: {len(result.errors)}")

    if args.dry_run and result.records:
        print(f"\nWould upsert the following lounges:")
        for rec in result.records:
            iata = rec.get("airport_iata", "???")
            name = rec.get("lounge_name", "?")
            terminal = rec.get("terminal_name", "")
            # Show first access method
            rules = rec.get("access_rules", [])
            access_label = rules[0]["access_method"] if rules else "Oneworld"
            print(f"  [{iata}] {name} — {terminal} — {access_label}")

    if result.errors:
        print(f"\nErrors encountered:")
        for err in result.errors:
            print(f"  ⚠  {err}")

    print(f"{'=' * 50}")

    return 1 if result.errors and not result.records else 0


if __name__ == "__main__":
    sys.exit(main())
