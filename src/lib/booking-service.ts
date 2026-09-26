import { prisma } from "@/db/client";
import { BookingStatus, PaymentStatus, TrialClassStatus } from "@prisma/client";
import {
  ClassSummary,
  ClassDetail,
  RosterEntry,
  BookingResult,
  BookingStatusResult,
  DuplicateBookingError,
  NoSeatsAvailableError,
  BookingNotFoundError,
  ClassNotFoundError,
} from "./types";

// ── Query functions ────────────────────────────────────

/**
 * Returns trial classes where confirmed count < max_seats.
 */
export async function getAvailableClasses(): Promise<ClassSummary[]> {
  const classes = await prisma.trialClass.findMany({
    where: { status: { not: TrialClassStatus.CANCELLED } },
    include: {
      bookings: {
        where: { status: BookingStatus.CONFIRMED },
        select: { id: true },
      },
    },
  });

  return classes
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
    .filter((c) => c.remainingSeats > 0)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/**
 * Returns class info with confirmed count, remaining seats, and roster.
 */
export async function getClassDetail(classId: string): Promise<ClassDetail> {
  const cls = await prisma.trialClass.findUnique({
    where: { id: classId },
    include: {
      bookings: {
        where: { status: BookingStatus.CONFIRMED },
        include: {
          student: { include: { parent: true } },
        },
      },
    },
  });

  if (!cls) throw new ClassNotFoundError(classId);

  const confirmedCount = cls.bookings.length;
  const roster: RosterEntry[] = cls.bookings.map((b) => ({
    bookingId: b.id,
    studentName: b.student.name,
    parentName: b.student.parent.name,
    bookedAt: b.createdAt,
    status: b.status,
  }));

  return {
    id: cls.id,
    subject: cls.subject,
    topic: cls.topic,
    teacher: cls.teacher,
    scheduledAt: cls.scheduledAt,
    maxSeats: cls.maxSeats,
    confirmedCount,
    remainingSeats: cls.maxSeats - confirmedCount,
    status: cls.status,
    roster,
  };
}

/**
 * Returns students for a given parent.
 */
export async function getStudentsForParent(parentId: string) {
  const parent = await prisma.parent.findUnique({
    where: { id: parentId },
    include: { students: true },
  });

  if (!parent) throw new Error(`Parent ${parentId} not found`);
  return parent.students;
}

// ── Write functions (with transaction safety) ──────────

/**
 * Creates a booking with status PENDING_PAYMENT.
 *
 * Invariants enforced:
 * - No duplicate CONFIRMED booking (same student + same class)
 * - PENDING_PAYMENT / PAYMENT_FAILED bookings can be re-booked
 * - Class must have available seats (confirmed < maxSeats)
 *
 * Uses Prisma interactive transaction for serialization (SQLite).
 */
export async function createBooking(
  studentId: string,
  classId: string
): Promise<BookingResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Verify class exists
    const trialClass = await tx.trialClass.findUnique({
      where: { id: classId },
    });
    if (!trialClass) throw new ClassNotFoundError(classId);

    // 2. Check for duplicate CONFIRMED booking
    // PENDING_PAYMENT and PAYMENT_FAILED bookings can be re-booked
    const existingConfirmed = await tx.booking.findFirst({
      where: {
        studentId,
        trialClassId: classId,
        status: BookingStatus.CONFIRMED,
      },
    });
    if (existingConfirmed) {
      throw new DuplicateBookingError(studentId, classId);
    }

    // 3. Check seat availability (count confirmed bookings)
    const confirmedCount = await tx.booking.count({
      where: {
        trialClassId: classId,
        status: BookingStatus.CONFIRMED,
      },
    });
    if (confirmedCount >= trialClass.maxSeats) {
      throw new NoSeatsAvailableError(classId);
    }

    // 4. Create the booking
    const booking = await tx.booking.create({
      data: {
        studentId,
        trialClassId: classId,
        status: BookingStatus.PENDING_PAYMENT,
      },
    });

    return {
      id: booking.id,
      studentId: booking.studentId,
      trialClassId: booking.trialClassId,
      status: booking.status,
      createdAt: booking.createdAt,
    };
  });
}

