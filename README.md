# Ottodot Trial Booking System

Trial class booking system for Ottodot — online science & math classes for kids.

## How to Run

```bash
# Install dependencies
npm install

# Set up database (SQLite — no Docker needed)
npx prisma migrate dev

# Seed the database with demo data
npx tsx prisma/seed.ts

# Start the dev server
npm run dev

# Run tests
npm test
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## What I Built

- **Trial booking system** for Ottodot (online science/math classes for kids)
- **Parent flow**: select parent → select child → see unpaid bookings (Continue Payment) → pick available class → book → mock payment → see status
- **Admin flow**: view trial class roster (all statuses), reset/simulate classes, split available vs full class views
- **All edge cases handled**:
  - Duplicate booking prevention (same student + same class)
  - Overbooking prevention (max 4 students per class)
  - Payment failure handling (never results in confirmed status)
  - Last-seat race condition (only one pending booking can confirm when 1 seat left)

## Time Spent

~3 hours total (Phase 0–6)

## Assumptions

- No authentication (demo uses parent selector dropdown)
- Payment is fully mocked (simulated success/failure buttons)
- Classes are pre-created (no class management UI)
- No enrollment system (trial only, as specified)
- SQLite for prototype (not production-grade concurrency)

## Architecture & Backend Decisions

### Stack
- **Next.js 16** (App Router) — full-stack, Server Components + Route Handlers
- **TypeScript** — type safety across the entire stack
- **SQLite via Prisma ORM** — zero-config database for prototyping
- **Zod** — runtime input validation on API routes
- **Vitest** — fast testing with TypeScript-native support
- **Tailwind CSS** — minimal UI styling

### Data Model

```
Parent 1──* Student 1──* Booking *──1 TrialClass
                              │
                              └── 1──* PaymentAttempt
```

- **Booking statuses**: `PENDING_PAYMENT` → `CONFIRMED` | `PAYMENT_FAILED` | `CANCELLED`
- **Partial unique index** on `(studentId, trialClassId)` WHERE `status = 'CONFIRMED'` prevents duplicate confirmed bookings at DB level

### Last-Seat Race Condition

Solved with **Prisma interactive transactions** (`$transaction`):

```
User A selects last seat → creates booking (PENDING_PAYMENT)
User B selects same last seat → creates booking (PENDING_PAYMENT)

When User A pays first:
  Prisma $transaction
  → Re-check: confirmed count < max_seats? YES (3/4)
  → Update booking to CONFIRMED (now 4/4)
  COMMIT

When User B tries to pay (sequential in SQLite):
  Prisma $transaction
  → Re-check: confirmed count < max_seats? NO (4/4)
  → Update booking to PAYMENT_FAILED
  COMMIT
```

**Note**: SQLite serializes writes natively, so concurrent transactions are queued. For production, PostgreSQL with `SELECT ... FOR UPDATE` would be the correct approach.

### How Duplicate Bookings Are Prevented

Two layers of protection, but **only CONFIRMED bookings block re-booking**:

1. **Database level**: A partial unique index on `(studentId, trialClassId)` with `WHERE status = 'CONFIRMED'` ensures only one confirmed booking per student+class. PENDING_PAYMENT and PAYMENT_FAILED rows are not blocked.
2. **Application level**: `createBooking()` in `booking-service.ts` checks for an existing `CONFIRMED` booking before creating a new one. Returns a `DuplicateBookingError` (HTTP 409) only when a confirmed booking exists.

**Re-booking is allowed** when the previous booking is `PENDING_PAYMENT` (never paid) or `PAYMENT_FAILED`. The student can simply book again without any cleanup.

The seed data demonstrates this: Emma has a CONFIRMED booking on Class 1 — any re-booking attempt is rejected. Meanwhile, Noah can freely create and re-create PENDING_PAYMENT bookings on the same class.

### How Payment Failure Is Handled

When `processPayment(bookingId, false)` is called:
- Booking status is set to `PAYMENT_FAILED`
- A `PaymentAttempt` record with status `FAILED` is created
- The booking is **never** set to `CONFIRMED`
- The student does **not** appear on the class roster
- The seat remains available for other students

### Where Checks Live

| Check | Layer | Details |
|-------|-------|--------|
| Duplicate booking | Database + Backend | Partial unique index (CONFIRMED only) + `createBooking()` app check |
| Seat availability | Backend (transaction) | Count check inside `$transaction` in both `createBooking` and `processPayment` |
| Payment validation | Backend service | `processPayment()` — failure never sets `CONFIRMED` |
| Input validation | Backend (Zod) | Route handlers validate request body with Zod schemas |
| UI hints (seats remaining) | Frontend | Informational only — backend is authoritative |
| Stale pending bookings | Background job (future) | Auto-cancel `PENDING_PAYMENT` after N minutes to free seats |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes` | List available classes with seat counts |
| GET | `/api/classes/:id` | Class detail with roster |
| GET | `/api/admin/classes` | ALL classes including full |
| GET | `/api/classes/:id/roster` | All non-cancelled bookings |
| POST | `/api/classes/:id/reset` | Cancel all bookings, reset class |
| POST | `/api/classes/:id/simulate` | Fill class with scenario |
| GET | `/api/parents` | List all parents |
| GET | `/api/parents/:id/students` | Students for a parent |
| POST | `/api/bookings` | Create a booking `{ studentId, classId }` |
| GET | `/api/bookings/:id` | Booking status + payment history |
| GET | `/api/students/:id/pending-bookings` | Unpaid bookings for a student (deduplicated by class) |
| POST | `/api/bookings/:id/pay` | Process payment `{ success: boolean }` |

## What I Deliberately Cut

- Authentication/authorization
- Real payment integration
- Class CRUD management
- Email notifications
- Waitlist functionality
- Regular enrollment system
- Frontend polish

## What I Would Monitor After Release

- Booking conversion rate (pending → confirmed)
- Payment failure rate
- Race condition frequency (how often last-seat conflicts occur)
- Time-to-book (how fast classes fill up)
- Orphaned pending bookings (created but never paid)

## What I Would Do Next

- Implement waitlist for full classes
- Add real payment gateway (Stripe/PayPal)
- Add parent authentication
- Add class scheduling management
- Add cancellation with refund logic
- Background job to auto-cancel stale `pending_payment` bookings (e.g., after 15 min)
- Migrate to PostgreSQL for production concurrency control
