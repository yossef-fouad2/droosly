# Droos Hub: Teacher and Center Workspace Roadmap

Rebuilt: 2026-10-04

**Status:** planning complete; implementation has not started. The database discovery gate below must pass before choosing or running migrations. This document does not authorize resetting data, committing code, or deploying.

This is a fresh backend design based on the product goals and current source, not an incremental revision of an earlier workspace plan. It replaces previous workspace roadmaps. `IMPLEMENTATION_PLAN.md` remains useful for later video/payment work, but the ownership, enrollment, and delivery decisions here take precedence for this scope.

## 1. What We Are Building

Droos Hub is one application serving multiple education businesses:

- An independent teacher has a branded workspace containing their courses.
- A center has a branded workspace containing courses taught by several teachers.
- A workspace owns its courses. An instructor is assigned to teach them; those are different responsibilities.
- Removing a center teacher removes their staff authority, not the center's courses, enrollments, or students' purchased access.
- One user account can own a workspace, teach elsewhere, and be a student in another course.
- Students receive access to individual courses for a defined period, not automatically to everything in a workspace.

The delivery priority remains **courses/categories -> enrollments -> teacher/center workspaces**. Necessary schema preparation can happen earlier than its API; we should not deliberately deploy an inconsistent schema just to preserve that order literally.

This plan delivers the backend foundation, not the complete video platform or subscription business. The frontend developer builds the website against the contracts below. Creating a workspace creates records and settings, not another application deployment.

## 2. Progress

Tick an implementation checkbox only after its change and verification are complete. A milestone is complete only when its exit gate passes. No boxes are pre-checked because this is a plan, not an implementation report.

- [ ] Milestone 0: Establish a safe, reproducible backend baseline.
- [ ] Milestone 1: Finish courses and categories.
- [ ] Milestone 2: Deliver enrollment and protected lesson access.
- [ ] Milestone 3: Introduce workspace ownership and staff management.
- [ ] Milestone 4: Verify isolation and hand off a controlled pilot.

Milestones 0-2 are development/internal testing stages. Do not expose the interim instructor-only authorization model to independent businesses. A real student/center pilot starts after the workspace isolation gate.

## 3. Deliberate MVP Choices

These are recommendations selected to make the new plan concrete, not claims that every detail was previously agreed. Change a choice explicitly before implementing the affected milestone rather than leaving two contradictory behaviors in the API.

| Area | Choice for this roadmap |
| --- | --- |
| Staff model | Exactly one owner per workspace; additional teacher members in centers. No assistants, co-owners, or configurable roles yet. |
| Owner identity | `spaces.ownerId` is the only ownership source. Do not also store an owner role in a membership row. |
| Solo vs center | A solo workspace's owner teaches its courses. Only centers can add other teachers. Type changes and ownership transfer are deferred. |
| Discovery | Workspace branding and non-archived course metadata are public by workspace URL. No cross-workspace marketplace/directory endpoint. Lesson content and rosters remain private. |
| Publication | Creating a course makes its catalog metadata visible. A separate draft/publish workflow and private catalogs are deferred. |
| Categories | A small, global, operator-curated subject/category list. No tenant-custom categories or grade/track hierarchy in this slice. |
| Academic terms | Global academic labels with default start/end dates. They are reference data, not business-owned calendars. |
| Course reuse | A course is not attached to one term. The same course can be enrolled in again for another term. |
| Enrollment dates | Each enrollment stores its actual access window. Term dates supply defaults; changing a term does not rewrite existing access. |
| Pilot enrollment | Authorized staff grant access to an existing student account after arranging payment outside Droos Hub. No student self-enrollment endpoint. |
| Staff onboarding | Center owners directly add an already-registered teacher by email. Pending invitations, acceptance tokens, and invitation email delivery are not included. |
| Workspace onboarding | Creation is restricted to operator-approved pilot accounts until paid self-service onboarding exists. |
| Branding | Name, stable URL slug, optional logo URL, primary color, and public contact phone. Paths first, not custom domains. |
| Billing | The eventual billable unit is the workspace; invited teachers are covered by it. Do not invent payment-provider fields or pretend billing is implemented now. |

