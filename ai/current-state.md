# Current state snapshot

## Website assistant — 6 November 2026

"Ask TechJest" chat: `frontend/components/site-assistant.tsx` → `POST /api/chat` → `backend/assistant/model.ts`, which calls an OpenAI-compatible chat completions API with `fetch` (no SDK). Default: Google Gemini's free tier (`gemini-flash-lite-latest`; `gemini-flash-latest` was too slow on the free tier); `AI_BASE_URL` and `AI_MODEL` switch to another provider such as Groq. It answers only from the website's content: `backend/assistant/prompt.ts` holds the rules, and `backend/assistant/knowledge.ts` builds the knowledge base from the live catalog, site settings, team, `frontend/data/site-content.ts` (homepage copy, moved out of `src/app/page.tsx`) and `serviceAreaDetails` (moved out of `src/app/services/[slug]/page.tsx`). About, Contact, Portfolio, Privacy and Terms text is restated in `knowledge.ts` and must be updated with those pages. Off until `AI_API_KEY` is set (the layout hides the button). Limits: 6 questions per minute and 40 per hour per IP, per server instance; the provider's free quota is shared by all visitors and returns "busy" when used up. Unit-tested with `fetch` mocked, and live-tested locally against Gemini on 6 November 2026; the widget's rendering in a browser is **NOT VERIFIED**.

## Local audit and frontend update — 27 October 2026

The opening now uses a roughly one-second, silent typographic welcome on a warm paper background, with subtle movement and a crimson rule. It runs once per tab, supports explicit replay, respects reduced motion and expires independently of React hydration. The previous video is no longer requested; the existing welcome URL remains compatible. Browser rendering remains **NOT VERIFIED** here.

The current working tree includes the 26 October safety fixes plus shared frontend refinements across the 31 page routes: consistent cards/controls, responsive header navigation, a mobile admin selector, client workspace tabs, readable legal text, improved contact form presentation, message wrapping, and loading/error states. The marketplace and cart distinguish catalog outages from empty selections; cart prices come from a successful current catalog read and unavailable selections require removal before submission.

Conversation creation now uses one transaction through `start_client_conversation`, reusing existing request/project threads and repairing missing client membership. Both `2026-10-26-request-and-message-safety.sql` and `2026-10-27-conversation-creation.sql` are prepared only: **not applied or database-integration verified**.

87 unit/API tests pass, including eight welcome-animation gating/fallback regressions. The isolated production build was verified with external integrations disconnected. Playwright discovers 57 tests in 8 files, including frontend viewport/navigation/outage checks; these are **not executed** because Docker/Chrome remain unavailable. Live integrations and visual/cross-browser behavior remain **NOT VERIFIED**. See `frontend-update-2026-10-27.md`, `audit-2026-10-26.md`, and `../docs/audit-rollout-2026-10-26.md`. Nothing was deployed.

The snapshot below describes the earlier 23 October baseline; its historical test/deployment statements do not verify these new changes.

What the repository contains as of 23 October 2026. It does not prove that the live Supabase project or Vercel deployment match it: changes made in this session were verified on a local Supabase copy, not on production.

## Project purpose

TechJest is a Next.js marketing, lead-generation, and client-portal site for a software development company. Visitors browse services, build a project cart, and send enquiries (with or without an account). Clients get a private workspace with requests, proposals, projects, invoices, and messages. The team runs everything from an admin console.

Legal entity, final domain, and other business details are **UNKNOWN / NOT VERIFIED** (see `LAUNCH-CHECKLIST.md`).

## Technology stack

- Next.js `^16.4.2` (App Router), React and React DOM `19.3.1`, TypeScript `5.8.2`
- `@supabase/ssr` `^0.12.7`, `@supabase/supabase-js` `^2.118.0`
- Vitest `5` (unit and API route tests), Playwright `1.64` (browser tests, using installed Google Chrome)
- Node.js `>=20` in `package.json`; `.nvmrc` pins `22.14.0` (Vitest 5 needs 22.12+)
- Plain global CSS in `src/app/globals.css`; no CSS framework
- Email through Resend's HTTP API (no SDK); off until configured

## Repository layout

```text
src/app/              Pages, layouts, API routes, styles, icons, link-preview image
src/lib/              Small helpers: site URL, safe redirects, login destination, dates/money, ids, JSON-LD, pagination
src/proxy.ts          Per-request session refresh (getClaims) and an in-memory API rate limit
frontend/components/  UI components (client and server)
frontend/data/        Team, service areas, fallback service catalog, workflow statuses
backend/supabase/     Supabase clients and data helpers, schema.sql, migrations, seed, reset script
backend/email/        Team alerts and client emails through Resend
e2e/                  Playwright browser tests and the scripts that start their local Supabase
public/               Images, home-screen icons, intro video, Google verification files
docs/                 CI/CD and post-login redirect notes
ai/                   These notes
```

## Rendering and caching

