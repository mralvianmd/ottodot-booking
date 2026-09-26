import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { BookingStatus } from "@prisma/client";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify class exists
    const cls = await prisma.trialClass.findUnique({ where: { id } });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Cancel all non-cancelled bookings for this class
    const result = await prisma.$transaction(async (tx) => {
      // First cancel all payment attempts for bookings we're about to cancel
      const bookings = await tx.booking.findMany({
        where: {
          trialClassId: id,
          status: { not: BookingStatus.CANCELLED },
        },
        select: { id: true },
      });

      const bookingIds = bookings.map((b) => b.id);

      if (bookingIds.length > 0) {
        await tx.paymentAttempt.updateMany({
          where: { bookingId: { in: bookingIds } },
          data: { status: "FAILED" },
        });

        await tx.booking.updateMany({
          where: { id: { in: bookingIds } },
          data: { status: BookingStatus.CANCELLED },
        });
      }

      // Reset class status to UPCOMING
      await tx.trialClass.update({
        where: { id },
        data: { status: "UPCOMING" },
      });

      return { cancelled: bookingIds.length };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/classes/:id/reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
