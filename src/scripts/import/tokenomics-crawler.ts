/**
 * Tokenomics Applications Crawler
 *
 * Crawls the groups.io tokenomics page to extract Featured App applications
 * and match them with existing entities by party ID.
 *
 * Usage: npx tsx src/scripts/import/tokenomics-crawler.ts
 */

import "dotenv/config";
import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

interface TokenomicsApplication {
  // Basic info
  topicTitle: string;
  topicUrl: string;  // Direct link to the application page

  // === FORM FIELDS (Official FA Application) ===
  // Organization details
  institutionName?: string;           // Name of Applying Institution
  applicationName?: string;           // Name of the application
  institutionUrl?: string;            // URL of the applying institution
  responsibleEmails?: string[];       // Emails for Responsible Persons
  partyId?: string;                   // Party ID for the Featured Application
  codeRepository?: string;            // URL for the public code repository

  // Application details
  applicationSummary?: string;        // Summary of what application will do
  expectedUsers?: string;             // Describe the expected users
  ledgerInteraction?: string;         // How application will interact with ledger
  rewardActivities?: string;          // Activities that earn application rewards
  usesCantonCoinOrMarkers?: string;   // Does activity use CC or Activity Markers?

  // Transaction details
  dailyTransactionsPerUser?: string;  // Expected daily transactions per user
  multipleTransactionConditions?: string; // Conditions for multiple transactions per round
  transactionScaling?: string;        // How transactions scale (Linear/Super Linear/Sub Linear)

  // Timeline
  mainnetLaunchDate?: string;         // Anticipated launch date on MainNet
  firstCustomers?: string;            // First customers and go-live dates

  // Business impact
  noFAStatusImpact?: string;          // How would not having FA status change plans?
  bonafideControls?: string;          // Controls to prevent non-bona fide transactions
  additionalNotes?: string;           // Additional Notes for Committee

  // === LEGACY/DERIVED FIELDS ===
  organizationName?: string;          // Alias for institutionName
  website?: string;                   // Alias for institutionUrl
  submissionDate?: string;
  entryId?: string;
  contactEmails?: string[];           // Alias for responsibleEmails
  organizationBackground?: string;
  targetUsers?: string;               // Alias for expectedUsers
  rewardMechanism?: string;           // Alias for rewardActivities
  documentationUrls?: string[];
  applicantName?: string;
  description?: string;
}

const TOKENOMICS_URL = "https://lists.sync.global/g/tokenomics/topics";
const DATA_DIR = path.join(process.cwd(), "data");
const MAX_TOPICS = 700; // Extract all applications (page has ~613 topics)

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract topics from the current page (single page only).
 */
async function extractTopicsFromCurrentPage(page: Page): Promise<TokenomicsApplication[]> {
  const applications: TokenomicsApplication[] = [];

  // Try to find topic links
  const topicLinks = await page.$$("a[href*='/topic/'], a[href*='/message/'], .subject a, td a");

  for (const link of topicLinks) {
    const href = await link.getAttribute("href");
    const text = await link.textContent();

    if (href && text && text.trim().length > 5) {
      // Filter for Featured App related topics
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes("featured") ||
        lowerText.includes("application") ||
        lowerText.includes("app") ||
        lowerText.includes("fa-") ||
        lowerText.includes("request")
      ) {
        applications.push({
          topicTitle: text.trim(),
          topicUrl: href.startsWith("http") ? href : `https://lists.sync.global${href}`,
        });
      }
    }
  }

  return applications;
}

/**
 * Extract all topics with pagination support.
 */
