import { config } from "dotenv";
config();

import { PrismaClient, EntityType } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface CrawlerApp {
  topicTitle: string;
  topicUrl: string;
  applicantName?: string;
  organizationName?: string;
  institutionName?: string;
  applicationName?: string;
  partyId?: string;
  website?: string;
  institutionUrl?: string;
  submissionDate?: string;
  contactEmails?: string[];
  responsibleEmails?: string[];
  organizationBackground?: string;
  applicationSummary?: string;
  expectedUsers?: string;
  targetUsers?: string;
  ledgerInteraction?: string;
  rewardActivities?: string;
  rewardMechanism?: string;
  usesCantonCoinOrMarkers?: string;
  dailyTransactionsPerUser?: string;
  multipleTransactionConditions?: string;
  transactionScaling?: string;
  mainnetLaunchDate?: string;
  firstCustomers?: string;
  noFAStatusImpact?: string;
  bonafideControls?: string;
  additionalNotes?: string;
  codeRepository?: string;
  documentationUrls?: string[];
  description?: string;
}

function buildApplicationData(app: CrawlerApp) {
  return JSON.parse(JSON.stringify({
    institutionName: app.institutionName || app.organizationName,
    applicationName: app.applicationName,
    institutionUrl: app.institutionUrl || app.website,
    responsibleEmails: app.responsibleEmails || app.contactEmails,
    codeRepository: app.codeRepository,
    applicationSummary: app.applicationSummary,
    expectedUsers: app.expectedUsers || app.targetUsers,
    ledgerInteraction: app.ledgerInteraction,
    rewardActivities: app.rewardActivities || app.rewardMechanism,
    usesCantonCoinOrMarkers: app.usesCantonCoinOrMarkers,
    dailyTransactionsPerUser: app.dailyTransactionsPerUser,
    multipleTransactionConditions: app.multipleTransactionConditions,
    transactionScaling: app.transactionScaling,
    mainnetLaunchDate: app.mainnetLaunchDate,
    firstCustomers: app.firstCustomers,
    noFAStatusImpact: app.noFAStatusImpact,
    bonafideControls: app.bonafideControls,
    additionalNotes: app.additionalNotes,
    organizationBackground: app.organizationBackground,
    documentationUrls: app.documentationUrls,
    submissionDate: app.submissionDate,
    topicUrl: app.topicUrl,
  }));
}

function determineEntityType(app: CrawlerApp): EntityType {
  const title = app.topicTitle.toLowerCase();
  if (title.includes("validator") || title.includes("batch approval")) {
    return "VALIDATOR";
  }
  return "FEATURED_APP";
}

function getTargetAmount(type: EntityType): string {
  // 10M CC for Featured Apps, 1M CC for Validators
  return type === "FEATURED_APP" ? "10000000" : "1000000";
}

// Category patterns for auto-tagging
const categoryPatterns: Record<string, string[]> = {
  'DeFi': ['defi', 'lending', 'borrowing', 'yield', 'stablecoin', 'trading', 'swap', 'liquidity', 'treasury', 'finance', 'payment', 'settlement', 'amm', 'dex'],
  'Gaming': ['game', 'gaming', 'play', 'nft', 'wager', 'esport', 'metaverse'],
  'Data': ['data', 'analytics', 'intelligence', 'oracle', 'indexing', 'reporting', 'ai', 'machine learning'],
  'Infrastructure': ['validator', 'node', 'infrastructure', 'bridge', 'interoperability', 'wallet', 'custody', 'sdk', 'api'],
  'Identity': ['kyc', 'aml', 'identity', 'compliance', 'verification', 'credential', 'privacy'],
  'RWA': ['rwa', 'tokeniz', 'real-world', 'asset', 'securities', 'equity', 'bond', 'real estate'],
  'Storage': ['storage', 'ipfs', 'file', 'data storage', 'backup'],
};

