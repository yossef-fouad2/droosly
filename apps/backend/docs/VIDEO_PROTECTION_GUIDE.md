# Video Protection Guide — Droos Hub

A build guide for protecting course videos from downloading, link-sharing, and
piracy. This expands **Phase 4 (Video pipeline)** and **Phase 5 (Content
protection)** of `apps/webapp/IMPLEMENTATION_PLAN.md` into concrete steps you
can follow while you learn.

> **Read this first.** Right now the repo has no `docs/` code for this yet —
> no R2 storage, no job queue, no transcode worker, no key endpoint. This
> document is the *how-to* for building that. Follow it **after** Phases 0–3
> (foundation, courses API, semester model, deploy). Don't jump here early —
> the access-check function from Phase 2 is a hard dependency.

---

## 1. The honest threat model

Before any code: know what is actually possible. No system stops everything.
Anyone who tells you otherwise is selling something.

| Threat | Can you stop it? | The tool that does it |
|---|---|---|
| Downloading the video file directly | **Yes** | Encrypted HLS — the file is chopped into encrypted chunks, there is no single file to grab |
| Sharing the playback link with friends | **Yes** | Short-lived **signed session URLs** — the link dies in minutes |
| Ripping with browser dev-tools or `yt-dlp` | **Mostly** | Encryption raises the bar a lot; without DRM a *determined* attacker can still capture the key (accepted tradeoff — see below) |
| Screen recording on **web** (OBS, etc.) | **No — impossible** | Can only be made *traceable* with a personal watermark |
| Screen recording on **mobile** | **Mostly** | `FLAG_SECURE` (Android) blocks it; iOS detects capture and pauses |
| One account shared with a WhatsApp group | **Yes, largely** | Device cap (2 devices) + single concurrent session |

**The core decision (from the plan): no DRM.** DRM (Widevine/FairPlay) is the
only thing that truly hides the decryption key from a technical attacker, but
it is heavy, costly, and overkill for your scale. Instead you use **encrypted
HLS + an access-gated key endpoint**. This means:

- Casual downloading and link-sharing: **solved**.
- A skilled attacker who is a paying student: can eventually rip one copy. You
  don't stop this — you make it **traceable** with a watermark so it points
  back to them, and you catch sharing with weekly detection queries.

That honesty is the point. You are building *strong, traceable protection*, not
an unbreakable vault.

---

## 2. The tools, and why each one

| Tool | Job | Why this one |
|---|---|---|
| **FFmpeg** | Transcode raw upload → 3 quality rungs + encrypt segments with AES-128 | Industry standard, free, does transcoding *and* encryption in one pass |
| **Cloudflare R2** | Store the encrypted segments | Storage ~$0.015/GB-month and **egress is free** — this is why the whole cost model works. S3-compatible API |
| **Postgres `jobs` table** | Queue transcode work | You process ~15 lessons/week. A `jobs` table + a polling worker is enough. RabbitMQ/Redis would be complexity you don't need |
| **The access-check function** (Phase 2) | Decide "is this user allowed?" | Built once in Phase 2, reused by the session endpoint *and* the key endpoint. Never duplicated |
| **Signed session URLs** | Time-limited, path-scoped access to the playlist | Stops link-sharing without killing CDN caching (scope to a *prefix*, not per-segment) |
| **hls.js / Shaka** (web) + **video_player / better_player** (Flutter) | Play encrypted HLS | Native HLS players that fetch the AES key from your endpoint automatically |
| **Watermark overlay** | Burn student identity over playback | The only defense against screen recording — makes leaks traceable |

Install FFmpeg on the server (Phase 3 box). Verify: `ffmpeg -version`.

---

## 3. File architecture

Add these folders to `apps/backend/src/`. The guiding rule from the plan:
**never call the storage SDK or ffmpeg directly from a route** — wrap each in
one module so you have a single place to change later.