Manual staff grants are a pilot simplification, not a replacement for the redemption-code flow in the broader roadmap. Add codes later through the same enrollment service rather than creating a second entitlement mechanism.

Global terms deliberately remove the need to guess a term's workspace during migration. Custom workspace calendars can later reference a global term without changing existing enrollment IDs. They are not required for this MVP.

Reusing a course means reusing its current curriculum. If different terms need independent lesson sets, create separate courses or design course versions later; this plan does not promise historical content snapshots.

## 4. Target Model and Invariants

### Data model

| Entity | Relevant fields and ownership |
| --- | --- |
| `users` | Existing global identity. No global teacher/student role flag. |
| `categories` | `id`, `name`, unique normalized `slug`. Global, read-only through the public API. |
| `terms` | `id`, `academicYear`, `termNumber`, `startsAt`, `endsAt`; unique `(academicYear, termNumber)`, valid date range. Global and operator-curated. |
| `spaces` | `id`, `ownerId -> users.id`, `name`, unique normalized `slug`, type `solo` / `center`, status `active` / `suspended`, optional branding, `createdAt`. |
| `space_members` | `spaceId -> spaces.id`, `userId -> users.id`, `joinedAt`; primary key `(spaceId, userId)`. Each row grants teacher membership. The owner needs no row here. |
| `courses` | Existing identity/content/price, `categoryId -> categories.id`, `instructorId -> users.id`, eventually `spaceId -> spaces.id`, nullable `deletedAt`. |
| `enrollments` | Stable `id`, `userId`, `courseId`, `termId -> terms.id`, `enrolledAt`, `validFrom`, `validUntil`, status `active` / `revoked`; unique `(userId, courseId, termId)`. |
| `lessons` | Existing `courseId` establishes ownership through the course. The existing mandatory video reference is retained in this slice. |

- `courses.spaceId` becomes mandatory after backfill and cannot be changed through ordinary course PATCH requests.
- Enrollments derive their workspace through their course. Do not add a second independently editable enrollment workspace field.
- Categories and terms intentionally have no `spaceId`. Sharing reference data is not sharing a roster or granting access.
- Course assignment accepts only the workspace owner or a current teacher member. Only the owner can reassign a center course to someone else.
- Keep `instructorId` pointing to the user after membership removal until the owner reassigns the course. Do not FK course assignment to a membership row that must be deletable.
- Role decisions come from current database ownership/membership, not from `instructorId` alone or cached JWT claims.
- The owner cannot be removed through the member-removal endpoint. No transfer/delete-owner workflow is included.
- Store new access timestamps with timezone semantics and exchange ISO-8601 values with an explicit offset. Confirm the interpretation of existing timestamps before converting them.
- Prices are integers in EGP minor units: `10000` means EGP 100.00. Verify old data's units; do not assume an earlier integer cast performed a currency conversion.

### Access and lifecycle rules

Student content access requires an existing user, an active workspace once workspaces exist, and **any** matching enrollment satisfying:

`status == active AND validFrom <= now AND now < validUntil`

Use a clock-testable service for this rule. Expiration is derived from time, not maintained by an `expired` status or a scheduled job. Do not select only the newest enrollment: another term may still provide valid access.

Owners and currently assigned teacher members can preview their managed courses without buying an enrollment. Other teachers are ordinary students for that course unless they have their own enrollment. Staff preview and student entitlement are separate authorization branches.

