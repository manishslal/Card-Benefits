"""On-demand lounge detail fetcher.

Fetches rich detail data from a lounge's source URL when a user opens a lounge.
Uses a 7-day cache to avoid re-fetching unnecessarily.
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from playwright.async_api import async_playwright

from scrapers.database import get_cursor
from scrapers.repository import get_lounge_by_id, update_lounge_detail

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

CACHE_TTL_DAYS = 7


async def fetch_lounge_detail(lounge_id: str, force_refresh: bool = False) -> Optional[dict]:
    """Fetch detailed lounge data, using 7-day cache.

    Args:
        lounge_id: The lounge ID to fetch details for.
        force_refresh: If True, bypass cache and always fetch from source.

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
    detail = await _scrape_detail_page(source_url)

    if detail:
        update_lounge_detail(
            lounge_id=lounge_id,
            is_airside=detail.get("is_airside"),
            gate_proximity=detail.get("gate_proximity"),
            detail_amenities=detail.get("detail_amenities"),
            access_conditions=detail.get("access_conditions"),
        )
        detail["detail_last_fetched_at"] = datetime.now(timezone.utc).isoformat()

    return detail


async def _scrape_detail_page(url: str) -> Optional[dict]:
    """Scrape a lounge detail page for rich data."""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 720},
            )
            page = await context.new_page()

            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            detail = {
                "is_airside": None,
                "gate_proximity": None,
                "detail_amenities": {},
                "access_conditions": {},
            }

            page_text = await page.text_content("body") or ""
            page_text_lower = page_text.lower()

            # Extract is_airside
            detail["is_airside"] = _detect_airside(page_text_lower)

            # Extract gate_proximity
            detail["gate_proximity"] = _extract_gate_proximity(page_text)

            # Extract detail_amenities
            detail["detail_amenities"] = await _extract_detail_amenities(page)

            # Extract access_conditions
            detail["access_conditions"] = _extract_access_conditions(page_text, page_text_lower)

            await browser.close()
            return detail

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


async def _extract_detail_amenities(page) -> dict:
    """Extract full amenity list from detail page."""
    amenities = {}

    # Look for amenity icons/badges/lists
    selectors = [
        '[class*="amenity"]',
        '[class*="Amenity"]',
        '[class*="facility"]',
        '[class*="Facility"]',
        '[class*="feature"]',
        '[data-testid*="amenity"]',
        '[class*="service"]',
    ]

    for selector in selectors:
        els = await page.query_selector_all(selector)
        if els:
            for el in els:
                text = (await el.text_content() or "").strip()
                if text and len(text) < 100:
                    key = re.sub(r'[^a-z0-9]+', '_', text.lower()).strip('_')
                    amenities[key] = True
            if amenities:
                break

    # Fallback: check page text for common amenity keywords
    if not amenities:
        page_text = (await page.text_content("body") or "").lower()
        amenity_keywords = {
            "has_wifi": ["wi-fi", "wifi", "wireless"],
            "has_showers": ["shower"],
            "has_hot_food": ["hot food", "hot meal", "buffet", "cooked food"],
            "has_bar": ["bar", "alcoholic", "cocktail", "spirits"],
            "has_spa": ["spa", "massage"],
            "has_tv": ["tv", "television"],
            "has_quiet_zone": ["quiet zone", "quiet area", "rest zone"],
            "has_business_center": ["business center", "business centre", "workstation"],
            "has_prayer_room": ["prayer room", "prayer area"],
            "has_kids_area": ["children", "kids area", "play area"],
            "has_smoking_area": ["smoking area", "smoking room"],
            "has_disabled_access": ["disabled access", "wheelchair", "accessible"],
        }
        for key, keywords in amenity_keywords.items():
            for kw in keywords:
                if kw in page_text:
                    amenities[key] = True
                    break

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
    fee_match = re.search(r'guest[s]?.*?(?:\$|£|€|USD|GBP)[\s]*(\d+(?:\.\d{2})?)', text, re.IGNORECASE)
    if fee_match:
        conditions["guest_fee"] = fee_match.group(1)

    # Pre-booking
    if any(kw in text_lower for kw in ['pre-book', 'prebook', 'advance booking', 'reservation required']):
        conditions["pre_booking_required"] = True
    else:
        conditions["pre_booking_required"] = False

    # Card restrictions
    if "specific card" in text_lower or "card restriction" in text_lower:
        conditions["has_card_restrictions"] = True

    return conditions
