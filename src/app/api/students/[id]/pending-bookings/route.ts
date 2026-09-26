import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { BookingStatus } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bookings = await prisma.booking.findMany({
      where: {
        studentId: id,
        status: BookingStatus.PENDING_PAYMENT,
      },
      include: {
        trialClass: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Deduplicate by class — keep only the latest pending booking per class
    const seen = new Set<string>();
    const unique = [];
    for (const b of bookings) {
      if (seen.has(b.trialClassId)) continue;
      seen.add(b.trialClassId);
      unique.push({
        id: b.id,
        studentId: b.studentId,
        trialClassId: b.trialClassId,
        status: b.status,
        createdAt: b.createdAt,
        trialClass: {
          id: b.trialClass.id,
          subject: b.trialClass.subject,
          topic: b.trialClass.topic,
          teacher: b.trialClass.teacher,
          scheduledAt: b.trialClass.scheduledAt,
          maxSeats: b.trialClass.maxSeats,
        },
      });
    }

    return NextResponse.json(unique);
  } catch (error) {
    console.error("GET /api/students/:id/pending-bookings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
