import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { BookingStatus, TrialClassStatus } from "@prisma/client";

export async function GET() {
  try {
    const classes = await prisma.trialClass.findMany({
      where: { status: { not: TrialClassStatus.CANCELLED } },
      include: {
        bookings: {
          where: { status: BookingStatus.CONFIRMED },
          select: { id: true },
        },
      },
    });

    const result = classes
      .map((c) => {
        const confirmedCount = c.bookings.length;
        return {
          id: c.id,
          subject: c.subject,
          topic: c.topic,
          teacher: c.teacher,
          scheduledAt: c.scheduledAt,
          maxSeats: c.maxSeats,
          confirmedCount,
          remainingSeats: c.maxSeats - confirmedCount,
          status: c.status,
        };
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/classes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
