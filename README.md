# Trip Counter 🥟🍷🐈

A small PWA for counting the important stuff on a trip, together with friends:
khinkali eaten, glasses of wine, night beers, cats met, Bolt rides…

- **Frontend:** React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · React Router 8 · TanStack Query 5 · `vite-plugin-pwa`
- **Backend:** Supabase only (Postgres + Auth + RLS + Realtime). No custom server. The browser talks to Supabase via `@supabase/supabase-js`.

## Local setup

```bash
pnpm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
pnpm dev                     # http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | `tsc -b` (TypeScript 7 native compiler) |
| `pnpm lint` | [oxlint](https://oxc.rs) (see note below) |
| `pnpm build` | typecheck + production build into `dist/` (incl. service worker + manifest) |
| `pnpm preview` | serve the production build |
| `pnpm test:db` | database / RLS test-suite (see [Database tests](#database-tests)) |

> **Why oxlint instead of ESLint?** TypeScript 7 ships only the native (Go) compiler and has no JS API.
> `typescript-eslint` still needs that API (`typescript <6.1`), so it can't run against TS 7. oxlint has its own
> TS parser and implements the `react-hooks` / `react-refresh` rules we need.

## Environment

`.env.local` (never committed; `.env*` is git-ignored except `.env.example`):

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Both values are in **Supabase Dashboard → Project Settings → API**. The anon key is safe to expose in the browser
because every table is protected by RLS. **Never** put the `service_role` key in the frontend or in any `VITE_*`
variable: it bypasses RLS completely.

## Supabase setup

### 1. Create a project

Create a project at [supabase.com](https://supabase.com/dashboard), then copy its URL and anon key into `.env.local`.

### 2. Apply the migrations

All schema lives in `supabase/migrations/` (tables, constraints, indexes, triggers, functions, grants, RLS policies,
realtime publication). Apply it with the Supabase CLI:

```bash
npx supabase init            # once; creates supabase/config.toml, keeps existing migrations
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push         # applies supabase/migrations/*.sql
```

(Local alternative: `npx supabase start` needs Docker, then `npx supabase db reset` applies the migrations to the
local stack.)

### 3. Authentication → URL Configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**
  - local development: `http://localhost:5173`
  - production: `https://YOUR_DOMAIN`
- **Redirect URLs**: add every place the magic link may send users back to:
  - `http://localhost:5173/auth/callback`
  - `https://YOUR_DOMAIN/auth/callback`
  - (optional) preview deployments, e.g. `https://*-your-team.vercel.app/auth/callback`

If a redirect URL is not in this list, Supabase falls back to the Site URL and the login won't complete in the app.

### 4. Authentication → Providers → Email

- **Email** provider enabled (it is by default).
- "Allow new users to sign up" must stay enabled, because a new user's first magic link creates their account.
- "Confirm email" can stay on. For a new user the first email is a *Confirm signup* email, and its link signs them
  in just like a magic link.

The built-in email sender is heavily rate-limited (a few emails per hour). Before inviting real friends, configure
custom SMTP under **Authentication → Emails → SMTP Settings** (Resend, Postmark, etc.).

### 5. Realtime

The migration adds `events`, `counters` and `trip_members` to the `supabase_realtime` publication, so the trip page
updates live when friends add things. Nothing else to configure. Realtime delivers only rows the user can read
under RLS. If realtime is unavailable, data still refreshes on window focus and after every mutation.

## Architecture

```text
src/
  app/            App (QueryClient, AuthProvider, Router, Toaster), AppLayout (phone-sized column)
  routes/         router definition, 404
  components/     Button, Sheet (bottom sheet), TopBar, EmojiField, Loading/Error/Empty states
  features/
    auth/         AuthProvider + useAuth (user, session, isLoading, signOut), ProtectedRoute,
                  LoginPage (magic link), AuthCallbackPage, pending-invite storage
    profile/      profile query/mutation, ProfilePage (display name, sign out)
    trips/        trips queries/mutations, DashboardPage, NewTripPage, TripPage, TripSettingsCard, realtime hook
    counters/     counters queries/mutations, CounterCard (tap = +1), AddEventSheet, CounterFormSheet
    events/       events queries, optimistic add, ActivityFeed
    members/      members query, remove/leave, MembersPage
    invites/      invite link (get-or-create / reset), JoinPage, preview + accept
  lib/            supabase client, query keys, error → human message mapping, date/number helpers
  types/          Database types for supabase-js (match the migrations)
supabase/
  migrations/     the whole schema, as SQL
  tests/          RLS test-suite + stub of Supabase's auth schema for vanilla Postgres
```

- **Server state** lives in TanStack Query. Local UI state uses plain React state. No global store.
- **Totals are never stored.** `counters_with_totals` is a `security_invoker` view that computes `sum(events.amount)`.
- **Quick add:** tapping a counter inserts an event with an optimistic update of the total and the feed, a pop/"+1"
  animation, and a toast with **Undo**, then refetches. Holding a counter (or tapping ⋯) opens a bottom sheet for
  custom amounts and editing.

