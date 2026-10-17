# Droos Hub — Milestone Tracker

A one-page execution tracker for `IMPLEMENTATION_PLAN.md`. The plan says *what* and
*why*; this file says *where you are* and *what the next box is*.

**If you get lost:** find the first unchecked box in the current milestone. That is
your next action. Nothing else matters until it's ticked.

- **Current milestone:** M0
- **Last updated:** 2026-10-17
- **Audited against code:** yes (see §Audit corrections — four plan claims were stale)

## How each milestone ends

A milestone is only done when **all** of these hold. No exceptions, because a soft
"done" is how the previous plan churn started.

1. Every box in the milestone is ticked.
2. These pass from the repo root:
   ```powershell
   npm --prefix apps/backend run type-check
   npm --prefix apps/backend run build
   npm --prefix apps/backend test      # from M2 onward
   ```
3. One commit for the milestone, tagged `m0` … `m8`.
4. The new behaviour was exercised once by hand (curl/Postman/browser), not just compiled.

| Milestone | Plan task | Tag | Blocking decision |
|---|---|---|---|
| M0 Unblock | Task 1 tail | `m0` | D1, D4, D5 |
| M1 Schema + packages baseline | Task 2 | `m1` | D1, D2, D3 |
| M2 Test harness + identity | Task 3 | `m2` | — |
| M3 Workspace self-signup | Task 4 | `m3` | D4 |
| M4 Course + package CRUD | Task 5 | `m4` | D3 |
| M5 Access check + library | Task 6 | `m5` | D2 |
| M6 Payment gateway | Task 7 | `m6` | D5 |
| M7 Minimal video delivery | Task 8 | `m7` | — |
| M8 Thin web slice + pilot | Task 9 | `m8` | D4 |

---

## Locked decisions — do not re-open

Re-litigating these is the exact failure mode the plan exists to stop.

- `workspace → course → package → lesson → video`. The **package** is the sellable unit.
- "Monthly" vs "chapter" is a **label only**. Same entity, same schema, same rules.
- Access expires at **academic term end**, always, regardless of label. Students re-buy next term.
- A package is buyable only once **published** (`publishedAt` set, not archived, term active).
  A published package from earlier in the term stays buyable.
- One-off gateway purchase per package. **Paymob**. No redemption codes, no manual grants.
- Multi-tenant SaaS, open self-signup. Solo teacher per workspace. Staff/centers **deferred**.
- Flutter **deferred** until the web loop is validated.

## Open decisions

Each one blocks the milestone it's listed against.

- **D1 — Is the dev DB disposable?** *(blocks M1; M1 replaces the migration history)*
  "Disposable" means the **database contents** can be dropped and recreated. It does
  **not** mean you should delete the migration files now. Keep the current `drizzle/`
  directory until D1 is confirmed and M1 is ready. The audit found no seed data beyond
  the 20 categories in `0008`, no fixtures, and no test DB. Everything points to
  disposable, but confirm it first.
- **D2 — Do terms have dates?** *(blocks M1; the access model depends on it)*
  `terms` currently has only `nameEn/nameAr/slug/sort_order` — **no start or end date**.
  The entire expiry model (`validUntil` snapshot, "active term") has nothing to read.
  Decision: add `startsAt`/`endsAt` (timestamptz, `endsAt > startsAt`) to `terms`.
- **D3 — What happens to `courses.price`?** *(blocks M1/M4)*
  Price moves to `packages.priceMinor`. Options: (a) drop `courses.price` — catalog shows
  "from X" computed from packages; (b) keep it as a display-only field the teacher sets.
  Recommend **(a)**: one price source, no drift. Whichever you pick, write it down here.
- **D4 — Token transport: `httpOnly` cookie or `Authorization: Bearer`?**
  *(blocks M3 for CORS/credentials, blocks M8 for the client)*
  Bearer is already implemented and simpler. Cookie needs CORS `credentials: true` +
  cookie parsing server-side. Recommend **Bearer + `localStorage` for the pilot**,
  accepting the XSS tradeoff, and revisit before real money moves.
- **D5 — Paymob merchant + fund recipient + refund policy.** *(blocks M6 go-live)*
  Not needed to start M6 against sandbox. Needed before the first real pound.

---

## M0 — Unblock

No features. Clear the decisions and make the plan survive a laptop/disk accident.

