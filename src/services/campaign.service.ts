// Campaign Service - Business logic for backing campaigns

import { prisma } from "@/lib/db";
import { CampaignStatus } from "@/types";

export interface CreateCampaignInput {
  entityId: string;
  title: string;
  description?: string;
  targetAmount: number;
  minContribution?: number;
  maxContribution?: number;
  terms?: string;
  endsAt?: Date;
}

export async function createCampaign(input: CreateCampaignInput) {
  return prisma.campaign.create({
    data: {
      ...input,
      status: CampaignStatus.DRAFT,
    },
  });
}

export async function getCampaignById(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      entity: {
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: {
          interests: true,
          invites: true,
          backings: true,
        },
      },
    },
  });
}

export async function listOpenCampaigns(params: {
  entityType?: "FEATURED_APP" | "VALIDATOR";
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { entityType, search, page = 1, limit = 20 } = params;

  const where = {
    status: CampaignStatus.OPEN,
    ...(entityType && { entity: { type: entityType } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { entity: { name: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        entity: {
          select: { id: true, name: true, type: true, logoUrl: true },
        },
        _count: {
          select: { backings: true },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function publishCampaign(campaignId: string) {
  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.OPEN,
      startsAt: new Date(),
    },
  });
}

export async function closeCampaign(campaignId: string) {
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.CLOSED },
  });
}

export async function getCampaignsByEntity(entityId: string) {
  return prisma.campaign.findMany({
    where: { entityId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          interests: true,
          invites: true,
          backings: true,
        },
      },
    },
  });
}

export async function updateCampaignCurrentAmount(campaignId: string) {
  const backings = await prisma.backing.aggregate({
    where: {
      campaignId,
      status: { in: ["PLEDGED", "LOCKED"] },
    },
    _sum: { amount: true },
  });

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      currentAmount: backings._sum.amount || 0,
    },
  });
}