### Data model

| Table | Notes |
| --- | --- |
| `profiles` | 1:1 with `auth.users`; created by a trigger on `auth.users` insert (`display_name` defaults to the email prefix) |
| `trips` | `owner_id` is set by `create_trip()` and cannot be updated by clients |
| `trip_members` | PK `(trip_id, user_id)`, `role in ('owner','member')`, at most one owner per trip (partial unique index) |
| `trip_invites` | random `token` uuid; `revoked_at` / `expires_at` supported; one active link per trip, which owners can reset |
| `counters` | `unique (id, trip_id)` exists so events can reference it with a composite FK |
| `events` | append-only (no UPDATE grant); FK `(counter_id, trip_id) → counters(id, trip_id)` guarantees `event.trip_id = counter.trip_id` |

### Security model

Security is enforced entirely in Postgres. The React checks only decide what to show.

- **RLS is enabled on every table.** `anon` has no table privileges at all.
- **Column-level grants:** clients can write only "content" columns. `owner_id`, `role`, `user_id`, `created_by` and
  `token` are never writable. `user_id` and `created_by` default to `auth.uid()`, and the insert policies also
  check `= auth.uid()`, so spoofing another user fails.
- **Memberships can't be inserted directly.** They are created only by
  - `create_trip()`, which atomically creates the trip, the owner membership and the optional starter counters, and
  - `accept_invite(token)`, which validates the invite (it must exist, not be revoked and not be expired) and
    inserts `role = 'member'` with `on conflict do nothing`, so joining twice is idempotent.
- **Privileged code lives in a `private` schema** that is not exposed through the API. Those functions are
  `SECURITY DEFINER`, use `set search_path = ''` and schema-qualified names, and grant `EXECUTE` only to the roles
  that need it. The `public` RPCs are thin `SECURITY INVOKER` wrappers. The RLS helpers `private.is_trip_member`,
  `private.is_trip_owner` and `private.shares_trip_with` are also `SECURITY DEFINER`, which avoids policy
  recursion on `trip_members`.
- **Invite preview:** `get_invite_preview(token)` is the only thing `anon` can call. It reveals the trip name, emoji
  and member count only for a valid token.
- **Indexes** exist on every column used by RLS: `trip_members(user_id)`, `trip_members(trip_id)`,
  `events(trip_id)`, `counters(trip_id)` and others.

### Auth & join flow

1. `/login` → `signInWithOtp({ email, options: { emailRedirectTo: origin + '/auth/callback' } })`.
2. `/auth/callback`: supabase-js parses the session from the URL (`detectSessionInUrl`). `AuthProvider` stays in
   `isLoading` until `getSession()` resolves, so private UI never flashes. After that:
   - if a pending invite exists, go to `/join/:token`
   - otherwise go to `/`
   - on an expired or invalid link, show an error with a way back to login.
3. `/join/:token` (public):
   - Signed out: shows the invite preview, saves `localStorage.pendingInviteToken`, and offers "Sign in to join".
   - Signed in: shows the preview and a **Join trip** button. Joining happens only on that click. Already a member?
     You're taken straight to the trip.

## Database tests

`supabase/tests/rls_test.sql` checks the security rules end to end with real roles and JWT claims (in one
transaction, then rolled back):

- an unrelated user can't read the trip, members, counters, events, invites or profiles
- an unrelated user can't add events or counters, insert a membership, create an invite, or update/delete the trip
- a member can read the trip and add their own events
- a member can't spoof `user_id`/`created_by`, can't make themselves owner or change `owner_id`, and can't
  edit others' counters or update events
- an event can't point at a counter from another trip (FK)
- unknown, revoked and expired invites are rejected
- a valid invite adds membership, and joining twice doesn't duplicate it
- anon can only preview an invite
- the owner can moderate, revoke invites and delete the trip (cascade)
- a member who leaves loses access

Run it:

```bash
# Throwaway local Postgres (needs initdb/pg_ctl/psql, e.g. `brew install postgresql@17`).
# Applies a small stub of Supabase's auth schema + roles, then all migrations, then the tests:
pnpm test:db

# Or against a Supabase local stack (`npx supabase start`) that already has the migrations:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db
```

## PWA

`vite-plugin-pwa` generates the manifest (`Trip Counter` / `TripCounter`, `display: standalone`, theme and
background `#fff7ed`) and a service worker that precaches the app shell. Supabase requests always go to the network.
Placeholder icons are in `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png`,
`apple-touch-icon.png`, `favicon.svg`); replace them with real artwork any time.

On iPhone: open the site in Safari → Share → **Add to Home Screen**.

Note: a magic link opened from the Mail app opens in Safari, not in the installed home-screen app. iOS keeps their
storage separate, so the first sign-in should happen in the same context the user will use.

## Deploying

Any static host works (Vercel, Netlify, Cloudflare Pages). Build with `pnpm build`, serve `dist/`, and configure
an SPA fallback (all paths → `index.html`). Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the host's
build environment, and add `https://YOUR_DOMAIN/auth/callback` to the Supabase redirect URLs.
