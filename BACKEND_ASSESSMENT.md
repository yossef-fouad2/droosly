# Droos Hub — Backend Launch-Readiness Plan

> Companion to `IMPLEMENTATION_PLAN.md`. Written as a review doc — read before you start the next work session. This is a real startup, so the bar here is **launch-readiness**, not a hobby curriculum.

## Context

You asked how well this is set up for high traffic. Honest answer: it isn't — **and it shouldn't be.** Your own `IMPLEMENTATION_PLAN.md` already made the right call by deferring Kubernetes, Redis, load balancers, read replicas, and a CDN ("solves a problem you do not have yet"). That instinct is senior-level. Don't undo it.

This is a real startup, not a practice project — so the bar is **launch-readiness**: correct, secure, deployable, and safe with real customers' data. Don't confuse that with high-traffic-readiness; they're different bars:

- **Launch-ready** (mandatory *before you charge anyone*): Tier 1 + Tier 2 below, plus Phase 3 (deploy + *tested* backups) and Phase 5 (content protection). Not "later," not optional.
- **High-traffic-ready** (the only thing deferred): more servers, Redis, load balancers. You scale on *proof of demand*, not in anticipation — deferring this is correct startup discipline, and your architecture (stateless JWT + video on R2/CDN) is already built to add it later with near-zero rework.

That this work also teaches you backend deeply is a bonus, not the point.

**Recommendation in one line:** fix the correctness bugs, add the security/ops fundamentals, then deploy for real (Phase 3) — that's the launch bar, and each step is standard production hygiene, not academic.

Each item says **what**, **why it matters**, and **where to look / what to reuse** — but you write the code.

---

## Can this actually ship as a real startup? Yes.

This is a legitimate production architecture, not a learning toy. Real paid products run on exactly this stack (one Hetzner box + Docker Compose + Postgres + Caddy + Cloudflare R2).

- **The economics work.** Video *egress* is what bankrupts video startups; your plan already solved it (R2 free egress, delete masters after transcode, one signed path-prefix URL per session to preserve CDN caching). That's the hardest part of this business, designed correctly up front.
- **One box goes far.** Your server only moves JSON + auth; the video bytes flow through R2/CDN, not through you. "10–20 students" is the *pilot*, not the ceiling — the same box serves thousands before Postgres/CPU is the limit.
- **No dead ends.** Stateless JWT means adding a second API instance behind a load balancer later is near-zero rework. Deferring scale doesn't corner you.

**But "deployable" has a bar — and it's Tier 1 + Tier 2, not scale.** An app where every course is born "deleted" and the DB doesn't match the schema won't survive real users; unthrottled auth, no HTTPS, no restore-tested backups, and no fail-fast config lose data or leak credentials at *any* size. Those items turn this from "project" into "a service you can charge for." Phase 3 (deploy + backups) and Phase 5 (content protection — your commercial moat) then make it a business. The real risks are non-technical (will teachers pay, is protection good enough, does the redemption flow work) — the stack itself is not the risk.

---

## The core mental model to internalize

Separate two things the assessment lumped together:

- **Correctness & hygiene** — bugs and gaps that bite at *5 users*, not 5,000. These are not "scale." Fix them regardless of traffic.
- **Scale** — throughput/latency under load. You have no load. Learn the *concepts* once, then defer the infrastructure exactly as your plan says.

Also know **where your traffic will actually live**: it's video bytes, not JSON. Your plan already handles that correctly. The Express API serves metadata/auth — one small box handles that for years. So "high traffic" for the API is a non-problem; for video it's already designed. Optimizing the API for throughput now would be learning the wrong lesson.

---

## Tier 1 — Correctness bugs (do these first; they're wrong at any traffic)

