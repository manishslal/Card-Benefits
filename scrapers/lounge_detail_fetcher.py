"""On-demand lounge detail fetcher.

Fetches rich detail data from a lounge's source URL when a user opens a lounge.
Uses a 7-day cache to avoid re-fetching unnecessarily.

Supports batch mode via CLI:
    python -m scrapers.lounge_detail_fetcher --batch
    python -m scrapers.lounge_detail_fetcher --lounge-id <id>
"""

import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional

# Ensure project root is on sys.path so `scrapers` resolves as a package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from playwright.async_api import async_playwright

from scrapers.database import get_cursor
from scrapers.repository import get_lounge_by_id, update_lounge_detail

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

CACHE_TTL_DAYS = 7


async def fetch_lounge_detail(lounge_id: str, force_refresh: bool = False, debug: bool = False) -> Optional[dict]:
    """Fetch detailed lounge data, using 7-day cache.

    Args:
        lounge_id: The lounge ID to fetch details for.
        force_refresh: If True, bypass cache and always fetch from source.
        debug: If True, emit verbose diagnostic output.

    Returns:
        Dict with detail fields, or None if lounge not found.
    """
    lounge = get_lounge_by_id(lounge_id)
    if not lounge:
        logger.error(f"Lounge not found: {lounge_id}")
        return None

    # Check cache
    if not force_refresh and lounge.get("detail_last_fetched_at"):
        fetched_at = lounge["detail_last_fetched_at"]
        if isinstance(fetched_at, str):
            fetched_at = datetime.fromisoformat(fetched_at)
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        cache_expiry = fetched_at + timedelta(days=CACHE_TTL_DAYS)
        if datetime.now(timezone.utc) < cache_expiry:
            logger.info(f"Cache hit for lounge {lounge_id}")
            return {
                "is_airside": lounge.get("is_airside"),
                "gate_proximity": lounge.get("gate_proximity"),
                "detail_amenities": lounge.get("detail_amenities"),
                "access_conditions": lounge.get("access_conditions"),
                "detail_last_fetched_at": lounge.get("detail_last_fetched_at"),
            }

    source_url = lounge.get("source_url")
    if not source_url:
        logger.warning(f"No source_url for lounge {lounge_id}, cannot fetch detail")
        return None

    # Fetch from source
    logger.info(f"Fetching detail for lounge {lounge_id} from {source_url}")
    detail = await _scrape_detail_page(source_url, debug=debug)

    if detail:
        logger.info(
            "Writing detail for %s: amenities=%s (%d keys), airside=%s, conditions=%s (%d keys)",
            lounge_id,
            "present" if detail.get("detail_amenities") else "empty",
            len(detail.get("detail_amenities") or {}),
            detail.get("is_airside"),
            "present" if detail.get("access_conditions") else "empty",
            len(detail.get("access_conditions") or {}),
        )
        update_lounge_detail(
            lounge_id=lounge_id,
            is_airside=detail.get("is_airside"),
            gate_proximity=detail.get("gate_proximity"),
            detail_amenities=detail.get("detail_amenities"),
            access_conditions=detail.get("access_conditions"),
        )
        detail["detail_last_fetched_at"] = datetime.now(timezone.utc).isoformat()

    return detail


async def _scrape_detail_page(url: str, debug: bool = False) -> Optional[dict]:
    """Scrape a lounge detail page for rich data."""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                context = await browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1280, "height": 720},
                )
                page = await context.new_page()

                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(3000)

                if debug:
                    title = await page.title()
                    print(f"[DEBUG] Page URL: {url}")
                    print(f"[DEBUG] Page title: {title}")

                detail = {
                    "is_airside": None,
                    "gate_proximity": None,
                    "detail_amenities": {},
                    "access_conditions": {},
                }

                page_text = await page.text_content("body") or ""
                page_text_lower = page_text.lower()

                if debug:
                    print(f"[DEBUG] Body text length: {len(page_text)} chars")
                    print(f"[DEBUG] Body preview: {page_text[:500]!r}")

                # Extract is_airside
                detail["is_airside"] = _detect_airside(page_text_lower)

                # Extract gate_proximity
                detail["gate_proximity"] = _extract_gate_proximity(page_text)

                # Extract detail_amenities
                detail["detail_amenities"] = await _extract_detail_amenities(page, debug=debug)

                # Extract access_conditions
                detail["access_conditions"] = _extract_access_conditions(page_text, page_text_lower)

                return detail
            finally:
                try:
                    await browser.close()
                except Exception:
                    pass

    except Exception as exc:
        logger.error(f"Failed to scrape detail page {url}: {exc}")
        return None


