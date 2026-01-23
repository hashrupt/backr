/**
 * Sync tokenomics data to database - forces update even if fields exist
 * Uses the most recent crawled JSON file
 */
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

interface TokenomicsApplication {
  topicTitle: string;
  topicUrl: string;
  organizationName?: string;
  partyId?: string;
  website?: string;
  description?: string;
  applicantName?: string;
}

async function syncTokenomicsData(): Promise<void> {
  const { Pool } = await import("pg");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../../generated/prisma/client");

  // Find the most recent tokenomics JSON file
  const dataDir = path.join(process.cwd(), "data");
  const files = fs.readdirSync(dataDir)
    .filter(f => f.startsWith("tokenomics-apps-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log("No tokenomics data files found!");
    return;
  }

  const latestFile = path.join(dataDir, files[0]);
  console.log(`Loading data from: ${files[0]}`);

  const applications: TokenomicsApplication[] = JSON.parse(
    fs.readFileSync(latestFile, "utf-8")
  );
  console.log(`Loaded ${applications.length} applications`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("No DATABASE_URL found!");
    return;
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("\n" + "=".repeat(60));
  console.log("SYNCING TOKENOMICS DATA TO DATABASE");
  console.log("=".repeat(60));

  let matchCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  for (const app of applications) {
    if (!app.partyId) {
      skipCount++;
      continue;
    }

    // Match by hex part of party ID
    const hexPart = app.partyId.split("::")[1] || app.partyId;

    const entity = await prisma.entity.findFirst({
      where: {
        partyId: { contains: hexPart },
      },
    });

    if (entity) {
      matchCount++;

      // Build updates - ALWAYS update if tokenomics has data
      const updates: Record<string, unknown> = {};

      if (app.website) {
        updates.website = app.website;
      }

      if (app.description) {
        updates.description = app.description.slice(0, 1000);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.entity.update({
          where: { id: entity.id },
          data: updates,
        });
        updateCount++;
        console.log(`Updated: ${entity.name} - ${Object.keys(updates).join(", ")}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("SYNC COMPLETE");
  console.log("=".repeat(60));
  console.log(`Matched: ${matchCount}`);
  console.log(`Updated: ${updateCount}`);
  console.log(`Skipped (no party ID): ${skipCount}`);

  await prisma.$disconnect();
  await pool.end();
}

syncTokenomicsData().catch(console.error);
