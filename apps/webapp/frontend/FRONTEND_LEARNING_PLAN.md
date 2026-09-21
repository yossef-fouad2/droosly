# Frontend Learning Plan — Droos Hub Webapp

Learn Next.js **by building the real webapp**, one small step at a time. Every
box is roughly one sitting and one commit. Tick it when it works in the browser.

**How to use this:** work top to bottom, never skip. When every box in a phase
is ticked *and* you've seen it work at `http://localhost:3000`, the phase is
done. If a phase takes twice as long as you expected, that's normal.

## What you're working with

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind v4 at
  `apps/webapp/frontend` — currently the default `create-next-app` starter.
- **Backend:** Express API on port 8000. Endpoints that already exist:
  `POST /auth/signup`, `POST /auth/login`, `GET /courses`, `GET /courses/:id`.
  Auth uses a JWT sent as `Authorization: Bearer <token>`.

## Setup you do once

- [ ] Open a terminal in `apps/backend`, run `npm run dev`, confirm it says it's
      listening on port 8000.
- [ ] Open a second terminal in `apps/webapp/frontend`, run `npm run dev`.
- [ ] Visit `http://localhost:3000` and see the Next.js starter page.
- [ ] Keep both terminals running while you work. You'll need the backend live
      from Phase 3 onward.

---

## Phase 0 — Understand the starter (½ day)

Goal: know what every file in the starter does before you change anything.

- [ ] Open `app/layout.tsx`. Read it. Understand: this wraps **every** page. The
      `{children}` is where each page gets injected.
- [ ] Open `app/page.tsx`. This is the route `/`. 
- [ ] Delete the starter JSX inside `app/page.tsx` and replace it with:
      ```tsx
      export default function Home() {
        return <h1>Droos Hub</h1>;
      }
      ```
- [ ] Save, look at the browser — it should hot-reload and show "Droos Hub".
      **This is your first win.**
- [ ] Open `app/globals.css` — this is where Tailwind is imported.
- [ ] Add a Tailwind class to prove styling works:
      `<h1 className="text-3xl font-bold text-blue-600">Droos Hub</h1>`.
      Confirm it turns big, bold, and blue.
- [ ] Commit: `git commit -m "frontend: replace starter home page"`.

**Done when:** the home page shows your own styled text.
**Learned:** `layout.tsx` wraps pages, `page.tsx` is a route, Tailwind works via classes.

---

## Phase 1 — Routing & navigation (2–3 days)

Goal: understand that **folders under `app/` become URLs**.

### Static pages
- [ ] Create `app/login/page.tsx` with a default-exported component returning
      `<h1>Login</h1>`. Visit `/login` — it works with zero config.
- [ ] Create `app/signup/page.tsx` → `<h1>Sign up</h1>`. Visit `/signup`.
- [ ] Create `app/courses/page.tsx` → `<h1>Courses</h1>`. Visit `/courses`.

### Dynamic route
- [ ] Create `app/courses/[id]/page.tsx`. The `[id]` folder means "any value".
      Read the param:
      ```tsx
      export default async function CoursePage({
        params,
      }: {
        params: Promise<{ id: string }>;
      }) {
        const { id } = await params;
        return <h1>Course {id}</h1>;
      }
      ```
- [ ] Visit `/courses/123` and `/courses/abc` — both render, showing the id.

### Navigation
- [ ] In `app/layout.tsx`, add a nav bar above `{children}` using `next/link`:
      ```tsx
      import Link from "next/link";
      // inside the body, above {children}:
      <nav className="flex gap-4 p-4 border-b">
        <Link href="/">Home</Link>
        <Link href="/courses">Courses</Link>
        <Link href="/login">Login</Link>
      </nav>
      ```
- [ ] Click between pages. Confirm the browser does **not** fully reload (no
      white flash) — that's client-side navigation. Never use a plain `<a>` for
      internal links.
- [ ] Commit.

**Done when:** you can click through Home → Courses → a course → Login without a
full page reload.
**Learned:** static routes, dynamic `[id]` routes, reading params, `<Link>`.

---

## Phase 2 — Server vs Client Components (3–4 days)

**The most important concept in Next.js. Go slow — most beginners trip here.**

The rule:
- Every component is a **Server Component by default** — runs on the server, can
  fetch data, sends only HTML. **Cannot** use `useState`, `onClick`, or anything
  browser-only.
- Add `"use client"` at the very top of the file to make it a **Client
  Component** — runs in the browser, **can** use state and events.

### See a client component work
- [ ] Create `components/` folder. Add `components/Counter.tsx`:
      ```tsx
      "use client";
      import { useState } from "react";
      export default function Counter() {
        const [n, setN] = useState(0);
        return (
          <button onClick={() => setN(n + 1)} className="border px-3 py-1 rounded">
            Clicked {n} times
          </button>
        );
      }
      ```
