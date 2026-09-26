import { NextRequest, NextResponse } from "next/server";
import { createBooking } from "@/lib/booking-service";
import { createBookingSchema } from "@/lib/validators";
import { DuplicateBookingError, NoSeatsAvailableError } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, classId } = parsed.data;
    const booking = await createBooking(studentId, classId);

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateBookingError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    if (error instanceof NoSeatsAvailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 410 }
      );
    }
    console.error("POST /api/bookings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