- [ ] Answer **D1** (disposable DB) and write the answer in §Open decisions. Do **not**
      delete migration files yet; this only confirms whether the database itself may
      be dropped and recreated.
- [ ] Answer **D4** and **D5** (or explicitly defer D5 to M6).
- [ ] **Fix `.gitignore`: it currently ignores `IMPLEMENTATION_PLAN.md` and `/docs`.**
      The canonical plan is untracked — one `git clean` and it's gone. Remove those
      two lines, then `git add IMPLEMENTATION_PLAN.md MILESTONES.md` and commit.
- [ ] Delete the 92-byte root `package-lock.json` (inert; there is no root `package.json`)
      or make the root a real workspace. Recommend deleting for now.
- [ ] Confirm the API port story is settled: `.env` has `PORT=8000` and
      `src/index.ts:18` already reads `process.env.PORT`. Nothing to change —
      just correct the stale "port clash" note in `FRONTEND_TODO.md` §1.

**Done when:** every decision above has an answer in this file, and
`git ls-files IMPLEMENTATION_PLAN.md` prints a path.

**Watch out:** do not start M1 before D1 is answered. M1 deletes migration history.

---

## M1 — Schema + packages baseline

Plan: Task 2 · Depends: M0 · Tag `m1`

Model the business, then generate **one** clean baseline. Not incremental fixes.

- [ ] Answer D1, D2, D3.
- [ ] Add `packages`: `id`, `courseId`, `termId`, `title`, `orderIndex`, `priceMinor`
      (integer, `> 0`), `publishedAt` (nullable), `archivedAt` (nullable, **no default**),
      `createdAt`. Unique `(courseId, termId, orderIndex)`.
- [x] Add `startsAt` / `endsAt` to `terms` (D2).
- [x] Repoint `lessons.courseId` → `lessons.packageId`.
- [x] Repoint `enrollments.courseId` → `packageId`; keep `userId`, `enrolledAt`,
      `validFrom`, `validUntil`, `status`; add the missing FK on `termId` **or** drop
      `termId` and derive it through the package (pick one, note it here).
- [x] Fix `courses.deletedAt`: nullable, **no default**. It is currently
      `.notNull()` with no default (`schema.ts:43`) — every insert fails.
- [ ] Resolve the orphaned `grade_levels` table: add `courses.gradeLevelId` or drop
      the table. It has no FK from anywhere today, so it's dead weight in the schema.
- [ ] Apply D3 to `courses.price`.
- [ ] After D1 is confirmed, preserve the current migration files in Git (commit them
      if needed), then delete the whole `drizzle/` directory and regenerate one
      baseline. This removes:
      pharmacy leftovers (`0000`: `drugs`, `inventory`), the duplicate
      `ADD COLUMN "category"` in `0002`+`0003`, and the missing
      `0005_safe_midnight` / `0007_dark_blonde_phantom` SQL files.
- [ ] Move the 20-category `INSERT` out of migration `0008` into a real seed script
      (`src/db/seed.ts` + `npm run db:seed`). Also seed `terms` — **there is no terms
      seed today, and no seed files at all**; the plan's "port the seeds" has nothing
      to port.
- [ ] Verify: drop and recreate an empty DB, replay the baseline, run the seed, and
      confirm the app boots and `POST /courses` works. This is the check that fails
      today — the latest snapshot still carries `instructor_id` and has no
      `workspaces` table, so a clean replay produces a DB the code cannot write to.
- [ ] Keep migrations an explicit step. Never on boot, never `drizzle-kit push`.

**Done when:** an empty DB + baseline + seed replays with zero errors and the existing
course endpoints work against it.

**Watch out:**
- `drizzle.config.ts` rewrites `@db:` → `localhost:` but `src/db/index.ts` does not.
  Pick one target (local Postgres *or* compose) and use it for every verification.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on — nullable
  Drizzle columns will fight you. Model them intentionally.

---

## M2 — Test harness + identity

Plan: Task 3 · Depends: M1 · Tag `m2`

- [ ] Add `vitest` + `supertest` + a `test` script; add `test:watch`.
- [ ] Use an explicitly isolated test DB. **Fail closed** if the URL matches the app DB.
- [ ] Add a `createTestApp()` / `closePool()` split so tests can tear the pool down and exit.
- [ ] Fix `GET /users/me` to return the real authenticated user (safe fields only).
      It is currently `{ message: "User route is working" }` (`routes/users.ts`).