async function extractTopicsFromPage(page: Page): Promise<TokenomicsApplication[]> {
  const allApplications: TokenomicsApplication[] = [];
  const seenUrls = new Set<string>();
  let pageNum = 1;

  console.log("Starting paginated topic extraction...");

  while (allApplications.length < MAX_TOPICS) {
    console.log(`\n--- Page ${pageNum} ---`);

    // Wait for topics list to render
    try {
      await page.waitForSelector("a[href*='/topic/']", { timeout: 10000 });
    } catch {
      console.log("No more topics found");
      break;
    }

    // Extract topics from current page
    const pageTopics = await extractTopicsFromCurrentPage(page);

    // Add only new topics (deduplicate)
    let newCount = 0;
    for (const topic of pageTopics) {
      if (!seenUrls.has(topic.topicUrl) && allApplications.length < MAX_TOPICS) {
        seenUrls.add(topic.topicUrl);
        allApplications.push(topic);
        newCount++;
      }
    }

    console.log(`Found ${pageTopics.length} topics on page, ${newCount} new (total: ${allApplications.length})`);

    if (newCount === 0) {
      console.log("No new topics on this page, stopping");
      break;
    }

    if (allApplications.length >= MAX_TOPICS) {
      console.log(`Reached MAX_TOPICS limit (${MAX_TOPICS})`);
      break;
    }

    // Try to go to next page
    const nextButton = await page.$('a[title="next page"], a:has-text("next page"), a:has-text("Next"), .pagination-next a, a[aria-label="Next"]');

    if (!nextButton) {
      // Try alternative: look for pagination links with higher page numbers
      const paginationText = await page.textContent('body');
      const currentPageMatch = paginationText?.match(/(\d+)\s*-\s*\d+\s*of\s*(\d+)/);
      if (currentPageMatch) {
        const [, start, total] = currentPageMatch;
        console.log(`Pagination: ${start} of ${total}`);
        if (parseInt(start) >= parseInt(total) - 20) {
          console.log("Reached last page");
          break;
        }
      }

      // Try clicking a "next" type link
      const nextLinks = await page.$$('a');
      let foundNext = false;
      for (const link of nextLinks) {
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');
        if (text?.toLowerCase().includes('next') || ariaLabel?.toLowerCase().includes('next')) {
          await link.click();
          foundNext = true;
          break;
        }
      }

      if (!foundNext) {
        console.log("No next page button found");
        break;
      }
    } else {
      console.log("Clicking next page...");
      await nextButton.click();
    }

    // Wait for page to load
    await delay(2000);
    pageNum++;

    // Safety limit to prevent infinite loops
    if (pageNum > 50) {
      console.log("Safety limit reached (50 pages)");
      break;
    }
  }

  console.log(`\nTotal topics collected: ${allApplications.length}`);
  return allApplications;
}

/**
 * Clean and extract the party ID from text content.
 * Party IDs follow format: namespace::hex64
 * Example: onchain-transfer-agent::12204a039322c01e9f714b56259c3e68b69058bf5dfe1debbe956c698f905ceba9d7
 */
function extractCleanPartyId(text: string): string | null {
  // Find all potential party ID patterns with :: separator
  // The hex part should be exactly 64 characters
  const partyIdRegex = /([a-zA-Z][a-zA-Z0-9_-]*)::(12[a-f0-9]{62})/gi;
  const matches = [...text.matchAll(partyIdRegex)];

  if (matches.length > 0) {
    // Get the first match - groups 1 and 2 are namespace and hex
    const namespace = matches[0][1];
    const hex = matches[0][2];

    // Clean up namespace - remove common prefix text like "Application"
    let cleanNamespace = namespace;
    // Common prefixes that accidentally get captured
    const prefixes = ['Application', 'Party', 'Provider', 'ID', 'PartyId'];
    for (const prefix of prefixes) {
      if (cleanNamespace.startsWith(prefix) && cleanNamespace.length > prefix.length) {
        cleanNamespace = cleanNamespace.slice(prefix.length);
        break;
      }
    }

    return `${cleanNamespace}::${hex}`;
  }

  return null;
}

/**
 * Clean and extract website URL from text content.
 * Stops at TLD boundary, removing trailing text.
 */
