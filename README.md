# 4th Grade Band Carpool (Next.js)

Parent portal for the Park View Elementary 4th Grade Band carpool. Parents sign in with a one-time email link, set their child's ride needs, and sign up to drive to rehearsals at Glenn Westlake Middle School.

Built with **Next.js (App Router) + TypeScript + React**. Hosted on **Vercel**, with data in **Turso** (free tier) and sign-in emails through **Resend**.

## Project layout

```
app/
  layout.tsx            root layout: fonts, header/footer shell, sign-in gate
  page.tsx              Home (next rehearsal, this week, upcoming)
  schedule/page.tsx     Carpool Schedule (filters, drive sign-up, ?d=<date> jump, ?f=mine)
  my-child/page.tsx     My Child's Rides (usual rides, weekly changes, home address)
  dates/page.tsx        Important Dates
  admin/page.tsx        Admin (families + emails, admins, dates, site text, CSV export)
  api/[...path]/route.ts  every /api/* request → lib/server/api.ts
  globals.css           all styles (Park View black & yellow)
components/             Shell (header, account menu, phone menu, footer), Login, Rehearsal cards, forms
lib/
  types.ts              shared types
  client/               browser helpers: portal context (state, toasts, dialogs), date formatting
  server/               api.ts (routes + permissions), auth.ts (signed tokens), db.ts (Turso tables, first-run data), seed.ts (starting data from the Google Sheet)
test/api.test.mjs       API permission checks
```

## Run locally

```bash
npm install
ADMIN_EMAILS=you@example.com npm run dev     # http://localhost:8888
npm test                                     # in a second terminal
```

Locally there's no email: after you enter your email, an **open sign-in link** appears on the page. Data is saved to a SQLite file, `./.localdata/carpool.db` (git-ignored). Mac users can also double-click **Start Carpool Site.command**.

## Deploy on Vercel

1. **Import the repo** in Vercel (Add New → Project). It detects Next.js automatically.
2. **Create a Turso database** (`brew install tursodatabase/tap/turso`, then `turso auth login`):
   `turso db create band-carpool`, then get its URL with `turso db show band-carpool --url` and a token with `turso db tokens create band-carpool`. The app creates its tables on first use.
3. **Environment variables** (see `.env.example`):

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://band-carpool-<you>.turso.io` |
   | `TURSO_AUTH_TOKEN` | the token from `turso db tokens create` |
   | `SESSION_SECRET` | 32+ random characters (`openssl rand -hex 32`) |
   | `ADMIN_EMAILS` | `jill@snacksdesign.com` (comma separated): the first admins, used only while no one in the database is an admin |
   | `RESEND_API_KEY` | from resend.com, after verifying your sending domain |
   | `FROM_EMAIL` | `Band Carpool <carpool@yourdomain.com>` (on the verified domain) |
   | `SITE_URL` | optional, custom domain, e.g. `https://carpool.snacksdesign.com` |

4. **Redeploy**, sign in with an admin email, then **Admin → Kids & parent emails**: add each family's email(s) and save. Only listed emails (plus admins) can sign in.

## How it works

- **Sign-in:** one-time link, valid 20 minutes, emailed only to admins and parents listed in Admin; any other email is told it isn't on the parent list and nothing is sent. Sessions last 60 days in an HttpOnly cookie signed with `SESSION_SECRET`.
- **Permissions (enforced in `lib/server/api.ts`):** parents change only their own child's rides and address. Any parent can **I can drive** and add kids who still need a ride to their car, and can change or remove only their own car. Admins can edit everything, including **+ Add another driver** for someone who offered by text. Admins are the users marked admin in the database (**Admin → Admin emails**); `ADMIN_EMAILS` only sets up the first ones on a new database.
- **Addresses:** visible only to the child's parents, admins, and drivers who have that child in their car (**Addresses & contacts** on the car, with Google Maps links).
- **"Still needs a ride"** = children whose ride needs include that leg, minus children already in a car. **Driver needed** shows when those kids outnumber open seats.
- **Starting data** (`lib/server/seed.ts`) loads once on first run: rehearsal dates, important dates, and the three kids from the sheet. After that, edit everything in Admin.
- **Database tables** (created in `lib/server/db.ts`): `settings` (site text), `users` (email, name, phone, admin), `kids` (name, address, notes), `kid_parents`, `rehearsal_dates`, `important_dates`, `kid_usual_needs`, `kid_need_overrides`, `cars` (one per driver per trip; admin-added drivers have a name instead of a user), `car_kids` (a kid rides in one car per trip), `used_links`. Every table has an auto-generated numeric `id`, and tables refer to each other by it (`kid_id`, `user_id`, `rehearsal_id`, `car_id`). Sites that stored data in the older single `kv` table copy it into these tables on first run; `kv` is kept as a backup.
- **Backup:** Admin → Download schedule (CSV).
