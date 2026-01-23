/**
 * Seed Entities Script
 *
 * Imports crawled Featured Apps data from JSON into the database.
 *
 * Usage: npx tsx src/scripts/import/seed-entities.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import * as fs from "fs";
import * as path from "path";

// Create Prisma client with adapter
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface FeaturedApp {
  organization: string;
  partyId: string;
  volume?: string;
  transactions?: string;
  rewards?: string;
  profits?: string;
  source: string;
}

async function findLatestJsonFile(): Promise<string | null> {
  const dataDir = path.join(process.cwd(), "data");

  if (!fs.existsSync(dataDir)) {
    return null;
  }

  const files = fs.readdirSync(dataDir)
    .filter(f => f.startsWith("featured-apps-") && f.endsWith(".json"))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(dataDir, files[0]) : null;
}

async function seedEntities() {
  console.log("=".repeat(60));
  console.log("Seeding Entities from Crawled Data");
  console.log("=".repeat(60));
  console.log("");

  // Find the latest JSON file
  const jsonFile = await findLatestJsonFile();

  if (!jsonFile) {
    console.error("No JSON data files found in data/ directory");
    console.error("Run the crawler first: npx tsx src/scripts/import/dry-run.ts");
    process.exit(1);
  }

  console.log(`Loading data from: ${jsonFile}`);

  const data: FeaturedApp[] = JSON.parse(fs.readFileSync(jsonFile, "utf-8"));
  console.log(`Found ${data.length} Featured Apps to import`);
  console.log("");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const app of data) {
    // Skip entries without valid party ID
    if (!app.partyId || !app.partyId.includes("::")) {
      console.log(`  Skipping invalid entry: ${app.organization}`);
      skipped++;
      continue;
    }

    // Clean organization name (replace "—" with "Unknown")
    const name = app.organization === "—" ? `Unknown (${app.partyId.split("::")[0]})` : app.organization;

    try {
      const existing = await prisma.entity.findUnique({
        where: { partyId: app.partyId },
      });

      if (existing) {
        // Update existing entity
        await prisma.entity.update({
          where: { partyId: app.partyId },
          data: {
            name: name,
            // Don't overwrite other fields if already set
          },
        });
        console.log(`  Updated: ${name}`);
        updated++;
      } else {
        // Create new entity
        await prisma.entity.create({
          data: {
            name: name,
            partyId: app.partyId,
            type: "FEATURED_APP",
            targetAmount: 10000000, // 10M CC default for Featured Apps
            currentAmount: 0,
            claimStatus: "UNCLAIMED",
            foundationStatus: "PENDING",
            activeStatus: "INACTIVE",
            importSource: "CANTON_SCANNER",
            importedAt: new Date(),
            externalId: app.partyId,
          },
        });
        console.log(`  Created: ${name}`);
        created++;
      }
    } catch (error) {
      console.error(`  Error processing ${name}:`, error);
      skipped++;
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("IMPORT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${data.length}`);
}

seedEntities()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
