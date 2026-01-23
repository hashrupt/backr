import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignStatus } from "@/types";

// GET /api/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as CampaignStatus | null;
    const entityType = searchParams.get("entityType");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "newest";

    const where: Record<string, unknown> = {};

    // Default to OPEN campaigns for public listing
    if (status) {
      where.status = status;
    } else {
      where.status = CampaignStatus.OPEN;
    }

    // Filter by entity type
    if (entityType) {
      where.entity = { type: entityType };
    }

    // Search by title or entity name
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { entity: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Determine sort order
    let orderBy: Record<string, string> = {};
    switch (sort) {
      case "ending":
        orderBy = { endsAt: "asc" };
        break;
      case "funded":
        orderBy = { currentAmount: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy,
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            logoUrl: true,
            partyId: true,
            owner: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { backings: true },
        },
      },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create a new campaign
const createCampaignSchema = z.object({
  entityId: z.string(),
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  targetAmount: z.number().positive(),
  minContribution: z.number().positive().optional(),
  maxContribution: z.number().positive().optional(),
  terms: z.string().optional(),
  endsAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createCampaignSchema.parse(body);

    // Verify user owns the entity
    const entity = await prisma.entity.findUnique({
      where: { id: validated.entityId },
      select: { ownerId: true },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    if (entity.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this entity" },
        { status: 403 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        entityId: validated.entityId,
        title: validated.title,
        description: validated.description,
        targetAmount: validated.targetAmount,
        minContribution: validated.minContribution,
        maxContribution: validated.maxContribution,
        terms: validated.terms,
        endsAt: validated.endsAt ? new Date(validated.endsAt) : undefined,
        status: CampaignStatus.DRAFT,
      },
      include: {
        entity: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