- The root layout reads no session, so public pages (home, services, service pages, about, contact, cart, portfolio, privacy, terms, auth screens, sitemap) are prerendered and revalidated every 5 minutes (`s-maxage=300`). Saving in Admin → Website settings or Admin → Services calls `/api/admin/revalidate`, which refreshes them at once.
- Public data comes from `backend/supabase/public.ts` (no cookies). Pages that read the session (dashboard, messages, project, admin) render per request.
- `frontend/components/account.tsx` (`AccountProvider`) reads the session in the browser for the header only: profile badge, Login link, mobile menu, and the notification bell (`unread_message_counts()` plus unread admin notifications). Message threads dispatch `UNREAD_EVENT` so the bell recounts.
- The intro video renders only on `/` and `/opening_animation_video`.

## Authentication and authorization

- Supabase Auth: email/password, Google OAuth, and password reset (`/auth` → email → `/auth/callback?next=/auth/reset` → `/auth/reset`).
- The project signs tokens with an ES256 key. `getSessionUser()` (`backend/supabase/session.ts`) and the proxy use `getClaims()`, which verifies tokens locally. Role changes apply when a token refreshes (within an hour), the same moment row-level security sees them.
- Admins have `app_metadata.role = 'admin'`. `requireAdmin()` / `getAdminForApi()` (`backend/supabase/admin.ts`) guard admin pages and routes; row-level security enforces the same in the database.
- Sign-ups and logins (including Google and password reset) are written to `audit_logs` by the `record_auth_event` trigger on `auth.users`; browsers cannot write there.

## Main flows

### Enquiries

`POST /api/contact` (contact form and cart):

1. Drops submissions that fill the hidden `website` field (looks successful to bots).
2. Validates service, message (20–5000 characters), contact fields, and cart service slugs against the catalog.
3. Signed in: `submit_project_request()` saves the request, its services, a conversation, the first message, and an admin notification in one transaction. A trigger limits each client to 10 requests an hour.
4. Signed out: `submit_guest_request()` saves a guest request (no account, no conversation) after re-checking every field; names and prices come from the catalog; 3 per email and 50 in total per hour.
5. After the response, `after()` emails the team (Resend), with Reply-To set to the client.

The cart keeps selected slugs in `localStorage` (`techjest-service-cart`); a half-written quote or contact form is kept while the visitor chooses to log in.

### Client workspace

- `/dashboard`: "Needs your attention" (unread messages, proposals to answer, invoices due), profile details (editable name, phone, purpose), projects with tasks, and request history with proposals.
- Proposals marked Sent show Accept/Decline (`POST /api/proposals/[id]/respond` → `respond_to_proposal()`): once only, by the owning client, before `valid_until`. The team gets a notification, an email, and a note in the conversation; accepting sets the lead stage to `won`.
- `/messages` and `/project/[id]`: conversations (polling every 15 s plus Supabase Realtime), tasks, documents (signed download links), and non-draft invoices.

### Admin console

Overview, notifications, messages, requests (paged, 25 per page), CRM pipeline, proposals, projects (tasks, invoices, documents), invoices, people (paged), services catalog editor, website settings, and activity log. Every status is editable from the console. Guest requests are labelled "reply by email". On phones the console starts with its tab row; create forms fold away once their list has items.

### Email

`backend/email/team-alert.ts`: team alerts for new requests, client messages, and proposal answers (needs `RESEND_API_KEY` and `ALERT_EMAIL_TO`); client emails when the team replies (also needs `ALERT_EMAIL_FROM` on a domain verified in Resend).

## Database

`backend/supabase/schema.sql` (safe to rerun) defines companies, profiles, project requests (with guest rows where `user_id` is null), request services, audit logs, proposals, projects, tasks, project messages, documents (plus the private `project-documents` storage bucket), invoices, the service catalog, admin notifications, conversations, participants, messages, and site settings, with row-level security on every table. Functions: `handle_new_user`, `record_auth_event`, `touch_conversation_on_message`, `admin_delete_user_data`, `submit_project_request`, `submit_guest_request`, `limit_project_requests`, `unread_message_counts`, `respond_to_proposal`.

Existing databases apply the dated files in `backend/supabase/migrations/` in name order. As of 23 October 2026 the owner had applied everything up to and including `2026-10-22-security-hardening.sql`; `2026-10-23-reliability-and-guest-enquiries.sql` must run before the matching code is deployed.

## Environment

See `.env.example`: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CONTACT_EMAIL` and `WHATSAPP_NUMBER` (fallbacks for Admin → Website settings), `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM`. `SUPABASE_JWKS_URL` is documented but not read. Never add the Supabase secret key to the app.

`next.config.ts` sets security headers and reads `NEXT_DIST_DIR` (the browser tests build into `.next-e2e`). `vercel.json` pins server functions to Mumbai (`bom1`).

## Verification

- `npm run check`: typecheck, Vitest (41 tests), Prettier, production build.
- `npm run e2e:db` then `npm run test:e2e`: 34 Playwright tests against a throwaway local Supabase (Docker); the config refuses any non-local database.
- CI (`.github/workflows/ci.yml`) runs both on every pull request and push to `main`; Vercel deploys `main`.

## Open items

See `ai/known-issues.md` (sections 25–26) and `LAUNCH-CHECKLIST.md`.
