# AI Usage Report — Ottodot Trial Booking

## AI Tools Used

- **Qoder** (AI coding assistant) — primary tool for all implementation phases

## What AI Was Used For

| Task | How AI Helped |
|------|---------------|
| Project scaffolding | Generated Next.js project setup, configured Prisma, Vitest, Tailwind |
| Schema design | Created Prisma schema with 5 models, enums, relations, and partial unique index |
| Seed data | Generated realistic English seed data covering all edge-case scenarios (3 parents, 5 students, 4 classes) |
| Business logic | Implemented booking service with all invariants (duplicate, overbooking, race condition) |
| API routes | Created 12 route handlers including admin reset/simulate and pending-bookings endpoints |
| UI components | Built booking flow page with unpaid bookings section and Continue Payment, admin roster page with dark/light mode, scenario controls, split available/full views, and manual refresh buttons |
| Test generation | Wrote 15 test cases covering all invariants including re-booking after pending/failed |
| Debugging | Fixed Prisma v8 RC → v6 downgrade, SQLite readonly errors from stale server, partial index migration, roster deduplication for duplicate pending bookings |
| Data localization | Converted all Indonesian demo data to English for international class context |

## One Place AI Helped Move Faster

**Partial unique index + duplicate rule redesign.** When the requirement changed from "block all duplicate bookings" to "only CONFIRMED blocks re-booking," AI immediately identified the three-layer change needed: (1) replace `@@unique` with `@@index` in schema, (2) hand-write a partial unique index `WHERE status = 'CONFIRMED'` in migration SQL since Prisma DSL can't express it, and (3) update the app-level check in `createBooking()`. AI also caught that the seed's duplicate demo needed to insert another CONFIRMED row (not PENDING) to actually trigger the partial index — a subtle correctness issue that would have been easy to miss.

## One Place I Disagreed With / Corrected AI Output

**Duplicate prevention was too strict.** AI initially implemented duplicate prevention to block ANY non-cancelled booking (PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED). I pointed out that if a student books a trial class but doesn't pay, they should be able to try again without being locked out. AI corrected the approach: only CONFIRMED bookings block re-booking, and the DB constraint was changed from a blanket `@@unique` to a partial unique index. This also required updating 3 existing tests and adding 2 new ones.

## What I'd Change About AI Workflow Next Time

1. **Specify database upfront** — the PostgreSQL → SQLite switch required rework of schema config, docker-compose deletion, and AGENTS.md updates. Specifying SQLite from the start would have saved ~10 minutes.
2. **Version pinning** — AI initially installed Prisma v8 (RC) which had breaking config changes. Pinning to stable v6 earlier would have avoided the downgrade cycle.
3. **Think about re-booking UX earlier** — the initial duplicate prevention was technically correct per the spec but didn't consider the user experience of "I didn't pay, can I try again?" Thinking through user flows end-to-end before implementing constraints would have avoided the redesign.
4. **Test the API layer too** — AI focused tests on the service layer. Adding integration tests for the API routes (testing HTTP status codes, response shapes) would have been more thorough.

## How I Verified the Final Implementation

1. **TypeScript compilation** — `npx tsc --noEmit` passes with zero errors
2. **Unit tests** — 15/15 tests pass via Vitest, covering:
   - Duplicate booking prevention (CONFIRMED-only)
   - Re-booking after PENDING_PAYMENT
   - Re-booking after PAYMENT_FAILED
   - Overbooking prevention
   - Payment failure handling
   - Last-seat race condition (the critical test)
   - Cancelled booking seat freeing
   - All query functions (available classes, roster with all statuses, student lookup)
3. **Build verification** — `next build` compiles successfully
4. **Manual testing** — Dev server runs, seed data loads correctly, all admin endpoints tested via curl
5. **Prisma validation** — `prisma validate` confirms schema is valid
6. **Live endpoint testing** — Reset and Simulate endpoints verified with curl against running dev server
