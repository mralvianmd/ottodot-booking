import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { BookingStatus, PaymentStatus } from "@prisma/client";

// ── Scenario definitions ───────────────────────────────
// Uses real students from the seed data.

interface ScenarioStudent {
  name: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
}

interface Scenario {
  label: string;
  description: string;
  students: ScenarioStudent[];
}

const SCENARIOS: Record<string, Scenario> = {
  empty: {
    label: "Empty (0/4)",
    description: "No bookings",
    students: [],
  },
  one_confirmed: {
    label: "1/4 Confirmed",
    description: "One student confirmed",
    students: [
      { name: "Emma Thompson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
    ],
  },
  two_confirmed: {
    label: "2/4 Confirmed",
    description: "Two students confirmed",
    students: [
      { name: "Emma Thompson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Liam Thompson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
    ],
  },
  last_seat: {
    label: "3/4 Confirmed (last seat)",
    description: "Three confirmed — 1 seat left",
    students: [
      { name: "Liam Thompson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Olivia Johnson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Noah Chen", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
    ],
  },
  full: {
    label: "4/4 Full",
    description: "Class is full",
    students: [
      { name: "Emma Thompson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Liam Thompson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Olivia Johnson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Sophie Chen", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
    ],
  },
  mixed: {
    label: "Mixed (1 confirmed + pending + failed)",
    description: "One confirmed, one pending, one failed",
    students: [
      { name: "Emma Thompson", status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Noah Chen", status: BookingStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.SUCCESS },
      { name: "Sophie Chen", status: BookingStatus.PAYMENT_FAILED, paymentStatus: PaymentStatus.FAILED },
    ],
  },
};

export async function GET() {
  // Return available scenarios for the UI
  const list = Object.entries(SCENARIOS).map(([id, s]) => ({
    id,
    label: s.label,
    description: s.description,
  }));
  return NextResponse.json(list);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const scenarioId = body.scenario as string;

    const scenario = SCENARIOS[scenarioId];
    if (!scenario) {
      return NextResponse.json(
        { error: "Invalid scenario", available: Object.keys(SCENARIOS) },
        { status: 400 }
      );
    }

    // Verify class exists
    const cls = await prisma.trialClass.findUnique({
      where: { id },
      include: { bookings: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Clean: cancel all existing non-cancelled bookings
      const existingBookings = await tx.booking.findMany({
        where: {
          trialClassId: id,
          status: { not: BookingStatus.CANCELLED },
        },
        select: { id: true },
      });
      const bookingIds = existingBookings.map((b) => b.id);

      if (bookingIds.length > 0) {
        await tx.paymentAttempt.updateMany({
          where: { bookingId: { in: bookingIds } },
          data: { status: PaymentStatus.FAILED },
        });
        await tx.booking.updateMany({
          where: { id: { in: bookingIds } },
          data: { status: BookingStatus.CANCELLED },
        });
      }

      // 2. Look up students by name
      const students = await tx.student.findMany({
        where: {
          name: { in: scenario.students.map((s) => s.name) },
        },
      });
      const studentMap = new Map(students.map((s) => [s.name, s.id]));

      // 3. Create bookings for the scenario
      let confirmedCount = 0;
      for (const s of scenario.students) {
        const studentId = studentMap.get(s.name);
        if (!studentId) continue; // skip if student not found

        const booking = await tx.booking.create({
          data: {
            studentId,
            trialClassId: id,
            status: s.status,
          },
        });

        await tx.paymentAttempt.create({
          data: {
            bookingId: booking.id,
            amount: 2500,
            status: s.paymentStatus,
          },
        });

        if (s.status === BookingStatus.CONFIRMED) confirmedCount++;
      }

      // 4. Update class status
      const classStatus = confirmedCount >= cls.maxSeats ? "FULL" : "UPCOMING";
      await tx.trialClass.update({
        where: { id },
        data: { status: classStatus },
      });

      return {
        scenario: scenarioId,
        label: scenario.label,
        confirmedCount,
        totalBookings: scenario.students.length,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/classes/:id/simulate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
