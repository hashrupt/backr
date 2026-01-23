import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/entities/search - Search entities
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("q") || "";
    const type = searchParams.get("type");
    const claimStatus = searchParams.get("claimStatus");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { partyId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (claimStatus) {
      where.claimStatus = claimStatus;
    }

    const entities = await prisma.entity.findMany({
      where,
      orderBy: { name: "asc" },
      take: 20,
      select: {
        id: true,
        name: true,
        type: true,
        partyId: true,
        logoUrl: true,
        claimStatus: true,
        owner: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ entities });
  } catch (error) {
    console.error("Error searching entities:", error);
    return NextResponse.json(
      { error: "Failed to search entities" },
      { status: 500 }
    );
  }
}
