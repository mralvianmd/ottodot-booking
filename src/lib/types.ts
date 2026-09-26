import { BookingStatus, PaymentStatus, TrialClassStatus } from "@prisma/client";

// ── Re-export Prisma enums for convenience ─────────────

export { BookingStatus, PaymentStatus, TrialClassStatus };

// ── Domain types ───────────────────────────────────────

export interface ClassSummary {
  id: string;
  subject: string;
  topic: string;
  teacher: string;
  scheduledAt: Date;
  maxSeats: number;
  confirmedCount: number;
  remainingSeats: number;
  status: TrialClassStatus;
}

export interface ClassDetail extends ClassSummary {
  roster: RosterEntry[];
}

export interface RosterEntry {
  bookingId: string;
  studentName: string;
  parentName: string;
  bookedAt: Date;
  status: BookingStatus;
}

export interface BookingResult {
  id: string;
  studentId: string;
  trialClassId: string;
  status: BookingStatus;
  createdAt: Date;
}

export interface BookingStatusResult {
  id: string;
  studentId: string;
  trialClassId: string;
  status: BookingStatus;
  createdAt: Date;
  payments: {
    id: string;
    amount: number;
    status: PaymentStatus;
    attemptedAt: Date;
  }[];
}

// ── Error types ────────────────────────────────────────

export class DuplicateBookingError extends Error {
  constructor(studentId: string, classId: string) {
    super(`Student ${studentId} already has a booking for class ${classId}`);
    this.name = "DuplicateBookingError";
  }
}

export class NoSeatsAvailableError extends Error {
  constructor(classId: string) {
    super(`No available seats for class ${classId}`);
    this.name = "NoSeatsAvailableError";
  }
}

export class BookingNotFoundError extends Error {
  constructor(bookingId: string) {
    super(`Booking ${bookingId} not found`);
    this.name = "BookingNotFoundError";
  }
}

export class ClassNotFoundError extends Error {
  constructor(classId: string) {
    super(`Trial class ${classId} not found`);
    this.name = "ClassNotFoundError";
  }
}
