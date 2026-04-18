#!/usr/bin/env python3
"""Scraper scheduler — runs scrapers on configurable cron schedules.

Usage:
    python3 scrapers/scheduler.py              # start the scheduler daemon
    python3 scrapers/scheduler.py --dry-run    # print schedule, don't execute
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime

# Path setup
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR

logger = logging.getLogger("scrapers.scheduler")


def weekly_full_scrape():
    """Run all 4 scrapers — Priority Pass, Amex, Star Alliance, Oneworld."""
    from scrapers.run_lounge_scrapers import main as run_scrapers
    logger.info("=== Starting weekly full scrape ===")
    try:
        run_scrapers([])  # no args = all sources
        logger.info("=== Weekly full scrape complete ===")
    except Exception as exc:
        logger.error("Weekly full scrape failed: %s", exc, exc_info=True)
        raise


def daily_detail_refresh():
    """Re-fetch detail pages for lounges with stale data (>7 days old)."""
    from scrapers.lounge_detail_fetcher import batch_fetch_all
    logger.info("=== Starting daily detail refresh ===")
    try:
        result = asyncio.run(batch_fetch_all(batch_size=10, delay=3.0, force_refresh=False))
        logger.info("=== Daily detail refresh complete: %s ===", result)
    except Exception as exc:
        logger.error("Daily detail refresh failed: %s", exc, exc_info=True)
        raise


def daily_staleness_check():
    """Check for lounges not verified in 30+ days and log a warning."""
    from scrapers.run_lounge_scrapers import query_stale_lounges, query_stale_rules
    logger.info("=== Running staleness check ===")
    try:
        stale_lounges = query_stale_lounges()
        stale_rules = query_stale_rules()

        if stale_lounges:
            logger.warning(
                "STALE DATA ALERT: %d lounges not verified in 30+ days",
                len(stale_lounges),
            )
            # Group by airport for readable summary
            by_airport: dict[str, int] = {}
            for row in stale_lounges:
                iata = row.get("iata_code", "???")
                by_airport[iata] = by_airport.get(iata, 0) + 1
            for iata, count in sorted(by_airport.items()):
                logger.warning("  %s: %d stale lounge(s)", iata, count)
        else:
            logger.info("No stale lounges found — all data is fresh")

        if stale_rules:
            logger.warning(
                "STALE RULES ALERT: %d access rules not verified in 30+ days",
                len(stale_rules),
            )
        else:
            logger.info("No stale access rules found")

    except Exception as exc:
        logger.error("Staleness check failed: %s", exc, exc_info=True)
        raise


def job_listener(event):
    """Log job execution results."""
    if event.exception:
        logger.error(
            "Job %s failed with exception: %s",
            event.job_id,
            event.exception,
        )
    else:
        logger.info("Job %s executed successfully", event.job_id)


def create_scheduler() -> BlockingScheduler:
    """Create and configure the scheduler with all jobs."""
    scheduler = BlockingScheduler(
        job_defaults={
            'coalesce': True,       # If multiple missed runs, only run once
            'max_instances': 1,     # Never run same job concurrently
            'misfire_grace_time': 3600,  # 1 hour grace for misfired jobs
        }
    )

    # Weekly full scrape — Sunday at 2:00 AM UTC
    scheduler.add_job(
        weekly_full_scrape,
        'cron',
        id='weekly_full_scrape',
        day_of_week='sun',
        hour=2,
        minute=0,
        name='Weekly Full Scrape (all sources)',
    )

    # Daily detail refresh — 3:00 AM UTC
    scheduler.add_job(
        daily_detail_refresh,
        'cron',
        id='daily_detail_refresh',
        hour=3,
        minute=0,
        name='Daily Detail Page Refresh',
    )

    # Daily staleness alert — 8:00 AM UTC
    scheduler.add_job(
        daily_staleness_check,
        'cron',
        id='daily_staleness_check',
        hour=8,
        minute=0,
        name='Daily Staleness Alert',
    )

    scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    return scheduler


def print_schedule(scheduler: BlockingScheduler):
    """Print the configured schedule without starting the scheduler."""
    print("\n=== Scraper Schedule ===\n")
    for job in scheduler.get_jobs():
        print(f"  {job.name}")
        print(f"    ID: {job.id}")
        print(f"    Trigger: {job.trigger}")
        try:
            print(f"    Next run: {job.next_run_time}")
        except AttributeError:
            print(f"    Next run: (scheduler not started)")
        print()


def main():
    parser = argparse.ArgumentParser(description="Scraper scheduler daemon")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print schedule without starting the scheduler",
    )
    parser.add_argument(
        "--run-now",
        choices=["full_scrape", "detail_refresh", "staleness_check"],
        help="Immediately run a specific job then exit",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    # Logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )

    # Run-now mode: execute one job immediately and exit
    if args.run_now:
        jobs = {
            "full_scrape": weekly_full_scrape,
            "detail_refresh": daily_detail_refresh,
            "staleness_check": daily_staleness_check,
        }
        logger.info("Running %s immediately...", args.run_now)
        jobs[args.run_now]()
        logger.info("Done.")
        return

    scheduler = create_scheduler()

    if args.dry_run:
        print_schedule(scheduler)
        return

    print("Starting scraper scheduler...")
    print("Press Ctrl+C to stop.\n")
    print_schedule(scheduler)

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")
        print("\nScheduler stopped.")


if __name__ == "__main__":
    main()
