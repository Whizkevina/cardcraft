# CardCraft — Production Release Checklist

Use this checklist before every production deployment. Items marked 🔴 are blockers.

---

## 1. Environment Variables

| Variable | Status | Notes |
|---|---|---|
| `DATABASE_URL` | 🔴 Required | PostgreSQL connection string (Supabase, Railway Postgres, etc.) |
| `SESSION_SECRET` | 🔴 Required | Min 32 random chars. Use `openssl rand -hex 32` |
| `PAYSTACK_SECRET_KEY` | 🔴 Required for payments | `sk_live_...` from Paystack dashboard |
| `PAYSTACK_PUBLIC_KEY` | 🔴 Required for payments | `pk_live_...` from Paystack dashboard |
| `GMAIL_USER` | 🔴 Required for email | Full Gmail address |
| `GMAIL_APP_PASSWORD` | 🔴 Required for email | 16-char App Password (not Gmail password) |
| `APP_URL` | 🔴 Required | Your deployed domain e.g. `https://cardcraft.app` |
| `NODE_ENV` | 🔴 Must be `production` | Enables HTTPS cookies, hides stack traces, validates secrets |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Required for Google Sign-In |
| Email/password auth | 🔴 Required for email features | Send by Email and password reset require a signed-in account |

Copy [`.env.example`](.env.example) to `.env.local` locally; set all variables on your hosting platform for production.

---

## 2. Infrastructure

- [ ] 🔴 App is served over **HTTPS** — required for `cookie.secure = true`
- [ ] 🔴 **PostgreSQL** database is provisioned and reachable from the app
- [ ] Session store uses **connect-pg-simple** (sessions table created on startup)
- [ ] Server has at least **512 MB RAM** (bcrypt + canvas processing)
- [ ] Process manager configured (Railway/Render auto-restart, or PM2 on VPS)
- [ ] Log retention configured — logs do not grow unbounded

---

## 3. Security (Post-Deploy Verification)

- [ ] 🔴 Verify `Content-Security-Policy` header is present: `curl -I https://your-domain.com/api/auth/me | grep Content-Security`
- [ ] 🔴 Verify `Strict-Transport-Security` header present (HTTPS required first)
- [ ] 🔴 Confirm `SESSION_SECRET` is **not** the default fallback value
- [ ] 🔴 Confirm `cookie.secure = true` by checking Set-Cookie response header includes `Secure`
- [ ] Rate limiting active — test login endpoint returns 429 after repeated attempts
- [ ] Paystack webhook URL registered: `https://your-domain.com/api/payments/webhook`
- [ ] Paystack test mode → live mode toggle confirmed in Paystack dashboard
- [ ] Public share links use secure tokens (`/share/:token`), not numeric IDs
- [ ] Reset token flow tested end-to-end

---

## 4. First-Time Setup

- [ ] Create admin user via local seed (`POST /api/admin/seed` — **local dev only**; disabled in production) or direct DB insert in production
- [ ] Sign in as admin and **change the default password** immediately
- [ ] Verify templates loaded: `GET /api/templates`
- [ ] Test a card download (free tier) — watermark should appear
- [ ] Create a test account, verify 3-download limit (including guest sessions)
- [ ] Test Paystack payment with test keys first, then switch to live

---

## 5. Functional Smoke Tests

Run these manually after each deployment:

**Auth**
- [ ] Register new account → session created
- [ ] Login with correct credentials → succeeds
- [ ] Login with wrong password → 401
- [ ] Forgot password → email received with reset link
- [ ] Reset password link → new password works
- [ ] Change password from Account Settings

**Editor**
- [ ] Open a template → canvas renders
- [ ] Upload a photo → appears on canvas
- [ ] Edit name text → updates in real time
- [ ] Download PNG / JPG / SVG → files download
- [ ] Send by Email (signed in) → card delivered or simulated
- [ ] Undo / Redo → works correctly

**Gallery**
- [ ] Templates visible with category filters
- [ ] Pro templates show lock for free users

**Payments**
- [ ] Paystack popup opens with correct amount (₦10,000)
- [ ] Test payment completes → account upgrades to Pro
- [ ] Pro account: no watermark, no download limit
- [ ] Payment shows in `/payments` page

**Admin Panel**
- [ ] Analytics tab shows correct counts
- [ ] Toggle user Free ↔ Pro reflects immediately
- [ ] Create/publish template → appears in gallery

**Bulk Generator (Pro only)**
- [ ] Free user sees upgrade prompt
- [ ] Pro user can upload CSV and generate cards

---

## 6. Automated Tests

```bash
npm run test:unit   # Vitest component + utility tests
npm run test:e2e    # Playwright end-to-end (requires DATABASE_URL in .env.test)
npm test            # Both suites
```

CI runs on push/PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## 7. Known Limitations (Non-blockers)

| Item | Impact | Future fix |
|---|---|---|
| Email via Gmail SMTP | 500 emails/day limit on standard Gmail | Switch to SendGrid/Resend at volume |
| `unsafe-inline` in CSP | Vite injects inline scripts | Nonce-based CSP at scale |
| No i18n | English-only UI | react-i18next for additional languages |
| Client-side export | No server-side render pipeline | Headless export service if needed |
| Background removal | Heuristic corner-color removal in the editor | Integrate dedicated API if quality needed |
| Fabric.js version | Pinned to 5.3.1 CDN (matches template JSON format) | Evaluate Fabric 7 migration separately |

---

## 8. Rollback Procedure

```bash
# On Railway
railway rollback --environment production

# On VPS
git checkout <previous-commit-hash>
npm run build
pm2 restart cardcraft
```

---

## 9. Monitoring (Recommended)

- [ ] Set up **UptimeRobot** (free) to ping `https://your-domain.com/api/auth/me` every 5 minutes
- [ ] Configure hosting platform alerts on deploy failure
- [ ] Watch logs for repeated 401/403/429 spikes

---

*Last reviewed: May 2026*