| Operation | Visitor | Enrolled student | Assigned teacher member | Workspace owner |
| --- | --- | --- | --- | --- |
| Public branding/catalog | Yes, active workspace only | Same | Same | Same |
| Protected lessons | No | Valid enrollment required | Own assigned courses | All courses in own workspace |
| Create course | No | No staff authority from enrollment | In own center, assigned to self | In own workspace |
| Edit/archive course | No | No staff authority from enrollment | Own assigned courses | All courses in own workspace |
| View roster/grant/revoke enrollment | No | Own enrollment history only | Own assigned courses | All courses in own workspace |
| Add/remove teachers or reassign instructor | No | No staff authority from enrollment | No | Own workspace only |
| Change workspace branding | No | No staff authority from enrollment | No | Own workspace only |

A student in one workspace can legitimately own another. These columns describe authority for the resource being requested, not permanent account types.

**Archive is not revocation.** `DELETE course` sets `deletedAt`, removes it from public discovery, and prevents new grants or ordinary course edits. An owner-only, assignment-only PATCH remains allowed so an archived course can get a replacement instructor; reject requests that combine reassignment with content edits. Archiving does not delete lessons/enrollments or invalidate an existing enrollment. Staff can still inspect its roster and revoke access explicitly. Existing students reach archived content through their enrollment/library, not the public course endpoint.

**Teacher removal is not archive.** It removes only the teacher-membership row. Courses, lesson records, and enrollments remain unchanged. A removed teacher's independent student enrollment, if any, remains valid.

**Suspension is explicit.** A suspended workspace is hidden publicly and denies teaching/management writes and protected lesson access. Preserve all records. Pilot operators suspend/reactivate it through a restricted operational command, not an owner-facing endpoint. Reactivation does not extend enrollment dates. Subscription expiry must not silently trigger suspension before a separate billing/access policy is agreed.

## 5. Milestone 0: Reproducible Baseline

**Outcome:** a testable app and a trustworthy database starting point. Do not build new features on top of guessed migration history.

### Evidence from the current repository

These are source findings, not claims about a running database or passing tests.

| Finding | Evidence |
| --- | --- |
| Only auth, placeholder current-user, and course routes are mounted; no workspace/enrollment APIs exist. | `apps/backend/src/index.ts`, `src/routes/users.ts`, `src/routes/courses.ts` |
| Parsed validation is nested, but several course handlers read the outer object. | `src/middleware/validate.ts:25-28`, `src/routes/courses.ts:14,21,35` |
| Course PATCH contains an unaliased self-`FROM`; its partial create schema also inherits the category default. | `src/services/courses.service.ts:104-109`, `src/validation/schemas.ts:68-76` |
| DELETE validates an update body and physically deletes; `deletedAt` defaults to now and is non-null. | `src/routes/courses.ts:56-67`, `src/services/courses.service.ts:127-130`, `src/db/schema.ts:30` |
| Both journaled migrations `0002` and `0003` add `category`; normal fresh replay fails. Snapshot history also needs reconciliation. | `drizzle/0002_sweet_categorie.sql`, `drizzle/0003_harsh_black_bolt.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0003_snapshot.json` |
| Enrollment identity/term/window fields and device pair uniqueness are declared without matching migrations. No terms table/FK exists. | `src/db/schema.ts:54-109` versus `drizzle/meta/0004_snapshot.json` |
| Importing the entry point performs startup; listening port 8000 ignores configured `PORT`. No test script exists. | `src/index.ts:19-42`, `apps/backend/package.json`, `apps/backend/docker-compose.yml` |

Paths beginning `src/` or `drizzle/` above are relative to `apps/backend`.

### Database safety gate

