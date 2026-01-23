/**
 * Dry Run Crawler - Test data extraction from ccview.io
 *
 * This script crawls ccview.io/featured-apps/ and extracts a few rows
 * to verify the crawler logic works before implementing full ingestion.
 *
 * Usage: npx tsx src/scripts/import/dry-run.ts
 *
 * Output:
 * - Console: Progress and summary
 * - JSON: Full data in console
 * - CSV: Backup file at data/featured-apps-{timestamp}.csv
 */

import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

interface FeaturedApp {
  organization: string;
  partyId: string;
  volume?: string;
  transactions?: string;
  rewards?: string;
  profits?: string;
  source: string;
}

const CCVIEW_URL = "https://ccview.io/featured-apps/";
const MAX_APPS = Infinity; // No limit - capture all apps
const DATA_DIR = path.join(process.cwd(), "data");

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }
}

function saveToCsv(apps: FeaturedApp[]): string {
  ensureDataDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `featured-apps-${timestamp}.csv`;
  const filepath = path.join(DATA_DIR, filename);

  // CSV header
  const headers = ["organization", "partyId", "volume", "transactions", "rewards", "profits", "source", "crawledAt"];

  // CSV rows
  const rows = apps.map(app => [
    escapeCsvField(app.organization),
    escapeCsvField(app.partyId),
    escapeCsvField(app.volume || ""),
    escapeCsvField(app.transactions || ""),
    escapeCsvField(app.rewards || ""),
    escapeCsvField(app.profits || ""),
    escapeCsvField(app.source),
    new Date().toISOString(),
  ].join(","));

  const csvContent = [headers.join(","), ...rows].join("\n");

  fs.writeFileSync(filepath, csvContent, "utf-8");

  return filepath;
}

