# TechJest

Marketing website, client portal, and admin console for TechJest, built with Next.js 16 (App Router) and Supabase.

## Project structure

```text
src/app/              Pages, layouts, API routes, and global styles (Next.js App Router)
  _og/                Fonts used only by the generated link-preview image
src/lib/              Small shared helpers (site URL, safe redirects, dates and money, ids, pagination)
src/proxy.ts          Refreshes the Supabase session cookie on each request
frontend/components/  Reusable UI components
frontend/data/        Static content: team, service areas, fallback service catalog
backend/supabase/     Supabase clients and data helpers, schema.sql, migrations, seed data
backend/email/        Email alerts for the team and clients (Resend)
e2e/                  Playwright browser tests and their local Supabase setup
public/               Images, home-screen icons, Google Search Console verification file
docs/                 CI/CD and post-login redirect notes
ai/                   Notes for AI agents: rules, current state, decisions, known issues
```

Path aliases: `@/*` → `src/*`, `@/frontend/*` → `frontend/*`, `@/backend/*` → `backend/*`.

## Design

- **Colours** are CSS variables at the top of [`src/app/globals.css`](./src/app/globals.css): Midnight Navy `#1B1E4A`, Warm Stone Grey `#AFAEA2`, and Crimson Red `#D21319`.
- **Fonts:** Source Serif 4 for headings and Manrope for text, bundled under `public/fonts/` with their licenses and loaded by `src/app/fonts.css`. Builds do not download fonts; the original Unicode subsets, weights, and fallback metrics are preserved.
- **Opening animation:** A quiet, approximately one-second wordmark fade on the first homepage visit per tab. Uses the existing fonts and brand colours; no video is downloaded. Reduced-motion users, crawlers, anchor links and subsequent visits skip it. Keyboard, pointer or wheel interaction dismisses it immediately. `/?intro=1` replays it; `/opening_animation_video` remains a compatible welcome page. Page content is never hidden or scroll-locked, and an independent timer clears the greeting if hydration fails.
- **Icons:** [`frontend/components/icons.tsx`](./frontend/components/icons.tsx), including one icon per service category.
- **Link preview and app icons:** [`src/app/opengraph-image.tsx`](./src/app/opengraph-image.tsx), `src/app/favicon.ico`, `src/app/icon.png`, `src/app/apple-icon.png`, and `public/icons/`.

## Everyday changes

- **Team members:** edit [`frontend/data/team.ts`](./frontend/data/team.ts). The About page, search-engine structured data, and `/llms.txt` all read from it.
- **Homepage text, contact email, WhatsApp number:** Admin → Website settings. WhatsApp links stay hidden until a real number is saved.
- **Services and prices:** Admin → Services.

## Run locally

Use Node.js 22.14.0 from `.nvmrc`. Development checks require Node 22.12+, Node 24, or Node 26+ (see `package.json`).

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

| Script                 | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Development server                            |
| `npm run build`        | Production build                              |
| `npm run start`        | Serve the production build                    |
| `npm run typecheck`    | TypeScript check                              |
| `npm test`             | Unit and API route tests (Vitest)             |
| `npm run check`        | Typecheck, tests, format check, then build (CI) |
| `npm run check:local`  | Same checks with external integrations disconnected; not a release build |
| `npm run format`       | Format the code with Prettier                 |
| `npm run format:check` | Report files that need formatting             |
| `npm run e2e:db`       | Start the local Supabase for browser tests    |
| `npm run test:e2e`     | Browser tests (Playwright)                    |
| `npm run e2e:db:stop`  | Stop that local Supabase and delete its data  |

### Browser tests

`e2e/` holds Playwright tests for sign-up, password reset, requests (signed in and as a guest), the cart, the admin console, database permissions, and caching. They run against a throwaway local Supabase, never the live project (the config refuses any non-local database), and use the installed Google Chrome.

1. Start Docker Desktop.
2. `npm run e2e:db` starts Supabase on ports 55320–55329 and loads `schema.sql`, the seed, and every migration (a fresh database each time).
3. `npm run test:e2e` builds the app into `.next-e2e` (your normal `.next` build is untouched), serves it on port 3200, and runs the tests.
4. `npm run e2e:db:stop` when you are done.

