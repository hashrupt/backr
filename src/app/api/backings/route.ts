import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InterestStatus, BackingStatus } from "@/types";
import { cantonService } from "@/services/canton";

const createBackingSchema = z.object({
  interestId: z.string(),
  campaignId: z.string(),
  entityId: z.string(),
  amount: z.number().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createBackingSchema.parse(body);

    // Verify the interest exists and is accepted
    const interest = await prisma.interest.findFirst({
      where: {
        id: validated.interestId,
        userId: session.user.id,
        campaignId: validated.campaignId,
        status: InterestStatus.ACCEPTED,
      },
    });

    if (!interest) {
      return NextResponse.json(
        { error: "Interest not found or not accepted" },
        { status: 404 }
      );
    }

    // Get user's partyId for Canton operations
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { partyId: true, mockBalance: true },
    });

    // Check mock balance (Web2 MVP)
    if (user && Number(user.mockBalance) < validated.amount) {
      return NextResponse.json(
        { error: "Insufficient CC balance" },
        { status: 400 }
      );
    }

    // Mock Canton lock operation
    const lockResult = await cantonService.lockCC(
      user?.partyId || "mock-party-id",
      validated.entityId,
      BigInt(validated.amount)
    );

    if (!lockResult.success) {
      return NextResponse.json(
        { error: "Failed to lock CC" },
        { status: 500 }
      );
    }

    // Create backing and update interest in a transaction
    const backing = await prisma.$transaction(async (tx) => {
      // Create the backing
      const newBacking = await tx.backing.create({
        data: {
          userId: session.user.id,
          entityId: validated.entityId,
          campaignId: validated.campaignId,
          amount: validated.amount,
          status: BackingStatus.LOCKED,
          lockedAt: new Date(),
          txHash: lockResult.txHash,
          lockedPartyId: lockResult.lockedPartyId,
        },
      });

      // Update interest status to CONVERTED
      await tx.interest.update({
        where: { id: validated.interestId },
        data: { status: InterestStatus.CONVERTED },
      });

      // Update campaign current amount
      await tx.campaign.update({
        where: { id: validated.campaignId },
        data: {
          currentAmount: {
            increment: validated.amount,
          },
        },
      });

      // Update entity current amount
      await tx.entity.update({
        where: { id: validated.entityId },
        data: {
          currentAmount: {
            increment: validated.amount,
          },
        },
      });

      // Deduct from user's mock balance
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          mockBalance: {
            decrement: validated.amount,
          },
        },
      });

      return newBacking;
    });

    return NextResponse.json({ backing }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating backing:", error);
    return NextResponse.json(
      { error: "Failed to create backing" },
      { status: 500 }
    );
  }
}
