#!/usr/bin/env python3
"""CLI entry point for the Oneworld lounge scraper.

Usage:
    python scrapers/run_oneworld.py              # full run (scrape + DB upserts)
    python scrapers/run_oneworld.py --dry-run    # scrape only, skip DB writes
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
        description="Scrape Oneworld lounge finder for US airport lounges.",
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

    scraper = OneworldScraper()
    result = asyncio.run(scraper.run(dry_run=args.dry_run))

    print(f"\n{'=' * 60}")
    print(f"Oneworld Scrape Complete")
    print(f"  Records scraped : {len(result.records)}")
    print(f"  Errors          : {len(result.errors)}")
    if args.dry_run:
        print("  Mode            : DRY RUN (no DB writes)")
    print(f"{'=' * 60}")

    if result.errors:
        print("\nErrors:")
        for err in result.errors:
            print(f"  - {err}")

    if args.dry_run and result.records:
        print(f"\nFirst 5 records (of {len(result.records)}):")
        for rec in result.records[:5]:
            print(f"  [{rec.get('airport_iata', '???')}] {rec.get('lounge_name', 'Unknown')}")
            for rule in rec.get("access_rules", []):
                print(f"        → {rule['access_method']}")

    return 1 if result.errors and not result.records else 0


if __name__ == "__main__":
    sys.exit(main())