// Extended keyword dictionary for rich tagging (keyword → display label)
const keywordDictionary: Record<string, string> = {
  // Finance & DeFi
  'defi': 'DeFi', 'lending': 'Lending', 'borrowing': 'Borrowing', 'yield': 'Yield',
  'stablecoin': 'Stablecoin', 'trading': 'Trading', 'swap': 'Swap', 'liquidity': 'Liquidity',
  'treasury': 'Treasury', 'payment': 'Payments', 'settlement': 'Settlement',
  'amm': 'AMM', 'dex': 'DEX', 'derivatives': 'Derivatives', 'margin': 'Margin',
  'staking': 'Staking', 'payout': 'Payouts', 'remittance': 'Remittance',
  // Tokenization & Assets
  'tokeniz': 'Tokenized', 'rwa': 'RWA', 'securities': 'Securities', 'equity': 'Equity',
  'bond': 'Bonds', 'real estate': 'Real Estate', 'commodity': 'Commodities',
  'nft': 'NFT', 'collectible': 'Collectibles', 'asset': 'Digital Assets',
  // Infrastructure & Tech
  'validator': 'Validator', 'node': 'Node', 'infrastructure': 'Infrastructure',
  'bridge': 'Bridge', 'interoperability': 'Interop', 'wallet': 'Wallet',
  'custody': 'Custody', 'sdk': 'SDK', 'api': 'API', 'protocol': 'Protocol',
  'smart contract': 'Smart Contracts', 'ledger': 'Ledger', 'on-chain': 'On-chain',
  'cross-chain': 'Cross-chain', 'multichain': 'Multichain', 'layer': 'Layer',
  // Identity & Compliance
  'kyc': 'KYC', 'aml': 'AML', 'identity': 'Identity', 'compliance': 'Compliance',
  'verification': 'Verification', 'credential': 'Credentials', 'privacy': 'Privacy',
  'regulated': 'Regulated', 'compliant': 'Compliant', 'audit': 'Auditable',
  'zero-knowledge': 'ZK Proofs', 'encryption': 'Encrypted',
  // Data & AI
  'analytics': 'Analytics', 'oracle': 'Oracle', 'indexing': 'Indexing',
  'reporting': 'Reporting', 'machine learning': 'ML', 'artificial intelligence': 'AI',
  'intelligence': 'Intelligence', 'prediction': 'Prediction',
  // Users & Markets
  'institutional': 'Institutional', 'enterprise': 'Enterprise', 'retail': 'Retail',
  'b2b': 'B2B', 'marketplace': 'Marketplace', 'exchange': 'Exchange',
  'consumer': 'Consumer', 'developer': 'Developers',
  // Gaming & Social
  'game': 'Gaming', 'gaming': 'Gaming', 'play': 'Play-to-Earn', 'esport': 'Esports',
  'metaverse': 'Metaverse', 'social': 'Social',
  // Storage
  'storage': 'Storage', 'ipfs': 'IPFS', 'backup': 'Backup',
  // Canton-specific
  'canton': 'Canton', 'daml': 'Daml', 'featured app': 'Featured App',
  'canton coin': 'Canton Coin', 'synchronizer': 'Synchronizer',
  // Other domains
  'insurance': 'Insurance', 'healthcare': 'Healthcare', 'supply chain': 'Supply Chain',
  'carbon': 'Carbon Credits', 'energy': 'Energy', 'crowdfund': 'Crowdfunding',
  'governance': 'Governance', 'dao': 'DAO', 'voting': 'Voting',
  'automation': 'Automation', 'treasury management': 'Treasury Mgmt',
  'open source': 'Open Source', 'non-custodial': 'Non-custodial',
};

