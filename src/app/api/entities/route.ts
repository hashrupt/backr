import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/entities - List all entities
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    const [entities, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          partyId: true,
          description: true,
          logoUrl: true,
          website: true,
          targetAmount: true,
          currentAmount: true,
          claimStatus: true,
          activeStatus: true,
          foundationStatus: true,
          createdAt: true,
          owner: {
            select: { id: true, name: true },
          },
          _count: {
            select: { campaigns: true, backings: true },
          },
        },
      }),
      prisma.entity.count({ where }),
    ]);

    return NextResponse.json({
      entities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching entities:", error);
    return NextResponse.json(
      { error: "Failed to fetch entities" },
      { status: 500 }
    );
  }
}
