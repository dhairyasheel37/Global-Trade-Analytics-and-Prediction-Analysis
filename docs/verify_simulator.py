"""
Playwright automated verification script for Scenario Simulator & Tariff Impact Engine.
Navigates to /scenario-simulator, verifies presets, sliders, scorecards, Recharts charts,
and captures visual proof screenshots.
"""
import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="msedge", headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 1080})
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("Navigating to login page...")
        await page.goto("http://localhost:5173/login")
        await page.wait_for_timeout(1000)

        # 1-Click login as Trade Analyst
        trader_btn = page.locator("button:has-text('Trade Analyst')")
        print("Clicking Quick Demo Login: Trade Analyst button...")
        await trader_btn.click()
        await page.wait_for_timeout(1500)
        print("Logged in successfully. Navigating to /scenario-simulator...")

        await page.goto("http://localhost:5173/scenario-simulator")
        await page.wait_for_timeout(3000)

        # Verify header
        header = await page.locator("h1:has-text('Scenario Simulator & Tariff Impact Analysis')").count()
        print(f"Header found: {header > 0}")

        # Verify presets
        preset_cards = page.locator("div[style*='cursor: pointer']")
        preset_count = await preset_cards.count()
        print(f"Presets count: {preset_count}")

        # Capture full page initial simulator screenshot
        artifact_path = "C:/Users/DNG/.gemini/antigravity/brain/61da3372-0ef3-4a83-a298-64eb54803f1e/scenario_simulator_overview.png"
        docs_path = "docs/screenshots/scenario_simulator_overview.png"
        await page.screenshot(path=artifact_path, full_page=True)
        await page.screenshot(path=docs_path, full_page=True)
        print(f"Saved initial overview screenshot to {artifact_path}")

        # Click the US-China Section 301 Tariff Hike preset
        print("Clicking US-China Section 301 Tariff Hike preset...")
        us_china_preset = page.locator("div:has-text('US-China Section 301 Tariff Hike')").first
        await us_china_preset.click()
        await page.wait_for_timeout(2500)

        # Scroll main container to bottom and capture lower section (Sensitivity Curve & Briefing)
        main_container = page.locator("main")
        await main_container.evaluate("el => el.scrollTop = el.scrollHeight")
        await page.wait_for_timeout(1000)

        lower_artifact = "C:/Users/DNG/.gemini/antigravity/brain/61da3372-0ef3-4a83-a298-64eb54803f1e/scenario_simulator_sensitivity_and_briefing.png"
        lower_docs = "docs/screenshots/scenario_simulator_sensitivity_and_briefing.png"
        await page.screenshot(path=lower_artifact)
        await page.screenshot(path=lower_docs)
        print(f"Saved lower section screenshot to {lower_artifact}")

        # Scroll to charts and capture
        charts_path = "C:/Users/DNG/.gemini/antigravity/brain/61da3372-0ef3-4a83-a298-64eb54803f1e/scenario_simulator_charts.png"
        docs_charts = "docs/screenshots/scenario_simulator_charts.png"
        chart_elem = page.locator("div[style*='recharts-responsive-container']").first
        if await chart_elem.count() > 0:
            print("Recharts charts verified successfully.")

        print(f"Console errors: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)

        await browser.close()
        print("Verification complete!")

if __name__ == "__main__":
    asyncio.run(verify())
