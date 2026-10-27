# Frontend and reliability update — 27 October 2026

Implemented in the existing repository. No push, deployment or live database change was performed. The existing navy, stone and crimson identity and bundled fonts are retained; no dependency or external design service was added.

## Page coverage

The application has 31 `page.tsx` routes. Shared layout, typography, controls and surface styles affect all of them; this does not mean every page was individually redesigned or visually verified.

| Pages | Improvements |
| --- | --- |
| Home, about, portfolio and service detail pages | Shared cards, buttons, responsive header, consistent corners and wrapping of long content. Existing content/assets retained. |
| Services | More readable service cards, accessible selected categories/results, clear-filter action, separate empty/outage states, uncached catalog retry, and a mobile/tablet cart review bar. |
| Cart | Explicit loading and retry states, current catalog prices, preserved selections during outages, unavailable-service removal, and submission guards. |
| Contact | Contained form panel with clear introductory copy and consistent fields. |
| Login, signup, password reset, admin login | Shared control sizing, card presentation and mobile input text sizing. |
| Privacy and terms | Readable content width, section spacing and visible inline links; legal wording retained. |
| Client dashboard, messages and project detail | Shared workspace navigation, clearer surfaces, responsive layout and long-message wrapping. |
| All admin pages | Compact headings, sidebar that scrolls within the viewport, a labelled phone/tablet section selector, consistent panels/controls and clearer table headers/hover states. |
| Loading, errors and missing pages | Shared skeleton with a status announcement, recovery/contact actions, focusable skip-link destination, responsive controls. |
| Animation showcase | Visible default content without waiting for JavaScript; title sizing for narrow screens; explicit replay reload. Client navigation cannot restart a dismissed intro and hide content again. |

Mobile navigation now shows the active page, closes on outside interaction/focus, closes on navigation including the cart, and returns focus to its trigger on Escape. It is a disclosure navigation, not an inaccurately labelled modal dialog.

## Related reliability work

- Catalog API failures return 503 with no-store headers. Successful empty catalogs remain 200. Public catalog and quote screens do not substitute bundled prices; legacy informational pages retain their existing fallback policy.
- Dynamic catalog JSON-LD uses the existing safe serializer.
- Conversation and participant creation use one invoker-rights PostgreSQL RPC. It checks ownership and project/request consistency, serializes linked retries, reuses existing threads, and can repair absent membership without resetting read state. The migration is prepared only.

## Verification

- 79 unit/API tests pass, including six catalog availability cases and four conversation RPC cases.
- TypeScript, formatting, and the isolated production build pass with Supabase/email disconnected. This build is not a deployment artifact.
- Playwright collects 57 tests in 8 files. New frontend coverage includes 360/768/1280px public layouts, mobile navigation, filter recovery, cart outage/retry, client workspace tabs and every admin selector destination. The suite also includes concurrent conversation retry/ownership/membership repair checks.
- **Browser tests and SQL were not executed.** Existing Docker socket and Chrome launch restrictions prevent these checks. Screenshots, actual responsive rendering, browser accessibility and real database concurrency are not certified by compilation or test collection.

## Release and remaining work

Apply and verify the 26 October safety migration and the 27 October conversation migration before the matching application release. Follow `../docs/audit-rollout-2026-10-26.md`.

Remaining work includes real browser/database verification, approved monitoring, larger admin-list pagination, durable file-cleanup retries and distributed abuse protection. No external account, secret or paid provider was configured.