function escapeCsvField(value: string): string {
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function extractAppsFromCurrentPage(page: Page): Promise<FeaturedApp[]> {
  const apps: FeaturedApp[] = [];

  // Try to find rows using various selectors (React/MUI tables vary)
  const rows = await page.$$("table tbody tr, .MuiTableBody-root tr");

  if (rows.length === 0) {
    return apps;
  }

  console.log(`Found ${rows.length} rows on current page`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = await row.$$("td");  // Only td, skip th (headers)

    if (cells.length > 0) {
      const cellTexts = await Promise.all(
        cells.map((cell) => cell.textContent())
      );

      // Skip empty rows (all cells empty or whitespace only)
      const hasContent = cellTexts.some((t) => t && t.trim().length > 0);
      if (!hasContent) {
        continue;
      }

      // Extract full party ID from the link href attribute
      let partyId = "";
      const partyIdCell = cells[1]; // Party ID is in second column

      if (partyIdCell) {
        // The full party ID is in the href of the <a> element: /party/{full-party-id}/
        const link = await partyIdCell.$("a[href*='/party/']");
        if (link) {
          const href = await link.getAttribute("href");
          if (href) {
            // Extract party ID from href like "/party/temple-mainnet-1::1220f238.../"
            const match = href.match(/\/party\/([^/]+)\/?/);
            if (match) {
              partyId = match[1];
            }
          }
        }

        // Fallback to text content if href not found
        if (!partyId) {
          for (const text of cellTexts) {
            if (text && text.includes("::")) {
              partyId = text.replace(/Copied$/i, "").trim();
              break;
            }
          }
        }
      }

      // Skip rows without valid party ID (likely headers or footers)
      if (!partyId) {
        continue;
      }

      const app: FeaturedApp = {
        organization: cellTexts[0]?.trim() || "Unknown",
        partyId: partyId,
        source: "ccview.io",
      };

      // Map additional columns if they exist
      if (cellTexts[2]) app.volume = cellTexts[2].trim();
      if (cellTexts[3]) app.transactions = cellTexts[3].trim();
      if (cellTexts[4]) app.rewards = cellTexts[4].trim();
      if (cellTexts[5]) app.profits = cellTexts[5].trim();

      apps.push(app);
    }
  }

  return apps;
}

async function extractAllApps(page: Page): Promise<FeaturedApp[]> {
  const allApps: FeaturedApp[] = [];
  let pageNum = 1;

  // Wait for the table to render
  console.log("Waiting for table to render...");

  try {
    await page.waitForSelector("table tbody tr, .MuiTableBody-root tr, [role='row']", {
      timeout: 15000,
    });
  } catch {
    console.log("Standard table selector not found, trying alternative selectors...");
  }

  // Take a screenshot for debugging
  await page.screenshot({ path: "/tmp/ccview-screenshot.png", fullPage: true });
  console.log("Screenshot saved to /tmp/ccview-screenshot.png");

  // Debug: Log pagination controls HTML
  const paginationArea = await page.$("[class*='pagination'], [class*='Pagination'], nav[aria-label*='pagination']");
  if (paginationArea) {
    const paginationHtml = await paginationArea.evaluate(el => el.outerHTML);
    console.log("Pagination HTML (first 500 chars):", paginationHtml.slice(0, 500));
  } else {
    // Try to find anything with page controls
    const buttons = await page.$$("button");
    console.log(`Found ${buttons.length} buttons on page`);
    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
      const text = await buttons[i].textContent();
      const ariaLabel = await buttons[i].getAttribute("aria-label");
      if (text?.includes("Page") || text?.match(/^\d+$/) || ariaLabel?.includes("page")) {
        console.log(`Button ${i}: text="${text}" aria-label="${ariaLabel}"`);
      }
    }
  }

  while (true) {
    console.log(`\n--- Page ${pageNum} ---`);
    const appsOnPage = await extractAppsFromCurrentPage(page);
    console.log(`Extracted ${appsOnPage.length} apps from page ${pageNum}`);

    for (const app of appsOnPage) {
      // Deduplicate by partyId
      if (!allApps.some(a => a.partyId === app.partyId)) {
        allApps.push(app);
        console.log(`  - ${app.organization} (${app.partyId.slice(0, 30)}...)`);
      }
    }

    // Check for pagination - look for "Page X of Y" pattern to know total pages
    const paginationText = await page.textContent("body");
    const pageMatch = paginationText?.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
    const totalPages = pageMatch ? parseInt(pageMatch[2], 10) : 1;
    const currentPageFromText = pageMatch ? parseInt(pageMatch[1], 10) : pageNum;

    if (pageNum === 1) {
      console.log(`Total pages detected: ${totalPages}`);
    }

    console.log(`Current page indicator shows: Page ${currentPageFromText} of ${totalPages}`);

    // Stop if we're on the last page
    if (currentPageFromText >= totalPages) {
      console.log("Reached last page.");
      break;
    }

    // Find the ">" next button - it should be right after "Page X of Y" text
    // Look for button containing just ">" character near pagination text
    let clicked = false;

    // Debug: Find the pagination container by looking for "Page X of Y" text
    // then find the button right after it
    const pageIndicator = await page.$("text=Page " + currentPageFromText + " of " + totalPages);
    if (pageIndicator) {
      console.log("Found page indicator text element");
      // Get the parent container and find next button sibling
      const parent = await pageIndicator.evaluateHandle(el => {
        // Walk up to find pagination container
        let container = el.parentElement;
        while (container && !container.querySelector('button')) {
          container = container.parentElement;
        }
        return container;
      });

      if (parent) {
        // Find all buttons in pagination container
        const paginationButtons = await (parent as any).$$("button");
        console.log(`Found ${paginationButtons.length} buttons in pagination area`);

        for (let i = 0; i < paginationButtons.length; i++) {
          const btn = paginationButtons[i];
          const text = (await btn.textContent())?.trim();
          const html = await btn.evaluate((el: HTMLElement) => el.innerHTML.slice(0, 100));
          console.log(`  Pagination button ${i}: text="${text}" html="${html}"`);
        }

        // The ">" button is usually the 4th button: First, <, [page indicator], >, Last
        // Or find button with right arrow SVG
        for (const btn of paginationButtons) {
          const html = await btn.evaluate((el: HTMLElement) => el.innerHTML);
          // Look for right-pointing SVG path or ">" text
          if (html.includes('ChevronRight') || html.includes('arrow-right') || html.includes('M10') || html.includes('chevron_right')) {
            const isDisabled = await btn.evaluate((el: HTMLButtonElement) => el.disabled);
            if (!isDisabled) {
              console.log("Found next button via SVG icon...");
              await btn.click();
              clicked = true;
              break;
            }
          }
        }
      }
    }

    if (!clicked) {
      // Fallback: try to find buttons near "Last" text
      const lastBtn = await page.$("button:has-text('Last')");
      if (lastBtn) {
        // Get the previous sibling button which should be ">"
        const prevButton = await lastBtn.evaluateHandle(el => {
          return el.previousElementSibling as HTMLButtonElement;
        });
        if (prevButton) {
          const isDisabled = await (prevButton as any).evaluate((el: HTMLButtonElement) => el?.disabled);
          if (!isDisabled) {
            console.log("Found next button as sibling of Last...");
            await (prevButton as any).click();
            clicked = true;
          }
        }
      }
    }

    if (!clicked) {
      // Try aria-label approach
      const nextBtn = await page.$("button[aria-label*='next']:not([disabled]), button[aria-label*='Next']:not([disabled])");
      if (nextBtn) {
        console.log("Found next button via aria-label...");
        await nextBtn.click();
        clicked = true;
      }
    }

    if (!clicked) {
      console.log("Could not find next page button.");
      break;
    }

    // Wait for page to update
    await delay(2500);
    await page.screenshot({ path: `/tmp/ccview-page-${pageNum + 1}.png` });
    pageNum++;

    // Safety limit
    if (pageNum > 15) {
      console.log("Reached page limit (15), stopping...");
      break;
    }
  }

  return allApps;
}

