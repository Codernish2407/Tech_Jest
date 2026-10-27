# Known issues, risks, and limitations

Sections 1–26 contain historical findings and updates from earlier tasks. For the 26 October 2026 local fixes, verification limits and prioritized remaining work, see `audit-2026-10-26.md` and sections 27–28 below. Production configuration and behavior are not verified by this repository audit.

## 1. Email login does not consume the cart `next` parameter

- **Issue:** The cart redirects unauthenticated users to `/auth?next=/cart`, but the email login flow always redirects to `/dashboard`.
- **Severity:** Medium
- **Evidence:** `src/app/cart/page.tsx` assigns `/auth?next=/cart`; `src/app/auth/page.tsx` calls `window.location.assign("/dashboard")` after email login and does not read search parameters.
- **Affected area:** Service cart quote flow and authentication UX.
- **Current behavior:** **Resolved in source:** email login now accepts the same safe internal-path policy as the OAuth callback and returns to `/cart` when that is the requested destination. A real authenticated browser flow is still **NOT VERIFIED**.
- **Expected behavior:** The verified intended destination should be honored, or the product should explicitly choose dashboard as the post-login destination.
- **Possible impact:** Users may lose context and believe their cart/quote flow did not continue.
- **Status:** Source-level fix complete; end-to-end authenticated verification remains open.
- **Recommended next investigation/fix:** Decide and document post-login redirect policy; test both email/password and OAuth flows before changing it.

## 2. Quote form fields are serialized into an unstructured request message

- **Issue:** Name, email, phone, company, timeline, and project description from the cart form are concatenated into `project_requests.message`.
- **Severity:** Medium
- **Evidence:** `src/app/cart/page.tsx` builds one string; `src/app/api/contact/route.ts` accepts only `service`, `message`, and `budget`; schema defines no dedicated quote fields.
- **Affected area:** Quote capture, admin operations, reporting, and future integrations.
- **Current behavior:** **Partially resolved in source:** new cart submissions send structured name, email, phone, company, budget range, timeline, and description fields; legacy `message`, `service`, and `budget` fields remain for compatibility. The remote migration and end-to-end persistence are **NOT VERIFIED**.
- **Expected behavior:** A structured quote model would be expected only if the product requires reliable field-level search, notifications, exports, or automation. This expectation is **NOT VERIFIED**.
- **Possible impact:** Harder reporting, inconsistent data quality, and fragile downstream parsing.
- **Status:** Partially resolved; migration/application verification remains open.
- **Recommended next investigation/fix:** Decide whether to add a normalized quote table/columns and migration, then define privacy/retention requirements.

## 3. Service catalog is hardcoded and not admin-manageable

- **Issue:** Service records are defined in `frontend/data/services.ts`; no services table or service-management API exists.
- **Severity:** Low to Medium
- **Evidence:** `src/app/services/page.tsx` imports the client marketplace; `frontend/components/service-marketplace.tsx` imports `services`; schema has no services table.
- **Affected area:** Catalog operations and content release workflow.
- **Current behavior:** Changing a service name, price, category, or slug requires a source change and deployment.
- **Expected behavior:** Dynamic catalog management is **NOT VERIFIED** as a current requirement.
- **Possible impact:** Slower content updates and potential mismatch between displayed service data and operational offerings.
- **Status:** **Resolved:** the catalog is read from the Supabase `service_catalog` table and edited in Admin → Services; `frontend/data/services.ts` remains only as a fallback.

## 4. Cart state is local to one browser/device

- **Issue:** Selected service slugs are stored in `localStorage`, not in the user account or server session.
- **Severity:** Low
- **Evidence:** `frontend/components/service-cart.tsx` uses `techjest-service-cart` and browser events.
- **Affected area:** Project cart continuity.
- **Current behavior:** Cart items survive normal browser storage lifetime on the same device, but are not synchronized across browsers/accounts and can be cleared by the user/browser.
- **Expected behavior:** Cross-device persistence is **NOT VERIFIED** as a requirement.
- **Possible impact:** A user can lose a prepared service package before submitting a quote.
- **Status:** Known limitation; intended by the current implementation.
- **Recommended next investigation/fix:** Define whether cart persistence should be account-backed or remain intentionally anonymous/local.

