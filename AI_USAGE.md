# AI Usage Report — Ottodot Trial Booking

## AI Tools Used

- **Qoder** (AI coding assistant) — primary tool for all implementation phases

## What AI Was Used For

| Task | How AI Helped |
|------|---------------|
| Project scaffolding | Generated Next.js project setup, configured Prisma, Vitest, Tailwind |
| Schema design | Created Prisma schema with all 5 models, enums, and relations from spec |
| Seed data | Generated realistic seed data covering all edge-case scenarios |
| Business logic | Implemented booking service with all invariants (duplicate, overbooking, race condition) |
| API routes | Created all 8 route handlers with Zod validation and proper error codes |
| UI components | Built booking flow page and admin roster page |
| Test generation | Wrote 13 test cases covering all invariants including race condition |
| Debugging | Fixed Prisma version compatibility issues (v8 RC → v6 stable) |

## One Place AI Helped Move Faster

**Test scaffolding and edge-case coverage.** AI generated all 13 test cases in a single pass, including the test helper with database setup/teardown. The race condition test — which requires creating 3 confirmed bookings, then 2 pending bookings, then processing payments sequentially — would have taken significant manual effort to structure correctly. AI produced the correct test flow immediately from the spec description.

## One Place I Disagreed With / Corrected AI Output

**Database choice for prototype.** The original plan specified PostgreSQL with Docker, `SELECT ... FOR UPDATE` row locks, and serializable transactions. For a prototype, this adds unnecessary setup complexity (Docker, connection management). I chose SQLite instead, which:
- Requires zero setup (file-based, no Docker)
- Serializes writes natively (single-writer model)
- Still supports Prisma interactive transactions for correctness
- Trade-off: no true concurrent write support, but acceptable for a prototype

The AI adapted the entire stack (AGENTS.md, booking service, test helper) to SQLite without pushback.

## What I'd Change About AI Workflow Next Time

1. **Specify database upfront** — the PostgreSQL → SQLite switch required rework of schema config, docker-compose deletion, and AGENTS.md updates. Specifying SQLite from the start would have saved ~10 minutes.
2. **Version pinning** — AI initially installed Prisma v8 (RC) which had breaking config changes. Pinning to stable v6 earlier would have avoided the downgrade cycle.
3. **Test the API layer too** — AI focused tests on the service layer. Adding integration tests for the API routes (testing HTTP status codes, response shapes) would have been more thorough.

## How I Verified the Final Implementation

1. **TypeScript compilation** — `npx tsc --noEmit` passes with zero errors
2. **Unit tests** — 13/13 tests pass via Vitest, covering:
   - Duplicate booking prevention
   - Overbooking prevention
   - Payment failure handling
   - Last-seat race condition (the critical test)
   - Cancelled booking seat freeing
   - All query functions
3. **Build verification** — `next build` compiles successfully
4. **Manual testing** — Dev server runs, seed data loads correctly
5. **Prisma validation** — `prisma validate` confirms schema is valid