1. **`courses.deletedAt` is born "deleted."** [schema.ts:30](apps/backend/src/db/schema.ts#L30) declares `deletedAt: timestamp(...).defaultNow().notNull()`, so every course is stamped deleted at insert, and `listCourses` never filters on it anyway.
   - *Learn:* soft-delete pattern + migrations. Make it nullable, default `null`; filter `WHERE deleted_at IS NULL` on reads; set the timestamp only on delete. Write a new Drizzle migration — don't hand-edit the DB.

2. **Migration drift — your DB doesn't match your schema.** `schema.ts` describes the Phase-2 `enrollments` (termId/validFrom/validUntil/`userCourseTermUnique`) and `devices` unique constraint, but the committed migrations in [apps/backend/drizzle/](apps/backend/drizzle/) don't appear to create them. Verify with `drizzle-kit` (generate/check) before trusting either.
   - *Learn:* schema-as-source-of-truth. `schema.ts` is the intent; migrations are the applied history; they must agree.

3. **Auth error shape + header inconsistency.** [auth.ts](apps/backend/src/routes/auth.ts) hand-writes `res.status(400).json({ error: "..." })` (lines 38, 52, 72, 78) instead of the `AppError` funnel every other route uses, and `/tokenIsValid` reads `x-auth-token` ([auth.ts:95](apps/backend/src/routes/auth.ts#L95)) while `requireAuth` reads `Authorization: Bearer`.
   - *Learn:* one error contract, one auth scheme. Reuse `AppError` from [lib/errors.ts](apps/backend/src/lib/errors.ts) and let [errorHandler.ts](apps/backend/src/middleware/errorHandler.ts) format it. Pick Bearer everywhere.

---

## Tier 2 — Backend fundamentals worth learning *now* (cheap, high learning value)

These aren't for traffic; they're the baseline competencies every backend dev needs. Do them because they're core, not because you're under load.

4. **Rate limiting on auth.** `/auth/login` + `/auth/signup` are wide open, and each runs an intentionally-expensive `scrypt` ([auth.ts:18,25](apps/backend/src/routes/auth.ts#L18)). Unthrottled expensive auth = brute-force + easy CPU exhaustion.
   - *Learn:* `express-rate-limit`. Add a tight limiter on the auth router specifically. This is the single most important security fix here.

5. **Security headers + CORS.** No `helmet`, no `cors`. CORS will block your Next.js frontend the moment it calls the API.
   - *Learn:* `helmet()` early in the chain; `cors()` with an explicit origin allowlist from env (not `*`).

6. **Re-enable request logging + add a real health endpoint.** [index.ts:20](apps/backend/src/index.ts#L20) has `// app.use(requestLogger)` commented out — you're flying blind. There's also no HTTP `/health` (the commit "health check db" was startup retry logic in [db/index.ts](apps/backend/src/db/index.ts), not an endpoint).
   - *Learn:* observability. Uncomment `requestLogger` (already wired via `pino-http`), and add `GET /health` that runs `select 1` and returns `200`/`503`. Your compose/Caddy/uptime checks will need it.

7. **Process lifecycle: graceful shutdown + unhandledRejection.** [index.ts](apps/backend/src/index.ts) handles `uncaughtException` but not `unhandledRejection`, and never drains the server or calls `pool.end()` on `SIGTERM`.
   - *Learn:* how Node processes die. Add a `SIGTERM`/`SIGINT` handler that stops accepting connections, then closes the pool. Matters the first time you redeploy.

8. **Config that fails fast + fix the PORT bug.** [index.ts:40](apps/backend/src/index.ts#L40) hardcodes `8000`, but `.env.example` says `PORT=3000` and compose maps `${PORT}` — so under Docker the published port never reaches the app. Env is also read ad hoc with `!`/`as string` (e.g. `JWT_SECRET`), so a missing secret fails at *request* time, not startup.
   - *Learn:* 12-factor config. Make one small module that reads + validates env with Zod at boot (reuse `zod`, already a dep), exports a typed `config`, and throws on missing values. Then `app.listen(config.port)`.

---

## Tier 3 — Performance concepts: learn once, deliberately (you do NOT need these yet)

Do at most one or two of these *as an exercise*, understanding they're overkill for a pilot. The learning is in the reasoning, not the necessity.

9. **Connection pool tuning.** [db/index.ts:11](apps/backend/src/db/index.ts#L11) uses `new Pool({ connectionString })` — all defaults (`max: 10`, no `connectionTimeoutMillis`, no query timeout → hangs forever under saturation).
   - *Learn:* set `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, and a statement timeout — and understand *why each number*. Default 10 is fine for 20 users; the point is knowing the knobs exist.

10. **Indexes for real query patterns.** `listCourses` filters `category` and orders by `id` with OFFSET pagination + a separate `COUNT(*)` per request ([courses.service.ts](apps/backend/src/services/courses.service.ts)); FKs like `instructor_id`, `lessons.course_id`, `enrollments.*` are unindexed.
    - *Learn:* add an index in a migration, then use `EXPLAIN ANALYZE` before/after to *see* seq-scan → index-scan. That "measure it" habit is the real skill. Don't add indexes blindly — add one, prove it helped.

*(Caching / Redis, clustering, `Promise.all` on the two list queries — skip. Note them in `docs/decisions.md` as "deferred, and here's why.")*

---

## Then: get back on your own plan — Phase 3 is the prize

After Tier 1–2, the highest-value learning milestone is **Phase 3: actually deploy it.** Turning the dev container into a real deployment teaches more backend/ops than any scaling task:

- Rewrite the [Dockerfile](apps/backend/Dockerfile) as a multi-stage prod build: `npm ci` → `tsc` → run `node dist/index.js` as a **non-root** user on a slim base. Today it runs `npm run dev` (nodemon + ts-node) as root — that's your dev loop, not a production image.
- Fix the compose issues: Postgres volume path (`/var/lib/postgresql/data`, not `/var/lib/postgresql`) and the `${PORT}` mapping (ties into fix #8).
- Add Caddy in front for automatic HTTPS (per your plan).
- Nightly Postgres backup **and restore it once** to prove it works.

Then continue Phase 1 → 2 (finish courses CRUD + ownership checks, the "one access-check function") as written.

## Explicitly NOT now (reaffirming your plan's deferral list)

Kubernetes, Redis, RabbitMQ, microservices, read replicas, load balancers, CDN-for-the-API, clustering/PM2. Your plan already says revisit after Phase 8 — keep it that way. The stateless-JWT design ([requireAuth.ts](apps/backend/src/middleware/requireAuth.ts)) already leaves the door open to add replicas later with almost no rework, so you lose nothing by waiting.

---

## Verification (how to know each step worked)

- **Set up tests first** — Phase 1 calls for `vitest` + `supertest` and none exist yet. Adding them is itself core backend learning, and every fix below then gets a test.
- Tier 1: a test that creates a course and immediately lists it (proves the `deletedAt` fix); `npx drizzle-kit` generate/check shows no pending diff (proves drift closed).
- Tier 2: hit `/auth/login` in a loop → expect `429` (rate limit); `curl -i` shows helmet headers + CORS; `GET /health` returns `200`, and `503` when DB is down; `docker stop` the container → logs show graceful drain, not an abrupt cut; boot with `JWT_SECRET` unset → process exits at startup, not on first request.
- Tier 3: `EXPLAIN ANALYZE` on the courses list query before/after the index.
- End-to-end: `docker compose up`, confirm the published port actually reaches the app (the PORT fix), and that data survives `docker compose down && up` (the volume fix).

## Suggested order

Tier 1 (bugs) → tests scaffold → Tier 2 (#4 rate-limit, #5 helmet/cors, #6 logging+health, #7 lifecycle, #8 config) → Phase 3 deploy → optionally one Tier 3 exercise. Log each non-obvious decision in `docs/decisions.md` — that habit is part of the craft.

