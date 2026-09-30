# 4th Grade Band Carpool — Parent Portal

A small website for the carpool: parents sign in with a one-time email link, set their child's ride needs, and sign up to drive. Built with Next.js and hosted on Vercel, with data in Upstash Redis.

## What's inside

- `app/`: Next.js App Router pages (`/`, `/schedule`, `/my-child`, `/dates`, `/admin`) and global styles
- `app/api/[...path]/route.ts`: serves every `/api/*` request through the router in `lib/api.js`
- `components/`: the page shell, login, rehearsal cards, profile dialog, and `PortalProvider` (shared signed-in state, toasts)
- `lib/`: server logic (`api.js`, `auth.js`, `store.js`) and `seed.js`, the starting data copied from the Google Sheet
- `test/api.test.js`: API smoke test against a running dev server

## Local development

```
npm install
ADMIN_EMAILS=you@example.com npm run dev    # http://localhost:3000
```

`.env.development` sets local defaults: data goes to JSON files in `./.localdata`, and the sign-in link shows on the page instead of being emailed. Delete `.localdata/` to start over from the seed data.

To run the API checks, start from an empty data folder with the test admin:

```
rm -rf .localdata && ADMIN_EMAILS=jill@snacksdesign.com npm run dev
npm test          # in a second terminal (set BASE=http://localhost:PORT if not 3000)
```

## Deploy to Vercel

1. **Import the GitHub repo** in Vercel. It detects Next.js automatically, so no build settings are needed.
2. **Add storage:** in the project, open Storage → Marketplace → **Upstash Redis** and connect it. This injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
3. **Set up email sending (Resend, free tier):** sign up at resend.com, verify your domain and create an API key. Without a verified domain, Resend only sends to your own account email.
4. **Add environment variables** (Settings → Environment Variables; see `.env.example`):

   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | 40+ random characters (`openssl rand -hex 32`) |
   | `RESEND_API_KEY` | your Resend key |
   | `FROM_EMAIL` | `Band Carpool <carpool@yourdomain.com>` (must be on your verified domain) |
   | `ADMIN_EMAILS` | always-admin emails, comma separated |
   | `SITE_URL` | optional, your custom domain, e.g. `https://carpool.example.com` |

5. **Redeploy**, then sign in with your admin email.
6. **Admin page → Kids & parent emails:** add each family's email(s) and save. Only emails listed there (plus admins) can sign in.

## How it works

- **Login:** the parent enters their email. If it's on the list, they get a link that works once and expires in 20 minutes. After that they stay signed in for 60 days on that device.
- **Permissions:** parents change only their own child's rides. Any parent can sign up to drive and add kids who still need a ride. Parents can only remove themselves from a car. Admins can edit everything.
- **"Still needs a ride"** is worked out automatically: children whose ride needs include that leg, minus children already in someone's car.
- **Backup:** Admin → Download schedule (CSV).