## 5. Audit events are client-initiated and IP addresses are not populated by current auth flows

- **Issue:** Login/signup/admin-login pages insert audit rows through the browser client; the current code does not pass an IP address.
- **Severity:** Medium
- **Evidence:** `src/app/auth/page.tsx` and `src/app/admin/login/page.tsx` call `supabase.from("audit_logs").insert(...)` without `ip_address`; `/admin/activity` displays `Not available` when it is null.
- **Affected area:** Audit reliability and activity reporting.
- **Current behavior:** Successful client-side authentication flows attempt to write events; failed audit inserts are ignored.
- **Expected behavior:** The repository documents an audit trail, but does not specify guaranteed delivery or IP collection. Stronger guarantees are **NOT VERIFIED**.
- **Possible impact:** Missing or incomplete activity records and limited investigation context.
- **Status:** Open design/reliability risk.
- **Recommended next investigation/fix:** Decide whether audit logging should move to trusted server-side events and whether IP collection is legally/operationally appropriate.

## 6. Several Supabase read/write errors are not surfaced

- **Issue:** Some page data operations ignore returned errors and render empty/default states.
- **Severity:** Medium
- **Evidence:** `src/app/dashboard/page.tsx` does not inspect the `profiles`/`project_requests` query errors; the auth pages ignore audit insert errors; `src/app/auth/callback/route.ts` ignores the profile upsert error.
- **Affected area:** Dashboard accuracy, audit reliability, and OAuth profile synchronization.
- **Current behavior:** A database failure can appear as no requests, missing profile data, or a successful login without a visible profile-sync warning.
- **Expected behavior:** The exact error UX is **NOT VERIFIED**, but operational failures should be distinguishable from genuinely empty data.
- **Possible impact:** Silent data loss perception, difficult diagnosis, and misleading admin/client views.
- **Status:** Partly resolved (2026-10-22): the dashboard shows an error instead of "No requests yet" when requests cannot load, and the OAuth callback reports profile-setup failures. Audit-insert errors are still ignored.
- **Recommended next investigation/fix:** Define error states and logging policy, then add targeted handling without exposing provider internals.

## 7. Environment variables are asserted rather than validated at startup

- **Issue:** Supabase URLs/keys are passed with non-null assertions in the proxy and Supabase clients.
- **Severity:** Medium
- **Evidence:** `src/proxy.ts`, `backend/supabase/client.ts`, and `backend/supabase/server.ts` use `process.env...!`; `.env.example` leaves Supabase values blank.
- **Affected area:** Local startup, CI/build, and deployment reliability.
- **Current behavior:** The repository does not provide a centralized runtime configuration validation layer.
- **Expected behavior:** Required deployment values should be present; actual environment behavior is **NOT VERIFIED** without a target deployment.
- **Possible impact:** Misconfigured environments may fail during request handling instead of producing an early, actionable configuration error.
- **Status:** Open reliability risk.
- **Recommended next investigation/fix:** Define required-variable validation per environment and verify it in CI/deployment without exposing secret values.

## 8. Production deployment and remote Supabase state are not verifiable from the repository

- **Issue:** The repository documents Vercel and Supabase setup, but contains no deployment workflow or proof of current production configuration.
- **Severity:** High for release confidence; not evidence of a production outage.
- **Evidence:** `.github/workflows/ci.yml` only checks typecheck/build; README describes Vercel setup; `.env.local` is ignored; no deployment provider configuration is tracked.
- **Affected area:** Release, hosting, authentication, database, and production smoke testing.
- **Current behavior:** CI can pass while redirect URLs, RLS migrations, environment variables, or deployed versions are wrong.
- **Expected behavior:** Production should be verified separately; the target state is **UNKNOWN / NOT VERIFIED**.
- **Possible impact:** Broken login, missing audit/request tables, incorrect canonical URLs, or inaccessible deployed features.
- **Status:** Open verification gap.
- **Recommended next investigation/fix:** Perform a separate deployment/configuration audit with access to Vercel and the Supabase project.

