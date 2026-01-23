import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/campaigns/[id] - Get campaign details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            logoUrl: true,
            partyId: true,
            website: true,
            targetAmount: true,
            currentAmount: true,
            owner: {
              select: { id: true, name: true },
            },
          },
        },
        backings: {
          where: { status: { in: ["PLEDGED", "LOCKED"] } },
          select: {
            id: true,
            amount: true,
            status: true,
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { amount: "desc" },
          take: 20,
        },
        _count: {
          select: {
            backings: true,
            interests: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