- [ ] Import and drop `<Counter />` into `app/page.tsx`. Click it — the number
      goes up. This only works because of `"use client"`.

### See why the boundary exists
- [ ] **On purpose**, remove the `"use client"` line from `Counter.tsx`. Save.
      Read the error Next gives you.
- [ ] Put `"use client"` back. You just learned the boundary by hitting it.

### Understand the split
- [ ] Add a comment `// SERVER component — no useState allowed here` at the top
      of `app/courses/page.tsx` (you'll fetch data in it next phase).

- [ ] Commit.

**Done when:** you can say in one sentence why `Counter` needs `"use client"`
but a data-fetching page does not.
**Learned:** the server/client boundary — the thing that makes Next.js different
from plain React.

---

## Phase 3 — Fetching real data from your API (1 week)

Goal: put real courses from your database on screen. Backend must be running.

### Wire up the API base URL
- [ ] Create `frontend/.env.local` with:
      ```
      NEXT_PUBLIC_API_URL=http://localhost:8000
      ```
- [ ] Confirm `.env.local` is in `.gitignore` (it should be by default). Never
      commit it.

### One place for all fetches
- [ ] Create `lib/api.ts`:
      ```ts
      const BASE = process.env.NEXT_PUBLIC_API_URL;

      export async function apiGet<T>(path: string): Promise<T> {
        const res = await fetch(`${BASE}${path}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
        return res.json();
      }
      ```
      (You'll add `apiPost` and the auth header in Phase 4.)

### Show the courses list
- [ ] In `app/courses/page.tsx` (Server Component), fetch and render:
      ```tsx
      import { apiGet } from "@/lib/api";
      export default async function CoursesPage() {
        const courses = await apiGet<any[]>("/courses");
        return (
          <ul>
            {courses.map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ul>
        );
      }
      ```
      (Adjust field names to match what your API returns — check the response.)
- [ ] See real course titles from your Postgres DB on screen.

### Handle the single course + errors
- [ ] In `app/courses/[id]/page.tsx`, fetch `/courses/:id` and show its details.
- [ ] Create `app/courses/[id]/not-found.tsx` with a "Course not found" message.
- [ ] In the page, call Next's `notFound()` when the API returns 404:
      ```tsx
      import { notFound } from "next/navigation";
      // if the fetch 404s: notFound();
      ```
- [ ] Visit a real id → details show. Visit a fake id → your not-found page shows.

### Loading state
- [ ] Create `app/courses/loading.tsx` returning `<p>Loading courses…</p>`.
      Next shows it automatically while the server component fetches.
- [ ] Commit.

**Done when:** `/courses` lists real courses, a real id shows details, a bad id
shows your not-found page.
**Learned:** server-side fetching, env vars, one fetch wrapper, loading & 404 UI.

---

## Phase 4 — Forms & authentication (1–2 weeks)

The first genuinely hard part. Small steps, test each one.

### Add POST to the API helper
- [ ] Extend `lib/api.ts` with a post function:
      ```ts
      export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
        const res = await fetch(`${BASE}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
        return res.json();
      }
      ```

### Signup form
- [ ] Make `app/signup/page.tsx` a Client Component (`"use client"`), with
      `useState` for each field (name/email/password — match your API).
- [ ] On submit, call `apiPost("/auth/signup", {...})`. Log the response.
- [ ] Show a success message or an error message on screen (don't leave the user
      guessing).
- [ ] Test: sign up a new user, confirm it appears in your database.

### Login form
- [ ] Build `app/login/page.tsx` the same way, calling `apiPost("/auth/login", {...})`.
- [ ] Confirm the response contains a JWT token. Log it to verify.

### Store the token & track the user
- [ ] Decide storage: use `localStorage` for now (simplest while learning).
      Write in `docs/decisions.md`: "Token in localStorage for now; move to
      httpOnly cookie before launch for security." Note the tradeoff so you
      remember to harden it.
- [ ] Create `components/AuthProvider.tsx` (`"use client"`) — a React Context
      holding `{ user, token, login(), logout() }`. On `login()`, save the token
      to `localStorage` and set state. On `logout()`, clear both. On mount, read
      the token back from `localStorage` so a refresh keeps you logged in.
- [ ] Wrap the app in `<AuthProvider>` inside `app/layout.tsx`.
- [ ] Make the login form call the context's `login()` on success.

### Reflect auth in the UI
- [ ] In the nav (`layout.tsx` or a client nav component), show the user's email
      + a Logout button when logged in; show Login/Signup links when logged out.
- [ ] Test the full loop: sign up → log in → see your email → **refresh the page,
      stay logged in** → log out → links flip back.

### Protect a route
- [ ] Pick a page (e.g. a new `app/dashboard/page.tsx`). If there's no token,
      redirect to `/login`. Learn `useRouter().push("/login")` from
      `next/navigation` in a client component.
- [ ] Test: visit `/dashboard` logged out → bounced to login. Logged in → stays.
- [ ] Commit.

**Done when:** you can sign up, log in, stay logged in across a refresh, see your
email in the nav, get redirected from a protected page when logged out, and log
out.
**Learned:** controlled forms, Context, JWT auth flow, sending credentials,
route protection.

---

## Phase 5 — Real UI, components & RTL (1 week)

Make it look like a product and read correctly in Arabic.

### Reusable components
- [ ] `components/Button.tsx` — one styled button used everywhere (variants:
      primary/secondary via a prop).
- [ ] `components/Input.tsx` — one styled input with a label. Use it in both forms.
- [ ] `components/CourseCard.tsx` — title, teacher, price. Use it in the courses grid.
- [ ] Refactor the courses list into a responsive grid:
      `className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"`.

### Layout
- [ ] Build a real header (logo/name + nav + auth state) and a footer in `layout.tsx`.

### Arabic + RTL (do it now, not later)
- [ ] In `app/layout.tsx`, set `<html lang="ar" dir="rtl">`.
- [ ] Reload and confirm the layout **mirrors** (nav flows right-to-left).
- [ ] Fix any spacing that assumed left-to-right (use Tailwind logical classes
      like `ps-4`/`pe-4` instead of `pl-4`/`pr-4` where it matters).

### Responsive
- [ ] Open dev-tools device view, test at phone width. Most students are on
      phones — the courses grid and forms must work there.
- [ ] Commit.

**Done when:** the site looks like a product on a phone and reads correctly in Arabic.
**Learned:** component reuse, Tailwind layout/grid, RTL, responsive design.

---

## Phase 6 — Video player (2 weeks) — *needs backend Phases 4–5 first*

⚠️ **Do not start until the backend video pipeline + key endpoint exist** — see
`apps/backend/docs/VIDEO_PROTECTION_GUIDE.md`. The web player is the **weaker
surface** (no way to block screen recording in a browser); build it knowing that.

- [ ] Install a player: `npm install hls.js`.
- [ ] Create `components/VideoPlayer.tsx` (`"use client"` — it touches the
      `<video>` DOM element and needs `useEffect`).
- [ ] Get a signed playback URL: `apiPost("/playback/session", { lessonId }, token)`.
- [ ] Point hls.js at the returned master playlist URL. It fetches the AES key
      from your key endpoint automatically. Confirm an enrolled lesson plays.
- [ ] Add a **watermark overlay**: an absolutely-positioned div over the video
      with the student's name + last-4 of phone, low opacity. Move it to a new
      random position every ~5 seconds with `setInterval`. This is the only real
      anti-recording measure on web.
- [ ] Report **watch progress** every 30 seconds (not every second) —
      `apiPost("/progress", {...}, token)` on an interval, cleared on unmount.
- [ ] Show **locked vs unlocked** lesson states based on the enrollment check
      (unenrolled → a locked card, not a player).
- [ ] Test: enrolled student plays an encrypted lesson with their name
      watermarked and moving; closing and reopening resumes near where they stopped.
- [ ] Commit.

**Done when:** an enrolled student plays an encrypted lesson with a moving
personal watermark, and progress is saved.
**Learned:** client-side media, integrating a player, overlays, calling a
protected API.

---

## Order vs the backend

| Frontend phase | Backend it needs | Status |
|---|---|---|
| 0–2 (routing, components) | none | start today |
| 3 (fetch courses) | `GET /courses` | ✅ exists |
| 4 (auth) | `POST /auth/signup`, `/auth/login` | ✅ exists |
| 5 (UI/RTL) | none | anytime |
| 6 (player) | video pipeline + `/playback/session` + key endpoint | ⏳ build backend Phases 4–5 first |

**You can do Phases 0–5 with the backend you already have.** Only Phase 6 waits.

---

## What NOT to learn yet

Redux, Zustand, React Query/SWR, SSR caching strategies, `next/image` tricks,
middleware, i18n libraries, animation libraries, TypeScript generics gymnastics.

Every one solves a problem you don't have yet. Plain `fetch`, `useState`, and
Context carry you cleanly through Phase 5. Add a tool only when you can name the
exact pain it removes.

## The one rule that matters most

**See it in the browser after every box.** Frontend work is visible in a way
backend work isn't — use that fast feedback loop. If you can't see the change,
the box isn't ticked yet.
