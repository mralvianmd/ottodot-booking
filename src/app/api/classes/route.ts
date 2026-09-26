import { NextResponse } from "next/server";
import { getAvailableClasses } from "@/lib/booking-service";

export async function GET() {
  try {
    const classes = await getAvailableClasses();
    return NextResponse.json(classes);
  } catch (error) {
    console.error("GET /api/classes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
