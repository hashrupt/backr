import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InterestStatus } from "@/types";

const reviewSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
  reviewNote: z.string().max(500).optional(),
});

// PATCH /api/interests/[id]/review - Review an interest
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
    const validated = reviewSchema.parse(body);

    // Get the interest and verify ownership
    const interest = await prisma.interest.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            entity: {
              select: { ownerId: true },
            },
          },
        },
      },
    });

    if (!interest) {
      return NextResponse.json(
        { error: "Interest not found" },
        { status: 404 }
      );
    }

    // Verify the user owns the entity
    if (interest.campaign.entity.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this entity" },
        { status: 403 }
      );
    }

    // Only pending interests can be reviewed
    if (interest.status !== InterestStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending interests can be reviewed" },
        { status: 400 }
      );
    }

    // Update the interest
    const updatedInterest = await prisma.interest.update({
      where: { id },
      data: {
        status: validated.status as InterestStatus,
        reviewedAt: new Date(),
        reviewNote: validated.reviewNote,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ interest: updatedInterest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error reviewing interest:", error);
    return NextResponse.json(
      { error: "Failed to review interest" },
      { status: 500 }
    );
  }
}
