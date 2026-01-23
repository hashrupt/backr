import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InterestStatus, CampaignStatus } from "@/types";

// GET /api/interests - Get user's interests
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const interests = await prisma.interest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: {
          include: {
            entity: {
              select: {
                id: true,
                name: true,
                type: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ interests });
  } catch (error) {
    console.error("Error fetching interests:", error);
    return NextResponse.json(
      { error: "Failed to fetch interests" },
      { status: 500 }
    );
  }
}

// POST /api/interests - Register interest in a campaign
const registerInterestSchema = z.object({
  campaignId: z.string(),
  pledgeAmount: z.number().positive(),
  message: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = registerInterestSchema.parse(body);

    // Get campaign details
    const campaign = await prisma.campaign.findUnique({
      where: { id: validated.campaignId },
      select: {
        id: true,
        status: true,
        minContribution: true,
        maxContribution: true,
        entity: {
          select: { ownerId: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check campaign is open
    if (campaign.status !== CampaignStatus.OPEN) {
      return NextResponse.json(
        { error: "Campaign is not accepting interests" },
        { status: 400 }
      );
    }

    // Check user is not the owner
    if (campaign.entity.ownerId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot register interest in your own campaign" },
        { status: 400 }
      );
    }

    // Validate contribution limits
    if (
      campaign.minContribution &&
      validated.pledgeAmount < Number(campaign.minContribution)
    ) {
      return NextResponse.json(
        { error: `Minimum contribution is ${campaign.minContribution} CC` },
        { status: 400 }
      );
    }

    if (
      campaign.maxContribution &&
      validated.pledgeAmount > Number(campaign.maxContribution)
    ) {
      return NextResponse.json(
        { error: `Maximum contribution is ${campaign.maxContribution} CC` },
        { status: 400 }
      );
    }

    // Check for existing interest
    const existingInterest = await prisma.interest.findUnique({
      where: {
        userId_campaignId: {
          userId: session.user.id,
          campaignId: validated.campaignId,
        },
      },
    });

    if (existingInterest) {
      return NextResponse.json(
        { error: "You have already registered interest in this campaign" },
        { status: 400 }
      );
    }

    // Create interest
    const interest = await prisma.interest.create({
      data: {
        userId: session.user.id,
        campaignId: validated.campaignId,
        pledgeAmount: validated.pledgeAmount,
        message: validated.message,
        status: InterestStatus.PENDING,
      },
      include: {
        campaign: {
          include: {
            entity: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ interest }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error registering interest:", error);
    return NextResponse.json(
      { error: "Failed to register interest" },
      { status: 500 }
    );
  }
}
