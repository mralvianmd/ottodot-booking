# Ottodot Trial Booking — Agent Instructions

## Project Context
- Trial class booking system for Ottodot (online science/math classes for kids)
- Max 4 students per trial class
- Must handle: duplicate bookings, overbooking, payment failure, last-seat race

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- SQLite via Prisma ORM (typed queries, migrations)
- Zod for validation
- Vitest for testing

## Key Invariants (NEVER violate these)
1. A student can only have ONE CONFIRMED booking per trial class (PENDING_PAYMENT/PAYMENT_FAILED can be re-booked)
2. A trial class can have at most 4 CONFIRMED students
3. Payment failure must NEVER result in confirmed status
4. Last-seat race: only one pending booking can upgrade to confirmed

## Architecture Rules
- All business logic lives in `src/lib/booking-service.ts`
- API routes are thin — validate input, call service, return response
- All availability checks MUST happen inside Prisma interactive transactions
- UI checks are informational only — backend is authoritative
- Tests must cover all edge cases, especially race conditions

## Database Rules
- SQLite via Prisma (prototype — no Docker needed)
- Partial unique index on (studentId, trialClassId) WHERE status='CONFIRMED' for duplicate prevention
- Booking statuses: pending_payment, confirmed, payment_failed, cancelled
- Payment attempts are recorded separately from bookings
- Note: SQLite does not support SELECT ... FOR UPDATE; use Prisma interactive transactions for serialization

## Testing Rules
- Each test uses a fresh database (or transaction rollback)
- Must test: duplicate, overbooking, payment failure, last-seat race
- Run `npm test` before considering any change complete