## 9. Documentation contains historical/planned architecture that differs from the current package

- **Issue:** `docs/PROGRESS.md` describes an earlier planned stack and routes, including pnpm, Tailwind, MDX, email-only leads, and routes that are not present in the current source/package.
- **Severity:** Medium
- **Evidence:** Current `package.json` uses npm scripts and does not list the planned packages; current route inventory differs from the route map in `docs/PROGRESS.md`.
- **Affected area:** Onboarding, future AI-agent context, and implementation planning.
- **Current behavior:** Multiple documents can give conflicting architecture signals.
- **Expected behavior:** Current-state documentation should distinguish historical plans from implemented behavior.
- **Possible impact:** Future changes may follow obsolete assumptions or install unnecessary dependencies.
- **Status:** **Resolved:** the obsolete `docs/` planning files were removed at the owner's request (October 2026); `README.md` and these `ai/` notes describe the current implementation.

## 10. Automated validation does not cover browser, accessibility, security, or database integration behavior

- **Issue:** CI runs only `npm ci` and `npm run check`.
- **Severity:** Medium
- **Evidence:** `.github/workflows/ci.yml`; `package.json` has no test, lint, Playwright, or accessibility script.
- **Affected area:** Regression detection and release confidence.
- **Current behavior:** TypeScript and production compilation are checked; runtime route behavior and remote integrations are not automatically exercised.
- **Expected behavior:** Required coverage targets are **NOT VERIFIED**.
- **Possible impact:** UI regressions, auth redirect bugs, RLS mismatches, or accessibility issues can reach deployment.
- **Status:** Open coverage gap.
- **Recommended next investigation/fix:** Define a test strategy and scope; do not add tooling solely from this document.

## 11. CRM lead-stage changes require the remote schema migration

- **Issue:** The new admin CRM route reads `project_requests.lead_stage`, but the repository cannot prove that the remote Supabase project has the latest additive column and constraint.
- **Severity:** Medium
- **Evidence:** `backend/supabase/schema.sql` adds `lead_stage`; `src/app/admin/crm/page.tsx` selects it; the local production build passes.
- **Affected area:** Admin CRM pipeline and request detail.
- **Current behavior:** The source is ready for the CRM route; a remote project using the older schema may show the CRM as unavailable.
- **Expected behavior:** The latest schema should be applied before the route is used in the target environment.
- **Possible impact:** CRM page/database query errors until migration is applied.
- **Status:** Open deployment prerequisite; not verified against remote Supabase.
- **Recommended next investigation/fix:** Apply the idempotent schema in Supabase SQL Editor and test admin CRM access with a real authorized account.

## 12. Proposal and project tables require remote schema application

- **Issue:** The new proposal and project admin pages depend on additive `proposals` and `projects` tables.
- **Severity:** Medium
- **Evidence:** `backend/supabase/schema.sql` defines both tables; the local build includes `/admin/proposals` and `/admin/projects`.
- **Affected area:** Admin commercial and delivery workspaces.
- **Current behavior:** Source-level routes and RLS policies are present; remote database availability is not verified.
- **Expected behavior:** Admins should be able to create proposals and view projects after the schema is applied.
- **Possible impact:** The pages will show their unavailable state until the migration is applied.
- **Status:** Open deployment prerequisite.
- **Recommended next investigation/fix:** Apply the idempotent schema and test proposal creation using an authorized admin account.

## 13. Project task workflow requires remote schema application

- **Issue:** Project detail and client dashboard task summaries depend on the additive `project_tasks` table.
- **Severity:** Medium
- **Evidence:** `backend/supabase/schema.sql` defines task RLS; `/admin/projects/[id]` creates tasks; `/dashboard` reads tasks through authorized projects.
- **Affected area:** Admin delivery workspace and client dashboard.
- **Current behavior:** Source-level task creation and read paths are present; remote database availability is not verified.
- **Expected behavior:** Admins can add tasks and clients can see tasks for their own projects.
- **Possible impact:** Task sections remain unavailable until the migration is applied.
- **Status:** Open deployment prerequisite.
- **Recommended next investigation/fix:** Apply the idempotent schema and test task creation/read access with separate admin and client accounts.

