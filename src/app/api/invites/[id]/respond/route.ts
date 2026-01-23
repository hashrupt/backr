import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InviteStatus } from "@/types";

const respondSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

// PATCH /api/invites/[id]/respond - Respond to an invite
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = respondSchema.parse(body);

    // Get the invite
    const invite = await prisma.campaignInvite.findUnique({
      where: { id },
      select: {
        id: true,
        recipientId: true,
        recipientEmail: true,
        status: true,
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Verify the user is the recipient
    if (invite.recipientId !== session.user.id) {
      return NextResponse.json(
        { error: "This invite is not for you" },
        { status: 403 }
      );
    }

    // Only pending invites can be responded to
    if (invite.status !== InviteStatus.PENDING) {
      return NextResponse.json(
        { error: "This invite has already been responded to" },
        { status: 400 }
      );
    }

    // Update the invite
    const updatedInvite = await prisma.campaignInvite.update({
      where: { id },
      data: {
        status: validated.status as InviteStatus,
        respondedAt: new Date(),
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

    return NextResponse.json({ invite: updatedInvite });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error responding to invite:", error);
    return NextResponse.json(
      { error: "Failed to respond to invite" },
      { status: 500 }
    );
  }
}
