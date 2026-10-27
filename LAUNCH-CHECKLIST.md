# Launch checklist

What is still open before TechJest is fully launch-ready. Items marked _owner_ need information or a decision from the founders.

## Business details (owner)

- [x] Chitwandeep Kaur's job title: Developer.
- [x] Amit's surname is "Singh" (corrected October 2026).
- [ ] WhatsApp business number, saved in Admin → Website settings.
- [ ] Custom domain (for example `techjest.in`), then set `NEXT_PUBLIC_SITE_URL` in Vercel and add the new `/auth/callback` URL in Supabase Auth.
- [ ] A professional contact email on that domain to replace the Gmail address.
- [ ] Registered company name, address, phone, GSTIN (if registered), and the company LinkedIn page for the footer.
- [ ] Real case studies, testimonials, or client logos, with the clients' permission, to replace the two sample projects.
- [ ] Professional photos of the team for the About page.
- [ ] Optional: a flat or SVG version of the logo in the site colours.

## Features that need an account or approval (owner)

- [ ] Email alerts for new enquiries (built, October 2026): create a free Resend account, then add `RESEND_API_KEY` and `ALERT_EMAIL_TO` in Vercel → Settings → Environment Variables and redeploy.
- [ ] Privacy Policy and Terms pages: approve a draft, then have it reviewed (the site collects names, emails, and phone numbers; India's DPDP Act applies).
- [ ] Client emails when the team replies (built, October 2026): verify a domain in Resend, then set `ALERT_EMAIL_FROM` in Vercel to an address on it (for example `alerts@techjest.in`).
- [x] Visitors may send an enquiry without an account (decided and built, October 2026). Guests get replies by email; signed-in clients get a workspace conversation.
- [ ] Turn on Vercel Web Analytics if visitor numbers are wanted.
- [ ] Supabase → Authentication: turn on leaked-password protection (needs the Supabase Pro plan).

## Technical sign-off

- [ ] Validate `2026-10-26-request-and-message-safety.sql` and `2026-10-27-conversation-creation.sql` with the local database/browser suite, then obtain approval to apply it before deploying the matching message-history and conversation-creation code. See `docs/audit-rollout-2026-10-26.md`. Prepared locally; not applied or integration-verified in this audit.

- [ ] Production deploy includes `vercel.json` (server region `bom1`, next to the database).
- [ ] Run `backend/supabase/migrations/2026-10-07-live-messages-and-indexes.sql` on the live database (instant message updates, one security fix, three indexes).
- [x] Run `backend/supabase/migrations/2026-10-22-security-hardening.sql` on the live database (done by the owner, 23 October 2026).
- [ ] Run `backend/supabase/migrations/2026-10-23-reliability-and-guest-enquiries.sql` on the live database BEFORE deploying the code that goes with it (request submission and unread counts depend on it).
- [ ] Supabase → Authentication → URL Configuration: Site URL is the live URL and `<live URL>/auth/callback**` is an allowed redirect (needed for password-reset emails).
- [ ] After deploying, one real password reset on the live site (the email must be opened in the same browser that asked for it).
- [x] Sign-in, dashboard, messages, and every admin page tested end to end on a local copy of the database (126 checks, October 2026).
- [ ] After deploying, one real run on the live site: a test request, an admin reply, and a proposal marked Sent.
- [ ] Spot-check on Safari/iPhone, Firefox, and Edge.
- [ ] Sitemap submitted in Google Search Console and Bing Webmaster Tools.
