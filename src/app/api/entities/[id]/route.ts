import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ClaimStatus } from "@/types";

// Zod schema for entity update
const updateEntitySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  website: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

// GET /api/entities/[id] - Get entity by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        campaigns: {
          where: { status: "OPEN" },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: { campaigns: true, backings: true },
        },
      },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    return NextResponse.json({ entity });
  } catch (error) {
    console.error("Error fetching entity:", error);
    return NextResponse.json(
      { error: "Failed to fetch entity" },
      { status: 500 }
    );
  }
}

// PATCH /api/entities/[id] - Update entity (owner only)
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

    // Get the entity and verify ownership
    const entity = await prisma.entity.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        claimStatus: true,
      },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Only claimed entities can be edited
    if (entity.claimStatus !== ClaimStatus.CLAIMED && entity.claimStatus !== ClaimStatus.SELF_REGISTERED) {
      return NextResponse.json(
        { error: "Entity must be claimed before editing" },
        { status: 400 }
      );
    }

    // Verify the user owns this entity
    if (entity.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this entity" },
        { status: 403 }
      );
    }

    // Parse and validate the request body
    const body = await request.json();
    const validated = updateEntitySchema.parse(body);

    // Build update data (only include fields that were provided)
    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.website !== undefined) updateData.website = validated.website;
    if (validated.logoUrl !== undefined) updateData.logoUrl = validated.logoUrl;

    // Update the entity
    const updatedEntity = await prisma.entity.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ entity: updatedEntity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating entity:", error);
    return NextResponse.json(
      { error: "Failed to update entity" },
      { status: 500 }
    );
  }
}
