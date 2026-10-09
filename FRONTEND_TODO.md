# Frontend TODO — connecting to the backend

For the frontend dev working on the **landing page** and **auth**. This is a monorepo:

```
droos hub/
├─ apps/backend          ← Express 5 + Drizzle + Postgres (JWT auth)
└─ apps/webapp/frontend  ← Next.js 16 (App Router, React 19, Tailwind v4)
```

You can build the landing page and the auth UI entirely against the contract below without waiting on backend internals. Where the backend isn't ready yet, it's called out under **Blockers**.

---

## 1. Running both apps

| App | Command (from its folder) | URL |
|-----|---------------------------|-----|
| backend | `npm run dev` | `http://localhost:8000` |
| frontend | `npm run dev` | `http://localhost:3000` |

> ⚠️ **Port clash.** `next dev` uses **3000**. The backend `.env` currently says `PORT=3000` (the code falls back to 8000 if unset). The API must be pinned to **8000** so both run at once. (Backend task — see Blockers.)

In the frontend, put the base URL in an env var, never hardcode it:

```
# apps/webapp/frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 2. Auth contract

Base path: `/auth`

### `POST /auth/signup`
```jsonc
// request body
{ "email": "a@b.com", "password": "min 8 chars", "name": "Full Name" }

// 201 response  — NOTE: no token here, you must log in afterwards
{ "message": "User registered successfully",
  "user": { "id": 1, "name": "Full Name", "email": "a@b.com", "createdAt": "2026-..." } }
```

### `POST /auth/login`
```jsonc
// request body
{ "email": "a@b.com", "password": "..." }

// 200 response
{ "message": "Login successful",
  "user": { "id": 1, "name": "...", "email": "...", "createdAt": "..." },
  "token": "<JWT>" }   // expires in 4h
```

### Using the token
All protected endpoints expect:
```
Authorization: Bearer <token>
```

### `POST /auth/tokenIsValid`
Returns `true` / `false`. ⚠️ Inconsistent: it reads the token from an **`x-auth-token`** header (not `Bearer`). Prefer not to rely on it — decide session validity by whether protected calls return `401`.

---

## 3. Error shape (every endpoint)

Failures always come back as this one shape — build one error handler around it:

```jsonc
{ "error": {
    "code": "VALIDATION_FAILED",   // see codes below
    "message": "Validation failed",
    "details": { "email": ["A valid email is required"] }  // optional, per-field
} }
```

| code | HTTP | meaning |
|------|------|---------|
| `VALIDATION_FAILED` | 400 | bad input — `details` has per-field messages |
| `UNAUTHENTICATED` | 401 | missing/invalid token |
| `INVALID_CREDENTIALS` | 401 | wrong email/password |
| `FORBIDDEN` | 403 | not allowed (e.g. other teacher's course) |
| `NOT_FOUND` | 404 | |
| `CONFLICT` | 409 | |
| `INTERNAL` | 500 | |

**Form validation rules to mirror on the client** (from the backend Zod schemas):
- `email` — valid email
- `password` — signup: **min 8 chars**; login: non-empty
- `name` — non-empty

---

## 4. Other endpoints you can already use

### `GET /categories`  (public — great for the landing page)
```jsonc
[ { "id": 1, "slug": "math", "nameEn": "Mathematics", "nameAr": "الرياضيات" } ]
```

### `GET /courses?page=1&limit=10&categoryId=2`  (public)
```jsonc
{ "data": [
    { "id": 1, "title": "...", "description": "...", "categoryId": 2, "price": 100, "workspaceId": 3 }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5,
                  "hasNextPage": true, "hasPrevPage": false } }
```
- `GET /courses/:id` → single course object.
- `POST /courses`, `PATCH /courses/:id`, `DELETE /courses/:id` → require `Bearer` **and** the user to own a workspace (teacher-only). Not needed for landing/auth.

---

## 5. Schema — share these TypeScript types

These mirror the backend DB tables. Suggest a shared file the frontend imports from, e.g. `apps/webapp/frontend/app/lib/api-types.ts`:

```ts
// Mirrors apps/backend/src/db/schema.ts — keep in sync by hand for now.

export type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;   // ISO timestamp
};
// passwordHash is NEVER sent to the client.

export type Category = {
  id: number;
  slug: string;
  nameEn: string;
  nameAr: string;
};

export type Course = {
  id: number;
  title: string;
  description: string;
  categoryId: number;
  price: number;        // integer
  workspaceId: number;
};

export type Workspace = {
  id: number;
  ownerId: number;
  nameEn: string;
  nameAr: string;
  slug: string;
  createdAt: string;
};

// --- API envelopes ---
export type AuthResponse = { message: string; user: User; token: string };     // login
export type SignupResponse = { message: string; user: User };                   // signup (no token)

export type Paginated<T> = {
  data: T[];
  pagination: {
    page: number; limit: number; total: number; totalPages: number;
    hasNextPage: boolean; hasPrevPage: boolean;
  };
};

export type ApiError = {
  error: { code: string; message: string; details?: Record<string, string[]> };
};
```

> The app is **bilingual (English + Arabic)** — note `nameEn` / `nameAr` on every lookup table. Plan the landing page for RTL Arabic too.

---

## 6. Suggested frontend auth plumbing

- A single `apiFetch(path, options)` wrapper that: prepends `NEXT_PUBLIC_API_URL`, attaches `Authorization: Bearer` when a token exists, and parses the `{ error }` shape into a thrown error.
- Decide **where the token lives**: `httpOnly` cookie (safer, needs a tiny change server-side) vs `localStorage` (simplest, XSS-exposed). Agree this with the backend before building — it affects both sides.
- Signup → on 201, immediately call login (backend doesn't return a token on signup).

---

## 7. Blockers — backend tasks before the frontend connects

These are on the **backend** side (ask the backend owner):

1. **Enable CORS.** No `cors` middleware is registered in `apps/backend/src/app.ts`, so every browser request from `localhost:3000` will be blocked. Needs `app.use(cors({ origin: "http://localhost:3000", credentials: true }))`.
2. **Pin the API port to 8000** (fix the `.env` `PORT=3000` clash with Next.js).
3. **Add a "current user" endpoint** — `/users/me` is a stub returning a hardcoded message. The frontend needs it to return the logged-in `User` from the `Bearer` token, to restore a session on refresh.
4. **Decide token transport** (cookie vs header) — see §6.
5. *(Optional)* make signup return a `token` so the UI can log the user in directly.

Until #1 and #2 are done, the frontend can be built against the contract above using mock data.