- [ ] Identify each actual target database and whether it contains data or clients to preserve. Inspect its migration ledger, table definitions, constraints, and row counts. Repository snapshots alone are not applied-state evidence.
- [ ] Take a backup and rehearse restoration before changing any database that matters. Do not reset the Compose Postgres volume by default.
- [ ] Select a migration path based on observed state: a new, disposable target can use a corrected canonical baseline; an existing/applied-history target needs a reviewed adoption/reconciliation path with explicit preconditions and postconditions.
- [ ] Preserve possibly applied historical artifacts. A later migration cannot repair an earlier pending statement that fails before it is reached. Do not blindly append a fix, skip ledger entries, or hide an unexpected schema with `IF NOT EXISTS`.
- [ ] Keep the chosen migration lineage and its SQL, snapshots, journal, and Drizzle configuration consistent. A new baseline must not accidentally replay the old pharmacy bootstrap/drop sequence or run alongside the old lineage.
- [ ] Audit legacy category spellings/collisions, price units, `deletedAt` values, enrollment IDs/term meanings/windows/statuses/timezones, and duplicate device pairs. Record mappings before changing data. Unknown entitlement dates or deletion intent require an explicit decision, not a default-current-term or blanket timestamp reset.
- [ ] Reconcile the complete enrollment/term dependency set from section 4 once, even if its HTTP API arrives in Milestone 2. On populated databases: add fields/tables, backfill from approved mappings, validate, then enforce constraints. Preserve existing IDs and check identity sequences/dependent references.
- [ ] Replace old unique `(userId, courseId)` enrollment enforcement with `(userId, courseId, termId)` only when all writers are term-aware. Do not first deploy an orphan `termId` and remodel it again for workspaces.
- [ ] Resolve existing device duplicates deliberately before adding the declared pair uniqueness. This is schema reconciliation, not implementation of device registration or caps.
- [ ] Validate both empty-database creation and preservation against a restored clone when existing data is involved. Compare row counts, stable IDs, relationships, and access windows. Never run exploratory migration repair against the only data copy.

### Runtime and test baseline

- [ ] Separate app construction/export from connection retries and `listen()`. Respect configured `PORT`; provide database-pool teardown so tests exit cleanly.
- [ ] Add `vitest`, `supertest`, and a backend `test` script. Use an explicitly isolated PostgreSQL test database; fail closed if test configuration points at an ordinary application database.
- [ ] Standardize errors using the existing `AppError` envelope, including auth failures, malformed JSON, unknown routes, and recognized constraint conflicts. Keep internal database details out of responses.
- [ ] Validate JWT identity claims and current-user existence. Keep the existing Bearer-token model and identity-only token; do not add workspace roles to it. Make `GET /users/me` return the authenticated user's safe profile instead of a placeholder.
- [ ] Ensure handlers consume parsed `req.validated.body/query/params`; apply this to auth as well as course handlers. Defer unrelated package cleanup, renames, and pharmacy validation cleanup unless needed for these changes.

**Exit gate:** app import does not start a server or retry loop; baseline HTTP tests run and clean up; build/type-check pass; the selected migration path is reproducible and its preservation checks pass. No unexplained schema drift remains. Unknown database state blocks migration execution, not writing/testing code against an isolated scratch database.

## 6. Milestone 1: Courses and Categories

**Outcome:** reliable course CRUD and a stable reference catalog before adding business membership.

- [ X ] Add global `categories` and `courses.categoryId`. Build an explicit legacy-string-to-category mapping, handle normalized slug collisions without silently merging different subjects, backfill, and validate before dropping free-text `category`.
- [ ] Seed the approved small category list and expose `GET /categories`. Do not add teacher-editable global categories or an admin CRUD subsystem.
- [ ] Make `deletedAt` nullable without a default. Restore only rows confirmed to have an automatically populated, non-deletion timestamp; preserve evidence and resolve ambiguous rows before enabling archive filters.
- [ ] Fix list/detail/create validation reads, replace the broken PATCH update chain, and remove DELETE body validation.
- [ ] Give PATCH an update-specific schema: no create defaults, at least one allowed field, and no silent reset of omitted fields. Reject attempts to set ownership or deletion timestamps through ordinary input.
- [ ] Validate category references, nonnegative bounded integer prices, pagination, and IDs. Map recognized invalid references/conflicts into the documented error contract rather than raw database errors.
- [ ] Make DELETE a bodyless archive operation returning 204. Filter archived rows from public list/detail and pagination counts. Keep entitlement/history queries separate from public catalog queries.
- [ ] Keep current authenticated-creator assignment for this internal stage; update/archive require that instructor. These are provisional development routes, not the final business authorization model.
- [ ] Test create/read/update/archive, genuine PostgreSQL updates, title-only PATCH preserving category, empty PATCH rejection, bodyless DELETE, pagination/filter counts, invalid input, missing auth, wrong instructor, and missing records.

