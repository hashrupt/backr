import { config } from "dotenv";
config(); // Load environment variables from .env

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hash } from "bcryptjs";

// Use DIRECT_URL for seeding (bypasses PgBouncer for transaction support)
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL environment variable is not set");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create users
  const passwordHash = await hash("password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice Johnson",
      passwordHash: passwordHash,
      partyId: "party::alice::1234567890",
      bio: "DeFi enthusiast and early Canton adopter",
      mockBalance: "5000000",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob Smith",
      passwordHash: passwordHash,
      partyId: "party::bob::0987654321",
      bio: "Validator operator and blockchain developer",
      mockBalance: "10000000",
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: "charlie@example.com" },
    update: {},
    create: {
      email: "charlie@example.com",
      name: "Charlie Davis",
      passwordHash: passwordHash,
      partyId: "party::charlie::5555555555",
      bio: "Long-term investor looking for quality projects",
      mockBalance: "2000000",
    },
  });

  const dave = await prisma.user.upsert({
    where: { email: "dave@example.com" },
    update: {},
    create: {
      email: "dave@example.com",
      name: "Dave Wilson",
      passwordHash: passwordHash,
      partyId: "party::dave::1111111111",
      mockBalance: "500000",
    },
  });

  console.log("Created users:", { alice: alice.id, bob: bob.id, charlie: charlie.id, dave: dave.id });

  // Create entities
  const coolApp = await prisma.entity.upsert({
    where: { partyId: "party::coolapp::featured" },
    update: {},
    create: {
      name: "CoolApp",
      partyId: "party::coolapp::featured",
      type: "FEATURED_APP",
      description: "Next-generation DeFi application on Canton Network",
      targetAmount: "10000000",
      claimStatus: "CLAIMED",
      ownerId: alice.id,
      claimedAt: new Date(),
    },
  });

  const nodeRunner = await prisma.entity.upsert({
    where: { partyId: "party::noderunner::validator" },
    update: {},
    create: {
      name: "NodeRunner",
      partyId: "party::noderunner::validator",
      type: "VALIDATOR",
      description: "Professional validator service with 99.9% uptime",
      targetAmount: "1000000",
      claimStatus: "CLAIMED",
      ownerId: bob.id,
      claimedAt: new Date(),
    },
  });

  await prisma.entity.upsert({
    where: { partyId: "party::newapp::featured" },
    update: {},
    create: {
      name: "NewApp",
      partyId: "party::newapp::featured",
      type: "FEATURED_APP",
      description: "Innovative trading platform coming soon",
      targetAmount: "10000000",
      claimStatus: "UNCLAIMED",
    },
  });

  await prisma.entity.upsert({
    where: { partyId: "party::superval::validator" },
    update: {},
    create: {
      name: "SuperValidator",
      partyId: "party::superval::validator",
      type: "VALIDATOR",
      description: "Enterprise-grade validation infrastructure",
      targetAmount: "1000000",
      claimStatus: "UNCLAIMED",
    },
  });

  console.log("Created entities");

  // Create campaigns
  const campaign1 = await prisma.campaign.upsert({
    where: { id: "campaign-coolapp-1" },
    update: {},
    create: {
      id: "campaign-coolapp-1",
      entityId: coolApp.id,
      title: "Series A Backing Round",
      description: "We're building the next generation DeFi app on Canton. Looking for long-term backers who believe in our vision.",
      targetAmount: "10000000",
      currentAmount: "6500000",
      minContribution: "10000",
      maxContribution: "500000",
      status: "OPEN",
      startsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
    },
  });

  const campaign2 = await prisma.campaign.upsert({
    where: { id: "campaign-noderunner-1" },
    update: {},
    create: {
      id: "campaign-noderunner-1",
      entityId: nodeRunner.id,
      title: "Validator Staking Pool",
      description: "Join our validator staking pool to earn rewards while supporting network security.",
      targetAmount: "5000000",
      currentAmount: "4000000",
      minContribution: "5000",
      maxContribution: "1000000",
      status: "OPEN",
      startsAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.campaign.upsert({
    where: { id: "campaign-coolapp-draft" },
    update: {},
    create: {
      id: "campaign-coolapp-draft",
      entityId: coolApp.id,
      title: "Series B Expansion",
      description: "Draft campaign for future expansion round.",
      targetAmount: "20000000",
      currentAmount: "0",
      minContribution: "50000",
      maxContribution: "2000000",
      status: "DRAFT",
    },
  });

  console.log("Created campaigns");

  // Create backings
  await prisma.backing.upsert({
    where: { userId_entityId_campaignId: { userId: bob.id, entityId: coolApp.id, campaignId: campaign1.id } },
    update: {},
    create: {
      userId: bob.id,
      entityId: coolApp.id,
      campaignId: campaign1.id,
      amount: "500000",
      status: "LOCKED",
      lockedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.backing.upsert({
    where: { userId_entityId_campaignId: { userId: charlie.id, entityId: coolApp.id, campaignId: campaign1.id } },
    update: {},
    create: {
      userId: charlie.id,
      entityId: coolApp.id,
      campaignId: campaign1.id,
      amount: "250000",
      status: "LOCKED",
      lockedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.backing.upsert({
    where: { userId_entityId_campaignId: { userId: alice.id, entityId: nodeRunner.id, campaignId: campaign2.id } },
    update: {},
    create: {
      userId: alice.id,
      entityId: nodeRunner.id,
      campaignId: campaign2.id,
      amount: "1000000",
      status: "LOCKED",
      lockedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Created backings");

  // Create interests
  await prisma.interest.upsert({
    where: { userId_campaignId: { userId: dave.id, campaignId: campaign1.id } },
    update: {},
    create: {
      userId: dave.id,
      campaignId: campaign1.id,
      pledgeAmount: "100000",
      message: "I believe in DeFi and want to support innovative projects on Canton!",
      status: "PENDING",
    },
  });

  await prisma.interest.upsert({
    where: { userId_campaignId: { userId: charlie.id, campaignId: campaign2.id } },
    update: {},
    create: {
      userId: charlie.id,
      campaignId: campaign2.id,
      pledgeAmount: "200000",
      message: "Looking to diversify my staking portfolio with quality validators.",
      status: "PENDING",
    },
  });

  await prisma.interest.upsert({
    where: { userId_campaignId: { userId: dave.id, campaignId: campaign2.id } },
    update: {},
    create: {
      userId: dave.id,
      campaignId: campaign2.id,
      pledgeAmount: "50000",
      message: "Interested in supporting validator infrastructure.",
      status: "ACCEPTED",
    },
  });

  console.log("Created interests");

  // Create invite
  await prisma.campaignInvite.upsert({
    where: { id: "invite-1" },
    update: {},
    create: {
      id: "invite-1",
      campaignId: campaign1.id,
      senderId: alice.id,
      recipientId: dave.id,
      message: "Hi Dave! We'd love to have you as a backer for CoolApp.",
      suggestedAmount: "100000",
      status: "PENDING",
    },
  });

  console.log("Created invites");
  console.log("Seed completed successfully!");
  console.log("\nTest accounts (password: password123):");
  console.log("  - alice@example.com (owns CoolApp)");
  console.log("  - bob@example.com (owns NodeRunner)");
  console.log("  - charlie@example.com (backer)");
  console.log("  - dave@example.com (backer with pending interest)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
