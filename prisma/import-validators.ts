/**
 * Import Validators from crawler data
 * Imports validators crawled from ccview.io/validators
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
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

interface ValidatorData {
  name: string;
  partyId: string;
  sponsor?: string;
  transactions?: string;
  trafficPurchased?: string;
  rewardsEarned?: string;
  balance?: string;
}

function cleanSponsorName(sponsor: string | undefined): string | null {
  if (!sponsor) return null;
  // Remove "Copied" suffix that comes from copy button text
  return sponsor.replace(/Copied$/, "").replace(/-/g, " ").trim();
}

function parseBalance(balanceStr: string | undefined): number | null {
  if (!balanceStr) return null;
  // Parse "2,135.39 CC$320.268" -> 2135.39
  const match = balanceStr.match(/^([\d,]+\.?\d*)\s*CC/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ""));
  }
  return null;
}

function parseRewards(rewardsStr: string | undefined): number | null {
  if (!rewardsStr) return null;
  // Parse "2,907.186 CC" -> 2907.186
  const match = rewardsStr.match(/^([\d,]+\.?\d*)\s*CC/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ""));
  }
  return null;
}

async function importValidators() {
  // Find the most recent validators JSON file
  const dataDir = path.join(process.cwd(), "data");
  const files = fs.readdirSync(dataDir);
  const validatorFiles = files
    .filter((f) => f.startsWith("validators-ccview-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (validatorFiles.length === 0) {
    console.log("No validator data files found in data/ directory");
    return;
  }

  const latestFile = validatorFiles[0];
  console.log(`Importing from: ${latestFile}\n`);

  const filePath = path.join(dataDir, latestFile);
  const validators: ValidatorData[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  console.log(`Found ${validators.length} validators to import\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const validator of validators) {
    try {
      const sponsor = cleanSponsorName(validator.sponsor);
      const balance = parseBalance(validator.balance);
      const rewards = parseRewards(validator.rewardsEarned);

      // Build description from available data
      const descParts: string[] = [];
      if (sponsor) descParts.push(`Sponsored by ${sponsor}.`);
      if (rewards) descParts.push(`Earned ${rewards.toLocaleString()} CC in rewards.`);
      if (balance) descParts.push(`Current balance: ${balance.toLocaleString()} CC.`);
      const description = descParts.length > 0 ? descParts.join(" ") : null;

      // Use name as partyId since we only have namespace identifiers
      const partyId = validator.partyId || validator.name;

      // Check if entity already exists
      const existing = await prisma.entity.findUnique({ where: { partyId } });

      // Store validator data in applicationData JSON field
      const validatorAppData = {
        sponsor,
        transactions: validator.transactions,
        trafficPurchased: validator.trafficPurchased,
        rewardsEarned: validator.rewardsEarned,
        balance: validator.balance,
        ccBalance: balance,
        ccRewards: rewards,
      };

      await prisma.entity.upsert({
        where: { partyId },
        update: {
          name: validator.name,
          description,
          applicationData: validatorAppData,
        },
        create: {
          name: validator.name,
          partyId,
          type: "VALIDATOR",
          description,
          claimStatus: "UNCLAIMED",
          activeStatus: "ACTIVE",
          category: "Infrastructure",
          targetAmount: 1000000, // 1M CC required for validators
          importedAt: new Date(),
          importSource: "CCVIEW",
          applicationData: validatorAppData,
        },
      });

      if (existing) {
        updated++;
        console.log(`  ↻ Updated: ${validator.name}`);
      } else {
        created++;
        console.log(`  ✓ Created: ${validator.name}`);
      }
    } catch (error) {
      errors++;
      console.error(`  ✗ Error importing ${validator.name}:`, error);
    }
  }

  console.log("\n=== Import Summary ===");
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${validators.length}`);

  // Show total counts
  const totalValidators = await prisma.entity.count({ where: { type: "VALIDATOR" } });
  const totalFeaturedApps = await prisma.entity.count({ where: { type: "FEATURED_APP" } });
  console.log(`\nDatabase totals:`);
  console.log(`  Validators: ${totalValidators}`);
  console.log(`  Featured Apps: ${totalFeaturedApps}`);
}

importValidators()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
