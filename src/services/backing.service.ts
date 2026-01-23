// Backing Service - Business logic for CC backing operations

import { prisma } from "@/lib/db";
import { BackingStatus, InterestStatus, InviteStatus } from "@/types";
import { UNLOCK_PERIOD_DAYS } from "@/lib/constants";
import { updateEntityCurrentAmount } from "./entity.service";
import { updateCampaignCurrentAmount } from "./campaign.service";

export interface CreateBackingInput {
  userId: string;
  entityId: string;
  campaignId?: string;
  amount: number;
  interestId?: string; // If backing from accepted interest
  inviteId?: string; // If backing from accepted invite
}

export async function createBacking(input: CreateBackingInput) {
  const { interestId, inviteId, ...backingData } = input;

  // Create backing in transaction
  const backing = await prisma.$transaction(async (tx) => {
    // Create the backing
    const newBacking = await tx.backing.create({
      data: {
        ...backingData,
        status: BackingStatus.PLEDGED,
      },
    });

    // Mark interest as converted if applicable
    if (interestId) {
      await tx.interest.update({
        where: { id: interestId },
        data: { status: InterestStatus.CONVERTED },
      });
    }

    // Mark invite as converted if applicable
    if (inviteId) {
      await tx.campaignInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.CONVERTED },
      });
    }

    return newBacking;
  });

  // Update entity and campaign totals
  await updateEntityCurrentAmount(input.entityId);
  if (input.campaignId) {
    await updateCampaignCurrentAmount(input.campaignId);
  }

  return backing;
}

export async function getBackingById(id: string) {
  return prisma.backing.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, partyId: true },
      },
      entity: {
        select: { id: true, name: true, type: true },
      },
      campaign: {
        select: { id: true, title: true },
      },
    },
  });
}

export async function getUserBackings(userId: string) {
  return prisma.backing.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      entity: {
        select: { id: true, name: true, type: true, logoUrl: true },
      },
      campaign: {
        select: { id: true, title: true },
      },
    },
  });
}

export async function getEntityBackings(entityId: string) {
  return prisma.backing.findMany({
    where: { entityId },
    orderBy: { amount: "desc" },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function requestUnlock(backingId: string) {
  const unlockEffectiveAt = new Date();
  unlockEffectiveAt.setDate(unlockEffectiveAt.getDate() + UNLOCK_PERIOD_DAYS);

  return prisma.backing.update({
    where: { id: backingId },
    data: {
      status: BackingStatus.UNLOCKING,
      unlockRequestedAt: new Date(),
      unlockEffectiveAt,
    },
  });
}

export async function completWithdrawal(backingId: string) {
  const backing = await prisma.backing.update({
    where: { id: backingId },
    data: {
      status: BackingStatus.WITHDRAWN,
      unlockedAt: new Date(),
    },
  });

  // Update entity totals
  await updateEntityCurrentAmount(backing.entityId);
  if (backing.campaignId) {
    await updateCampaignCurrentAmount(backing.campaignId);
  }

  return backing;
}

export async function getUnlockingBackings() {
  const now = new Date();
  return prisma.backing.findMany({
    where: {
      status: BackingStatus.UNLOCKING,
      unlockEffectiveAt: { lte: now },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      entity: {
        select: { id: true, name: true },
      },
    },
  });
}