function extractCleanWebsite(text: string): string | null {
  // Filter out garbage text that's not a URL (cookie banners, etc.)
  const garbagePatterns = ['cookies', 'agree', 'consent', 'privacy policy', 'learn more'];
  const lowerText = text.toLowerCase();
  if (garbagePatterns.some(p => lowerText.includes(p) && !lowerText.includes('http'))) {
    return null;
  }

  // Match URL up to and including TLD, then stop at common boundaries
  const websiteRegex = /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*\.(com|io|org|net|app|xyz|co|ai|dev)(?:\/[^\s<>"]*)?/gi;
  const matches = text.match(websiteRegex);

  if (matches && matches.length > 0) {
    let url = matches[0];
    // Remove trailing punctuation that's not part of URL
    url = url.replace(/[.,;:!?'")\]}>]+$/, '');
    // Remove common trailing words that got captured
    url = url.replace(/(Emails|Product|Summary|Name|Background|Company|Description).*$/i, '');
    // Final validation - reject if it doesn't look like a valid URL
    if (!url.startsWith('http') || url.length < 10) {
      return null;
    }
    return url;
  }
  return null;
}

/**
 * Extract applicant name from topic title.
 * Topic titles follow format: "New Featured App Request: Company Name"
 */
function extractApplicantFromTitle(title: string): string | null {
  // Extract from "New Featured App Request: Company Name"
  const match = title.match(/(?:New\s+)?Featured\s+App\s+Request[:\s]+(.+)$/i);
  if (match) {
    return match[1].trim();
  }

  // Try other patterns
  const altMatch = title.match(/Request[:\s]+(.+)$/i);
  return altMatch ? altMatch[1].trim() : null;
}

/**
 * Extract clean description from message content.
 * Removes page chrome, scripts, and other cruft.
 */
function extractCleanDescription(text: string): string {
  // Remove common page cruft
  let clean = text
    // Remove cookie consent and script blocks
    .replace(/Our site uses cookies.*?I Agree/gs, '')
    .replace(/if \(window\.matchMedia.*?\}/gs, '')
    .replace(/var groupnavigatorData.*$/gs, '')
    .replace(/function highlightSubstring.*$/gs, '')
    .replace(/function populateList.*$/gs, '')
    .replace(/\/\/ Keep track of.*$/gs, '')
    // Remove language selector items
    .replace(/(العربية|Deutsch|English|Español|Français|Italiano|Nederlands|Português.*?|Українська|简体中文)/g, '')
    // Remove navigation elements
    .replace(/to navigate.*?esc to dismiss/gs, '')
    .replace(/Log In/g, '')
    .replace(/Help/g, '')
    // Clean up whitespace
    .replace(/[\t\n]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Try to extract just the message body content
  // Look for content after common headers
  const contentMatch = clean.match(/(?:Summary of Company|Background|Description)[:\s]*(.{100,})/is);
  if (contentMatch) {
    clean = contentMatch[1].slice(0, 2000);
  }

  return clean.slice(0, 3000);
}

/**
 * Extract a field value from text using label patterns.
 */
function extractFieldByLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    // Try pattern: "Label: value" or "Label\nvalue"
    const regex = new RegExp(`${label}[:\\s]*([^\\n]{10,500})`, 'i');
    const match = text.match(regex);
    if (match) {
      let value = match[1].trim();
      // Clean up common artifacts
      value = value.replace(/^[:\s]+/, '').trim();
      // Stop at next field marker
      value = value.split(/(?:Name of|Summary|Background|Description|Party|Website|Email|Launch|Repository|Target|Reward)/i)[0].trim();
      if (value.length > 5) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Extract all email addresses from text.
 */
function extractEmails(text: string): string[] {
  // Match complete email addresses (not redacted ones with ...)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Filter out redacted emails and false positives
  return [...new Set(matches)].filter(email =>
    !email.includes('...') &&
    !email.includes('example.com') &&
    !email.includes('test.com') &&
    !email.match(/^\d+Email/) &&  // Filter "290Email..." artifacts
    !email.match(/@\.\.\./) &&    // Filter redacted domains
    email.split('@')[0].length > 2  // Filter partial emails
  );
}

/**
 * Extract all documentation/GitHub URLs from text.
 */
function extractDocUrls(text: string): string[] {
  const urlRegex = /https?:\/\/(?:github\.com|docs\.|documentation)[^\s<>"]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)]
    .map(url => {
      // Clean up URL - remove trailing artifacts
      url = url.replace(/[.,;:!?'")\]}>]+$/, '');
      // Remove common text artifacts that get captured after .md
      url = url.replace(/\.md[A-Z].*$/i, '.md');
      return url;
    })
    .filter(url => url.length > 20);  // Filter out truncated URLs
}

/**
 * Extract date from text.
 */
function extractDate(text: string): string | null {
  // Try ISO format first
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Try "Month Day, Year" format
  const longMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i);
  if (longMatch) return longMatch[0];

  return null;
}

async function extractTopicDetails(page: Page, topic: TokenomicsApplication): Promise<TokenomicsApplication> {
  console.log(`\nExtracting details from: ${topic.topicTitle.slice(0, 50)}...`);
  console.log(`Direct link: ${topic.topicUrl}`);

  try {
    await page.goto(topic.topicUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await delay(2000);

    // Take screenshot
    const screenshotName = topic.topicTitle.replace(/[^a-z0-9]/gi, "_").slice(0, 30);
    await page.screenshot({ path: `/tmp/topic-${screenshotName}.png`, fullPage: true });

    // Extract applicant/organization name from topic title
    topic.applicantName = extractApplicantFromTitle(topic.topicTitle) || undefined;
    topic.organizationName = topic.applicantName;
    topic.institutionName = topic.applicantName;
    if (topic.organizationName) {
      console.log(`Organization Name: ${topic.organizationName}`);
    }

    // Extract message content
    const messageContent = await page.textContent(".message-body, .msg-content, .content, article, .post-content, body");

    if (messageContent) {
      console.log("Raw content length:", messageContent.length);

      // === 1. NAME OF APPLYING INSTITUTION ===
      const institutionName = extractFieldByLabel(messageContent, [
        'Name of Applying Institution',
        'Name of the Applying Institution',
        'Applying Institution',
        'Institution Name'
      ]);
      if (institutionName) {
        topic.institutionName = institutionName;
        topic.organizationName = institutionName;
        console.log(`Institution Name: ${topic.institutionName}`);
      }

      // === 2. NAME OF THE APPLICATION ===
      const appName = extractFieldByLabel(messageContent, [
        'Name of the application',
        'Application Name',
        'Name of Application',
        'Product Name',
        'App Name'
      ]);
      if (appName) {
        topic.applicationName = appName;
        console.log(`Application Name: ${topic.applicationName}`);
      }

      // === 3. URL OF THE APPLYING INSTITUTION ===
      const institutionUrl = extractFieldByLabel(messageContent, [
        'URL of the applying institution',
        'Institution URL',
        'Company URL',
        'Organization URL',
        'Website'
      ]);
      if (institutionUrl) {
        topic.institutionUrl = extractCleanWebsite(institutionUrl) || institutionUrl;
        topic.website = topic.institutionUrl;
        console.log(`Institution URL: ${topic.institutionUrl}`);
      } else {
        // Fallback: extract any website
        const website = extractCleanWebsite(messageContent);
        if (website) {
          topic.website = website;
          topic.institutionUrl = website;
          console.log(`Website: ${topic.website}`);
        }
      }

      // === 4. EMAILS FOR RESPONSIBLE PERSONS ===
      const emails = extractEmails(messageContent);
      if (emails.length > 0) {
        topic.responsibleEmails = emails;
        topic.contactEmails = emails;
        console.log(`Responsible Emails: ${emails.join(', ')}`);
      }

      // === 5. PARTY ID FOR THE FEATURED APPLICATION ===
      const partyId = extractCleanPartyId(messageContent);
      if (partyId) {
        topic.partyId = partyId;
        console.log(`Party ID: ${topic.partyId}`);
      }

      // === 6. URL FOR PUBLIC CODE REPOSITORY ===
      const repoMatch = messageContent.match(/(?:repository|github|code)[:\s]*(https?:\/\/github\.com[^\s<>"]+|N\/A|proprietary|private)/i);
      if (repoMatch) {
        let repo = repoMatch[1].trim();
        repo = repo.replace(/\.md[A-Z].*$/i, '.md');
        topic.codeRepository = repo;
        console.log(`Code Repository: ${topic.codeRepository}`);
      }

      // === 7. SUMMARY OF WHAT APPLICATION WILL DO ===
      const appSummary = extractFieldByLabel(messageContent, [
        'Provide a summary of what your application will do',
        'summary of what your application will do',
        'Application Summary',
        'Summary of Application',
        'What does the application do',
        'Product Summary'
      ]);
      if (appSummary) {
        topic.applicationSummary = appSummary.slice(0, 2000);
        console.log(`Application Summary: ${topic.applicationSummary.slice(0, 100)}...`);
      }

      // === 8. EXPECTED USERS ===
      const expectedUsers = extractFieldByLabel(messageContent, [
        'Describe the expected users of your application',
        'expected users of your application',
        'Expected Users',
        'Target Users',
        'Who are the target users',
        'Intended Users'
      ]);
      if (expectedUsers) {
        topic.expectedUsers = expectedUsers.slice(0, 1000);
        topic.targetUsers = topic.expectedUsers;
        console.log(`Expected Users: ${topic.expectedUsers.slice(0, 100)}...`);
      }

      // === 9. LEDGER INTERACTION ===
      const ledgerInteraction = extractFieldByLabel(messageContent, [
        'Describe how your application will interact with the ledger',
        'how your application will interact with the ledger',
        'Ledger Interaction',
        'interact with the ledger'
      ]);
      if (ledgerInteraction) {
        topic.ledgerInteraction = ledgerInteraction.slice(0, 1000);
        console.log(`Ledger Interaction: ${topic.ledgerInteraction.slice(0, 100)}...`);
      }

      // === 10. REWARD ACTIVITIES ===
      const rewardActivities = extractFieldByLabel(messageContent, [
        'Describe the activities that your application will earn application rewards from',
        'activities that your application will earn application rewards from',
        'activities that earn application rewards',
        'Reward Activities',
        'earn application rewards'
      ]);
      if (rewardActivities) {
        topic.rewardActivities = rewardActivities.slice(0, 1000);
        topic.rewardMechanism = topic.rewardActivities;
        console.log(`Reward Activities: ${topic.rewardActivities.slice(0, 100)}...`);
      }

      // === 11. USES CANTON COIN OR ACTIVITY MARKERS ===
      const usesCC = extractFieldByLabel(messageContent, [
        'Does this activity use Canton Coin or Activity Markers to generate rewards',
        'use Canton Coin or Activity Markers',
        'Canton Coin or Activity Markers',
        'CC or Activity Markers'
      ]);
      if (usesCC) {
        topic.usesCantonCoinOrMarkers = usesCC.slice(0, 500);
        console.log(`Uses CC/Markers: ${topic.usesCantonCoinOrMarkers.slice(0, 100)}...`);
      }

      // === 12. DAILY TRANSACTIONS PER USER ===
      const dailyTx = extractFieldByLabel(messageContent, [
        'On a per user basis, what is your expected daily number of transactions',
        'expected daily number of transactions',
        'daily number of transactions',
        'Daily Transactions'
      ]);
      if (dailyTx) {
        topic.dailyTransactionsPerUser = dailyTx.slice(0, 500);
        console.log(`Daily Tx Per User: ${topic.dailyTransactionsPerUser.slice(0, 100)}...`);
      }

      // === 13. MULTIPLE TRANSACTIONS CONDITIONS ===
      const multiTx = extractFieldByLabel(messageContent, [
        'Under what conditions may a user generate multiple transactions per round',
        'conditions may a user generate multiple transactions',
        'multiple transactions per round',
        'Multiple Transactions'
      ]);
      if (multiTx) {
        topic.multipleTransactionConditions = multiTx.slice(0, 1000);
        console.log(`Multiple Tx Conditions: ${topic.multipleTransactionConditions.slice(0, 100)}...`);
      }

      // === 14. TRANSACTION SCALING ===
      const scaling = extractFieldByLabel(messageContent, [
        'How do you expect your transactions to scale',
        'transactions to scale as your customer base scales',
        'transaction scaling',
        'Linearly, Super Linear, Sub Linear'
      ]);
      if (scaling) {
        topic.transactionScaling = scaling.slice(0, 500);
        console.log(`Transaction Scaling: ${topic.transactionScaling.slice(0, 100)}...`);
      }

      // === 15. MAINNET LAUNCH DATE ===
      const launchDate = extractFieldByLabel(messageContent, [
        'What is your anticipated launch date on MainNet',
        'anticipated launch date on MainNet',
        'MainNet launch date',
        'Launch Date'
      ]);
      if (launchDate) {
        topic.mainnetLaunchDate = launchDate.slice(0, 200);
        console.log(`MainNet Launch Date: ${topic.mainnetLaunchDate}`);
      } else {
        // Fallback regex
        const launchMatch = messageContent.match(/(?:MainNet|Launch|Go.?Live)[:\s]*(?:Date)?[:\s]*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
        if (launchMatch) {
          topic.mainnetLaunchDate = launchMatch[1].trim();
          console.log(`MainNet Launch Date: ${topic.mainnetLaunchDate}`);
        }
      }

      // === 16. FIRST CUSTOMERS ===
      const firstCustomers = extractFieldByLabel(messageContent, [
        'Who will be your first customers and what is the expected go-live dates',
        'first customers and what is the expected go-live',
        'first customers',
        'First Customers',
        'go-live dates'
      ]);
      if (firstCustomers) {
        topic.firstCustomers = firstCustomers.slice(0, 1000);
        console.log(`First Customers: ${topic.firstCustomers.slice(0, 100)}...`);
      }

      // === 17. NO FA STATUS IMPACT ===
      const noFAImpact = extractFieldByLabel(messageContent, [
        'How would not having FA status change your operating plans',
        'not having FA status change your operating plans',
        'without FA status',
        'No FA Status Impact'
      ]);
      if (noFAImpact) {
        topic.noFAStatusImpact = noFAImpact.slice(0, 1000);
        console.log(`No FA Status Impact: ${topic.noFAStatusImpact.slice(0, 100)}...`);
      }

      // === 18. BONA FIDE CONTROLS ===
      const bonafide = extractFieldByLabel(messageContent, [
        'Does your application have any controls to prevent non-bona fide transactions',
        'controls to prevent non-bona fide transactions',
        'non-bona fide transactions',
        'Bona Fide Controls'
      ]);
      if (bonafide) {
        topic.bonafideControls = bonafide.slice(0, 1000);
        console.log(`Bona Fide Controls: ${topic.bonafideControls.slice(0, 100)}...`);
      }

      // === 19. ADDITIONAL NOTES ===
      const notes = extractFieldByLabel(messageContent, [
        "Additional Notes for the Committee's consideration",
        'Additional Notes for the Committee',
        'Additional Notes',
        "Committee's consideration"
      ]);
      if (notes) {
        topic.additionalNotes = notes.slice(0, 2000);
        console.log(`Additional Notes: ${topic.additionalNotes.slice(0, 100)}...`);
      }

      // === ORGANIZATION BACKGROUND (legacy) ===
      const background = extractFieldByLabel(messageContent, [
        'Summary of Company and Background',
        'Company Background',
        'Organization Background',
        'About the Company',
        'Background'
      ]);
      if (background) {
        topic.organizationBackground = background.slice(0, 1000);
        console.log(`Organization Background: ${topic.organizationBackground.slice(0, 100)}...`);
      }

      // === SUBMISSION DATE ===
      const submissionDate = extractDate(messageContent);
      if (submissionDate) {
        topic.submissionDate = submissionDate;
        console.log(`Submission Date: ${topic.submissionDate}`);
      }

      // === DOCUMENTATION URLS ===
      const docUrls = extractDocUrls(messageContent);
      if (docUrls.length > 0) {
        topic.documentationUrls = docUrls;
        console.log(`Documentation URLs: ${docUrls.join(', ')}`);
      }

      // === LEGACY DESCRIPTION (combined summary) ===
      topic.description = [
        topic.organizationBackground,
        topic.applicationSummary,
        topic.expectedUsers
      ].filter(Boolean).join('\n\n').slice(0, 2000) || extractCleanDescription(messageContent);
    }

  } catch (error) {
    console.error(`Error extracting topic details:`, error);
  }

  return topic;
}

async function crawlTokenomics(): Promise<TokenomicsApplication[]> {
  console.log("=".repeat(60));
  console.log("Tokenomics Applications Crawler");
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
    console.log(`Navigating to ${TOKENOMICS_URL}...`);
    await page.goto(TOKENOMICS_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("Page loaded. Current URL:", page.url());

    // Give extra time for dynamic content
    await delay(3000);

    // Check if we need to login or if it's public
    const pageContent = await page.textContent("body");
    if (pageContent?.includes("Sign In") || pageContent?.includes("Log In") || pageContent?.includes("login")) {
      console.log("\nNote: Page may require authentication for full access");
    }

    // Extract topics list
    const topics = await extractTopicsFromPage(page);

    console.log(`\nFound ${topics.length} relevant topics`);

    // Extract details from all topics
    const detailedTopics: TokenomicsApplication[] = [];
    for (let i = 0; i < topics.length; i++) {
      console.log(`\n[${i + 1}/${topics.length}] Processing...`);
      const detailed = await extractTopicDetails(page, topics[i]);
      detailedTopics.push(detailed);
      await delay(2000); // Rate limit between requests
    }

    return detailedTopics;

  } catch (error) {
    console.error("Error during crawl:", error);

    try {
      await page.screenshot({ path: "/tmp/tokenomics-error.png" });
      console.log("Error screenshot saved to /tmp/tokenomics-error.png");
    } catch {
      // Ignore screenshot errors
    }

    return [];
  } finally {
    await browser.close();
    console.log("\nBrowser closed.");
  }
}

/**
 * Match crawled applications with existing entities in the database.
 * Updates existing entities and creates new ones for unmatched party IDs.
 */
async function matchAndUpdateEntities(applications: TokenomicsApplication[]): Promise<void> {
  // Dynamically import Prisma to avoid top-level import issues
  const { Pool } = await import("pg");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../../generated/prisma/client");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("\nNo DATABASE_URL found - skipping database update");
    return;
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("\n" + "=".repeat(60));
  console.log("SYNCING WITH DATABASE");
  console.log("=".repeat(60));

  let matchCount = 0;
  let updateCount = 0;
  let createCount = 0;
  let skipCount = 0;

  for (const app of applications) {
    if (!app.partyId) {
      console.log(`\nSkipping "${app.topicTitle.slice(0, 40)}..." - no party ID`);
      skipCount++;
      continue;
    }

    console.log(`\nProcessing: ${app.organizationName || app.topicTitle.slice(0, 40)}...`);
    console.log(`  Party ID: ${app.partyId.slice(0, 50)}...`);

    // Try to find entity with matching party ID (match on hex part)
    const hexPart = app.partyId.split("::")[1] || app.partyId;
    const entity = await prisma.entity.findFirst({
      where: {
        partyId: {
          contains: hexPart,
        },
      },
    });

    if (entity) {
      matchCount++;
      console.log(`  ✓ MATCH FOUND: ${entity.name} (ID: ${entity.id})`);

      // Update entity with additional data from tokenomics application
      const updates: Record<string, unknown> = {};

      if (app.website && !entity.website) {
        updates.website = app.website;
      }

      if (app.description && !entity.description) {
        updates.description = app.description.slice(0, 1000);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.entity.update({
          where: { id: entity.id },
          data: updates,
        });
        updateCount++;
        console.log(`  ✓ Updated with: ${Object.keys(updates).join(", ")}`);
      } else {
        console.log(`  - Already up to date`);
      }
    } else {
      // No match found - create new entity
      console.log(`  ✗ No existing entity found`);

      // Check if we have enough data to create a new entity
      if (!app.organizationName && !app.applicantName) {
        console.log(`  ⚠ Skipping - no organization name available`);
        skipCount++;
        continue;
      }

      try {
        const newEntity = await prisma.entity.create({
          data: {
            name: app.organizationName || app.applicantName || "Unknown",
            partyId: app.partyId,
            type: "FEATURED_APP",
            claimStatus: "UNCLAIMED",
            activeStatus: "INACTIVE",
            foundationStatus: "PENDING",
            website: app.website || null,
            description: app.description?.slice(0, 1000) || null,
            targetAmount: 0,
            currentAmount: 0,
            importedAt: new Date(),
            importSource: "TOKENOMICS_CSV",
          },
        });
        createCount++;
        console.log(`  ✓ CREATED NEW ENTITY: ${newEntity.name} (ID: ${newEntity.id})`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Unique constraint')) {
          console.log(`  ⚠ Entity already exists (duplicate party ID)`);
        } else {
          console.error(`  ✗ Error creating entity:`, errorMessage);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("SYNC SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total applications processed: ${applications.length}`);
  console.log(`  - Matched & updated: ${updateCount}`);
  console.log(`  - Already up to date: ${matchCount - updateCount}`);
  console.log(`  - New entities created: ${createCount}`);
  console.log(`  - Skipped (no party ID or name): ${skipCount}`);

  await prisma.$disconnect();
  await pool.end();
}

// Run the crawler
crawlTokenomics()
  .then(async (applications) => {
    console.log("");
    console.log("=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total applications found: ${applications.length}`);

    if (applications.length > 0) {
      // Save to JSON
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `tokenomics-apps-${timestamp}.json`;
      const filepath = path.join(DATA_DIR, filename);

      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      fs.writeFileSync(filepath, JSON.stringify(applications, null, 2), "utf-8");
      console.log(`JSON saved to: ${filepath}`);

      console.log("\nExtracted applications:");
      for (const app of applications) {
        console.log(`\n${"─".repeat(60)}`);
        console.log(`📋 ${app.topicTitle}`);
        console.log(`🔗 ${app.topicUrl}`);
        console.log(`${"─".repeat(60)}`);

        if (app.organizationName) console.log(`  Organization: ${app.organizationName}`);
        if (app.applicationName) console.log(`  Application: ${app.applicationName}`);
        if (app.website) console.log(`  Website: ${app.website}`);
        if (app.partyId) console.log(`  Party ID: ${app.partyId}`);
        if (app.submissionDate) console.log(`  Submitted: ${app.submissionDate}`);
        if (app.mainnetLaunchDate) console.log(`  MainNet Launch: ${app.mainnetLaunchDate}`);
        if (app.codeRepository) console.log(`  Repository: ${app.codeRepository}`);
        if (app.contactEmails?.length) console.log(`  Emails: ${app.contactEmails.join(', ')}`);
        if (app.documentationUrls?.length) console.log(`  Docs: ${app.documentationUrls.join(', ')}`);
        if (app.organizationBackground) console.log(`  Background: ${app.organizationBackground.slice(0, 150)}...`);
        if (app.applicationSummary) console.log(`  Summary: ${app.applicationSummary.slice(0, 150)}...`);
        if (app.targetUsers) console.log(`  Target Users: ${app.targetUsers.slice(0, 150)}...`);
        if (app.rewardMechanism) console.log(`  Rewards: ${app.rewardMechanism.slice(0, 150)}...`);
      }

      // Match with database entities
      await matchAndUpdateEntities(applications);
    }
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