def _detect_airside(text_lower: str) -> Optional[bool]:
    """Detect if lounge is airside or landside."""
    if "airside" in text_lower or "after security" in text_lower or "past security" in text_lower:
        return True
    if "landside" in text_lower or "before security" in text_lower or "pre-security" in text_lower:
        return False
    return None


def _extract_gate_proximity(text: str) -> Optional[str]:
    """Extract gate proximity info like 'Near Gate B22'."""
    patterns = [
        r'(?:near|next to|opposite|adjacent to|between|close to)\s+(?:gate[s]?\s*[A-Z]?\d+[-–\s]*(?:and|to|[-–])\s*[A-Z]?\d+|gate[s]?\s*[A-Z]?\d+)',
        r'gate[s]?\s*[A-Z]?\d+[-–\s]*(?:and|to|[-–])\s*[A-Z]?\d+',
        r'(?:near|next to|opposite|adjacent to)\s+(?:terminal|concourse|pier)\s+\w+',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return None


AMENITY_TEXT_MAP: dict[str, str] = {
    "wi-fi": "has_wifi",
    "wifi": "has_wifi",
    "wireless": "has_wifi",
    "internet": "has_wifi",
    "shower": "has_showers",
    "showers": "has_showers",
    "hot food": "has_hot_food",
    "hot meal": "has_hot_food",
    "buffet": "has_hot_food",
    "cooked food": "has_hot_food",
    "bar": "has_bar",
    "alcoholic": "has_bar",
    "cocktail": "has_bar",
    "spirits": "has_bar",
    "beer": "has_bar",
    "wine": "has_bar",
    "spa": "has_spa",
    "massage": "has_spa",
    "tv": "has_tv",
    "television": "has_tv",
    "quiet zone": "has_quiet_zone",
    "quiet area": "has_quiet_zone",
    "rest zone": "has_quiet_zone",
    "business center": "has_business_center",
    "business centre": "has_business_center",
    "workstation": "has_business_center",
    "prayer room": "has_prayer_room",
    "prayer area": "has_prayer_room",
    "children": "has_kids_area",
    "kids area": "has_kids_area",
    "play area": "has_kids_area",
    "smoking area": "has_smoking_area",
    "smoking room": "has_smoking_area",
    "disabled access": "has_disabled_access",
    "wheelchair": "has_disabled_access",
    "accessible": "has_disabled_access",
    "nap": "has_quiet_zone",
    "sleep": "has_quiet_zone",
    "newspaper": "has_newspapers",
    "magazines": "has_newspapers",
    "flight monitor": "has_flight_monitors",
    "flight information": "has_flight_monitors",
}


def _map_amenity_text(raw_text: str) -> Optional[str]:
    """Map raw amenity text scraped from a page to a canonical amenity key.

    Returns the canonical key (e.g. ``has_wifi``) or *None* if no mapping is
    found.
    """
    text = raw_text.lower().strip()
    # Direct lookup
    if text in AMENITY_TEXT_MAP:
        return AMENITY_TEXT_MAP[text]
    # Substring match – e.g. "Complimentary Wi-Fi" → has_wifi
    for phrase, key in AMENITY_TEXT_MAP.items():
        if phrase in text:
            return key
    return None


def _map_amenity_keywords(page_text_lower: str) -> dict[str, bool]:
    """Scan full page text for known amenity keywords (Strategy 2)."""
    found: dict[str, bool] = {}
    for phrase, key in AMENITY_TEXT_MAP.items():
        if phrase in page_text_lower and key not in found:
            found[key] = True
    return found


async def _extract_detail_amenities(page, debug: bool = False) -> dict:
    """Extract full amenity list from detail page.

    Strategy 1 – CSS selector scraping: look for structured amenity
    elements on the page.  Strategy 2 – Keyword matching: scan full
    body text for known amenity phrases.  Both strategies run and their
    results are merged so that keyword matches *supplement* selector
    matches.
    """
    amenities: dict[str, bool] = {}

    # --- Strategy 1: CSS selector scraping ---
    selectors = [
        '[class*="amenity"]',
        '[class*="Amenity"]',
        '[class*="facility"]',
        '[class*="Facility"]',
        '[class*="feature"]',
        '[class*="Feature"]',
        '[data-testid*="amenity"]',
        '[class*="service"]',
        '[class*="Service"]',
        'ul[class*="icon"] li',
        '[class*="lounge-info"] li',
        '[class*="LoungeInfo"] li',
        '[class*="detail"] li',
        '[class*="benefit"] li',
        '[class*="perk"]',
        '.amenities li',
        '.facilities li',
        '.features li',
        '.services li',
    ]

    if debug:
        print("[DEBUG] Strategy 1: CSS selector scraping")

    for selector in selectors:
        els = await page.query_selector_all(selector)
        if debug and els:
            print(f"[DEBUG]   Selector {selector!r} → {len(els)} elements")
        for el in els:
            text = (await el.text_content() or "").strip()
            if not text or len(text) >= 100:
                continue
            mapped = _map_amenity_text(text)
            if mapped:
                amenities[mapped] = True
                if debug:
                    print(f"[DEBUG]     Mapped {text!r} → {mapped}")
            elif debug:
                print(f"[DEBUG]     Unmapped text: {text!r}")

    if debug:
        print(f"[DEBUG] Strategy 1 result: {amenities}")

    # --- Strategy 2: Keyword matching (always runs to supplement) ---
    page_text_lower = (await page.text_content("body") or "").lower()
    keyword_matches = _map_amenity_keywords(page_text_lower)

    if debug:
        print(f"[DEBUG] Strategy 2 keyword matches: {keyword_matches}")

    # Merge – keyword matches fill in gaps
    for key, val in keyword_matches.items():
        if key not in amenities:
            amenities[key] = val

    if debug:
        print(f"[DEBUG] Final merged amenities: {amenities}")

    return amenities


def _extract_access_conditions(text: str, text_lower: str) -> dict:
    """Extract access conditions from detail page text."""
    conditions = {}

    # Boarding pass required
    if "boarding pass" in text_lower:
        conditions["requires_boarding_pass"] = True

    # Maximum stay
    stay_match = re.search(r'(?:maximum|max)[\s:]*(\d+)\s*(?:hour|hr)', text_lower)
    if stay_match:
        conditions["max_stay_hours"] = int(stay_match.group(1))

    # Guest allowance
    guest_match = re.search(r'(\d+)\s*(?:guest|visitor|companion)', text_lower)
    if guest_match:
        conditions["guest_limit"] = int(guest_match.group(1))

    # Guest fee
    fee_match = re.search(r'guest[s]?.{0,50}(?:\$|£|€|USD|GBP)[\s]*(\d+(?:\.\d{2})?)', text, re.IGNORECASE)
    if fee_match:
        conditions["guest_fee"] = fee_match.group(1)

    # Pre-booking — only set when True to avoid asserting False on pages
    # that simply don't mention booking at all.
    if any(kw in text_lower for kw in ['pre-book', 'prebook', 'advance booking', 'reservation required']):
        conditions["pre_booking_required"] = True

    # Card restrictions
    if "specific card" in text_lower or "card restriction" in text_lower:
        conditions["has_card_restrictions"] = True

    return conditions


# ---------------------------------------------------------------------------
# Batch mode
# ---------------------------------------------------------------------------


async def batch_fetch_all(batch_size: int = 10, delay: float = 3.0, force_refresh: bool = False) -> dict:
    """Fetch details for all lounges missing detail data.

    Processes sequentially with a delay between each lounge and an extra
    pause every *batch_size* lounges.

    Args:
        batch_size: Number of lounges per batch before an extra pause.
        delay: Seconds to wait between individual lounge fetches.
        force_refresh: If True, re-fetch even lounges that already have detail data.

    Returns:
        Summary dict with total/success/failed/skipped counts.
    """
    with get_cursor() as cur:
        if force_refresh:
            cur.execute("""
                SELECT id, name, source_url
                FROM lounges
                WHERE source_url IS NOT NULL
                  AND source_url != ''
                ORDER BY name
            """)
        else:
            cur.execute("""
                SELECT id, name, source_url
                FROM lounges
                WHERE detail_last_fetched_at IS NULL
                  AND source_url IS NOT NULL
                  AND source_url != ''
                ORDER BY name
            """)
        lounges = cur.fetchall()

    total = len(lounges)
    success = 0
    failed = 0
    skipped = 0
    errors: list[str] = []

    logger.info("Batch detail fetch: %d lounges to process", total)

    for i, lounge in enumerate(lounges, 1):
        lounge_id = lounge["id"]
        lounge_name = lounge["name"]

        logger.info("[%d/%d] Fetching: %s...", i, total, lounge_name)
        print(f"[{i}/{total}] Fetching: {lounge_name}...")

        try:
            result = await fetch_lounge_detail(lounge_id, force_refresh=True)
            if result:
                success += 1
                amenity_count = len(result.get("detail_amenities") or {})
                logger.info(
                    "  ✓ Success — airside=%s, amenities=%d keys, conditions=%d keys",
                    result.get("is_airside"),
                    amenity_count,
                    len(result.get("access_conditions") or {}),
                )
                print(f"  ✓ airside={result.get('is_airside')}, amenities={amenity_count} keys")
            else:
                skipped += 1
                logger.warning("  ⊘ Skipped (no result)")
        except Exception as exc:
            failed += 1
            error_msg = f"{lounge_name}: {exc}"
            errors.append(error_msg)
            logger.error("  ✗ Failed: %s", exc)

        # Delay between fetches (not after the last one)
        if i < total:
            await asyncio.sleep(delay)
            if i % batch_size == 0:
                logger.info(
                    "  --- Batch %d complete, pausing ---", i // batch_size
                )
                await asyncio.sleep(delay)  # Extra pause between batches

    summary = {
        "total": total,
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "errors": errors,
    }

    _log_batch_run(summary)

    logger.info(
        "Batch complete: %d/%d success, %d failed, %d skipped",
        success, total, failed, skipped,
    )
    print(f"\n{'=' * 50}")
    print("Batch Detail Fetch Complete")
    print(f"{'=' * 50}")
    print(f"Total:   {total}")
    print(f"Success: {success}")
    print(f"Failed:  {failed}")
    print(f"Skipped: {skipped}")
    if errors:
        print("\nErrors:")
        for err in errors:
            print(f"  - {err}")

    return summary


def _log_batch_run(summary: dict) -> None:
    """Log a batch run to the ``lounge_scrape_runs`` table.

    Schema:  id | source_name | started_at | completed_at |
             records_found | records_upserted | errors | status
    """
    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO lounge_scrape_runs
                    (id, source_name, started_at, completed_at,
                     records_found, records_upserted, errors, status)
                VALUES (gen_random_uuid()::text, %s, NOW(), NOW(), %s, %s, %s, %s)
                """,
                (
                    "batch_detail_fetcher",
                    summary["total"],
                    summary["success"],
                    json.dumps(summary.get("errors", [])),
                    "completed" if summary["failed"] == 0 else "completed_with_errors",
                ),
            )
    except Exception as exc:
        logger.error("Failed to log batch run: %s", exc)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Lounge detail fetcher")
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Fetch details for all lounges missing detail data",
    )
    parser.add_argument(
        "--lounge-id",
        type=str,
        help="Fetch details for a specific lounge by ID",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Batch size before extra pause (default: 10)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=3.0,
        help="Delay between fetches in seconds (default: 3.0)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable verbose debug output for scraping diagnostics",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Bypass cache and re-fetch all lounges (batch) or the specified lounge",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if args.batch:
        asyncio.run(
            batch_fetch_all(
                batch_size=args.batch_size,
                delay=args.delay,
                force_refresh=args.force_refresh,
            )
        )
    elif args.lounge_id:
        detail = asyncio.run(
            fetch_lounge_detail(
                args.lounge_id,
                force_refresh=args.force_refresh or True,
                debug=args.debug,
            )
        )
        if detail:
            print(json.dumps(detail, indent=2, default=str))
        else:
            print("No result returned")
    else:
        parser.print_help()
