// Interest Service - Business logic for campaign interest registration

import { prisma } from "@/lib/db";
import { InterestStatus, InviteStatus } from "@/types";

export interface RegisterInterestInput {
  userId: string;
  campaignId: string;
  pledgeAmount: number;
  message?: string;
}

export async function registerInterest(input: RegisterInterestInput) {
  return prisma.interest.create({
    data: {
      ...input,
      status: InterestStatus.PENDING,
    },
  });
}

export async function getInterestById(id: string) {
  return prisma.interest.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, bio: true, partyId: true },
      },
      campaign: {
        include: {
          entity: true,
        },
      },
    },
  });
}

export async function getUserInterests(userId: string) {
  return prisma.interest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        include: {
          entity: {
            select: { id: true, name: true, type: true, logoUrl: true },
          },
        },
      },
    },
  });
}

export async function getCampaignInterests(
  campaignId: string,
  status?: InterestStatus
) {
  return prisma.interest.findMany({
    where: {
      campaignId,
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          bio: true,
          partyId: true,
          mockBalance: true,
        },
      },
    },
  });
}

export async function reviewInterest(
  interestId: string,
  status: typeof InterestStatus.ACCEPTED | typeof InterestStatus.DECLINED,
  reviewNote?: string
) {
  return prisma.interest.update({
    where: { id: interestId },
    data: {
      status,
      reviewedAt: new Date(),
      reviewNote,
    },
  });
}

export async function withdrawInterest(interestId: string) {
  return prisma.interest.update({
    where: { id: interestId },
    data: { status: InterestStatus.WITHDRAWN },
  });
}

// Campaign Invite functions
export interface SendInviteInput {
  campaignId: string;
  senderId: string;
  recipientId?: string;
  recipientEmail?: string;
  recipientPartyId?: string;
  message?: string;
  suggestedAmount?: number;
}

export async function sendInvite(input: SendInviteInput) {
  return prisma.campaignInvite.create({
    data: {
      ...input,
      status: InviteStatus.PENDING,
    },
  });
}

export async function getUserInvites(userId: string) {
  return prisma.campaignInvite.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        include: {
          entity: {
            select: { id: true, name: true, type: true, logoUrl: true },
          },
        },
      },
      sender: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function respondToInvite(
  inviteId: string,
  status: typeof InviteStatus.ACCEPTED | typeof InviteStatus.DECLINED
) {
  return prisma.campaignInvite.update({
    where: { id: inviteId },
    data: {
      status,
      respondedAt: new Date(),
    },
  });
}

export async function getCampaignInvites(campaignId: string) {
  return prisma.campaignInvite.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      recipient: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}
