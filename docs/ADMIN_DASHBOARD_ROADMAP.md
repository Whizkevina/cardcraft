# Admin Dashboard Roadmap

Gradual build plan for CardCraft's admin panel — from basic SaaS standards through enterprise polish.

**Last updated:** 2026-07-30 (reconciled statuses with shipped code)  
**Live admin page:** `client/src/pages/AdminPage.tsx`  
**Admin API routes:** `server/routes/admin.ts` (`/api/admin/*`)

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | **Done** — shipped and usable |
| 🔄 | **Partial** — basic version exists; see notes for gaps |
| ⏳ | **Pending** — not started |
| 🚫 | **Deferred** — intentionally postponed |

**How to update this doc:** When you ship a feature, change its status and add the PR/commit link or date under *Shipped*.

---

## Current baseline (already shipped)

These exist today and are the foundation for Tiers 1–4.

| Feature | Status | Notes |
|---------|--------|-------|
| Admin auth gate (role = admin) | ✅ | Non-admins see access-denied screen |
| Analytics KPI cards | ✅ | Users, Pro count, cards, lifetime revenue |
| Today stats | ✅ | Signups today, cards created today |
| Pro conversion % | ✅ | Derived from user counts |
| Top templates by usage | ✅ | Bar-style usage list |
| Recent signups list | ✅ | Name, date, tier badge |
| User list | ✅ | Name, email, tier, role, downloads today |
| User search (name/email) | ✅ | Single search field |
| Toggle Free ↔ Pro | ✅ | Per-user button |
| Toggle user ↔ admin role | ✅ | Shield button; can't demote self |
| Template list | ✅ | Category, usage count, status badge |
| Publish / unpublish template | ✅ | Eye toggle |
| Edit template in editor | ✅ | Link to `/editor/t/:id` |
| Delete template | ✅ | With toast confirmation via mutation |
| Create template (basic) | ✅ | Title + background color dialog |
| Dev admin seed button | ✅ | Local only; production uses `npm run db:seed-admin` |
| Auto-refresh analytics | ✅ | 30s polling |

---

## Tier 1 — Standard SaaS essentials

*Goal: support real customers, billing questions, and accountability.*

### 1.1 User detail view

| Task | Status | Notes |
|------|--------|-------|
| Click user row → detail drawer or page | ✅ | Right-side sheet |
| Show join date (`createdAt`) | ✅ | List + detail drawer |
| Show last login / last active | ✅ | `last_login_at` + auth hook |
| Show auth method (email vs Google) | ✅ | `auth_provider` column |
| Project count for user | ✅ | List + detail drawer |
| Total downloads / downloads this period | ✅ | `totalDownloads` + `downloadsToday` |
| Share links created count | ✅ | `sharedCount` in list + drawer |
| Payment history on user profile | ✅ | Detail drawer |
| Action: send password reset email | ✅ | Admin POST + audit log |
| Action: suspend / ban user | ✅ | `status` enum + middleware |
| Action: force logout (invalidate sessions) | ✅ | Session table purge |
| Action: grant Pro with optional expiry + reason | ✅ | Tier PATCH + expiry date |

### 1.2 Payments & billing tab

| Task | Status | Notes |
|------|--------|-------|
| New **Payments** tab in admin | ✅ | |
| List all transactions | ✅ | `GET /api/admin/payments` |
| Filter by status (success / pending / failed) | ✅ | |
| Filter by date range | ✅ | `from` / `to` query params |
| Filter by user (email search) | ✅ | |
| Show amount, currency, plan, created date | ✅ | |
| Manual Pro grant with audit reason | ✅ | Detail drawer + `reason` on tier PATCH |
| Revenue this month / period | ✅ | Header stat on Payments tab |
| Refund status field (manual tracking) | ✅ | `refundNote` column + inline edit |

### 1.3 Activity & audit log

| Task | Status | Notes |
|------|--------|-------|
| `admin_audit_log` table | ✅ | Created on app init |
| Log tier changes | ✅ | Includes optional `reason` |
| Log role changes | ✅ | |
| Log template delete / publish | ✅ | Publish/unpublish + delete |
| Log manual Pro grants | ✅ | Via tier change with reason |
| **Activity** tab: searchable log | ✅ | |
| Export audit log CSV | ✅ | Admin Activity tab export buttons |

### 1.4 User search & filters

| Task | Status | Notes |
|------|--------|-------|
| Search by name or email | ✅ | Already on Users tab |
| Filter: Free / Pro | ✅ | |
| Filter: Admin only | ✅ | Role filter (admin / user) |
| Filter: joined date range | ✅ | From / to date inputs |
| Filter: inactive 30+ days | ✅ | Uses `lastLoginAt` or join date |
| Filter: hit download limit today | ✅ | “At download cap” toggle |
| Sort: newest, most projects, most downloads | ✅ | |

**Tier 1 exit criteria:** Admin can answer “who is this user?”, “did they pay?”, and “who changed their plan?” without touching the database.

