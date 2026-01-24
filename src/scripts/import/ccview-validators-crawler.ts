/**
 * CCView Validators Crawler
 * Extracts validator data from ccview.io/validators
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

interface ValidatorData {
  name: string;
  partyId: string;
  sponsor?: string;
  transactions?: string;
  trafficPurchased?: string;
  rewardsEarned?: string;
  balance?: string;
}

const CCVIEW_VALIDATORS_URL = "https://ccview.io/validators/";
const DATA_DIR = path.join(process.cwd(), "data");

async function crawlValidators(): Promise<ValidatorData[]> {
  console.log("Starting CCView validators crawler...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const validators: ValidatorData[] = [];

  try {
    console.log("Navigating to:", CCVIEW_VALIDATORS_URL);
    await page.goto(CCVIEW_VALIDATORS_URL, { waitUntil: "networkidle", timeout: 60000 });

    // Wait for table to load
    await page.waitForSelector("table", { timeout: 30000 });

    // Take screenshot for debugging
    await page.screenshot({ path: "/tmp/ccview-validators.png", fullPage: true });
    console.log("Screenshot saved to /tmp/ccview-validators.png");

    // Try to increase rows per page if possible
    const rowSelector = await page.$('select[aria-label*="rows"]');
    if (rowSelector) {
      console.log("Found rows-per-page selector, attempting to set to 100...");
      await rowSelector.selectOption({ label: "100" }).catch(() => {
        console.log("Could not set rows to 100, trying other options...");
      });
      await page.waitForTimeout(2000);
    } else {
      // Try alternative selectors for pagination
      const altSelector = await page.$('select');
      if (altSelector) {
        const options = await page.$$eval('select option', opts => opts.map(o => o.textContent));
        console.log("Available select options:", options);
      }
    }

    // Extract all rows
    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
      console.log(`Extracting page ${pageNum}...`);

      // Get table rows
      const rows = await page.$$("table tbody tr");
      console.log(`Found ${rows.length} rows on page ${pageNum}`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const cells = await row.$$("td");
          if (cells.length >= 2) {
            // Try to extract validator name and party ID
            const firstCell = await cells[0].textContent();
            const nameLink = await cells[0].$("a");

            let name = "";
            let partyId = "";

            if (nameLink) {
              name = (await nameLink.textContent())?.trim() || "";
              const href = await nameLink.getAttribute("href");
              // Extract party ID from link if present
              if (href) {
                const match = href.match(/\/validator\/([^\/]+)/);
                if (match) {
                  partyId = decodeURIComponent(match[1]);
                }
              }
            } else {
              name = firstCell?.trim() || "";
            }

            // Skip header rows and empty names
            const skipPatterns = ["ID", "Validator", "Name", ""];
            if (skipPatterns.includes(name)) {
              console.log(`  [skip row ${i}] header or empty: "${name}"`);
              continue;
            }

            // Check for duplicate (already captured)
            if (validators.some(v => v.name === name)) {
              console.log(`  [skip row ${i}] duplicate: "${name}"`);
              continue;
            }

            const validator: ValidatorData = {
              name,
              partyId: partyId || name,
            };

            // Try to extract other columns
            if (cells.length > 1) validator.sponsor = (await cells[1].textContent())?.trim();
            if (cells.length > 2) validator.transactions = (await cells[2].textContent())?.trim();
            if (cells.length > 3) validator.trafficPurchased = (await cells[3].textContent())?.trim();
            if (cells.length > 4) validator.rewardsEarned = (await cells[4].textContent())?.trim();
            if (cells.length > 5) validator.balance = (await cells[5].textContent())?.trim();

            validators.push(validator);
            console.log(`  - ${name} (partyId: ${partyId || "same as name"})`);
          } else {
            console.log(`  [skip row ${i}] only ${cells.length} cells`);
          }
        } catch (e) {
          console.log(`  [error row ${i}]`, e);
        }
      }

      // Check for next page
      const nextButton = await page.$('button[aria-label="Next page"]:not([disabled])');
      const allButtons = await page.$$('button');
      const buttonTexts = await Promise.all(allButtons.map(async b => {
        const text = await b.textContent();
        const ariaLabel = await b.getAttribute('aria-label');
        const disabled = await b.getAttribute('disabled');
        return `"${text?.trim()}" (aria: ${ariaLabel}, disabled: ${disabled})`;
      }));
      console.log(`  Pagination buttons: ${buttonTexts.slice(0, 10).join(', ')}`);

      if (nextButton) {
        console.log(`  Clicking next page...`);
        await nextButton.click();
        await page.waitForTimeout(2000);
        pageNum++;
      } else {
        console.log(`  No more pages (next button not found or disabled)`);
        hasNextPage = false;
      }
    }

  } catch (error) {
    console.error("Error during crawl:", error);
  } finally {
    await browser.close();
  }

  return validators;
}

async function saveValidators(validators: ValidatorData[]) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `validators-ccview-${timestamp}.json`;
  const filepath = path.join(DATA_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(validators, null, 2));
  console.log(`\nSaved ${validators.length} validators to ${filename}`);
  return filepath;
}

async function main() {
  const validators = await crawlValidators();

  if (validators.length > 0) {
    await saveValidators(validators);

    console.log("\n=== Summary ===");
    console.log(`Total validators: ${validators.length}`);
    console.log(`With Party ID: ${validators.filter(v => v.partyId && v.partyId !== v.name).length}`);
  } else {
    console.log("\nNo validators found. The page might require different selectors.");
    console.log("Check /tmp/ccview-validators.png for the current page state.");
  }
}

main().catch(console.error);
