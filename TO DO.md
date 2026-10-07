# Project TODO

Updated October 3, 2026 after a source review and local checks. Findings below are based on the current working tree, including the in-progress CreatorDB integration. External services and complete user journeys have not been verified end to end.

## P0 — Access control and private data

- [ ] **Protect private file downloads.** `app/api/s3-image/[...key]/route.ts` serves arbitrary known bucket keys without authentication and uses public caching. Verification documents and message attachments use this same upload path. Separate public assets from private files; authorize private downloads against the document owner, conversation participants, or authorized admins; use private caching. Also address the publicly served local-upload fallback in `lib/upload.ts`. Verify unauthorized users cannot download private files even with a valid URL.
- [ ] **Authorize realtime message subscriptions.** Message publishing and the inbox currently use public `conversation-${id}` and `user-${id}` channels. Move them to private channels with server-side membership checks. Update the inbox and header subscribers together. Verify outsiders cannot subscribe to another conversation or user's notifications.
- [ ] **Check AI chat ownership before writing.** `app/api/ai-chat/route.ts` accepts an existing `chatId` without checking its owner before inserting messages or changing its title. Resolve chats by both ID and authenticated user ID before charging credits or writing. Add a cross-user authorization regression test.
- [ ] **Keep CreatorDB contact information server-side.** `lib/creatordb.ts` returns `_email`, and `app/api/discovery/club-enrich/route.ts` serializes the result directly. Use an explicit public response shape and keep email lookup separate. Sanitize contact information in biographies as well. Verify enrichment responses contain no internal contact fields for either provider.

## P1 — Payments and reliable state changes

- [ ] **Connect payments to the collaboration model.** Checkout currently creates an application-linked payment, while collaboration pages read `collaboration.payment`. Use the collaboration as the funded unit of work, calculate amounts and currency from its locked terms, and preserve compatibility for legacy application-linked payments. Ensure displayed and charged amounts agree and funded payments appear on both dashboards.
- [ ] **Make payment release safe to retry.** `app/api/stripe/release/route.ts` checks `HELD` before making a transfer, without an atomic claim or Stripe idempotency key. Add both, validate the collaboration's release eligibility server-side, and recover safely when Stripe succeeds but the database update fails. Verify concurrent requests produce only one transfer.
- [ ] **Make checkout recoverable.** Checkout creates a payment row before creating the PaymentIntent and rejects subsequent attempts whenever a payment row exists. Resume eligible pending/failed attempts safely so abandoned checkout or an upstream failure does not permanently block funding.
- [ ] **Prevent payment webhook state regression.** `payment_intent.succeeded` unconditionally sets the payment to `HELD`. A replay after release could make it releasable again. Apply guarded state transitions and test repeated and out-of-order webhook delivery.
- [ ] **Make batch outreach safe to retry and resume.** `app/api/outreach/[id]/send/route.ts` separately reads `READY` and writes `SENDING`, allowing concurrent sends. Atomically claim the batch, track recipient-level progress, and reconcile partial failures, refunds, and recorded credit costs. Provide recovery for interrupted batches rather than leaving them stuck in `SENDING`.
- [ ] **Finalize Stripe Connect product decisions and verify money movement.** Retain the existing project blocker: decide the intended funding, release, cancellation, refund, and dispute behavior, then validate the complete flow in Stripe test mode.

## P1 — Finish the discovery provider transition

- [ ] **Use the selected provider throughout batch outreach.** `lib/outreach-ai.ts` uses the new provider abstraction for search but still calls Influencers Club directly for enrichment and email lookup. Route all three operations through the abstraction and test a CreatorDB-only configuration.
- [ ] **Verify provider parity and caching.** Cover normalized fields, supported platforms, filters, pagination, contact redaction, error handling, cache behavior, and credit/refund behavior for both providers. CreatorDB's search cache probe currently always returns `null`; confirm the intended caching layer actually persists its results and avoids unintended repeated vendor calls.

## P2 — Validation and development environment

- [ ] **Resolve the failing cache test.** `tests/influencers-club-cache.test.ts` expects a cached profile unchanged, but enrichment now adds `bio: null`. Decide the intended normalized response contract, then align implementation and assertion.
- [ ] **Run wallet tests against an isolated test database.** The review run could not reach PostgreSQL at `localhost:5432`; 25 wallet tests were skipped after suite setup failed. Configure a dedicated test database and rerun the wallet suite.
- [ ] **Resolve duplicate generated Next.js type files.** `npx tsc --noEmit --incremental false` failed on duplicate declarations in `.next/types/cache-life.d 2.ts` and `.next/types/routes.d 2.ts`. Regenerate the affected build output and rerun type checking; investigate how duplicate generated files appeared.
- [ ] **Repair the discovery experiment's native SQLite dependency.** Its `better-sqlite3` binary targets Node module version 115, but the review environment requires 120. Rebuild under the intended Node version and rerun the eight pipeline tests. The other 67 experiment tests passed.
- [ ] **Complete end-to-end verification after fixes.** Cover signup and verification, campaign approval and application, collaboration drafts and revisions, private messaging and attachments, discovery with each provider, outreach retry behavior, and subscription/credit/payment flows. The review did not establish a clean production build or live integration result.

## P2 — Product completion and documentation

- [ ] **Finish saved-search alerts.** `components/alerts/AlertsPageClient.tsx` renders a read-only active toggle and controls without persistence handlers. Implement search creation, editing, deletion, frequency/preferences persistence, and alert delivery; verify the full workflow.
- [ ] **Surface verification states consistently.** Retain the previous follow-up to expose the verification-state helpers in `lib/status.ts` through the relevant UI badges.
- [ ] **Use shared campaign status badges.** Replace the dashboards' ad-hoc campaign status pills with `StatusBadge`, preserving translated labels and consistent colors.
- [ ] **Update setup and architecture documentation.** Align README routes and development port with the current application, explain legacy quota versus wallet behavior (`CREDIT_SYSTEM_ENABLED`), document provider selection, and distinguish registered creators (`InfluencerProfile`) from discovered creators (`CreatorProfile`). Keep the standalone discovery and video experiments clearly identified.

## Corrected previous TODO

- Draft file uploads are already implemented through the creator collaboration page and the `upload_draft` action in `app/api/collaborations/[id]/route.ts`. They are no longer listed as missing; their authorization, storage, and full user flow still need the validation described above.

## Review check results

| Check | Result |
| --- | --- |
| Main test suite | 25 passed, 1 cache assertion failed, 25 wallet tests skipped following database setup failure |
| Discovery experiment | 67 passed, 8 pipeline tests failed due to native SQLite/Node version mismatch |
| TypeScript | Failed on duplicate generated declarations under `.next/types` |

No implementation fixes were made as part of the review or this TODO update.