```
apps/backend/src/
├─ storage/
│  ├─ index.ts          # interface: put(), get(), signedUrl(), delete()
│  └─ r2.ts             # the R2/S3 implementation behind that interface
├─ jobs/
│  ├─ queue.ts          # enqueue() + claimNext() against the jobs table
│  └─ worker.ts         # long-running poller: claim a job, run it, mark done/failed
├─ media/
│  ├─ transcode.ts      # ffmpeg wrapper: raw file → 3 rungs + encrypted HLS
│  ├─ upload.routes.ts  # presigned multipart upload URLs (browser → R2 direct)
│  ├─ playback.routes.ts# POST /playback/session → signed master-playlist URL
│  └─ key.routes.ts     # GET /keys/:videoId → AES key, ONLY after access check
├─ access/
│  └─ canWatch.ts       # THE access-check function (from Phase 2), reused here
└─ ... (existing: db, lib, middleware, routes, services, validation)
```

### How it hooks into what you already have

- **`src/db/schema.ts`** — add a `jobs` table (`id`, `type`, `payload`,
  `status`, `attempts`, `lockedAt`, `error`, `createdAt`) and add columns to the
  existing `videos` table: `masterPlaylistKey`, `keyId` (which AES key), and
  keep the existing `status` (`uploaded` → `processing` → `ready` / `failed`).
  Every change is a **migration** — edit schema, generate, commit the SQL.
- **`src/index.ts`** — mount the new routers next to the existing ones:
  `app.use("/media", uploadRouter)`, `app.use("/playback", playbackRouter)`,
  `app.use("/keys", keyRouter)`. All behind `requireAuth`.
- **`src/middleware/requireAuth.ts`** — reuse as-is for the new routes.
- **`access/canWatch.ts`** — this is the Phase 2 function (enrolled? inside
  validity window? device allowed?). The session route and the key route both
  call it. This is the whole protection model: **decision** (your API) stays
  separate from **delivery** (the key), so a DRM license server could slot in
  later without a rewrite.

> ⚠️ Auth note (not for this task): your existing auth is inconsistent —
> `requireAuth` reads `Authorization: Bearer`, but `/auth/tokenIsValid` reads
> `x-auth-token`. Pick one before you build on top. Flagging only; don't fix here.

The worker (`jobs/worker.ts`) runs as a **separate process** from the API
(`npm run worker`), so a heavy transcode never blocks student requests. Run it
`nice`d.

---

## 4. Playback flow, end to end

This is the sequence every play follows. Notice the access check runs **twice** —
once to hand out the playlist, once to hand out the key. That double gate is
deliberate.

```
  PLAYER (Flutter / web)                 YOUR API                      R2
  ───────────────────────               ─────────                     ────
  1. POST /playback/session  ───────▶  canWatch()? ──┐
     (lessonId + auth token)           enrolled +    │
                                       in window +   │
                                       device ok +   │
                                       session slot  │
  2.  ◀── signed master URL ──────────────────────── ┘
      (scoped to this lesson's
       path prefix, expires ~15 min)

  3. GET master.m3u8         ─────────────────────────────────────▶  playlist
     (using signed URL)      ◀─────────────────────────────────────  returned
     playlist says: segments are AES-128, key is at /keys/:videoId

  4. GET encrypted segments  ─────────────────────────────────────▶  .ts chunks
                             ◀─────────────────────────────────────  (encrypted)

  5. GET /keys/:videoId      ───────▶  canWatch() AGAIN? ──┐
     (auth token)                      still allowed?      │
  6.  ◀── AES-128 key ──────────────────────────────────── ┘

  7. Player decrypts segments with the key and plays. 🎬
```

Key rules baked into this flow:
- **Sign a session scoped to a path prefix, not each segment.** Per-user
  segment URLs destroy CDN caching and make you pay origin bandwidth per
  student. One signed prefix per session.
- **The AES key never sits in the bucket** next to the video. It lives in your
  DB / a secrets store and is only ever served by the gated key endpoint.
- **The key endpoint re-runs `canWatch()`** — a leaked playlist URL is useless
  if the user's access has expired.

---

## 5. Step-by-step build order (Phase 4 → Phase 5)