---

## Tier 2 — CardCraft-specific ops

*Goal: content moderation, support workflows, and product usage insight.*

### 2.1 Projects & content moderation

| Task | Status | Notes |
|------|--------|-------|
| New **Projects** tab | ✅ | `AdminProjectsTab` |
| List saved cards: user, title, template, updated | ✅ | |
| Show share enabled + share token | ✅ | Live / Off badge |
| Open shared preview (public URL) | ✅ | `/share/:token` |
| Disable / revoke share link | ✅ | PATCH revoke-share + audit |
| Delete user project (support) | ✅ | Admin-only delete with audit |
| Filter by shared-only | ✅ | Toggle on Projects tab |

### 2.2 Usage & limits dashboard

| Task | Status | Notes |
|------|--------|-------|
| Widget: users at download cap today | ✅ | Analytics tab ops widgets |
| Widget: bulk generate usage (Pro) | ✅ | `AdminOpsWidgets` "Bulk generate (30d)" KPI card, backed by `getBulkGenerateCount30d` |
| Widget: share link creation count | ✅ | Active share links widget |
| Widget: export format breakdown (PNG/JPG/SVG) | ✅ | `AdminOpsWidgets` "Export formats" panel, backed by `getExportFormatBreakdown` |
| List users near free project limit | ✅ | `FREE_PROJECT_LIMIT` in schema |

### 2.3 Support tools

| Task | Status | Notes |
|------|--------|-------|
| Read-only “view as user” (My Cards) | ✅ | Session-based impersonation (`POST/DELETE /api/admin/impersonate/:id`) + `ImpersonationBanner` — staff can browse a user's actual `/projects` read-only and exit; writes are blocked via `blockIfImpersonating` |
| Admin-triggered password reset | ✅ | Overlap 1.1 |
| Internal note per user | ✅ | `users.admin_note` + save in detail drawer |
| Copy user ID / email quick actions | ✅ | Detail drawer header |

### 2.4 System health

| Task | Status | Notes |
|------|--------|-------|
| Paystack webhook last success / failure | ✅ | `system_meta.paystack_webhook_last` |
| Email (SMTP) send status indicator | ✅ | Config present vs missing |
| Recent server errors count (24h) | ✅ | `recordServerError()` middleware |
| Database connectivity badge | ✅ | Health strip on admin load |

**Tier 2 exit criteria:** Support can handle abuse reports, stuck users, and usage questions from the admin UI alone.

---

## Tier 3 — Growth & product operations

*Goal: understand conversion, operate the template catalog, and communicate with users.*

### 3.1 Analytics depth

| Task | Status | Notes |
|------|--------|-------|
| Signups chart (7 / 30 / 90 days) | ✅ | Recharts area chart on Analytics tab |
| Revenue chart by period | ✅ | |
| Free → Pro conversion funnel | ✅ | Funnel widget on Analytics tab |
| Template performance by category | ⏳ | Group `topTemplates` by category |
| Churn signal: inactive Pro users (14d) | ⏳ | Needs last active |
| Cards created over time | ✅ | Area chart |
| Real-time active users & live feed | ✅ | Session heartbeats + `/api/admin/analytics/live` |
| Page / device / browser / referrer breakdown | ✅ | Telemetry + dashboard widgets |
| Audit: severity, session, UA, masked IP, integrity hash | ✅ | Extended `admin_audit_log` |
| Audit export CSV / JSON | ✅ | `/api/admin/audit-log/export` |
| Retention policy (analytics + audit days) | ✅ | `system_meta` + startup purge |
| Failed login audit events | ✅ | `user.login_failed` |
| Share link view tracking | ✅ | `share.view` on public share route |

### 3.2 Template operations

| Task | Status | Notes |
|------|--------|-------|
| Duplicate template | ⏳ | |
| Mark template as **featured** (landing hero pool) | ⏳ | `featured` boolean |
| Toggle **Pro-only** in admin UI | ✅ | Crown toggle button per template row + checkbox in the create-template dialog |
| Reorder gallery (drag or sort order field) | ⏳ | `sort_order` column |
| Regenerate preview thumbnail (admin button) | ⏳ | Wrap `npm run db:previews` logic in API |
| Bulk publish / unpublish by category | ⏳ | |

### 3.3 Announcements & feature flags

| Task | Status | Notes |
|------|--------|-------|
| Site-wide banner message | ⏳ | `site_settings` table or JSON config |
| Feature flags (bulk beta, etc.) | ⏳ | Env or DB-backed flags |
| Admin UI to edit banner / flags | ⏳ | Settings tab |

### 3.4 Team admin

| Task | Status | Notes |
|------|--------|-------|
| Role: Support (users read + tier, no delete) | ✅ | `server/permissions.ts` `StaffRole` — support gets read/write on users & payments, no delete/role-change |
| Role: Content (templates only) | ✅ | `content` role — templates read/write + analytics read only |
| Role: Super admin (full access) | 🔄 | Current single `admin` role — still no tier above it |
| Permission checks per route | ✅ | `requirePermission(...)` middleware on every `/api/admin/*` route in `server/routes/admin.ts` |