**Exit gate:** public catalog reads never expose archived records; course mutations work against PostgreSQL; category backfill is complete; response fields and price units are documented; all milestone tests pass.

## 7. Milestone 2: Enrollment and Protected Access

**Outcome:** a staff-issued, time-limited entitlement that survives renewal and can be revoked without deleting history.

- [ ] Complete/verify the schema prepared in Milestone 0: real term FK, stable enrollment identity, active/revoked status constraint, valid time ranges, and unique user/course/term. Seed approved global terms and expose read-only `GET /terms`.
- [ ] Implement one enrollment service shared by staff grants now and code redemption later. Student-facing authentication alone never authorizes creating an enrollment.
- [ ] Add grant and roster routes under a course. The current course instructor controls them in this internal stage; Milestone 3 replaces this with workspace owner/assigned-member authority.
- [ ] Grant request: registered `studentEmail`, `termId`, and optional `validFrom`/`validUntil`. Resolve the account only after staff authorization. Copy omitted dates from the term and persist the final window. Do not create a user, charge money, or infer payment from the course price.
- [ ] Reject grants to archived courses. Handle concurrent duplicate grants with the database unique constraint and return 409. A valid enrollment can have a different window from the term defaults.
- [ ] Add a staff-only enrollment PATCH for explicit status changes or window corrections. Student/course/term bindings are immutable. Reinstatement is an explicit staff action, not a side effect of submitting a duplicate grant.
- [ ] Add `GET /users/me/enrollments`, including the caller's current and historical enrollments with safe course details. A later-term renewal creates another row; it does not overwrite the earlier purchase.
- [ ] Implement and test the access rule in section 4, including staff preview. Inject/control time in tests; enforce both start and end boundaries and revoked status.
- [ ] Add a protected lesson-metadata read route under the course and call the same access service. Scope any lesson lookup to its parent course. Never expose raw video storage keys or pretend a metadata endpoint is secure video streaming.
- [ ] Keep the mandatory `lessons.videoId` relation intact. Use legitimate test-only video/lesson fixtures for authorization tests; do not insert dummy media into a real database. Uploads, playback URLs, processing, and lesson-authoring CRUD are separate video work.
- [ ] Test unauthorized grants/rosters, invalid terms/dates, concurrent duplicates, future/expired/revoked access, exact expiry denial, authorized staff preview, same-course next-term renewal, and archived-course access for an existing valid student.

**Exit gate:** enrollment state and dates determine student content access on the server; users cannot grant themselves paid access; renewal retains history; archiving does not revoke an existing entitlement. This validates access control, not the deferred video pipeline.

## 8. Milestone 3: Workspace Ownership

**Outcome:** the same backend safely serves both a solo teacher and a center.

### Ownership migration

- [ ] Create `spaces` and teacher-only `space_members`; enforce unique slugs, valid workspace types/statuses, and membership uniqueness.
- [ ] Approve an explicit mapping of existing courses to workspaces. Existing personal courses can be grouped into one solo workspace per instructor. Do not infer that real center-owned courses belong personally to their assigned teacher.
- [ ] Add nullable `courses.spaceId`, backfill using that mapping, validate all references, then enforce NOT NULL and an index supporting `(spaceId, deletedAt)`. Preserve course/enrollment IDs and enrollment windows.
- [ ] Keep categories and terms global. No term cloning, arbitrary term-owner assignment, or re-keying of enrollments is needed for this design.
- [ ] Coordinate the cutover with writes paused or an explicitly tested deployment transition. Do not allow new unowned courses or a fallback global query while backfill is in progress.

