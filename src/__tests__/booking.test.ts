import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDb,
  cleanTestDb,
  teardownTestDb,
  createTestParent,
  createTestClass,
  createConfirmedBooking,
  getTestPrisma,
} from "./test-helper";
import {
  createBooking,
  processPayment,
  getAvailableClasses,
  getClassDetail,
  getClassRoster,
  getBookingStatus,
  getStudentsForParent,
} from "@/lib/booking-service";
import {
  DuplicateBookingError,
  NoSeatsAvailableError,
  BookingNotFoundError,
} from "@/lib/types";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTestDb();
});

// ── Test 1: Duplicate booking prevention ───────────────

describe("Booking Service", () => {
  it("prevents duplicate booking only when CONFIRMED", async () => {
    const parent = await createTestParent("Parent A", ["Student A1"]);
    const cls = await createTestClass("Science", "The Solar System");
    const studentId = parent.students[0].id;

    // Create and confirm a booking
    const booking1 = await createBooking(studentId, cls.id);
    const confirmed = await processPayment(booking1.id, true);
    expect(confirmed.status).toBe("CONFIRMED");

    // Second booking for same student + class should fail (already confirmed)
    await expect(createBooking(studentId, cls.id)).rejects.toThrow(
      DuplicateBookingError
    );
  });

  it("allows re-booking after PENDING_PAYMENT (not yet paid)", async () => {
    const parent = await createTestParent("Parent A", ["Student A1"]);
    const cls = await createTestClass("Science", "The Solar System");
    const studentId = parent.students[0].id;

    // First booking — PENDING_PAYMENT (never paid)
    const booking1 = await createBooking(studentId, cls.id);
    expect(booking1.status).toBe("PENDING_PAYMENT");

    // Should be able to create a new booking (previous was not confirmed)
    const booking2 = await createBooking(studentId, cls.id);
    expect(booking2.status).toBe("PENDING_PAYMENT");
    expect(booking2.id).not.toBe(booking1.id);
  });

  it("allows re-booking after PAYMENT_FAILED", async () => {
    const parent = await createTestParent("Parent A", ["Student A1"]);
    const cls = await createTestClass("Science", "The Solar System");
    const studentId = parent.students[0].id;

    // First booking — payment fails
    const booking1 = await createBooking(studentId, cls.id);
    const failed = await processPayment(booking1.id, false);
    expect(failed.status).toBe("PAYMENT_FAILED");

    // Should be able to create a new booking (previous was not confirmed)
    const booking2 = await createBooking(studentId, cls.id);
    expect(booking2.status).toBe("PENDING_PAYMENT");
  });

  it("allows booking for same student in different classes", async () => {
    const parent = await createTestParent("Parent A", ["Student A1"]);
    const cls1 = await createTestClass("Science", "The Solar System");
    const cls2 = await createTestClass("Mathematics", "Fractions");
    const studentId = parent.students[0].id;

    const b1 = await createBooking(studentId, cls1.id);
    const b2 = await createBooking(studentId, cls2.id);

    expect(b1.status).toBe("PENDING_PAYMENT");
    expect(b2.status).toBe("PENDING_PAYMENT");
  });

  // ── Test 2: Overbooking prevention ─────────────────

  it("prevents overbooking beyond max_seats", async () => {
    const parent = await createTestParent("Parent A", [
      "S1", "S2", "S3", "S4", "S5",
    ]);
    const cls = await createTestClass("Science", "The Solar System", 4);

    // Create 4 confirmed bookings (fill the class)
    for (let i = 0; i < 4; i++) {
      const booking = await createBooking(parent.students[i].id, cls.id);
      await processPayment(booking.id, true);
    }

    // 5th booking should fail
    await expect(
      createBooking(parent.students[4].id, cls.id)
    ).rejects.toThrow(NoSeatsAvailableError);
  });

  // ── Test 3: Payment failure ────────────────────────

  it("payment failure does not confirm booking", async () => {
    const parent = await createTestParent("Parent A", ["Student A1"]);
    const cls = await createTestClass("Science", "The Solar System");
    const studentId = parent.students[0].id;

    const booking = await createBooking(studentId, cls.id);
    expect(booking.status).toBe("PENDING_PAYMENT");

    // Process payment with failure
    const result = await processPayment(booking.id, false);
    expect(result.status).toBe("PAYMENT_FAILED");

    // Verify booking is NOT confirmed
    const status = await getBookingStatus(booking.id);
    expect(status.status).toBe("PAYMENT_FAILED");
    expect(status.payments).toHaveLength(1);
    expect(status.payments[0].status).toBe("FAILED");
  });

  it("payment success confirms booking", async () => {
    const parent = await createTestParent("Parent A", ["Student A1"]);
    const cls = await createTestClass("Science", "The Solar System");
    const studentId = parent.students[0].id;

    const booking = await createBooking(studentId, cls.id);
    const result = await processPayment(booking.id, true);

    expect(result.status).toBe("CONFIRMED");

    const status = await getBookingStatus(booking.id);
    expect(status.status).toBe("CONFIRMED");
    expect(status.payments).toHaveLength(1);
    expect(status.payments[0].status).toBe("SUCCESS");
  });

  // ── Test 4: Last-seat race condition ───────────────

  it("last-seat race condition — only one pending booking can confirm", async () => {
    const parent = await createTestParent("Parent A", ["S1", "S2", "S3"]);
    const parent2 = await createTestParent("Parent B", ["S4"]);
    const cls = await createTestClass("Science", "The Solar System", 4);

    // Fill 3/4 seats
    await createConfirmedBooking(parent.students[0].id, cls.id);
    await createConfirmedBooking(parent.students[1].id, cls.id);
    await createConfirmedBooking(parent.students[2].id, cls.id);

    // Now only 1 seat left. Create TWO pending bookings.
    const pendingA = await createBooking(parent2.students[0].id, cls.id);
    // Need another student for second pending booking
    const parent3 = await createTestParent("Parent C", ["S5"]);
    const pendingB = await createBooking(parent3.students[0].id, cls.id);

    expect(pendingA.status).toBe("PENDING_PAYMENT");
    expect(pendingB.status).toBe("PENDING_PAYMENT");

    // Process first payment — should succeed (1 seat available)
    const resultA = await processPayment(pendingA.id, true);
    expect(resultA.status).toBe("CONFIRMED");

    // Process second payment — should fail (no seats left)
    const resultB = await processPayment(pendingB.id, true);
    expect(resultB.status).toBe("PAYMENT_FAILED");

    // Verify: exactly 4 confirmed, class is full
    const detail = await getClassDetail(cls.id);
    expect(detail.confirmedCount).toBe(4);
    expect(detail.remainingSeats).toBe(0);

    // Verify: roster has exactly 4 confirmed students (plus 1 payment_failed)
    const roster = await getClassRoster(cls.id);
    const confirmedOnRoster = roster.filter((r) => r.status === "CONFIRMED");
    expect(confirmedOnRoster).toHaveLength(4);
  });

  // ── Test 5: Cancelled booking frees a seat ─────────

  it("cancelled booking allows new booking (seat freed)", async () => {
    const parent = await createTestParent("Parent A", ["S1", "S2", "S3", "S4", "S5"]);
    const cls = await createTestClass("Science", "The Solar System", 4);

    // Fill 4/4 seats
    const bookings = [];
    for (let i = 0; i < 4; i++) {
      const b = await createBooking(parent.students[i].id, cls.id);
      await processPayment(b.id, true);
      bookings.push(b);
    }

    // 5th student should be rejected
    await expect(
      createBooking(parent.students[4].id, cls.id)
    ).rejects.toThrow(NoSeatsAvailableError);

    // Cancel one booking directly
    const prisma = getTestPrisma();
    await prisma.booking.update({
      where: { id: bookings[0].id },
      data: { status: "CANCELLED" },
    });

    // Now 5th student should succeed
    const newBooking = await createBooking(parent.students[4].id, cls.id);
    expect(newBooking.status).toBe("PENDING_PAYMENT");
  });

  // ── Test 6: Query functions ────────────────────────

  it("getAvailableClasses returns only classes with remaining seats", async () => {
    const parent = await createTestParent("Parent A", ["S1", "S2", "S3", "S4"]);
    const cls1 = await createTestClass("Science", "The Solar System", 4);
    const cls2 = await createTestClass("Mathematics", "Fractions", 4);

    // Fill cls1 to 4/4
    for (let i = 0; i < 4; i++) {
      const b = await createBooking(parent.students[i].id, cls1.id);
      await processPayment(b.id, true);
    }

    // cls2 has 0 bookings
    const available = await getAvailableClasses();
    const ids = available.map((c) => c.id);

    expect(ids).not.toContain(cls1.id); // full class excluded
    expect(ids).toContain(cls2.id); // empty class included
  });

  it("getStudentsForParent returns correct students", async () => {
    const parent = await createTestParent("Parent A", ["Alice", "Bob"]);

    const students = await getStudentsForParent(parent.id);
    expect(students).toHaveLength(2);
    expect(students.map((s) => s.name)).toContain("Alice");
    expect(students.map((s) => s.name)).toContain("Bob");
  });

  it("getClassRoster returns all non-cancelled bookings", async () => {
    const parent = await createTestParent("Parent A", ["S1", "S2", "S3"]);
    const cls = await createTestClass("Science", "The Solar System");

    // One confirmed
    const b1 = await createBooking(parent.students[0].id, cls.id);
    await processPayment(b1.id, true);

    // One pending
    await createBooking(parent.students[1].id, cls.id);

    // One payment failed
    const b3 = await createBooking(parent.students[2].id, cls.id);
    await processPayment(b3.id, false);

    const roster = await getClassRoster(cls.id);
    expect(roster).toHaveLength(3);
    const names = roster.map((r) => r.studentName);
    expect(names).toContain("S1");
    expect(names).toContain("S2");
    expect(names).toContain("S3");
    // Verify statuses are preserved
    const statuses = roster.map((r) => r.status);
    expect(statuses).toContain("CONFIRMED");
    expect(statuses).toContain("PENDING_PAYMENT");
    expect(statuses).toContain("PAYMENT_FAILED");
  });

  it("getBookingStatus returns booking with payment history", async () => {
    const parent = await createTestParent("Parent A", ["S1"]);
    const cls = await createTestClass("Science", "The Solar System");

    const booking = await createBooking(parent.students[0].id, cls.id);
    await processPayment(booking.id, true);

    const status = await getBookingStatus(booking.id);
    expect(status.status).toBe("CONFIRMED");
    expect(status.payments).toHaveLength(1);
    expect(status.payments[0].amount).toBe(2500);
    expect(status.payments[0].status).toBe("SUCCESS");
  });

  it("getBookingStatus throws for non-existent booking", async () => {
    await expect(getBookingStatus("nonexistent")).rejects.toThrow(
      BookingNotFoundError
    );
  });
});
