import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(__dirname, "../../prisma/test.db");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

// Set env before any Prisma usage
process.env.DATABASE_URL = TEST_DB_URL;

let prisma: PrismaClient;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } },
    });
  }
  return prisma;
}

export async function setupTestDb() {
  // Ensure clean test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Run migration on test DB
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  });
}

export async function cleanTestDb() {
  const p = getTestPrisma();
  await p.paymentAttempt.deleteMany();
  await p.booking.deleteMany();
  await p.trialClass.deleteMany();
  await p.student.deleteMany();
  await p.parent.deleteMany();
}

export async function teardownTestDb() {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

/**
 * Helper: create a parent with students
 */
export async function createTestParent(name: string, studentNames: string[]) {
  const p = getTestPrisma();
  return p.parent.create({
    data: {
      name,
      email: `${name.toLowerCase().replace(/\s/g, ".")}@test.com`,
      students: {
        create: studentNames.map((sn) => ({
          name: sn,
          dateOfBirth: new Date("2018-06-15"),
        })),
      },
    },
    include: { students: true },
  });
}

/**
 * Helper: create a trial class
 */
export async function createTestClass(
  subject: string,
  topic: string,
  maxSeats = 4
) {
  const p = getTestPrisma();
  return p.trialClass.create({
    data: {
      subject,
      topic,
      teacher: "Test Teacher",
      scheduledAt: new Date("2026-11-01T10:00:00"),
      maxSeats,
    },
  });
}

/**
 * Helper: create a confirmed booking with payment
 */
export async function createConfirmedBooking(studentId: string, classId: string) {
  const p = getTestPrisma();
  const booking = await p.booking.create({
    data: {
      studentId,
      trialClassId: classId,
      status: "CONFIRMED",
    },
  });
  await p.paymentAttempt.create({
    data: {
      bookingId: booking.id,
      amount: 2500,
      status: "SUCCESS",
    },
  });
  return booking;
}
