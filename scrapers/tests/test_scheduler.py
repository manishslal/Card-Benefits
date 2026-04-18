"""Tests for scrapers/scheduler.py — verify scheduler configuration."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from unittest.mock import patch, MagicMock
import pytest


class TestSchedulerConfiguration:
    """Test that the scheduler is configured correctly."""

    def test_create_scheduler_returns_scheduler(self):
        from scrapers.scheduler import create_scheduler
        scheduler = create_scheduler()
        assert scheduler is not None

    def test_scheduler_has_three_jobs(self):
        from scrapers.scheduler import create_scheduler
        scheduler = create_scheduler()
        jobs = scheduler.get_jobs()
        assert len(jobs) == 3

    def test_weekly_scrape_job_exists(self):
        from scrapers.scheduler import create_scheduler
        scheduler = create_scheduler()
        job = scheduler.get_job('weekly_full_scrape')
        assert job is not None
        assert 'Weekly' in job.name

    def test_daily_detail_refresh_job_exists(self):
        from scrapers.scheduler import create_scheduler
        scheduler = create_scheduler()
        job = scheduler.get_job('daily_detail_refresh')
        assert job is not None
        assert 'Detail' in job.name

    def test_daily_staleness_check_job_exists(self):
        from scrapers.scheduler import create_scheduler
        scheduler = create_scheduler()
        job = scheduler.get_job('daily_staleness_check')
        assert job is not None
        assert 'Staleness' in job.name

    def test_print_schedule_dry_run(self, capsys):
        from scrapers.scheduler import create_scheduler, print_schedule
        scheduler = create_scheduler()
        print_schedule(scheduler)
        captured = capsys.readouterr()
        assert "Scraper Schedule" in captured.out
        assert "Weekly Full Scrape" in captured.out
        assert "Daily Detail Page Refresh" in captured.out
        assert "Daily Staleness Alert" in captured.out


class TestJobFunctions:
    """Test that job functions call the right underlying code."""

    @patch('scrapers.scheduler.asyncio')
    def test_daily_detail_refresh_calls_batch(self, mock_asyncio):
        from scrapers.scheduler import daily_detail_refresh
        mock_asyncio.run.return_value = {'total': 10, 'success': 8}
        daily_detail_refresh()
        mock_asyncio.run.assert_called_once()

    @patch('scrapers.run_lounge_scrapers.query_stale_lounges')
    @patch('scrapers.run_lounge_scrapers.query_stale_rules')
    def test_daily_staleness_check_logs_stale(self, mock_rules, mock_lounges):
        from scrapers.scheduler import daily_staleness_check
        mock_lounges.return_value = [
            {"iata_code": "JFK", "name": "Test Lounge"},
        ]
        mock_rules.return_value = []
        daily_staleness_check()  # Should not raise
        mock_lounges.assert_called_once()

    @patch('scrapers.run_lounge_scrapers.query_stale_lounges')
    @patch('scrapers.run_lounge_scrapers.query_stale_rules')
    def test_daily_staleness_check_no_stale(self, mock_rules, mock_lounges):
        from scrapers.scheduler import daily_staleness_check
        mock_lounges.return_value = []
        mock_rules.return_value = []
        daily_staleness_check()  # Should not raise

    @patch('scrapers.run_lounge_scrapers.main')
    def test_weekly_full_scrape_calls_main(self, mock_main):
        from scrapers.scheduler import weekly_full_scrape
        weekly_full_scrape()
        mock_main.assert_called_once_with([])