## 14. Collaboration and finance schema require remote application

- **Issue:** Project messages, document metadata, and invoices depend on additive tables and policies.
- **Severity:** Medium
- **Evidence:** `backend/supabase/schema.sql` defines the tables; `/project/[id]` and `/admin/invoices` query them.
- **Affected area:** Client portal, collaboration, and finance.
- **Current behavior:** Source routes are implemented, but remote schema/storage/payment configuration is not verified.
- **Expected behavior:** Authorized users can read their project data; payment state is only changed by trusted server-side integration.
- **Possible impact:** Portal sections remain empty/unavailable until migration and storage/payment setup are completed.
- **Status:** Open deployment prerequisite.
- **Recommended next investigation/fix:** Apply the schema, configure a private storage bucket, and implement/test provider webhooks before enabling live payments.

## 15. AI recommendation endpoint is deterministic until a model provider is configured

- **Issue:** `/api/ai/recommend` currently ranks the static catalog using prompt keyword matches rather than calling a model.
- **Severity:** Low
- **Evidence:** `src/app/api/ai/recommend/route.ts`.
- **Affected area:** AI consultant foundation.
- **Current behavior:** Authenticated requests receive service-only recommendations with bounded input.
- **Expected behavior:** A future model integration should remain server-side and validate output against an allowlisted service schema.
- **Possible impact:** Recommendations are less nuanced than a model-backed consultant.
- **Status:** Source-level foundation complete; model provider integration not configured.
- **Recommended next investigation/fix:** Select a provider, add server-only credentials, schema-validate output, and add rate limiting/cost controls.

## 16. Production observability and end-to-end coverage are not configured

- **Issue:** The repository has a safe configuration health check and a global error boundary, but no external error monitoring, alerting, browser end-to-end suite, or remote Supabase smoke-test environment is verified.
- **Severity:** Medium
- **Evidence:** `src/app/api/health/route.ts`, `src/app/error.tsx`, and the current package scripts.
- **Affected area:** Reliability, deployment, and operations.
- **Current behavior:** Build/type validation runs locally/CI; runtime provider and browser coverage remain limited.
- **Expected behavior:** Production should have monitoring, alerts, and authenticated smoke tests.
- **Possible impact:** Runtime regressions or provider outages may be detected late.
- **Status:** Open operational follow-up; source-level baseline added.
- **Recommended next investigation/fix:** Configure an approved monitoring provider and Playwright/Vitest suites with test credentials in CI.

## 17. Website settings currently cover core homepage/contact content

- **Issue:** The new website control page manages homepage hero fields and contact values; service catalogue records, portfolio entries, FAQs, and leadership content remain source-managed.
- **Severity:** Medium
- **Evidence:** `src/app/admin/settings/page.tsx`, `backend/supabase/site-settings.ts`, and the static source files under `frontend/data/` and `src/app/`.
- **Affected area:** Admin website control scope.
- **Current behavior:** Admins can safely edit the first public content surface without changing source code.
- **Expected behavior:** A complete CMS would provide validated CRUD for every editable public content type.
- **Possible impact:** Other public content still requires a code change and deployment.
- **Status:** Open next admin-CMS phase.
- **Recommended next investigation/fix:** Add a service catalogue and content-management schema, migrate public reads to it, and add audited CRUD screens.

## 18. Server functions ran far from the database

- **Issue:** Production responses showed `x-vercel-id: bom1::iad1`, meaning functions ran in US East while Supabase is in Mumbai.
- **Severity:** Medium (performance)
- **Evidence:** 1.1–3.0 s time-to-first-byte on `/`, `/services`, `/about`, and `/contact` (October 2026).
- **Status:** Fix prepared in `vercel.json` (`regions: ["bom1"]`); verify the header shows `bom1::bom1` after the next deploy.

## 19. Enquiries require an account

- **Issue:** `/api/contact` returns 401 for signed-out visitors, so the contact form and cart quote ask visitors to sign up first.
- **Severity:** Medium (conversion)
- **Status:** Resolved (October 2026): guests can send enquiries through `submit_guest_request()`; the team replies by email.