- [ ] Route the remaining hand-rolled error responses through `AppError`. `POST /auth/signup`
      returns `{ error: "User with the same email already exists" }` (400) — that breaks
      the `{ error: { code, message } }` contract the frontend is coded against. Should be
      `CONFLICT` / `INVALID_CREDENTIALS` per `lib/errors.ts`.
- [ ] Smoke tests: missing token, malformed token, malformed JSON, unknown route,
      validation failure shape, `/users/me` happy path.
- [ ] Delete the dead code the audit found: the empty `if (!result) {}` in
      `routes/courses.ts:40` and the unreachable `if (!existing)` in
      `courses.service.ts:120` (`getCoursesByID` already throws `NOT_FOUND`).

**Done when:** `npm test` is green on a fresh DB, and every error response matches
`toErrorBody`'s shape.

**Watch out:** an empty `if` block silently swallows nothing *today*, but the same
pattern on a nullable lookup will swallow a real 404 tomorrow.

---

## M3 — Workspace self-signup

Plan: Task 4 · Depends: M2 · Tag `m3`

- [ ] `POST /spaces` — authenticated teacher creates their own workspace.
      Owner and status are server-set, never from the body.
- [ ] `GET /spaces/:slug` (public branding), `PATCH /spaces/:slug` (owner only),
      `GET /users/me/spaces`.
- [ ] Validate slug (format, uniqueness → `CONFLICT`), `nameEn`, `nameAr`.
- [ ] Add CORS. Still absent from `app.ts` — the browser cannot call the API at all today.
      If D4 chose Bearer, a plain `origin` allowlist is enough; cookies need `credentials: true`.
- [ ] Resolve ownership from the DB. Never trust a JWT claim.

**Done when:** a brand-new signup can create a space and read it back by slug; a second
user gets `403`/`404` on the first user's space, not a success.

**Watch out:** `workspaceAuth` currently returns `403 "no work space for this user"`.
Once self-signup exists, make wrong-tenant lookups `404`, not `403` — `403` confirms the
resource exists.

---

## M4 — Course + package CRUD

Plan: Task 5 · Depends: M3 · Tag `m4`

- [ ] Move routes to `/spaces/:slug/courses` and `/:courseId/packages`.
- [ ] `PATCH` must preserve omitted fields. `updateCourseSchema` is `.partial()`, so this
      mostly works — verify it, don't assume. Reject an empty `{}` PATCH.
- [ ] Remove `validate(updateCourseSchema, "body")` from `DELETE /courses/:id`
      (`routes/courses.ts:84`) — a DELETE should not require or validate a body.
- [ ] Validate package: `priceMinor > 0`, `orderIndex` unique per
      `(courseId, termId)`, `termId` exists and is active, course belongs to the space.
- [ ] Publish/unpublish via `publishedAt`; archive instead of delete (204).
      Keep archived rows for owners, hide them from the public catalog.
- [ ] Bindings immutable: a course can't move workspace, a package can't move course/term.
- [ ] Retire the global `/courses` router once nothing calls it.

**Done when:** teacher A cannot read or mutate teacher B's course/package by guessing IDs
(tests prove it), and archived courses disappear from the public list.

---

## M5 — Access check + student library

Plan: Task 6 · Depends: M4 · Tag `m5`

- [ ] One `canAccess(userId, packageId)` service: package published and not archived +
      workspace active + enrollment `active` + `validFrom <= now < validUntil`.
      Inject the clock so boundary cases are testable.
- [ ] No self-enrollment endpoint. Access comes only from verified payment (M6).
- [ ] `GET /users/me/enrollments` — purchased packages + history.
- [ ] Protected lesson metadata resolves **through the package**. Never expose `storageKey`.
- [ ] Tests: owned ✓ / unowned ✗ (including direct lesson IDs, which is the obvious bypass),
      not-yet-valid, at-exact-`validUntil`, revoked, archived, suspended workspace.

**Done when:** the test file covers every row of that list and each one has an
explicit assertion on the boundary.

**Watch out:** this is the piece that must be right before money exists. A bug here is
free content or a paying student locked out.

---

## M6 — Payment gateway (Paymob)

Plan: Task 7 · Depends: M5 · Tag `m6`

- [ ] Confirm D5. Build against sandbox.
- [ ] `POST` server-side checkout: snapshot package identity, price, currency, term
      expiry. Reject unpublished/archived packages, inactive terms, already-owned content.