/**
 * Simulates payment processing.
 *
 * If paymentSuccess=true:
 *   - Re-check seat availability inside transaction (last-seat race!)
 *   - If seats available: update to CONFIRMED, record SUCCESS payment
 *   - If NO seats: update to PAYMENT_FAILED, record FAILED payment
 *
 * If paymentSuccess=false:
 *   - Update to PAYMENT_FAILED, record FAILED payment
 *
 * Uses Prisma interactive transaction for serialization (SQLite).
 */
export async function processPayment(
  bookingId: string,
  paymentSuccess: boolean
): Promise<BookingResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Find the booking
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { trialClass: true },
    });
    if (!booking) throw new BookingNotFoundError(bookingId);

    const TRIAL_PRICE = 2500;

    if (!paymentSuccess) {
      // Payment failed — straightforward
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.PAYMENT_FAILED },
      });
      await tx.paymentAttempt.create({
        data: {
          bookingId,
          amount: TRIAL_PRICE,
          status: PaymentStatus.FAILED,
        },
      });
      return {
        id: booking.id,
        studentId: booking.studentId,
        trialClassId: booking.trialClassId,
        status: BookingStatus.PAYMENT_FAILED,
        createdAt: booking.createdAt,
      };
    }

    // Payment success — must re-check availability (last-seat race condition)
    const confirmedCount = await tx.booking.count({
      where: {
        trialClassId: booking.trialClassId,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (confirmedCount >= booking.trialClass.maxSeats) {
      // No seats left! Another booking took the last seat.
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.PAYMENT_FAILED },
      });
      await tx.paymentAttempt.create({
        data: {
          bookingId,
          amount: TRIAL_PRICE,
          status: PaymentStatus.FAILED,
        },
      });
      return {
        id: booking.id,
        studentId: booking.studentId,
        trialClassId: booking.trialClassId,
        status: BookingStatus.PAYMENT_FAILED,
        createdAt: booking.createdAt,
      };
    }

    // Seats available — confirm the booking
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });
    await tx.paymentAttempt.create({
      data: {
        bookingId,
        amount: TRIAL_PRICE,
        status: PaymentStatus.SUCCESS,
      },
    });

    // Check if class is now full and update status
    const newConfirmedCount = confirmedCount + 1;
    if (newConfirmedCount >= booking.trialClass.maxSeats) {
      await tx.trialClass.update({
        where: { id: booking.trialClassId },
        data: { status: TrialClassStatus.FULL },
      });
    }

    return {
      id: booking.id,
      studentId: booking.studentId,
      trialClassId: booking.trialClassId,
      status: BookingStatus.CONFIRMED,
      createdAt: booking.createdAt,
    };
  });
}

/**
 * Returns booking status with payment history.
 */
export async function getBookingStatus(
  bookingId: string
): Promise<BookingStatusResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      paymentAttempts: {
        orderBy: { attemptedAt: "desc" },
      },
    },
  });

  if (!booking) throw new BookingNotFoundError(bookingId);

  return {
    id: booking.id,
    studentId: booking.studentId,
    trialClassId: booking.trialClassId,
    status: booking.status,
    createdAt: booking.createdAt,
    payments: booking.paymentAttempts.map((p) => ({
      id: p.id,
      amount: p.amount.toNumber(),
      status: p.status,
      attemptedAt: p.attemptedAt,
    })),
  };
}

/**
 * Returns all non-cancelled bookings for a class (admin/teacher roster view).
 */
export async function getClassRoster(classId: string): Promise<RosterEntry[]> {
  const cls = await prisma.trialClass.findUnique({
    where: { id: classId },
  });
  if (!cls) throw new ClassNotFoundError(classId);

  const bookings = await prisma.booking.findMany({
    where: {
      trialClassId: classId,
      status: { not: BookingStatus.CANCELLED },
    },
    include: {
      student: { include: { parent: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return bookings.map((b) => ({
    bookingId: b.id,
    studentName: b.student.name,
    parentName: b.student.parent.name,
    bookedAt: b.createdAt,
    status: b.status,
  }));
}