## 20. No email alert for new enquiries

- **Issue:** New requests are only visible in the admin console; nobody is notified by email.
- **Severity:** Medium
- **Status:** Built (October 2026) in `backend/email/team-alert.ts`; turns on once `RESEND_API_KEY` and `ALERT_EMAIL_TO` are set in Vercel.

## 21. Instant message updates are off in production

- **Issue:** The live database has no tables in the `supabase_realtime` publication, so new messages appear only through the 15-second poll.
- **Severity:** Low
- **Evidence:** `pg_publication_tables` returned no rows (October 2026).
- **Status:** Fix prepared in `backend/supabase/migrations/2026-10-07-live-messages-and-indexes.sql` (also revokes API access to `handle_new_user()` and adds three indexes); needs the owner's approval to run on production.

## 22. Fixed in the 2026-10-22 audit (verified on a local Supabase copy)

- **Next.js 16.3.7 security advisories** (cache poisoning, image-optimizer SSRF/RCE, Server Actions DoS): upgraded to 16.4.2. Vitest moved to 5.0.5 for dev-only advisories. `npm audit`: 0 vulnerabilities.
- **Google sign-in overwrote saved profiles:** `/auth/callback` upserted the profile on every login, resetting phone, company, and purpose. It now only creates a missing profile.
- **Row Level Security gaps** (fix in `migrations/2026-10-22-security-hardening.sql`, mirrored in `schema.sql`): clients could create requests already marked completed/won, record `admin_login` audit events, open a conversation on another client's request (blocking that client's own thread), join a conversation as `admin`, and point their profile at another company. The first four were reproduced against the old policies; all five are blocked by the new ones (21 policy checks pass).
- **`migrations/sync-all.sql`** defined `service_catalog` differently from `schema.sql`, failed on a fresh database despite saying it was safe there, and added a looser duplicate audit-log policy. It now matches `schema.sql`, and its header says it is for existing databases only.
- **Password reset was missing:** `/auth` has "Forgot your password?", and `/auth/reset` sets the new password (also linked from the dashboard as "Change password"). Clients can edit their name, phone, and purpose from the dashboard.
- **Smaller fixes:** malformed ids in conversation and admin APIs return 404/400 instead of 500. Contact and recommendation APIs check sign-in before reading the catalog. Service JSON-LD escapes `<`. The intro video no longer downloads on pages that never play it. Removed the unused `clsx` dependency.

## 23. Fixed in the 2026-10-23 follow-up (verified on a local Supabase copy)

- **Request submission is atomic:** `/api/contact` calls `submit_project_request()`, which saves the request, services, conversation, participant, first message, and admin notification in one transaction. A failure part-way saves nothing.
- **Database-side request limit:** a trigger allows 10 requests per client per hour, through the API or directly. The in-memory limit in `src/proxy.ts` remains a first, per-instance guard.
- **Sign-ins are logged by the database:** the `record_auth_event` trigger on `auth.users` logs sign-ups, logins, and admin logins (including Google and password-reset sign-ins, which were never logged before). Browsers can no longer write to `audit_logs`. IP addresses are still not recorded.
- **Unread counts are summed in the database** (`unread_message_counts()`), so they stay exact past 1,000 messages.
- **Admin console:** fits phone screens (it was 722px too wide); the service editor accepts new lines and commas while typing; adding a service with a slug that is already taken no longer replaces that service; a malformed request link shows "not found" instead of a database error; request action buttons follow status changes; project target dates cannot be before start dates.
- **Cart quote form** keeps what the visitor typed while they log in or sign up.
- **Missing Supabase settings** are reported once in the server log at startup.

## 24. Fixed in the 2026-10-23 improvements (verified on a local Supabase copy)

