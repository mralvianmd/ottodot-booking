# Ottodot Trial Booking — Agent Instructions

## Project Context
- Trial class booking system for Ottodot (international online science/math classes for kids)
- All demo data is in English (parents, students, teachers, subjects, topics)
- Max 4 students per trial class
- Must handle: duplicate bookings, overbooking, payment failure, last-seat race
- Dark/light mode support (class-based, Tailwind v4 `@custom-variant dark`)

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- SQLite via Prisma ORM v6 (typed queries, migrations)
- Zod for validation
- Vitest v2 for testing
- tsx for running seed scripts

## Key Invariants (NEVER violate these)
1. A student can only have ONE CONFIRMED booking per trial class
2. PENDING_PAYMENT and PAYMENT_FAILED bookings do NOT block re-booking
3. A trial class can have at most 4 CONFIRMED students
4. Payment failure must NEVER result in confirmed status
5. Last-seat race: only one pending booking can upgrade to confirmed

## Architecture Rules
- All business logic lives in `src/lib/booking-service.ts` (7 exported functions)
- API routes are thin — validate input, call service, return response
- All availability checks MUST happen inside Prisma interactive transactions
- UI checks are informational only — backend is authoritative
- Tests must cover all edge cases, especially race conditions
- `getClassRoster()` returns ALL non-cancelled bookings, deduplicated by student (latest booking only) — admin operational view
- Seat availability (`getAvailableClasses`, `confirmedCount`) counts ONLY confirmed bookings

## API Endpoints (12 routes)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes` | Available classes (excludes full) |
| GET | `/api/admin/classes` | ALL classes including full |
| GET | `/api/classes/:id` | Class detail with roster |
| GET | `/api/classes/:id/roster` | All non-cancelled bookings |
| POST | `/api/classes/:id/reset` | Cancel all bookings, reset class |
| POST | `/api/classes/:id/simulate` | Fill class with scenario |
| GET | `/api/parents` | List all parents |
| GET | `/api/parents/:id/students` | Students for a parent |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/:id` | Booking status + payment history |
| POST | `/api/bookings/:id/pay` | Process payment |
| GET | `/api/students/:id/pending-bookings` | Unpaid bookings for a student (deduplicated by class) |

## Database Rules
- SQLite via Prisma (prototype — no Docker needed)
- Partial unique index on (studentId, trialClassId) WHERE status='CONFIRMED' — lives in migration SQL only (Prisma schema DSL cannot express partial indexes)
- Regular `@@index([studentId, trialClassId])` in schema.prisma for query performance
- Booking statuses: PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED, CANCELLED
- Payment attempts are recorded separately from bookings
- SQLite does not support SELECT ... FOR UPDATE; use Prisma interactive transactions for serialization

## Booking Page Features
- When a child is selected, their unpaid (PENDING_PAYMENT) bookings are fetched and shown with a "Continue Payment" button
- Manual Refresh button re-fetches available classes and pending bookings

## Admin Features
- **Reset Class**: Cancels all non-cancelled bookings, resets class to UPCOMING
- **Simulate Class**: Fills a class with predefined scenarios (empty, 1/4, 2/4, 3/4, full, mixed)
- Admin page splits available classes (card list) from full classes (compact table)
- Roster shows color-coded status badges: green=CONFIRMED, yellow=PENDING_PAYMENT, red=PAYMENT_FAILED, grey=CANCELLED
- Manual Refresh button re-fetches all classes and current roster detail

## Testing Rules
- Each test uses a fresh database (separate test.db file)
- 15 tests covering: duplicate (CONFIRMED-only), re-booking after pending/failed, overbooking, payment failure, last-seat race, cancelled seat freeing, all query functions
- Run `npm test` before considering any change complete
- When asserting on roster, filter by status before counting (roster includes all non-cancelled)
