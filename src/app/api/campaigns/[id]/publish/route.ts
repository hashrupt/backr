import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignStatus } from "@/types";

// POST /api/campaigns/[id]/publish - Publish a draft campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the campaign and verify ownership
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
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

    if (campaign.entity.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this entity" },
        { status: 403 }
      );
    }

    if (campaign.status !== CampaignStatus.DRAFT) {
      return NextResponse.json(
        { error: "Only draft campaigns can be published" },
        { status: 400 }
      );
    }

    // Publish the campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.OPEN,
        startsAt: new Date(),
      },
    });

    return NextResponse.json({ campaign: updatedCampaign });
  } catch (error) {
    console.error("Error publishing campaign:", error);
    return NextResponse.json(
      { error: "Failed to publish campaign" },
      { status: 500 }
    );
  }
}