### Workspace behavior and authorization

- [ ] Implement restricted pilot `POST /spaces`: an authenticated, operator-allowlisted creator becomes owner; name/slug/type come from validated input, owner/status come from the server. Reject public self-provisioning outside that allowlist; use this only as a pilot gate, not a billing implementation.
- [ ] Add public workspace lookup with branding only, owner-only branding updates, and `GET /users/me/spaces` listing the caller's owned/staff workspaces with a computed owner/teacher role.
- [ ] Make slugs and workspace type immutable in MVP. Check URL/color/length formats for branding; return explicit public/private DTOs rather than raw space rows.
- [ ] Add owner-only teacher listing/addition/removal for centers. Require an existing account, reject duplicate membership, and reject attempts to add the owner as a teacher or remove the owner. Solo workspaces cannot add teachers.
- [ ] Add central workspace authorization that resolves current ownership/membership. A still-valid JWT must not retain staff permission after membership removal.
- [ ] Move course operations to workspace-scoped routes. Teachers create courses assigned to themselves; owners can assign themselves or a current member. Only owners can change instructor assignment, including an assignment-only PATCH on archived courses. Nobody can PATCH a course into another workspace.
- [ ] Add a private management course list: owners see all workspace courses, teachers only their assigned courses, with an explicit archived filter. This is separate from the public catalog.
- [ ] Upgrade grants, rosters, enrollment corrections, lesson reads, and staff preview to the authorization matrix. A public catalog does not imply access to content, teacher lists, or student data.
- [ ] Scope every nested resource lookup and mutation to the resolved workspace/course before acting. Wrong-workspace course, lesson, or enrollment IDs return 404; a matching instructor ID is never a substitute for current membership. Keep mutation authorization and scope in the same guarded operation/transaction.
- [ ] Preserve enrollments and courses on teacher removal. Confirm the owner can reassign retained courses, and valid students continue reading them without joining `space_members`.
- [ ] Apply active/suspended checks to protected access and business writes. Membership/branding management writes are also blocked while suspended; the owner's private workspace list can still show its status.
- [ ] Add a deployment-operator-only command for suspend/reactivate, usable while a workspace is suspended and not mounted as a public API. Restrict it to workspace status changes, log the operator/target/old and new state, and document its invocation and reversal in the operational handoff.
- [ ] Remove the entire old global `/courses` router, including detail, all mutation verbs, and nested enrollment/lesson paths added in Milestone 2. Do not retire only the list endpoint. Verify actual client usage before cutover; a real compatibility requirement needs an explicit migration decision, not an unguarded alias.

**Exit gate:** a teacher can own a solo workspace and teach at a separate center; center ownership is independent of instructor assignment; wrong-workspace requests cannot read private data or write; teacher removal immediately denies subsequent staff requests with the old token while retaining student access.

## 9. Final HTTP Contract

Paths below are the final contract, without an assumed `/api` prefix. The current app mounts its routers directly. If a deployment adds a prefix, apply it consistently and document it for the frontend.

Use the workspace slug consistently in nested paths and resolve its internal ID on the server. Course/enrollment/member IDs identify children; they never replace parent-scope checks.

