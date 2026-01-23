// Entity Service - Business logic for Featured Apps and Validators

import { prisma } from "@/lib/db";
import { EntityType, ClaimStatus } from "@/types";
import { MIN_CC_DISPLAY, GRACE_PERIOD_DAYS } from "@/lib/constants";

export interface CreateEntityInput {
  type: EntityType;
  name: string;
  description?: string;
  partyId: string;
  website?: string;
  logoUrl?: string;
  ownerId?: string;
}

export async function createEntity(input: CreateEntityInput) {
  const targetAmount =
    input.type === "FEATURED_APP"
      ? MIN_CC_DISPLAY.FEATURED_APP
      : MIN_CC_DISPLAY.VALIDATOR;

  const gracePeriodDays =
    input.type === "FEATURED_APP"
      ? GRACE_PERIOD_DAYS.FEATURED_APP
      : GRACE_PERIOD_DAYS.VALIDATOR;

  return prisma.entity.create({
    data: {
      ...input,
      targetAmount,
      gracePeriodDays,
      claimStatus: input.ownerId ? ClaimStatus.SELF_REGISTERED : ClaimStatus.UNCLAIMED,
      claimedAt: input.ownerId ? new Date() : null,
    },
  });
}

export async function getEntityById(id: string) {
  return prisma.entity.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      campaigns: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { backings: true },
      },
    },
  });
}

export async function getEntityByPartyId(partyId: string) {
  return prisma.entity.findUnique({
    where: { partyId },
  });
}

export async function listEntities(params: {
  type?: EntityType;
  claimStatus?: ClaimStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { type, claimStatus, search, page = 1, limit = 20 } = params;

  const where = {
    ...(type && { type }),
    ...(claimStatus && { claimStatus }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { partyId: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: { id: true, name: true },
        },
        _count: {
          select: { backings: true, campaigns: true },
        },
      },
    }),
    prisma.entity.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function claimEntity(entityId: string, userId: string) {
  return prisma.entity.update({
    where: { id: entityId },
    data: {
      claimStatus: ClaimStatus.CLAIMED,
      ownerId: userId,
      claimedAt: new Date(),
    },
  });
}

export async function updateEntityCurrentAmount(entityId: string) {
  const backings = await prisma.backing.aggregate({
    where: {
      entityId,
      status: { in: ["PLEDGED", "LOCKED"] },
    },
    _sum: { amount: true },
  });

  return prisma.entity.update({
    where: { id: entityId },
    data: {
      currentAmount: backings._sum.amount || 0,
    },
  });
}

export interface UpdateEntityInput {
  name?: string;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
}

export async function updateEntity(entityId: string, data: UpdateEntityInput) {
  return prisma.entity.update({
    where: { id: entityId },
    data,
    include: {
      owner: {
        select: { id: true, name: true },
      },
    },
  });
}
