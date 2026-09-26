import { NextRequest, NextResponse } from "next/server";
import { getBookingStatus } from "@/lib/booking-service";
import { BookingNotFoundError } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await getBookingStatus(id);
    return NextResponse.json(booking);
  } catch (error) {
    if (error instanceof BookingNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    console.error("GET /api/bookings/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
