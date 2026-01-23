import { NextRequest, NextResponse } from "next/server";
import { getCollaborationSuggestions } from "@/services/collaboration.service";

// GET /api/entities/[id]/collaborations - Get collaboration suggestions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    // Validate limit
    const validLimit = Math.min(Math.max(1, limit), 10);

    const result = await getCollaborationSuggestions(id, validLimit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching collaborations:", error);
    return NextResponse.json(
      { error: "Failed to fetch collaboration suggestions" },
      { status: 500 }
    );
  }
}