async function crawlCcview(): Promise<FeaturedApp[]> {
  console.log("=".repeat(60));
  console.log("DRY RUN: Crawling ccview.io/featured-apps/");
  console.log("=".repeat(60));
  console.log("");

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    console.log(`Navigating to ${CCVIEW_URL}...`);
    await page.goto(CCVIEW_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("Page loaded. Current URL:", page.url());

    // Give extra time for React to render
    await delay(3000);

    // Dismiss cookie notice if present
    try {
      const acceptCookieBtn = await page.$("button:has-text('Accept'), button:has-text('Got it'), button:has-text('OK')");
      if (acceptCookieBtn) {
        console.log("Dismissing cookie notice...");
        await acceptCookieBtn.click();
        await delay(1000);
      }
    } catch {
      // Cookie notice not found or already dismissed
    }

    const apps = await extractAllApps(page);

    console.log("");
    console.log("=".repeat(60));
    console.log(`RESULTS: Found ${apps.length} featured apps`);
    console.log("=".repeat(60));

    for (const app of apps) {
      console.log("");
      console.log(`Organization: ${app.organization}`);
      console.log(`Party ID: ${app.partyId || "(not found)"}`);
      if (app.volume) console.log(`Volume: ${app.volume}`);
      if (app.transactions) console.log(`Transactions: ${app.transactions}`);
      if (app.rewards) console.log(`Rewards: ${app.rewards}`);
      if (app.profits) console.log(`Profits: ${app.profits}`);
      console.log("-".repeat(40));
    }

    return apps;
  } catch (error) {
    console.error("Error during crawl:", error);

    // Save screenshot on error
    try {
      await page.screenshot({ path: "/tmp/ccview-error.png" });
      console.log("Error screenshot saved to /tmp/ccview-error.png");
    } catch {
      // Ignore screenshot errors
    }

    return [];
  } finally {
    await browser.close();
    console.log("");
    console.log("Browser closed. Dry run complete.");
  }
}

// Run the crawler
crawlCcview()
  .then((apps) => {
    console.log("");
    console.log("=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total apps extracted: ${apps.length}`);

    if (apps.length > 0) {
      // Save to CSV backup
      const csvPath = saveToCsv(apps);
      console.log(`CSV backup saved to: ${csvPath}`);

      // Save to JSON backup
      const jsonPath = csvPath.replace(".csv", ".json");
      fs.writeFileSync(jsonPath, JSON.stringify(apps, null, 2), "utf-8");
      console.log(`JSON backup saved to: ${jsonPath}`);

      console.log("");
      console.log("JSON output:");
      console.log(JSON.stringify(apps, null, 2));
    }

    console.log("");
    console.log("This was a DRY RUN - no data was saved to database");
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