function detectCategory(app: CrawlerApp): { category: string; tags: string[] } {
  const text = [
    app.applicationSummary,
    app.description,
    app.organizationBackground,
    app.expectedUsers,
    app.ledgerInteraction,
    app.topicTitle
  ].filter(Boolean).join(' ').toLowerCase();

  const matchedCategories: { cat: string; score: number }[] = [];
  const categoryTags: string[] = [];

  for (const [cat, patterns] of Object.entries(categoryPatterns)) {
    const matches = patterns.filter(p => text.includes(p));
    if (matches.length > 0) {
      matchedCategories.push({ cat, score: matches.length });
      categoryTags.push(...matches.slice(0, 3));
    }
  }

  // Sort by score and pick the best category
  matchedCategories.sort((a, b) => b.score - a.score);
  const primaryCategory = matchedCategories[0]?.cat || 'Other';

  // Extract rich tags from the extended dictionary
  const richTags: string[] = [];
  for (const [keyword, label] of Object.entries(keywordDictionary)) {
    if (text.includes(keyword) && !richTags.includes(label)) {
      richTags.push(label);
    }
  }

  // Remove duplicates with category tags, prefer rich labels
  const allTags = [...new Set(richTags)];

  // Remove "Canton" (too generic - every app mentions it) and the primary category label
  const filtered = allTags.filter(t =>
    t !== 'Canton' && t !== primaryCategory && t !== 'Featured App'
  );

  // Limit to 12 tags
  const finalTags = filtered.slice(0, 12);

  return { category: primaryCategory, tags: finalTags };
}

async function importCrawlerData() {
  console.log("Importing crawler data from data/ folder...\n");

  const dataDir = path.join(__dirname, "..", "data");
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));

  // Use the most recent tokenomics file (largest and most complete)
  const tokenomicsFiles = files
    .filter(f => f.startsWith("tokenomics-apps-"))
    .sort()
    .reverse();

  if (tokenomicsFiles.length === 0) {
    console.log("No tokenomics JSON files found in data/ folder");
    return;
  }

  const latestFile = tokenomicsFiles[0];
  console.log(`Using latest file: ${latestFile}\n`);

  const filePath = path.join(dataDir, latestFile);
  const data: CrawlerApp[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  console.log(`Found ${data.length} entries to import\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const app of data) {
    // Skip entries without a partyId
    if (!app.partyId) {
      console.log(`Skipping "${app.applicantName || app.topicTitle}" - no partyId`);
      skipped++;
      continue;
    }

    const name = app.organizationName || app.applicantName || "Unknown";
    const type = determineEntityType(app);

    try {
      // Check if entity already exists
      const existing = await prisma.entity.findUnique({
        where: { partyId: app.partyId }
      });

      const applicationData = buildApplicationData(app);
      const { category, tags } = detectCategory(app);

      if (existing) {
        console.log(`Updating "${name}" (${type}) [${category}]`);
        await prisma.entity.update({
          where: { partyId: app.partyId },
          data: {
            name,
            description: app.description || app.organizationBackground || null,
            website: app.website || null,
            externalId: app.topicUrl,
            applicationData,
            category,
            tags,
            updatedAt: new Date()
          }
        });
      } else {
        console.log(`Creating "${name}" (${type}) [${category}]`);
        await prisma.entity.create({
          data: {
            type,
            name,
            description: app.description || app.organizationBackground || null,
            partyId: app.partyId,
            website: app.website || null,
            targetAmount: getTargetAmount(type),
            currentAmount: "0",
            foundationStatus: "PENDING",
            activeStatus: "INACTIVE",
            claimStatus: "UNCLAIMED",
            importSource: "TOKENOMICS_CSV",
            importedAt: new Date(),
            externalId: app.topicUrl,
            applicationData,
            category,
            tags
          }
        });
      }
      imported++;
    } catch (error) {
      console.error(`Error importing "${name}":`, error);
      errors++;
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Imported/Updated: ${imported}`);
  console.log(`  Skipped (no partyId): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // Show summary of entities in database
  const counts = await prisma.entity.groupBy({
    by: ["type"],
    _count: { id: true }
  });

  console.log(`\nDatabase summary:`);
  for (const c of counts) {
    console.log(`  ${c.type}: ${c._count.id}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

importCrawlerData().catch(console.error);