- [ ] `orders` + `payment_events` tables with unique provider transaction/event IDs
      (forward migration — do **not** rewrite the M1 baseline).
- [ ] Verify independently: HMAC/signature + confirmation, match amount, currency,
      merchant, order, package. Redirects never grant access.
- [ ] Atomic, idempotent fulfillment: success + grant in one transaction. Retries and
      concurrent callbacks must not duplicate or extend access.
- [ ] `GET /orders/:id` status + a reconciliation path for paid-but-unfulfilled.
- [ ] Tests: spoofed signature, wrong amount, duplicate callback, out-of-order events,
      DB failure mid-fulfill, retry, refund, exact term-end.

**Done when:** replaying the same callback 5× leaves exactly one enrollment with the
same `validUntil`, and a tampered amount is rejected.

---

## M7 — Minimal video delivery

Plan: Task 8 · Depends: M5 · Tag `m7`

- [ ] Private object storage (no public URLs).
- [ ] Upload path for the teacher (plain, resumable later).
- [ ] Signed playback URL, short TTL, issued **only** after `canAccess` passes.
- [ ] `GET /lessons/:id/playback` on the protected route.

**Do not build yet:** HLS/ffmpeg pipeline, AES-128, device cap + cooldown,
single-session enforcement, watermark, multipart resumable upload. The `devices` and
`watch_progress` tables already exist ahead of need — leave them unused, they cost nothing.

**Done when:** a signed URL works for an enrolled student and 404s for everyone else,
including a direct lesson ID.

---

## M8 — Thin web slice + pilot

Plan: Task 9 · Depends: all · Tag `m8`

- [ ] `apiFetch` wrapper: base URL from `NEXT_PUBLIC_API_URL`, Bearer when present,
      parse `{ error: { code, message } }` into a thrown typed error.
- [ ] `app/lib/api-types.ts` mirroring the M1 schema (the hand-synced types in
      `FRONTEND_TODO.md` §5 are still pre-package and must be rewritten).
- [ ] Teacher flow: signup → login → create space → course → package → publish → upload lesson.
- [ ] Student flow: browse → buy (sandbox) → library → watch.
- [ ] Arabic/RTL from the start, not retrofitted. `nameAr` exists on every lookup table.
- [ ] One real teacher + 10–20 students. The loop must work with no Postman and no DB edits.

**Done when:** a student who has never touched a terminal buys a package and watches a
lesson end-to-end on their phone.

---

## Audit corrections (2026-10-17)

Verified against the code, not taken on trust. The plan is right about the big things;
these four items are stale or missing.

1. **"`index.ts` listens on hardcoded 8000" — stale.** `index.ts:18` already reads
   `process.env.PORT` with an 8000 fallback, and `.env` sets `PORT=8000`.
   Task 3's "respect configured PORT" is already done. `FRONTEND_TODO.md` §1's port-clash
   blocker (#2) is obsolete — only CORS (#1) remains.
2. **`courses.deletedAt` is worse than described.** The plan says
   `defaultNow().notNull()`; `schema.ts:43` is `.notNull()` with **no default**, so no
   course row can be inserted at all. Not a soft-delete nuance — a hard write break.
3. **No seeds exist.** Categories are `INSERT`ed inside migration `0008`; there is no seed
   script and no terms data anywhere. Task 2's "port the seeds" needs a seed file created,
   not just moved.
4. **`terms` has no dates** (D2). Nothing in the schema supports "access expires at term
   end". This is the single largest gap between the plan and the schema and it is not
   mentioned in Task 2.

Also worth knowing, lower severity:

- `.gitignore` ignores `IMPLEMENTATION_PLAN.md` and `/docs` — the canonical plan is not
  in git. Fixed in M0.
- `grade_levels` is referenced by nothing. `courses` has no grade. Decide in M1.
- Cross-tenant lookups currently return `403`, not `404`. Fix in M3.
- `bcryptjs` / `@types/bcryptjs` are dependencies but auth uses `node:crypto` scrypt.
  Remove the dead deps in M2 (note: `@types/bcryptjs` is a stub package).
- `devices` and `watch_progress` exist ahead of M7. Harmless; leave them.
- No root `package.json`. `npm --prefix apps/backend …` works fine — don't build a
  monorepo orchestrator just to have one.