| Route | Purpose and authority |
| --- | --- |
| Existing `/auth/*`, `GET /users/me` | Global identity using Bearer authentication; safe self-profile. |
| `GET /categories`, `GET /terms` | Global curated reference data. |
| `POST /spaces` | Operator-approved pilot user creates an owned workspace. |
| `GET /users/me/spaces` | Caller-owned/staff workspaces, not everyone else's membership list. |
| `GET /users/me/enrollments` | Caller's enrollment history across workspaces, paginated. |
| `GET /spaces/:slug` | Public active-workspace branding, no owner email or private settings. |
| `PATCH /spaces/:slug` | Owner changes permitted branding fields. |
| `GET /spaces/:slug/courses` | Public non-archived catalog; `categoryId`, `page`, `limit` filters. |
| `GET /spaces/:slug/courses/:courseId` | Public non-archived course metadata in this workspace. |
| `GET /spaces/:slug/manage/courses` | Owner/teacher management list, scoped by authority; `includeArchived`, `page`, `limit`. |
| `POST /spaces/:slug/courses` | Owner/current teacher creates a course in this workspace. |
| `PATCH /spaces/:slug/courses/:courseId` | Owner or currently assigned teacher; instructor reassignment owner-only. Archived courses accept only an owner's assignment-only PATCH. |
| `DELETE /spaces/:slug/courses/:courseId` | Same management authority; archive, never cascade deletion. |
| `GET /spaces/:slug/courses/:courseId/lessons` | Valid enrolled student or authorized staff preview, including retained archived content. |
| `GET /spaces/:slug/courses/:courseId/enrollments` | Owner/assigned-member roster, paginated. |
| `POST /spaces/:slug/courses/:courseId/enrollments` | Owner/assigned-member manual grant to a registered student. |
| `PATCH /spaces/:slug/courses/:courseId/enrollments/:enrollmentId` | Owner/assigned-member explicit correction/revocation/reinstatement. |
| `GET /spaces/:slug/members` | Owner-only teacher list. |
| `POST /spaces/:slug/members` | Owner adds a registered teacher by email. |
| `DELETE /spaces/:slug/members/:userId` | Owner removes teacher membership only. |

Contract rules:

