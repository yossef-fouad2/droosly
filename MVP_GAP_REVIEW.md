# Droos Hub - MVP Implementation Plan

A video platform for Egyptian teachers selling monthly lesson packages.
Students buy specific content and keep access until its academic term ends.
One solo teacher first, with a student website and a Flutter app.

Updated: 2026-10-07. This replaces the gap review with an implementation checklist.
It preserves the confirmed product decisions, not the older plans' manual-grant,
redemption-code, or whole-course subscription assumptions.

## How to use this document

Work top to bottom. Each phase ends with **Done when** and **What you are learning**,
like `IMPLEMENTATION_PLAN.md`. Finish the gate before marking that phase complete.

- **One task at a time.** Build it, test it, then tick its box.
- **Existing code is not proof of completion.** The progress notes below describe source, not passing tests.
- **Preserve work.** Do not reset the old database, rewrite historical migrations, or remove unrelated code.
- **Keep the next build focused.** Phases 0-3 define the initial backend slice. Phases 4-9 are the remaining roadmap; resolve their stated integration gates before implementing them.
- **No implementation is authorized by this document edit.** Source changes, infrastructure, and deployments require a later implementation step.

## The MVP we agreed on

- One solo teacher and 10-20 students initially. Center membership and reassignment come later.
- Next.js provides the teacher dashboard and student website. Flutter provides the student app.
- The hierarchy is `workspace -> course -> monthly package -> lesson -> video`.
- A package belongs to a dated academic term and has its own price. Buying October does not unlock November.
- Students initiate each gateway payment. Successful server-verified payment grants access automatically; there are no recurring charges.
- Purchased October content remains accessible until the term ends, not merely until October ends.
- A term reset means access expires. Purchase records, enrollment history, and progress are not deleted.
- There is no existing data to migrate. Use a new empty database and leave the old database and migration directory untouched.

## Where you are now

- App construction is separated from startup, and `PORT` is respected. Preserve that work.
- Categories, bilingual names, seed SQL, and `src/services/category.ts` exist. The helper currently returns only names; it still needs IDs/slugs, a mounted route, and tests.
- Course CRUD exists but still has incorrect validation reads, a PATCH self-FROM, and hard deletion. `deletedAt` is still mandatory with a current-time default.
- The old migration chain has missing journaled files and duplicate category creation. Tests, package access, workspaces, payments, and real media delivery are not complete; the web client remains a starter.

Backend `src/` paths below are relative to `apps/backend`. No phase is pre-checked:
the source audit did not run application checks or inspect a live database.

---

## Phase 0 - Make the backend testable

Keep the working foundation. Fix what prevents you from proving the next changes.

- [ ] **Preserve startup separation.** Importing the app must not listen or start connection retries. Add database-pool teardown so tests exit cleanly.
- [ ] **Add Vitest, Supertest, and a test script.** Require an explicitly isolated test database; never fall back to the ordinary application database.
- [ ] **Validate token identity.** Check JWT identity claims and keep Bearer authentication consistent. Database-backed current-user/profile behavior is completed in Phase 2 after the new schema exists.
- [ ] **Use parsed input everywhere.** Auth and course handlers must consume `req.validated.body`, `.query`, and `.params`, not raw or incorrectly nested values.
- [ ] **Standardize failures.** Use AppError for invalid input, auth failures, malformed JSON, missing routes, and recognized constraint conflicts. Do not expose database internals.
- [ ] **Add baseline HTTP checks.** Cover invalid/missing tokens, malformed JSON, unknown routes, and cleanup without requiring the future package schema.

**Done when:** app import has no startup side effects, smoke tests run and exit,
and the backend type-check/build commands pass.

**What you are learning:** integration testing, identity validation, error contracts.

---

## Phase 1 - Model packages and create a clean database

Fix the product model before building more endpoints. A course is a container;
the monthly package is what the student purchases.

- [ ] **Add solo workspace ownership.** Courses belong to a workspace. Its owner is also the instructor for this MVP; both values are server-controlled. Membership and instructor reassignment are deferred.
- [ ] **Complete academic terms.** Add academic year, term number, timezone-aware start/end timestamps, valid date ranges, and uniqueness. Terms are operator-curated reference data.
- [ ] **Add monthly packages.** Store course, term, month/year, price, and archive state. Use positive bounded integer EGP minor units: `10000` means EGP 100.00. Remove whole-course purchase pricing from the contract.
- [ ] **Scope lessons and access to packages.** Lessons reference their package and a real video record. Enrollments have stable IDs, user/package references, active/revoked status, and valid access windows. Derive course/workspace/term through the package rather than duplicating editable ownership fields.
- [ ] **Preserve paid history.** Snapshot promised term expiry into access records. New terms get new package identities, not overwritten purchases. Payment provenance and fulfillment constraints arrive with the approved Phase 6 integration; do not guess provider fields now.
- [ ] **Fix existing constraints.** Archive timestamps are nullable with no default. Keep unique category slugs, bilingual names, and device-pair uniqueness. Do not expand unrelated grade/track features.
- [ ] **Generate a new baseline.** Use `apps/backend/drizzle-baseline` as the only active migration directory. Preserve the old `drizzle` directory as inactive history. Use an explicit connection URL, not the config's silent hostname rewrite; stop if the chosen new target contains unexpected data.
- [ ] **Verify reproducibility.** Port the category seeds, replay on independent empty databases, and check constraints and schema drift. Once adopted, freeze the baseline and use forward migrations. No volume reset, schema push shortcut, or migrations on app boot.