Do these in order. Each is testable on its own — don't move on until the test
passes.

### Phase 4 — the pipeline

1. **Create an R2 bucket.** Get credentials. Store them in the server `.env`
   (never in git). — *Test:* upload a text file via the dashboard, confirm it's there.
2. **Build the storage interface** (`storage/index.ts` + `storage/r2.ts`) with
   `put` / `get` / `signedUrl` / `delete`. — *Test:* a tiny script that puts a
   file and reads it back through your interface (not the raw SDK).
3. **Presigned multipart upload** (`media/upload.routes.ts`). The teacher's
   browser/app uploads **straight to R2**; the file never passes through your
   API. Multipart = resumable. — *Test:* upload a 2 GB file, kill your wifi
   mid-upload, resume it, confirm it completes. This is not optional — Egyptian
   home connections drop, and a non-resumable upload restarts from zero.
4. **Write the teacher recording guide** — OBS, 720p, CRF 23, 20 fps for
   whiteboard work. One page. Turns a 2.5 GB file into ~500 MB. Biggest single
   win in the phase for zero code.
5. **The `jobs` table + worker** (`jobs/`). A row has `status`, `attempts`,
   `lockedAt`. Worker polls, claims one atomically (row lock), runs it. — *Test:*
   enqueue a fake job, watch the worker pick it up and mark it done.
6. **The transcode worker** (`media/transcode.ts`). ffmpeg produces 360p / 480p
   / 720p rungs + an HLS master playlist, uploads to R2, flips `videos.status`
   to `ready`. — *Test:* a short clip goes in, a playable HLS set comes out in R2.
7. **Handle failure properly:** retries with backoff, a `failed` status with the
   error stored, a way to requeue by hand. — *Test:* feed it a corrupt file,
   confirm it lands in `failed` with a readable error, not a crashed worker.
8. **Measure a real lesson.** Push one actual 1.5-hour teacher recording
   through and **write down the output sizes** in `docs/decisions.md`. Every
   cost estimate depends on this one number.
9. **Delete the raw master after a successful encode** (or move to R2 Infrequent
   Access). Keeping raw uploads forever is the one thing that can quietly triple
   your storage bill.

**Phase 4 done when:** a teacher uploads, walks away, and a playable encrypted
HLS stream exists minutes later without you touching anything.

### Phase 5 — protection

10. **Encrypted HLS.** Turn on AES-128 in the ffmpeg step (`-hls_key_info_file`).
    ffmpeg encrypts each segment; the key is written to your DB, **not** the
    bucket. — *Test:* download a `.ts` segment directly from R2 and confirm it
    will **not** play in VLC without the key.
11. **The key endpoint** (`media/key.routes.ts`). Serves the AES key only after
    `canWatch()` passes. — *Test:* an unenrolled or expired user gets **403**;
    a valid user gets the key.
12. **Signed session, path-scoped** (`media/playback.routes.ts`). — *Test:* copy
    a signed master URL, wait for it to expire, confirm it **403s**; confirm
    sharing it to a second account still fails the key check.
13. **Device cap:** 2 registered devices per account (you already have the
    unique constraint on `devices(userId, deviceId)`). Changing a device needs a
    14-day cooldown or admin unlock. — *Test:* register 2 devices, confirm the
    3rd is refused.
14. **One concurrent session** per account — a second play request kills the
    first. — *Test:* start playback on device A, start on device B, confirm A stops.
15. **Personalised watermark** — see §6. Student name + last-4 of phone,
    semi-transparent, slowly moving.
16. **Capture blocking on mobile** — see §6.
17. **Weekly sharing-detection query** — a manual review list: accounts playing
    from several cities, many hours/day, or many device fingerprints. No ML
    needed. — *Test:* run it, eyeball the output.

**Phase 5 done when:** you can hand a teacher an honest description of the
protection without promising anything is unbreakable.

---

## 6. Player protection — both clients

The backend above is **identical** for both. Only this section differs.

### Flutter (mobile) — the strong surface

