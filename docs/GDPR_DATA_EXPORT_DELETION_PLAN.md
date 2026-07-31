# GDPR/NDPR Data Export & Deletion — Build Plan

**Status:** Scoped, not yet built. Nothing in this doc exists in code yet — check
`git log`/the codebase before assuming any step below is already done.

**Why this exists:** [`client/src/pages/LegalPage.tsx`](../client/src/pages/LegalPage.tsx)
already publicly promises GDPR/NDPR rights — access, erasure, restriction, data
portability (see its "Your Rights under GDPR and NDPR" section) — and tells users
to email `support@cardcraft.app` to exercise them. Today that's a fully manual
process: a staff member would have to hand-write SQL. This plan closes that gap.

It's tracked separately from [`ADMIN_DASHBOARD_ROADMAP.md`](ADMIN_DASHBOARD_ROADMAP.md)
(Tier 4 § 4.2 "Privacy & compliance") because it's large enough to need its own
scope doc — update that roadmap's status column when phases here ship.

**Estimated effort:** 8–12 hours for a careful build with testing (not a
happy-path-only version). See "Effort breakdown" at the bottom.

---

## Decisions already made (do not re-litigate without a reason)

These were deliberately chosen over alternatives — see "Alternatives considered"
for why, in case circumstances change and it's worth revisiting.

1. **Deletion is admin-mediated, not self-service, for v1.** The user still emails
   `support@cardcraft.app` (as LegalPage already says). Staff fulfill the request
   via a new admin action. No new user-facing "delete my account" button yet.
2. **Payment records are anonymized, not hard-deleted, on account deletion.**
   Strip the name/email link, keep amount/date/status/reference/plan. This is
   both a financial record-keeping need (tax/AML retention obligations) and
   explicitly permitted under GDPR Art. 17(3)(b) (retention despite an erasure
   request when there's a legal obligation).
3. **Deletion has a grace period, not instant purge.** Requesting deletion marks
   the account `pending_deletion` and force-logs-out the user immediately; a
   background sweep actually purges/anonymizes after N days (default: 14,
   admin-configurable — see "Open parameters" below).
4. **Data export scope is profile + projects + payment history.** Not analytics
   events/sessions (those are operational telemetry, not typically expected in
   a "my data" export) and not raw thumbnail/share-image blobs (project design
   JSON is enough to reproduce them; keeps the export file small).

### Alternatives considered

- *Self-service deletion now*: rejected for v1 — more exposure (accidental
  clicks, needs its own confirmation UX and abuse-prevention), and the
  admin-mediated path ships faster while the email-based process is still the
  documented one. Revisit once support volume justifies it.
- *Hard-delete payments on deletion (matches today's existing behavior)*:
  rejected — it's simpler but leaves the compliance gap this whole plan exists
  to close. Don't quietly fall back to this to save time.
- *Instant deletion, no grace period*: rejected — no undo if a request was a
  mistake or malicious (e.g. a compromised session requesting self-deletion in
  a future self-service phase).

---

## Current state (read this before writing any code)

- `shared/schema.ts` — `users.status` is `text` with enum `active | suspended`.
  No deletion-related columns exist yet.
- `server/storage/users.ts` — `deleteUser(id)` **hard-deletes** `projects`,
  `payments`, `analytics_events`, `analytics_sessions`, `session`, and `users`
  rows in one transaction. This is the behavior being replaced. Do not extend
  this function — it's the wrong shape for the new flow (build new functions;
  decide whether to keep `deleteUser` around for a different purpose, like a
  true hard-delete escape hatch for spam/test accounts, or remove it once
  nothing calls it).
- `server/routes/admin.ts` — `DELETE /api/admin/users/:id` calls `deleteUser`
  directly. This route's behavior needs to change or be replaced.
- `client/src/pages/AdminPage.tsx:800` — `onDelete={id => deleteUser.mutate(id)}`
  wires the admin UI's delete action to that route.
- `server/analyticsService.ts:356` — `runRetentionCleanup()` is the existing
  pattern for "sweep something on a schedule" in this codebase: it runs once at
  server boot (called from `server/routes.ts`), no job queue involved. Follow
  this exact pattern for the deletion-purge sweep — don't introduce new
  scheduling infrastructure for this.
- `client/src/pages/AccountSettings.tsx` — has `SurfaceCard` sections for
  Profile, Appearance, Subscription, Change Password. A new "Privacy & Data"
  section fits the same pattern for the export button.
- CSV export pattern to mirror for the export endpoint's plumbing (not its
  format — this is JSON, not CSV): `server/csv.ts`, `server/routes/admin.ts`'s
  `/export` routes, added in the CSV-exports work (see git log
  "Add CSV exports for admin Users, Payments, and Projects tabs").

---

## Build plan

### 1. Schema changes

In `shared/schema.ts`:
- Extend `users.status` enum: `["active", "suspended", "pending_deletion"]`
- Add `users.deletionRequestedAt: timestamp` (nullable)
- Add `users.deletionScheduledFor: timestamp` (nullable) — `deletionRequestedAt`
  + grace period days at request time
- Run `npm run db:generate` to create the migration, `npm run db:migrate`
  locally to verify it applies cleanly. Do NOT hand-edit `migrations/*.sql`.

Grace period length: read from `system_meta` (same pattern as
`analytics_retention_days`/`audit_retention_days` in
`server/storage/analytics.ts`), default 14, admin-configurable. Don't hardcode it.