Update affected types with the schema changes. Keep the cutover internal until
Phase 2 replaces the old writers; do not deploy old routes against the new model.

**Done when:** the package-aware schema and seeds reproduce cleanly, relationships
and constraints are tested, and the old database/history remain untouched.

**What you are learning:** data modelling, foreign keys, migrations, money and time.

---

## Phase 2 - Finish the solo workspace and catalog APIs

Build the final scoped API rather than polishing temporary global routes twice.

- [ ] **Finish database-backed identity.** Check current-user existence and return a safe profile from `GET /users/me`. Test signup/login, valid tokens, and tokens for removed users against the new PostgreSQL schema.
- [ ] **Expose reference data.** Mount `GET /categories` and `GET /terms`. Extend the existing category helper to return `id`, `slug`, `nameEn`, and `nameAr` for real selectors.
- [ ] **Add controlled workspace onboarding.** Only operator-approved accounts can create a solo workspace. Provide branding lookup, owner-only branding updates, and `GET /users/me/spaces`. No center creation or member endpoints yet.
- [ ] **Finish course and package CRUD.** Use `/spaces/:slug/courses` and nested `/:courseId/packages` routes, with scoped detail/update/archive operations. Resolve ownership from the database, not JWT role claims or a submitted instructor ID.
- [ ] **Fix the current course defects.** Remove PATCH self-FROM and DELETE body validation. Reject empty/forbidden PATCH fields, preserve omitted fields, and validate IDs, references, package prices, and pagination.
- [ ] **Archive rather than delete.** DELETE returns 204. Hide archived courses/packages from public discovery and new sales without deleting lessons or access records. Give owners a private management list including archives.
- [ ] **Keep bindings immutable.** Ordinary PATCH cannot move a course between workspaces, a package between courses/terms, or purchased lessons between packages.
- [ ] **Retire the old global router.** Confirm actual client usage, then remove the entire `/courses` surface. Do not leave an unguarded compatibility route.
- [ ] **Test with two owners.** Cover real PostgreSQL mutations, title-only PATCH, bodyless archive, counts/filters, invalid input, missing auth, wrong owner, and wrong-parent IDs. Out-of-scope children return 404, even if the caller owns both parents.

**Done when:** an approved owner can manage their catalog, another owner cannot,
and all scoped CRUD/error/archive checks pass.

**What you are learning:** REST contracts, tenant isolation, lifecycle-safe CRUD.

---

## Phase 3 - Enforce package access and term expiry

Prove what a student can watch before connecting real money or media.

- [ ] **Build one access-check service.** Require the exact package, an active workspace, active enrollment, and `validFrom <= now < validUntil`. Inject time for boundary tests. Owner preview is a separate authorization branch.
- [ ] **Make access payment-ready, not self-service.** Only the later verified-payment fulfillment path may grant live access. Do not expose a student enrollment endpoint. Use isolated test fixtures until payment integration exists.
- [ ] **Implement term expiry.** Copy the advertised term end into access records. Do not silently shorten purchases when reference dates change. Expiration is derived from time, not a reset job that deletes history.
- [ ] **Add the student library.** `GET /users/me/enrollments` returns only the caller's purchased packages and history, grouped with safe course/workspace details. Owning one package never marks the whole course unlocked.
- [ ] **Protect lesson metadata and progress.** Resolve each lesson through its package before reading or recording progress. Never expose raw storage keys. Keep mandatory video relationships; fixtures belong only in isolated tests.
- [ ] **Test the real rules.** October access succeeds while November fails, including direct lesson IDs. Cover future, exact-expiry, revoked, archived, suspended, and next-term access. Existing valid purchases survive catalog archive.
- [ ] **Add operator suspension controls.** Suspension blocks protected access and management writes without deleting data. Reactivation does not extend expiry.

**Done when:** package identity and stored expiry decide access on the server;
term reset denies old access without erasing purchases or unlocking the next term.

**What you are learning:** entitlements, authorization boundaries, clock-based tests.

---

## Phase 4 - Deploy a private staging environment

Deploy the backend before the full product, but do not call this a paid pilot.