CI runs the same steps on every push and pull request.

For local source checks without accessing configured Supabase/email services, run `npm run check:local`. It uses `.next-local-check` and leaves real environment files alone. Database and browser tests still require the local Supabase stack. See [the 26 October audit rollout notes](docs/audit-rollout-2026-10-26.md) for the required migration, verification limits, and release order.

## Deployment

Every pull request and push to `main` runs [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) (`npm ci`, then `npm run check`). Vercel's Git integration deploys `main` to production. [`vercel.json`](./vercel.json) runs the server code in Mumbai (`bom1`), next to the Supabase database (`ap-south-1`).

Set these environment variables in Vercel:

- `NEXT_PUBLIC_SITE_URL` (the public domain; used for canonical URLs, the sitemap, and link previews)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_JWKS_URL` (optional; reserved for token verification, not read by the current code)
- `CONTACT_EMAIL` and `WHATSAPP_NUMBER` (fallbacks; the values saved in Admin → Website settings take priority)
- `RESEND_API_KEY` and `ALERT_EMAIL_TO` (optional; turn on email alerts for new requests, see `.env.example`)

Public pages (home, services, about, contact, and so on) are cached for 5 minutes and served from Vercel's CDN; saving in Admin → Website settings or Admin → Services refreshes them straight away. The signed-in parts of the header load in the browser. Visitors can send a request without an account (a guest enquiry, answered by email); signed-in clients get a conversation in their workspace.

Never add `SUPABASE_SECRET_KEY` to client or Vercel environment variables for this application, and never commit it. The app uses Supabase Auth and Row Level Security with the publishable key only.

## Supabase setup

1. Create a Supabase project.
2. In the SQL Editor, run [`backend/supabase/schema.sql`](./backend/supabase/schema.sql), then [`backend/supabase/seed-services-catalog.sql`](./backend/supabase/seed-services-catalog.sql). Both are safe to run again.
   - Existing databases also need the dated files in [`backend/supabase/migrations/`](./backend/supabase/migrations/), run in name order (all are safe to rerun). Run a new migration before deploying the code that comes with it.
   - For a clean rebuild, run [`backend/supabase/reset-database.sql`](./backend/supabase/reset-database.sql) first. It is destructive: it removes all public application data (not Auth users).
3. Copy the project URL and publishable key into `.env.local` (see [`.env.example`](./.env.example)):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
   ```

4. In Supabase → Authentication → URL Configuration, set **Site URL** to the production URL, and add `http://localhost:3000/auth/callback**` and your production URL followed by `/auth/callback**` as redirect URLs. Sign-up confirmation, Google login, and password-reset emails all return through `/auth/callback`.
5. For Google login, enable **Authentication → Providers → Google** in Supabase with the OAuth client ID and secret from Google Cloud, and add Supabase's callback URL (usually `https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI in Google Cloud.

`/api/health` reports whether the public Supabase configuration is present; it never returns secret values.

### Admin access

Sign in at `/admin/login` with an account whose Supabase `app_metadata.role` is `admin` (set it in the Supabase dashboard or with server-side user management). Admins who sign in through `/auth` are sent to `/admin`. If the role was added while the account was signed in, log out and back in to refresh the session.

The console covers requests, the CRM pipeline, proposals, projects (tasks, invoices, documents), messages, notifications, people, activity, services, and website settings.

Every status (requests, lead stages, proposals, projects, tasks, invoices, conversations) can be changed from the console. Clients see a proposal once it is marked **Sent** and an invoice once it is no longer a **Draft**; internal notes in a conversation are never shown to the client.

## Routes

- Public: `/`, `/services`, `/services/[slug]`, `/portfolio`, `/about`, `/contact`, `/cart`
- Accounts: `/auth` (log in, sign up, forgot password), `/auth/reset` (choose a new password), `/dashboard`, `/messages`, `/project/[id]`
- Admin: `/admin` and its sub-pages, `/admin/login`
- Generated: `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/manifest.webmanifest`, `/opengraph-image`

Case studies stay labelled as samples until real client permission and details are available.
