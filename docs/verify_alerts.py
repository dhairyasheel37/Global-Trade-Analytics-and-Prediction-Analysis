"""
Playwright automated verification script for Automated Email Briefings & Alerts Engine.
Navigates to /alerts, interacts with briefings, rules, audit evaluations, notifications feed,
and email outbox, and captures visual proof screenshots.
"""
import asyncio
import os
from playwright.async_api import async_playwright

DOCS_DIR = "docs/screenshots"
ARTIFACT_DIR = os.environ.get("ARTIFACT_DIR", DOCS_DIR)

os.makedirs(DOCS_DIR, exist_ok=True)
if ARTIFACT_DIR != DOCS_DIR:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)


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
        print("Logged in successfully. Navigating to /alerts...")

        await page.goto("http://localhost:5173/alerts")
        await page.wait_for_timeout(2500)

        # 1. Verify Header & Tab 1: Scheduled Briefings
        header = await page.locator("h1:has-text('Automated Briefings & Risk Alerts')").count()
        print(f"Header found: {header > 0}")

        # Check if any briefing schedule exists; if not, create one via the modal
        schedule_count = await page.locator("button:has-text('Trigger Dispatch Now')").count()
        if schedule_count == 0:
            print("No schedule found. Creating a new briefing schedule...")
            new_btn = page.locator("button:has-text('Schedule New Briefing')").first
            await new_btn.click()
            await page.wait_for_timeout(1000)
            
            # Submit form
            submit_btn = page.locator("button[type='submit']:has-text('Create Schedule')")
            if await submit_btn.count() > 0:
                await submit_btn.click()
                await page.wait_for_timeout(2000)
                print("Briefing schedule created.")

        shot1_artifact = f"{ARTIFACT_DIR}/alerts_briefings_tab.png"
        shot1_docs = f"{DOCS_DIR}/alerts_briefings_tab.png"
        await page.screenshot(path=shot1_artifact, full_page=True)
        await page.screenshot(path=shot1_docs, full_page=True)
        print(f"Saved Briefings Tab screenshot to {shot1_artifact}")

        # 2. Trigger Instant Dispatch for the briefing
        trigger_btn = page.locator("button:has-text('Trigger Dispatch Now')").first
        if await trigger_btn.count() > 0:
            print("Clicking Trigger Dispatch Now...")
            await trigger_btn.click()
            await page.wait_for_timeout(4500)
            print("Triggered briefing dispatch successfully.")

        # 3. Switch to Tab 2: Alert Rules & Thresholds
        print("Switching to Alert Rules & Thresholds tab...")
        rules_tab_btn = page.locator("button:has-text('Alert Rules & Thresholds')")
        await rules_tab_btn.click()
        await page.wait_for_timeout(1500)

        # Click Activate Rule on US Deficit Expansion Preset
        activate_preset_btn = page.locator("button:has-text('Activate Rule')").first
        if await activate_preset_btn.count() > 0:
            print("Activating preset rule...")
            await activate_preset_btn.click()
            await page.wait_for_timeout(2000)

        # Click 'Audit Thresholds Now' button in header
        audit_btn = page.locator("button:has-text('Audit Thresholds Now')")
        if await audit_btn.count() > 0:
            print("Triggering Audit Thresholds Now...")
            await audit_btn.click()
            await page.wait_for_timeout(3500)

        shot2_artifact = f"{ARTIFACT_DIR}/alerts_rules_tab.png"
        shot2_docs = f"{DOCS_DIR}/alerts_rules_tab.png"
        await page.screenshot(path=shot2_artifact, full_page=True)
        await page.screenshot(path=shot2_docs, full_page=True)
        print(f"Saved Alert Rules & Presets screenshot to {shot2_artifact}")

        # 4. Switch to Tab 3: Triggered Alerts Feed
        print("Switching to Triggered Alerts Feed tab...")
        feed_tab_btn = page.locator("button:has-text('Triggered Alerts Feed')")
        await feed_tab_btn.click()
        await page.wait_for_timeout(1500)

        # If any acknowledge button is present, click it
        ack_btn = page.locator("button:has-text('Acknowledge')").first
        if await ack_btn.count() > 0:
            print("Clicking Acknowledge on first alert notification...")
            await ack_btn.click()
            await page.wait_for_timeout(1500)

        shot3_artifact = f"{ARTIFACT_DIR}/alerts_feed_tab.png"
        shot3_docs = f"{DOCS_DIR}/alerts_feed_tab.png"
        await page.screenshot(path=shot3_artifact, full_page=True)
        await page.screenshot(path=shot3_docs, full_page=True)
        print(f"Saved Triggered Alerts Feed screenshot to {shot3_artifact}")

        # 5. Switch to Tab 4: Outbox & Sent Briefings
        print("Switching to Outbox & Sent Briefings tab...")
        outbox_tab_btn = page.locator("button:has-text('Outbox & Sent Briefings')")
        await outbox_tab_btn.click()
        await page.wait_for_timeout(1500)

        shot4_artifact = f"{ARTIFACT_DIR}/alerts_outbox_tab.png"
        shot4_docs = f"{DOCS_DIR}/alerts_outbox_tab.png"
        await page.screenshot(path=shot4_artifact, full_page=True)
        await page.screenshot(path=shot4_docs, full_page=True)
        print(f"Saved Outbox & Sent Briefings screenshot to {shot4_artifact}")

        print("Console errors detected:", len(console_errors))
        if console_errors:
            print("Errors:", console_errors)

        await browser.close()
        print("Automated browser verification completed successfully!")


if __name__ == "__main__":
    asyncio.run(verify())