- [ ] **Approve the deployment target.** Use the planned single-server Docker/Compose approach with HTTPS. Keep staging isolated and restricted; do not expose database ports publicly.
- [ ] **Handle secrets and migrations explicitly.** Configure the intended database and active migration lineage. Keep credentials out of Git/logs and run reviewed migrations as a deployment step.
- [ ] **Add CI gates.** Run backend type-check, build, and tests before deployment. Add client checks as those clients become real.
- [ ] **Test backup restoration.** Store backups off the application server and restore one into a separate database. Record deployment and recovery steps.
- [ ] **Add basic operations.** Health checks, structured errors, uptime alerts, disk-space alerts, and authentication rate limits belong before real users.

**Done when:** the scoped backend works over HTTPS in private staging, CI catches
regressions, and a backup has actually been restored.

**What you are learning:** deployment, configuration, recoverability.

---

## Phase 5 - Deliver real lessons and protected playback

Keep the original R2/ffmpeg direction, but finish the delivery contract before
coding its integration. Private storage and an authorized player are separate jobs.

- [ ] **Resolve the media gate.** Specify private-origin access, playback-session validation/revocation, and delivery to both web and Flutter. A plain R2 presigned URL is not automatically a path-scoped playback session.
- [ ] **Add owner-only lesson authoring.** Create/edit/order lessons inside a package. Keep purchased package bindings stable; additional lessons in that same package are covered by its existing purchases.
- [ ] **Implement resumable uploads.** Issue scoped multipart uploads to private R2 storage, with ownership, size/type checks, completion validation, and abandoned-upload cleanup.
- [ ] **Process media asynchronously.** Use a PostgreSQL job queue and ffmpeg for HLS renditions. Track queued/processing/ready/failed states, retries, and safe requeueing. Unknown duration can remain pending; never invent dummy media to satisfy a constraint.
- [ ] **Protect delivery.** Use the package-access service before issuing playback access or encryption keys. Keep keys separate from public media and prevent direct origin/manifest/segment bypasses.
- [ ] **Apply the original no-DRM controls.** Two registered devices, a 14-day replacement cooldown with logged operator exceptions, one concurrent playback session across both clients, and a learner watermark. Native capture controls depend on the selected Flutter platforms; browsers cannot guarantee capture prevention.
- [ ] **Test failure and recovery.** Use a real recording, interrupted upload, failed worker, retry, unauthorized playback, expiry, and revocation. Measure actual output/storage rather than copying old cost estimates.
- [ ] **Define media retention.** Term expiry is not permission to delete purchase history or all video files. Approve cleanup and source-file retention before enabling destructive jobs.

**Done when:** an authorized test player can stream a real processed lesson,
unpaid access is denied, and interrupted uploads/jobs recover without manual database edits.

**What you are learning:** asynchronous work, object storage, media security.

---

## Phase 6 - Take payment and grant access automatically

This is one-off payment for a monthly content package, not automatic billing.

**Entry gate:** select the gateway, merchant-account owner/fund recipient, refund
policy, and permitted checkout channels. Teacher-direct collection is the simpler
pilot recommendation, not an accepted decision. Platform collection requires a
settlement/refund plan. Do not invent a payout system or assume merchant approval.

- [ ] **Create checkout on the server.** Authenticate the student and snapshot package identity, positive price, currency, and advertised term expiry. Reject archived/unavailable packages, inactive terms, and already-owned content.
- [ ] **Add the chosen provider's records and constraints.** Preserve orders, payment attempts/events, and fulfillment history. Use unique provider transaction/event identifiers; the provider-specific schema is a forward migration, not a rewrite of the baseline.
- [ ] **Verify payment independently.** Follow the provider's signature/HMAC and confirmation rules. Match amount, currency, merchant, order, and package. Browser/app redirects never authorize enrollment.
- [ ] **Fulfill atomically and idempotently.** Record verified success and package access together. Retries and concurrent callbacks must not duplicate a grant or extend expiry. Keep failed/pending payments from granting access and prevent stale events from reversing a newer state.
- [ ] **Recover delayed outcomes.** Provide an authenticated order-status endpoint and a reconciliation path for paid-but-not-yet-fulfilled orders. Both clients must display pending states honestly.
- [ ] **Handle exceptional payments.** Resolve duplicate captures, term-end late captures, archived-package orders, refunds, and chargebacks under the agreed policy. Revoke only the affected purchase's access, not unrelated packages; do not silently grant next-term content instead.
- [ ] **Test before charging real students.** Cover spoofed callbacks, mismatched amounts, duplicates, out-of-order events, database failure, retries, refunds, and exact term-end behavior. Keep card details out of your application.

**Done when:** a verified payment unlocks only the purchased package once;
failed/unverified payments unlock nothing, and payment recovery/refund cases pass.

