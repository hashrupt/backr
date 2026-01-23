/**
 * Inspect Party ID elements to find full party ID
 */

import { chromium } from "playwright";

const CCVIEW_URL = "https://ccview.io/featured-apps/";

async function inspectPartyId() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });
  const page = await context.newPage();

  console.log("Navigating to ccview.io...");
  await page.goto(CCVIEW_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Find the first table row with data
  const rows = await page.$$("table tbody tr");
  console.log(`Found ${rows.length} rows`);

  if (rows.length > 0) {
    const firstRow = rows[0];
    const cells = await firstRow.$$("td");

    if (cells.length > 1) {
      const partyIdCell = cells[1];

      // Get the outer HTML of the party ID cell
      const outerHtml = await partyIdCell.evaluate((el) => el.outerHTML);
      console.log("\n=== Party ID Cell HTML ===");
      console.log(outerHtml);

      // Get all attributes
      const attrs = await partyIdCell.evaluate((el) => {
        const result: Record<string, string> = {};
        for (const attr of el.attributes) {
          result[attr.name] = attr.value;
        }
        return result;
      });
      console.log("\n=== Cell Attributes ===");
      console.log(attrs);

      // Look for any nested elements with data
      const nestedElements = await partyIdCell.$$("*");
      console.log(`\n=== Nested Elements (${nestedElements.length}) ===`);

      for (let i = 0; i < Math.min(nestedElements.length, 10); i++) {
        const el = nestedElements[i];
        const tagName = await el.evaluate((e) => e.tagName);
        const text = await el.textContent();
        const elAttrs = await el.evaluate((e) => {
          const result: Record<string, string> = {};
          for (const attr of e.attributes) {
            result[attr.name] = attr.value;
          }
          return result;
        });
        console.log(`[${i}] <${tagName}> text="${text?.slice(0, 50)}" attrs=`, elAttrs);
      }

      // Try clicking on the party ID to see if it triggers any action
      console.log("\n=== Trying to click party ID cell ===");
      try {
        await partyIdCell.click();
        await page.waitForTimeout(500);

        // Check clipboard (if possible)
        const clipboardText = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch {
            return "clipboard not accessible";
          }
        });
        console.log("Clipboard after click:", clipboardText);
      } catch (e) {
        console.log("Click error:", e);
      }

      // Check for any tooltip or popup
      const tooltips = await page.$$("[role='tooltip'], .MuiTooltip-tooltip, .tooltip");
      console.log(`\nFound ${tooltips.length} tooltips after click`);

      for (const tooltip of tooltips) {
        const text = await tooltip.textContent();
        console.log("Tooltip text:", text);
      }
    }
  }

  await browser.close();
}

inspectPartyId().catch(console.error);