- **Intro video** re-encoded from 5.2 MB to 1.3 MB (H.264, CRF 28, no audio track; SSIM 0.984 against the original). Homepage weight 5.4 MB → 1.7 MB, `/services` 5.3 MB → 0.36 MB.
- **Public pages are cached:** the root layout no longer reads the session, so home, services, service pages, about, contact, cart, portfolio, privacy, terms, and the sitemap are served from the CDN (`s-maxage=300`). The header's signed-in parts come from `AccountProvider` in the browser. Admin saves call `/api/admin/revalidate`.
- **Fewer auth round trips:** `getClaims()` (verified locally with the project's ES256 key) replaces `getUser()` in the proxy, admin pages, and API routes. Admin pages render one notification bell instead of two.
- **Pagination** on Admin → Requests and Admin → People (25 per page).
- **Email alerts** for every new request through Resend, sent after the response (`after()`), with Reply-To set to the client.
- **Guest enquiries** (see item 19) with a hidden bot field, 3 per email address and 50 in total per hour.
- **Google sign-in** is offered on the Create account screen too.

## 25. Admin ↔ client connection and phone layout (2026-10-23, verified locally)

- **Clients answer proposals:** Accept/Decline on the dashboard and project page (`respond_to_proposal()` in the 2026-10-23 migration). The team gets a notification, an email alert, and a note in the conversation; accepting moves the lead to Won. Expired, draft, already-answered, and other clients' proposals are refused.
- **Client dashboard:** a "Needs your attention" box (unread messages, proposals to answer, invoices due); correct singular/plural counts.
- **Email:** the team is emailed when a client writes; clients are emailed when the team replies, once `ALERT_EMAIL_FROM` is on a verified domain.
- **Phone layout:** the admin console starts with its tabs (current tab scrolled into view); stats two per row; create forms fold away once their list has items; CRM stages scroll inside their columns; message threads open at the newest message with the reply box in reach; larger tap targets.
- **Fixed:** the bell did not update after marking notifications read; "Remove data" stayed stuck on a network error.

## 26. Still open

- **Lighthouse's simulated mobile scores** cannot be compared between localhost and Vercel. Locally, the old and new code both score 93–95 (LCP about 3.1 s, simulated); on the live site the old code scores 96–97. Re-measure on the live site after deploying.
- **Headless Chrome can leave prefetches of cached pages pending** after a full page load cuts off the previous page's prefetches (the browser's HTTP cache, not the server: the same request is answered in 2 ms). Clicking links is not affected (58 ms in testing). Tests avoid waiting for network silence.
- **Unbounded admin lists:** CRM, proposals, projects, and invoices load every row. Fine at today's volume; the CRM's profile lookup sends every client id in one URL and will need batching past a few hundred clients.
- **Guest requests are not linked to an account** if the guest signs up later with the same email.
- **No IP address in the activity log** (the database trigger cannot see it).
- **No online invoice payment;** clients see invoices but pay outside the site.

## 27. Local fixes and open verification — 26 October 2026

Implemented message history beyond 100 rows, cursor-based older-history navigation, safer read-state updates, strict object/selection validation, generic admin error responses, bounded rate limiting, cart storage error handling, bundled fonts and isolated test configuration. The new migration hardens direct request writes and guest/client quota concurrency without rewriting historical rows.

Unit/API checks pass. Database/RLS/concurrency tests and browser checks remain blocked by Docker/Chrome access. The SQL migration must be tested and approved before applying it; it is required before deploying the updated message-history endpoint. No current full npm dependency-audit result is available because registry access failed.

Remaining product work includes atomic free-standing conversation creation, large-admin-list pagination, orphaned document cleanup, catalog outage states, and production monitoring. See the prioritized checklist in `audit-2026-10-26.md`; the application is not certified production-ready.

## 28. Frontend and conversation follow-up — 27 October 2026

- Shared design and responsive navigation were refined across the 31 page routes. Marketplace/cart failures now have loading, outage and retry states; the cart does not substitute fallback prices. Full scope: `frontend-update-2026-10-27.md`.
- Atomic conversation creation is implemented in source and depends on `2026-10-27-conversation-creation.sql`, which is **not applied**. Request/project retries reuse a thread; unlinked creations are not deduplicated.
- 79 unit/API tests pass; the isolated build passes. 57 browser/database tests are collected but **not executed**. Do not infer visual, RLS, concurrency or production integration sign-off from these results.
- Admin list pagination at scale, durable orphaned-file cleanup, distributed rate limiting and approved monitoring remain follow-ups.
