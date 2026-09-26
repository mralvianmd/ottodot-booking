import { NextRequest, NextResponse } from "next/server";
import { getClassRoster } from "@/lib/booking-service";
import { ClassNotFoundError } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roster = await getClassRoster(id);
    return NextResponse.json(roster);
  } catch (error) {
    if (error instanceof ClassNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    console.error("GET /api/classes/:id/roster error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