**What you are learning:** webhooks, transactions, idempotency, financial state.

---

## Phase 7 - Build the web teaching and learning loop

The Next.js app is currently a starter. Build the necessary workflows, not a large dashboard.

- [ ] **Agree the client contract.** Document scoped routes, DTOs, error shapes, pagination, EGP price units, and term-end timestamps. Configure API origin/CORS or a same-origin proxy deliberately.
- [ ] **Add secure account flows.** Signup, login, logout, session expiry, and protected navigation. Use production-safe browser session handling; do not leave JWTs logged or permanently stored in localStorage.
- [ ] **Build the teacher essentials.** Workspace branding, course/package management, lesson upload/status/order, and private buyer/access lists. Do not include center membership screens.
- [ ] **Build the student essentials.** Workspace catalog, monthly package details, exact content/expiry/price disclosure, checkout status, library, lesson list, and player.
- [ ] **Handle real use.** Arabic/RTL, mobile layouts, loading/empty/error states, retries, shared watch progress, and resume. Unbought packages remain locked even inside a partly owned course.
- [ ] **Test the full web flow.** Teacher creates content; student pays, waits for verification, watches, and resumes. Test payment cancellation, missing access, and expiry as well as success.

**Done when:** teacher and student can complete their workflows through the website
without Postman, manual enrollment, or database intervention.

**What you are learning:** frontend/backend integration, sessions, usable error states.

---

## Phase 8 - Build the Flutter student loop

Reuse the backend rules and purchase history. Do not create a second entitlement system.

**Entry gate:** choose Android/iOS targets and pilot distribution. Confirm store
billing requirements for digital lessons before adding in-app checkout links.
Web checkout plus a consumption-only app is a recommendation to evaluate, not a settled requirement.

- [ ] **Create the student app.** Login with secure token storage, workspace/course browsing, package details, library, and clearly locked/unlocked lessons.
- [ ] **Implement the approved payment experience.** Use the agreed checkout/store route and server-confirmed order status. If native store billing is required, plan its receipt verification before implementation; do not silently bypass platform policy.
- [ ] **Add protected HLS playback.** Use the same package authorization, device limits, and concurrent-session rules as web. Add the watermark and supported native capture controls without promising unbreakable protection.
- [ ] **Share progress and resume.** Report progress in batches, recover after interruption, and resume using the same server records as the website.
- [ ] **Test on real supported devices.** Arabic/RTL, mobile data, slow connections, app restart, expired sessions, unpaid packages, and term expiry must behave correctly.

**Done when:** a student can obtain access through the approved purchase flow,
watch and resume in Flutter, and see the same entitlement state as on web.

**What you are learning:** mobile integration, secure storage, playback lifecycle.

---

## Phase 9 - Prove the MVP with one teacher

This is the launch gate. Passing metadata tests alone is not enough.

- [ ] **Complete one real package purchase.** A teacher publishes October and November packages in a dated term. A student pays for October and can watch it on web and Flutter; November stays locked, including direct-ID requests.
- [ ] **Prove term reset.** October remains available after October ends, then stops at the academic term's exact expiry. History remains visible and a next-term package requires another purchase.
- [ ] **Prove isolation and retention.** Another workspace owner cannot inspect buyers or edit content. Archive preserves valid paid access; suspension blocks access without erasing records.
- [ ] **Rehearse failures.** Delayed/duplicate payment callbacks, failed upload, worker restart, expired token, payment refund, and database restoration have verified recovery paths.
- [ ] **Prepare operations.** Approve live merchant setup, refund/support ownership, client distribution, secrets, monitoring, backups, and rate limits on auth, checkout, and playback.
- [ ] **Onboard one teacher and 10-20 students.** Observe them using real lessons and devices. Fix the problems they encounter before expanding to centers or additional features.

**Done when:** a teacher can sell a monthly package and students can reliably
pay, watch, and revise until term end on both clients, without developer intervention.

**What you are learning:** end-to-end validation, support, finding the real backlog.

---

## Validation commands

Run these from the repository root after Phase 0 adds the backend test script:

```powershell
npm --prefix apps/backend run type-check
npm --prefix apps/backend run build
npm --prefix apps/backend test
```

Add web lint/build and Flutter analyze/test checks when those phases are implemented.
Run migrations from `apps/backend` with the selected configuration and an explicitly
isolated target. This plan edit did not run builds, tests, or migrations.

## Deliberately not in this MVP

Center memberships and instructor reassignment. Recurring card charges. Workspace
subscription billing. Redemption codes and manual-grant onboarding. Custom domains.
Homework, quizzes, certificates, analytics dashboards, and expanded grade/track
hierarchies. Microservices, Kubernetes, or a separate message broker.

Payment processing, real video delivery, and both student clients are **in scope**.
They are later phases, not features to quietly drop when calling the backend finished.
