import { NextRequest, NextResponse } from "next/server";
import { getStudentsForParent } from "@/lib/booking-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const students = await getStudentsForParent(id);
    return NextResponse.json(students);
  } catch (error) {
    console.error("GET /api/parents/:id/students error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
