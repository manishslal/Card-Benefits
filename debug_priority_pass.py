# debug_priority_pass.py
import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        response = await page.goto(
            "https://www.prioritypass.com/en-GB/airport-lounges",
            wait_until="networkidle"
        )
        
        print(f"Final URL: {page.url}")
        print(f"Status: {response.status}")
        
        # Wait a few seconds for JS to render lounge cards
        await page.wait_for_timeout(3000)
        
        await page.screenshot(path="debug_pp.png", full_page=True)
        content = await page.content()
        with open("debug_pp.html", "w") as f:
            f.write(content)
        
        # Try to find lounge cards — search for common patterns
        for selector in [
            "[class*='lounge']",
            "[class*='card']", 
            "[class*='result']",
            "[class*='listing']",
            "article",
            "[data-testid]"
        ]:
            elements = await page.query_selector_all(selector)
            if elements:
                print(f"Selector '{selector}' found {len(elements)} elements")
        
        await browser.close()

asyncio.run(debug())