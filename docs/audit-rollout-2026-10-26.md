# Request and message safety: rollout

This change has **not** been deployed and its SQL has **not** been executed against a database in this audit. Local Docker and Chrome were unavailable. Unit/API tests use mocks; they do not prove PostgreSQL policy or concurrency behavior. Run the local integration suite successfully before considering a release.

## Local verification

Use the Node version in `.nvmrc` (22.14.0). The installed Vitest toolchain supports Node 22.12+, Node 24, or Node 26+; Node 20 is not supported for this project's development checks.

`npm run check:local` performs typechecking, Vitest, formatting, and a production-mode compilation with an intentionally disconnected loopback Supabase URL, fake key, and email disabled. It writes `.next-local-check` and restores Next's generated type-path changes. This verifies compilation and local tests only; do not publish this build. Expected catalog/settings fetch warnings do not indicate successful database access. No real environment files are modified.

For full integration testing, use the existing disposable local Supabase workflow with Docker available:

1. `npm run e2e:db` — resets only the dedicated local test stack and loads the schema, seed, and migrations. It deletes previous data in that disposable test stack.
2. `npm run test:e2e` — includes the existing suite plus long message history, quota races, timestamp tampering, forged catalog snapshots, private/monotonic read cursors, and storage-failure regressions, atomic conversation retries, and frontend viewport/navigation/catalog-outage scenarios.

Do not substitute a production URL. Playwright rejects non-loopback Supabase URLs. Disable real email credentials when running local integration tests.

## Release order (requires owner approval)

1. Confirm a backup and the actual applied migration history. The repository alone cannot establish the production schema state.
2. Test `2026-10-26-request-and-message-safety.sql` on a disposable/staging copy **after** all dated migrations through `2026-10-23-reliability-and-guest-enquiries.sql`. Then test `2026-10-27-conversation-creation.sql`. Apply both twice to verify rerun safety.
3. With approval, apply both new migrations in date order before releasing the application. The messages API calls `mark_conversation_read` and conversation creation calls `start_client_conversation`; deploying without those functions makes the corresponding flows fail explicitly. The SQL runs in one transaction, changes no existing row values, and limits lock waits to 5 seconds and statements to 60 seconds. A large message index may require a separately reviewed maintenance plan if that timeout is insufficient.
4. Build with the intended deployment environment, then release only after approval. Use a fresh production build, never `.next-local-check`.
5. With approval for production smoke tests, verify guest and signed-in enquiries, client/admin replies, a thread over 100 messages, older history, unread badges, and permission denial between two different clients. Check the actual email provider separately.

## Compatibility and rollback

- Existing request RPC signatures are retained. Existing row ownership and admin-role semantics are unchanged.
- Message GET responses remain arrays; an `X-Next-Cursor` response header and optional `before` query parameter add history pagination. Ordering in returned arrays remains chronological.
- New requests enforce lengths and use server timestamps. New service snapshots use the active catalog. Historical requests/snapshots are preserved; no claim is made that old records are already valid.
- Roll back the application to its prior release if needed, retaining the additive database hardening. Old code does not need `mark_conversation_read`, but remains compatible with its presence and with canonical snapshots.
- If the migration fails before commit, roll back that transaction; no partial migration should be committed. Do not disable RLS, remove validation, or run the destructive reset script as a rollback.
- Reverting database security functions to their old definitions reintroduces the confirmed weaknesses. That is a separate, explicitly approved decision, not an automatic rollback step.

## Remaining limitations

- The proxy limiter is bounded but per process; it depends on the hosting platform's forwarded-IP handling. Database quotas cover request submissions, not all messaging/auth traffic. Distributed abuse protection remains a separate follow-up.
- Conversation creation is now transactional, and linked request/project retries reuse an existing thread. The 27 October migration remains unexecuted in this audit; validate RLS/concurrency and membership repair locally. Unlinked conversation requests intentionally create new threads.
- Some admin lists are still unpaginated; storage cleanup failures can leave orphaned files. Those flows were inspected but are not changed in this batch.
- No live schema, OAuth provider, mail delivery, storage provider, production performance, or cross-browser behavior is certified by this audit.
