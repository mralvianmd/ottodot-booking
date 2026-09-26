import { PrismaClient, BookingStatus, PaymentStatus, TrialClassStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clean existing data
  await prisma.paymentAttempt.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.trialClass.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  console.log("🗑️  Cleared existing data\n");

  // ── Parents & Students ───────────────────────────────

  const parent1 = await prisma.parent.create({
    data: {
      name: "David Thompson",
      email: "david@example.com",
      students: {
        create: [
          { name: "Emma Thompson", dateOfBirth: new Date("2018-03-15") },
          { name: "Liam Thompson", dateOfBirth: new Date("2019-07-22") },
        ],
      },
    },
    include: { students: true },
  });
  console.log(`✅ Parent 1: ${parent1.name} (${parent1.students.length} students)`);

  const parent2 = await prisma.parent.create({
    data: {
      name: "Sarah Johnson",
      email: "sarah@example.com",
      students: {
        create: [
          { name: "Olivia Johnson", dateOfBirth: new Date("2017-11-08") },
        ],
      },
    },
    include: { students: true },
  });
  console.log(`✅ Parent 2: ${parent2.name} (${parent2.students.length} students)`);

  const parent3 = await prisma.parent.create({
    data: {
      name: "Michael Chen",
      email: "michael@example.com",
      students: {
        create: [
          { name: "Noah Chen", dateOfBirth: new Date("2018-06-30") },
          { name: "Sophie Chen", dateOfBirth: new Date("2020-01-12") },
        ],
      },
    },
    include: { students: true },
  });
  console.log(`✅ Parent 3: ${parent3.name} (${parent3.students.length} students)`);

  // ── Trial Classes ────────────────────────────────────

  // Class 1: Available seats (1/4 confirmed)
  const class1 = await prisma.trialClass.create({
    data: {
      subject: "Science",
      topic: "The Solar System",
      teacher: "Mr. Otto",
      scheduledAt: new Date("2026-10-05T10:00:00"),
      maxSeats: 4,
      status: TrialClassStatus.UPCOMING,
    },
  });
  console.log(`\n✅ Class 1: ${class1.subject} - ${class1.topic} (available seats)`);

  // Class 2: Last-seat scenario (3/4 confirmed)
  const class2 = await prisma.trialClass.create({
    data: {
      subject: "Mathematics",
      topic: "Fractions",
      teacher: "Ms. Dot",
      scheduledAt: new Date("2026-10-06T14:00:00"),
      maxSeats: 4,
      status: TrialClassStatus.UPCOMING,
    },
  });
  console.log(`✅ Class 2: ${class2.subject} - ${class2.topic} (last-seat scenario)`);

  // Class 3: Full (4/4 confirmed)
  const class3 = await prisma.trialClass.create({
    data: {
      subject: "Science",
      topic: "Energy & Forces",
      teacher: "Mr. Otto",
      scheduledAt: new Date("2026-10-07T10:00:00"),
      maxSeats: 4,
      status: TrialClassStatus.FULL,
    },
  });
  console.log(`✅ Class 3: ${class3.subject} - ${class3.topic} (full)`);

  // Class 4: Upcoming with no bookings
  const class4 = await prisma.trialClass.create({
    data: {
      subject: "Mathematics",
      topic: "Basic Geometry",
      teacher: "Ms. Dot",
      scheduledAt: new Date("2026-10-10T09:00:00"),
      maxSeats: 4,
      status: TrialClassStatus.UPCOMING,
    },
  });
  console.log(`✅ Class 4: ${class4.subject} - ${class4.topic} (empty, no bookings)`);

  // ── Bookings for Class 1 (1/4 confirmed) ────────────

  const booking1 = await prisma.booking.create({
    data: {
      studentId: parent1.students[0].id, // Emma
      trialClassId: class1.id,
      status: BookingStatus.CONFIRMED,
    },
  });
  await prisma.paymentAttempt.create({
    data: {
      bookingId: booking1.id,
      amount: 2500,
      status: PaymentStatus.SUCCESS,
    },
  });
  console.log(`\n📋 Class 1: 1/4 confirmed (Emma)`);

  // ── Bookings for Class 2 (3/4 confirmed — last-seat) ─

  const class2Bookings = [
    { student: parent1.students[1], label: "Liam" },
    { student: parent2.students[0], label: "Olivia" },
    { student: parent3.students[0], label: "Noah" },
  ];

  for (const { student } of class2Bookings) {
    const b = await prisma.booking.create({
      data: {
        studentId: student.id,
        trialClassId: class2.id,
        status: BookingStatus.CONFIRMED,
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        bookingId: b.id,
        amount: 2500,
        status: PaymentStatus.SUCCESS,
      },
    });
  }
  console.log(`📋 Class 2: 3/4 confirmed (Liam, Olivia, Noah) — 1 seat left`);

  // ── Bookings for Class 3 (4/4 — full) ───────────────

  // Need 4 students for class3. We have 5 total: Emma, Liam, Olivia, Noah, Sophie
  const class3Students = [
    { student: parent1.students[0], label: "Emma" },
    { student: parent1.students[1], label: "Liam" },
    { student: parent2.students[0], label: "Olivia" },
    { student: parent3.students[1], label: "Sophie" },
  ];

  for (const { student } of class3Students) {
    const b = await prisma.booking.create({
      data: {
        studentId: student.id,
        trialClassId: class3.id,
        status: BookingStatus.CONFIRMED,
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        bookingId: b.id,
        amount: 2500,
        status: PaymentStatus.SUCCESS,
      },
    });
  }
  console.log(`📋 Class 3: 4/4 confirmed (Emma, Liam, Olivia, Sophie) — FULL`);

  // ── Verify Duplicate Prevention ──────────────────────
  // Only CONFIRMED bookings block re-booking.
  // The partial unique index (WHERE status='CONFIRMED') blocks another
  // CONFIRMED row at DB level. The app-level check in createBooking()
  // also prevents creating any new booking when CONFIRMED exists.
  // PENDING_PAYMENT and PAYMENT_FAILED do NOT block re-booking.

  // 1. Emma already has CONFIRMED on Class 1 → another CONFIRMED is BLOCKED by DB
  try {
    await prisma.booking.create({
      data: {
        studentId: parent1.students[0].id, // Emma (already CONFIRMED)
        trialClassId: class1.id,
        status: BookingStatus.CONFIRMED,
      },
    });
    console.log(`\n❌ ERROR: Duplicate CONFIRMED booking was NOT prevented!`);
  } catch {
    console.log(`\n🔒 DB constraint: Emma cannot have 2nd CONFIRMED on Class 1 (partial unique index)`);
  }

  // 2. Noah has no booking on Class 1 → can create PENDING_PAYMENT freely
  const noahPending = await prisma.booking.create({
    data: {
      studentId: parent3.students[0].id, // Noah
      trialClassId: class1.id,
      status: BookingStatus.PENDING_PAYMENT,
    },
  });
  console.log(`📋 Noah created a PENDING_PAYMENT booking on Class 1 (no conflict)`);

  // 3. Noah can re-book Class 1 even with the pending booking still there
  const noahRebook = await prisma.booking.create({
    data: {
      studentId: parent3.students[0].id, // Noah again
      trialClassId: class1.id,           // Class 1 again
      status: BookingStatus.PENDING_PAYMENT,
    },
  });
  console.log(`🔄 Noah re-booked Class 1 (previous PENDING_PAYMENT did not block)`);

  // ── Summary ──────────────────────────────────────────

  console.log("\n────────────────────────────────────────────");
  console.log("📊 Seed Summary:");
  console.log(`   Parents:  3 (David Thompson, Sarah Johnson, Michael Chen)`);
  console.log(`   Students: 5 (Emma, Liam, Olivia, Noah, Sophie)`);
  console.log(`   Classes:  4`);
  console.log(`     - Class 1 (Science/Solar System):    1/4 confirmed + 2 pending (Noah)`);
  console.log(`     - Class 2 (Math/Fractions):          3/4 confirmed (last-seat scenario)`);
  console.log(`     - Class 3 (Science/Energy & Forces): 4/4 confirmed (FULL)`);
  console.log(`     - Class 4 (Math/Basic Geometry):     0/4 (empty)`);
  console.log(`\n   Duplicate rule: only CONFIRMED blocks re-booking.`);
  console.log(`   PENDING_PAYMENT / PAYMENT_FAILED do NOT block re-booking.`);
  console.log("────────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
