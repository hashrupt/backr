import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InviteStatus } from "@/types";

// GET /api/invites - Get user's received invites
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invites = await prisma.campaignInvite.findMany({
      where: { recipientId: session.user.id },
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
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

// POST /api/invites - Send an invite
const sendInviteSchema = z.object({
  campaignId: z.string(),
  recipientEmail: z.string().email().optional(),
  recipientPartyId: z.string().optional(),
  message: z.string().max(500).optional(),
  suggestedAmount: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = sendInviteSchema.parse(body);

    // Verify the campaign exists and user owns the entity
    const campaign = await prisma.campaign.findUnique({
      where: { id: validated.campaignId },
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
        { error: "You do not own this campaign's entity" },
        { status: 403 }
      );
    }

    // Find recipient user if email or partyId provided
    let recipientId: string | undefined;

    if (validated.recipientEmail) {
      const recipient = await prisma.user.findUnique({
        where: { email: validated.recipientEmail },
        select: { id: true },
      });
      recipientId = recipient?.id;
    } else if (validated.recipientPartyId) {
      const recipient = await prisma.user.findUnique({
        where: { partyId: validated.recipientPartyId },
        select: { id: true },
      });
      recipientId = recipient?.id;
    }

    // Create the invite
    const invite = await prisma.campaignInvite.create({
      data: {
        campaignId: validated.campaignId,
        senderId: session.user.id,
        recipientId,
        recipientEmail: validated.recipientEmail,
        recipientPartyId: validated.recipientPartyId,
        message: validated.message,
        suggestedAmount: validated.suggestedAmount,
        status: InviteStatus.PENDING,
      },
      include: {
        recipient: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error sending invite:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}