- **Block screenshots & screen recording (Android):** set `FLAG_SECURE` on the
  activity (e.g. via the `flutter_windowmanager` package or a tiny platform
  channel). The OS itself refuses to capture the screen — recordings come out black.
- **Detect capture (iOS):** iOS can't hard-block, but you can read
  `UIScreen.main.isCaptured` and **pause playback + show an overlay** while a
  recording/mirroring is active. Resume when it stops.
- **Moving watermark overlay:** a semi-transparent `Text` (student name +
  last-4 phone) positioned over the player, moving slowly every few seconds so
  it can't be cropped out. Cheap to build, disproportionately effective on teens.
- **Single concurrent session + batched progress:** report watch progress
  **every 30 seconds**, not every second — batch it. The server enforces the
  one-session rule.

Result on mobile: downloading blocked, link-sharing blocked, screen-recording
**blocked on Android / disrupted on iOS**, and any leak carries the student's name.

### Next.js (web) — the honest, weaker surface

- **Player:** `hls.js` (or Shaka Player). Point it at the signed master URL; it
  fetches the AES key from your key endpoint automatically. Encrypted HLS plays,
  direct download doesn't.
- **Watermark:** a CSS/canvas overlay with the student name + last-4 phone,
  low opacity, repositioned by JS every few seconds. Same purpose as mobile:
  traceability.
- **Be honest about the ceiling.** The web browser **cannot** block screen
  recording — no API exists. And because there's no DRM, a technical user with
  dev-tools can reach the decryption key. So on web you lean on the layers that
  *do* work there: signed sessions (no link-sharing), device cap + single
  session (no account-sharing), and the watermark (traceable leaks).

**Practical stance:** treat mobile as the primary, protected way to watch. Offer
web for convenience, knowing it's the softer target, and rely on
watermark + device/session caps to contain the damage.

---

## 7. Protection layers — checklist & what each actually buys you

| Layer | What it actually buys you |
|---|---|
| ☐ Encrypted HLS (AES-128) | No downloadable file exists — kills casual ripping |
| ☐ Key endpoint gated by `canWatch()` | The key — and thus playback — dies the moment access expires |
| ☐ Signed, path-scoped session URL | A shared link is useless within ~15 min; caching still works |
| ☐ Device cap (2/account) | Stops one login spreading across a WhatsApp group |
| ☐ Single concurrent session | Stops simultaneous sharing of one active account |
| ☐ Personalised watermark | Makes any screen-recorded leak point back to the leaker |
| ☐ `FLAG_SECURE` / `isCaptured` (mobile) | Actually blocks/disrupts recording on phones |
| ☐ Weekly sharing-detection query | Catches the accounts the automated layers missed |

No single layer is the answer. The **stack** is the protection.

---

## 8. Verification — prove it works

Run these once the pipeline and protection are built. If any fails, that layer
isn't done.

1. **Pipeline:** push one real 1.5-hour lesson end to end. A `ready` encrypted
   HLS stream appears in R2 with no manual steps. Record the output sizes.
2. **No naked file:** download a `.ts` segment straight from R2 → it will **not**
   play in VLC (no key).
3. **Expired link:** grab a signed master URL, wait past expiry → **403**.
4. **Access gate:** call the key endpoint as an unenrolled / expired-enrollment
   user → **403**. As a valid user → key returned.
5. **Device cap:** register 2 devices, try a 3rd → refused.
6. **Concurrency:** play on device A, then device B → A stops.
7. **Watermark:** on both clients, confirm the student's name is visible over
   the video and moves.
8. **Mobile capture:** on Android, a screen recording of playback comes out
   black. On iOS, playback pauses while mirroring/recording.

---

## Deliberately not here

- **DRM** — excluded by design (see §1). Revisit only if a teacher's content is
  high-value enough to justify the cost and complexity.
- **Payment gateway, CDN, load balancers** — out of scope per the main plan.
- The **auth header inconsistency** noted in §3 — flagged, fix separately.

Everything above solves a problem you actually have. Don't add a layer until you
can name the leak it stops.