**Tier 3 exit criteria:** Product decisions (what templates to build, who converts, what to feature) are data-driven from the dashboard.

---

## Tier 4 — Enterprise polish

*Goal: compliance, exports, reliability — when you have meaningful user volume.*

### 4.1 Data export

| Task | Status | Notes |
|------|--------|-------|
| Export users CSV | ✅ | Client-side export of the currently filtered Users tab list (`AdminUsersTab`) |
| Export payments CSV | ✅ | `GET /api/admin/payments/export`, honors the tab's status/email/date filters |
| Export projects metadata CSV | ✅ | `GET /api/admin/projects/export`, honors the tab's search/shared-only filters |
| Scheduled email report (weekly KPIs) | 🚫 | Optional automation |

### 4.2 Privacy & compliance

Fully scoped (schema, endpoints, storage functions, UI, effort estimate, open
parameters) in [`GDPR_DATA_EXPORT_DELETION_PLAN.md`](GDPR_DATA_EXPORT_DELETION_PLAN.md) —
read that doc before starting any of the three rows below.

| Task | Status | Notes |
|------|--------|-------|
| User data export (GDPR package) | ⏳ | Scoped: JSON download of profile, projects, payments — see plan doc |
| User data deletion request workflow | ⏳ | Scoped: admin-mediated, grace period, anonymize-not-delete payments — see plan doc |
| Deletion audit trail | ⏳ | Scoped as part of the same plan (rides on existing `admin_audit_log`) |

### 4.3 Advanced operations

| Task | Status | Notes |
|------|--------|-------|
| Rate limit override per user | ⏳ | |
| Paystack webhook replay / manual verify | ✅ | `POST /api/admin/payments/:id/verify` — re-runs Paystack transaction verification for a pending/failed payment and reconciles status + Pro tier; "Verify" button on Payments tab; audit-logged as `payment.manual_verify` |
| Email campaign hook (dormant signups) | 🚫 | Integrate later with Mailchimp etc. |
| Multi-admin concurrent edit warnings | 🚫 | Low priority |

**Tier 4 exit criteria:** Ready for scale, audits, and regulatory requests without emergency SQL.

---

## Recommended implementation order

Build in this sequence to maximize value early:

```
Phase A (Tier 1 core)
  1. User detail drawer + join date + project count + payments on profile
  2. Payments tab (list + filters)
  3. Audit log table + log tier/role changes
  4. User filters (Pro/Free, sort by newest)

Phase B (Tier 2 support)
  5. Projects tab + revoke share link
  6. Download-cap widget + internal user notes
  7. System health strip (Paystack, email config)

Phase C (Tier 3 growth)
  8. Signups + revenue charts
  9. Template: Pro toggle, featured flag, regen preview
  10. Site banner / feature flags

Phase D (Tier 4)
  11. CSV exports
  12. GDPR export/delete workflow
```

---

## Schema additions (planned)

Track migrations needed as tiers ship:

| Column / table | Tier | Purpose |
|----------------|------|---------|
| `users.last_login_at` | 1 | ✅ Shipped Phase A |
| `users.status` (`active` / `suspended`) | 1 | ✅ Shipped Phase A |
| `users.admin_note` | 2 | Support notes |
| `users.pro_expires_at` | 1 | ✅ Shipped Phase A |
| `users.auth_provider` | 1 | ✅ Shipped Phase A |
| `users.total_downloads` | 1 | ✅ Shipped Phase A |
| `payments.refund_note` | 1 | ✅ Shipped Phase A |
| `admin_audit_log` | 1 | ✅ Shipped Phase A |
| `templates.featured` | 3 | Landing hero pool |
| `templates.sort_order` | 3 | Gallery ordering |
| `site_settings` (key/value) | 3 | Banner, flags |

---

## Shipped log

Record completed phases here as you go.

| Date | Item | Commit / PR |
|------|------|-------------|
| — | Baseline admin (analytics, users, templates) | Pre-roadmap |
| 2026-05-20 | **Phase A** — user drawer, payments tab, audit log, filters | `9ffd301` |
| 2026-05-20 | **Phase A leftovers** — last login, auth provider, suspend/reset/logout, Pro expiry, payment date filter, refund notes, inactive/joined filters | (pending push) |
| 2026-07-30 | Status reconciliation — support/content roles, per-route permission checks, read-only impersonation, and the bulk-generate/export-format ops widgets were already shipped but still marked ⏳/🔄 in this doc | doc-only, no code change |

---

## Related docs

- [README.md](../README.md) — setup, admin seed, env vars
- [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) — deploy checklist
- [GDPR_DATA_EXPORT_DELETION_PLAN.md](GDPR_DATA_EXPORT_DELETION_PLAN.md) — full build plan for Tier 4 § 4.2, not yet implemented