### 2. Storage layer (`server/storage/users.ts` or a new `server/storage/gdpr.ts`)

- `requestUserDeletion(id, graceDays)` — sets status/timestamps, calls
  `destroyUserSessions(id)`
- `cancelUserDeletion(id)` — reverts status to `active`, clears both timestamps
- `purgeExpiredDeletions()` — the scheduled sweep:
  - Find all users where `status='pending_deletion' AND deletionScheduledFor <= now()`
  - For each: anonymize `users` row (name/email → redacted placeholders — decide
    exact placeholder format, e.g. `deleted-user-{id}@cardcraft.invalid`; null
    out `resetToken`, `adminNote`, etc.), **do not delete the row** (payments
    still reference `userId`)
  - Hard-delete their `projects`, `analytics_events`, `analytics_sessions`,
    `session` rows (no retention obligation on these)
  - Leave `payments` rows in place — they already only carry `userId`, no
    denormalized name/email, so anonymizing the `users` row is sufficient;
    admin payment views naturally show the anonymized name from then on
  - Audit-log `user.deletion_purged` per user with a summary of what was
    anonymized vs deleted

### 3. Admin routes (`server/routes/admin.ts`)

- `POST /api/admin/users/:id/request-deletion` — `requirePermission("users:delete")`,
  audit-log `user.deletion_requested`
- `POST /api/admin/users/:id/cancel-deletion` — same permission, audit-log
  `user.deletion_cancelled`
- Decide: keep `DELETE /api/admin/users/:id` as a true immediate hard-delete
  (e.g. for spam/test accounts where compliance doesn't apply), or remove it
  in favor of the request/cancel/purge flow entirely. Get sign-off before
  picking — this changes existing admin behavior.
- Wire `runRetentionCleanup()`'s call site in `server/routes.ts` (or add a
  sibling call) to also run `purgeExpiredDeletions()` at boot.

### 4. Admin UI (`client/src/pages/AdminPage.tsx`, `AdminUsersTab.tsx`, `UserDetailSheet.tsx`)

- Replace (or supplement) the delete button with "Request deletion" /
  "Cancel pending deletion" depending on current status
- Status badge: "Pending deletion — purges in N days" wherever user status is
  shown (list row, detail drawer)
- Decide how bulk-delete (`AdminUsersTab`'s existing multi-select delete)
  interacts with this — does it request deletion for each selected user, or
  stay as an immediate hard-delete for a different use case?

### 5. Self-service export

- `GET /api/account/export` — auth'd, no admin permission needed (exports the
  calling user's own data only, via `req.session.userId`)
- Response: JSON with `profile` (users row minus `password`/`resetToken`/
  `resetTokenExpiry`), `projects` (array: title, designJson, shareEnabled,
  createdAt, updatedAt — no thumbnail/shareImage blobs), `payments` (array:
  amount, currency, status, plan, reference, createdAt — no raw
  `paystackData`)
- Audit-log `data.export` (self-triggered, so `actorId` = the user themself)
- Client: "Download my data" button in a new "Privacy & Data" `SurfaceCard`
  section in `AccountSettings.tsx`, following the same
  `Blob`/`URL.createObjectURL`/synthetic-`<a>`-click pattern used for the
  client-side Users CSV export in `AdminUsersTab.tsx`

### 6. Docs

- Update `ADMIN_DASHBOARD_ROADMAP.md`'s Tier 4 § 4.2 rows to ✅ once shipped
- Consider whether `LegalPage.tsx`'s deletion-request copy needs a line about
  the grace period (e.g. "requests are processed within N days") — check
  current wording before assuming it needs a change

---

## Open parameters (confirm before/while building, not after)

- Exact grace period default (this doc assumes 14 days — confirm)
- Exact anonymized placeholder values for name/email (must not collide with a
  real user's email — check the `users.email` unique constraint won't reject
  the anonymization update if run twice or if `id` isn't unique enough in the
  placeholder)
- Whether `adminNote` should be preserved or cleared on anonymization (it may
  contain support context worth keeping internally — a judgment call, not
  purely technical)
- Whether the export endpoint needs rate-limiting (mirror `rateLimiters.ts`'s
  existing limiters if so — an unauthenticated-adjacent abuse vector is low
  here since it's session-authed, but worth a quick check)

## Explicitly out of scope for this phase

- Self-service deletion trigger (user-initiated, no staff involved)
- Anonymizing/exporting analytics session/event data
- Exporting raw project thumbnail/share-image binary data (only design JSON)
- Any change to how templates or admin-audit-log data is retained

---

## Effort breakdown (~8-12 hours total)

| Piece | Estimate |
|---|---|
| Schema fields + migration | 0.5 hr |
| Admin backend: request/cancel routes + storage functions | 1–1.5 hr |
| Scheduled purge logic (anonymize + cascade delete + audit log) | 1.5–2 hr |
| Admin UI: status badge, request/cancel actions | 1–1.5 hr |
| Self-service export endpoint + query | 1 hr |
| Account Settings "Download my data" button | 0.5 hr |
| Testing (real Postgres + live browser, edge cases: cancel-before-purge, re-registration with an anonymized email, pending-deletion user's share links) | 1.5–2 hr |
| Docs | 0.25 hr |

The scheduled-purge logic and its edge cases are where time actually goes —
budget for that, don't compress it to hit a smaller number.
