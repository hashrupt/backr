import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ClaimStatus } from "@/types";
import { cantonService } from "@/services/canton";

// POST /api/entities/[id]/claim - Claim an entity
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

    // Get the entity
    const entity = await prisma.entity.findUnique({
      where: { id },
      select: {
        id: true,
        partyId: true,
        claimStatus: true,
        ownerId: true,
      },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    if (entity.claimStatus === ClaimStatus.CLAIMED) {
      return NextResponse.json(
        { error: "Entity is already claimed" },
        { status: 400 }
      );
    }

    // Get user's partyId
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { partyId: true },
    });

    // Verify ownership (mock in Web2 MVP)
    // In production, signature would be provided by the user's wallet
    const isOwner = await cantonService.verifyOwnership(
      user?.partyId || "",
      entity.partyId,
      "" // Mock signature - not used in Web2 MVP
    );

    if (!isOwner) {
      return NextResponse.json(
        {
          error:
            "Ownership verification failed. Your PartyId does not match the entity.",
        },
        { status: 403 }
      );
    }

    // Claim the entity
    const updatedEntity = await prisma.entity.update({
      where: { id },
      data: {
        claimStatus: ClaimStatus.CLAIMED,
        ownerId: session.user.id,
        claimedAt: new Date(),
      },
      include: {
        owner: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ entity: updatedEntity });
  } catch (error) {
    console.error("Error claiming entity:", error);
    return NextResponse.json(
      { error: "Failed to claim entity" },
      { status: 500 }
    );
  }
}
