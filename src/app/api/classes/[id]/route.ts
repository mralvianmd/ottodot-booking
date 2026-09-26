import { NextRequest, NextResponse } from "next/server";
import { getClassDetail } from "@/lib/booking-service";
import { ClassNotFoundError } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const classDetail = await getClassDetail(id);
    return NextResponse.json(classDetail);
  } catch (error) {
    if (error instanceof ClassNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    console.error("GET /api/classes/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