- Single-resource success: bare object. Lists: `{ data: [...] }`; paginated lists also include the existing `pagination` fields (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`).
- GET/PATCH return 200, resource creation returns 201, and successful DELETE returns 204 without a body. Empty or invalid PATCH requests return 400.
- Errors use `{ error: { code, message, details? } }` from the existing error library. Use 400 for invalid input, 401 for missing/invalid authentication, 403 for missing authority/entitlement, 404 for missing or out-of-scope resources, and 409 for duplicate/lifecycle conflicts.
- Course DTO: `id`, `spaceId` in the final API, `title`, `description`, `categoryId`, integer `price`, and safe instructor identity (`id`, `name`). Archive state belongs in authorized management/library responses, not public catalog results.
- Enrollment DTO: stable identity, course/term references, status, dates, and safe course/workspace metadata needed by the student's library. Rosters expose student details only to the course's authorized staff. Never serialize password hashes, tokens, storage keys, or arbitrary joined user rows.
- Reject client-controlled owner/workspace/status fields where they are not part of that endpoint's contract. Check assignment permissions separately even when `instructorId` is syntactically valid.
- The workspace course/enrollment bindings are immutable. A URL/body ID from another workspace must not update anything or leak its existence through returned private fields.
- The pre-workspace `/courses` endpoints are provisional internal surfaces. Frontend handoff targets this final contract, including the removal of all global course paths.

## 10. Milestone 4: Isolation, Handoff, and Pilot

**Outcome:** evidence that the agreed backend works, not just completed CRUD checkboxes.

- [ ] Run real PostgreSQL integration tests with two owners, a teacher who belongs to one center and owns a solo workspace, a colleague teacher, an enrolled student, and an unrelated account.
- [ ] Verify cross-workspace list/detail/update/archive/roster/enrollment/lesson requests cannot cross scope, including when the same user legitimately belongs to both workspaces.
- [ ] Verify owner versus assigned-teacher permissions, colleague-course denial, invalid instructor assignment, duplicate slugs/memberships, solo membership rejection, owner-removal rejection, and duplicate enrollment races.
- [ ] Remove a teacher and retry with the same JWT: management must fail, courses/rosters must remain under owner control, and an existing student's valid content access must still succeed. Test separate student entitlement for the removed teacher and owner reassignment of an archived course without permitting content edits.
- [ ] Verify future, valid, exact-expiry, revoked, reinstated, archived-course, and suspended-workspace access. Exercise the operator command for suspend/reactivate; records/windows must remain unchanged and only still-valid enrollments regain access. Multiple term rows must not cause a valid entitlement to be overlooked.
- [ ] Verify public DTOs contain only branding/catalog fields; students can read only their own enrollment history; members cannot browse unrelated rosters; all old global course routes are gone.
- [ ] Test empty-DB setup and the selected populated-DB migration path on a clone. Check row counts, IDs, category mappings, workspace mappings, and unchanged entitlement windows. Confirm the schema generator has no unexplained pending changes.
- [ ] Hand the frontend developer final request/response examples, validation/error examples, Bearer-auth handling, date/price units, pagination behavior, archived-library behavior, and the correct API origin/CORS configuration. Do not implement frontend screens in this task.
- [ ] Rehearse in isolated staging with test-only video/lesson fixtures: approved owner creates center -> teacher registers and is added -> teacher creates course -> test harness attaches lesson fixtures -> student registers -> staff grants enrollment -> student reads protected lesson metadata -> teacher is removed -> student retains access -> owner reassigns course. This proves authorization and record retention, not a live paid-video teaching flow; do not seed dummy media into a real pilot database.
- [ ] Approve the known limitations before rollout: no automated payment verification, no public paid onboarding, no complete invitation flow, and no secure video pipeline delivered by this plan. Keep pilot account creation controlled.

Run application checks from the backend package, not a nonexistent root npm workspace. From the repository root, once the test script has been added:

```powershell
npm --prefix apps/backend run type-check
npm --prefix apps/backend run build
npm --prefix apps/backend test
```

Migration generation/replay commands must use the selected migration lineage and the `apps/backend` working directory. Do not substitute an unreviewed `drizzle-kit push` for migration verification.

**Exit gate:** all automated checks and the manual scenario pass; migration/restore evidence is recorded; the frontend contract is shared; the pilot is limited to the validated backend capabilities. This is not a claim that the deferred full product is production-ready.

## 11. Later Work, Not Hidden Requirements

- Redemption-code issuance/redemption for offline-paid student enrollment, using the same grant rules and atomic duplicate protection.
- Paid workspace onboarding: choose solo/center and plan -> configure workspace -> pay -> activate. Plan limits, provider/webhook handling, renewal, cancellation, and grace-period policy need their own design.
- Real teacher invitations, additional staff roles, owner transfer, and workspace type upgrades.
- Private catalogs, drafts/publication, a global directory, curriculum filters, and workspace-specific category/calendar settings if users need them.
- Lesson authoring, upload/processing/playback, signed media access, device limits, progress, homework, grading, and lesson unlocking.
- Custom domains, subdomains/TLS, advanced branding, and removal of Droos Hub branding.
- Explicit media retention and account/workspace deletion policies. Never translate teacher removal, course archiving, or term defaults into automatic media/purchase deletion.

## 12. Decisions That Need Real Evidence

The implementation should not guess these from source code:

- [ ] Which databases and existing API consumers must be preserved, and whether any specific development database is explicitly disposable.
- [ ] The correct mapping of existing prices, category strings, deletion timestamps, term IDs, enrollment windows/statuses/timezones, and existing business ownership.
- [ ] The initial curated categories/academic terms and the operator-approved pilot accounts.
- [ ] Whether the deliberate MVP defaults in section 3 are accepted for the pilot, especially public workspace metadata and manual staff grants. Changing these requires updating the relevant contracts and tests, not expanding unrelated milestones.

Start with the database inventory and testable runtime. Then deliver the course, enrollment, and workspace slices in order. Do not add subscriptions or homework just because the architecture can eventually support them.
