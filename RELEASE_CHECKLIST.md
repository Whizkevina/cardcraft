# CardCraft — Production Release Checklist

Use this checklist before every production deployment. Items marked 🔴 are blockers.

---

## 1. Environment Variables

| Variable | Status | Notes |
|---|---|---|
| `SESSION_SECRET` | 🔴 Required | Min 32 random chars. Use `openssl rand -hex 32` |
| `PAYSTACK_SECRET_KEY` | 🔴 Required for payments | `sk_live_...` from Paystack dashboard |
| `PAYSTACK_PUBLIC_KEY` | 🔴 Required for payments | `pk_live_...` from Paystack dashboard |
| `GMAIL_USER` | 🔴 Required for email | Full Gmail address |
| `GMAIL_APP_PASSWORD` | 🔴 Required for email | 16-char App Password (not Gmail password) |
| `APP_URL` | 🔴 Required | Your deployed domain e.g. `https://cardcraft.app` |
| `NODE_ENV` | 🔴 Must be `production` | Enables HTTPS cookies, hides stack traces |

---

## 2. Infrastructure

- [ ] 🔴 App is served over **HTTPS** — required for `cookie.secure = true`
- [ ] 🔴 **SQLite database file** is stored on a persistent volume (Railway: add Volume, mount at `/app`)
- [ ] Database file path is writable by the Node.js process
- [ ] Server has at least **512 MB RAM** (bcrypt + fabric.js canvas processing)
- [ ] **PM2** or equivalent process manager is running (restarts on crash)
- [ ] Log retention configured — logs do not grow unbounded

---

## 3. Security (Post-Deploy Verification)

- [ ] 🔴 Verify `Content-Security-Policy` header is present: `curl -I https://your-domain.com/api/auth/me | grep Content-Security`
- [ ] 🔴 Verify `Strict-Transport-Security` header present (HTTPS required first)
- [ ] 🔴 Confirm `SESSION_SECRET` is **not** the default `cardcraft-secret-2024`
- [ ] 🔴 Confirm `cookie.secure = true` by checking Set-Cookie response header includes `Secure`
- [ ] Rate limiting active — test with `for i in $(seq 15); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://your-domain.com/api/auth/login -H "Content-Type: application/json" -d '{"email":"x","password":"y"}'; done` — should return 429 after 10 attempts
- [ ] Paystack webhook URL registered in Paystack dashboard: `https://your-domain.com/api/payments/webhook`
- [ ] Paystack test mode → live mode toggle confirmed in Paystack dashboard
- [ ] Admin seed endpoint tested and default password changed: `POST /api/admin/seed` then immediately change password from Account Settings
- [ ] Reset token flow tested end-to-end

---

## 4. First-Time Setup

- [ ] 🔴 `POST /api/admin/seed` — creates `admin@cardcraft.com` / `admin123`
- [ ] 🔴 Sign in as admin and **change the default password** immediately (Account Settings)
- [ ] Verify all 20 templates loaded: `GET /api/templates` should return 20 items
- [ ] Test a card download (free tier) — watermark should appear
- [ ] Create a test account, verify 3-download limit
- [ ] Test Paystack payment with test keys first (sandbox), then switch to live

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
- [ ] Open Royal Elegance template → canvas renders
- [ ] Upload a photo → appears on canvas
- [ ] Edit name text → updates in real time
- [ ] Remove background → works on plain background photo
- [ ] Add QR code → generates and lands on canvas
- [ ] Download PNG → file downloads
- [ ] Download JPG → file downloads
- [ ] Send by Email → card delivered to inbox
- [ ] Undo / Redo → works correctly

**Gallery**
- [ ] All 20 templates visible
- [ ] Category filters work
- [ ] Search filters templates correctly
- [ ] Preview modal opens before entering editor

**Payments**
- [ ] Paystack popup opens with correct amount (₦10,000)
- [ ] Test payment completes → account upgrades to Pro
- [ ] Pro account: no watermark on download
- [ ] Pro account: no download limit
- [ ] Payment shows in `/payments` page

**Admin Panel**
- [ ] Analytics tab shows correct counts
- [ ] Toggle user Free ↔ Pro reflects immediately
- [ ] Create new template → appears in gallery after publishing
- [ ] Unpublish template → disappears from gallery

**Bulk Generator**
- [ ] Download sample CSV → correct format
- [ ] Upload CSV → rows appear in table
- [ ] Generate All → cards generated per row
- [ ] Download All → files download

---

## 6. Performance Baselines

- [ ] Home page loads in < 3 seconds on 4G mobile
- [ ] Gallery loads 20 templates in < 2 seconds
- [ ] Editor canvas ready in < 5 seconds (Fabric.js loads from CDN)
- [ ] `/api/admin/analytics` responds in < 200 ms (now uses SQL aggregates)

---

## 7. Known Limitations (Non-blockers, document for future)

| Item | Impact | Future fix |
|---|---|---|
| SQLite single-file database | Scales to ~10k concurrent users before bottleneck | Migrate to PostgreSQL when traffic demands |
| MemoryStore for sessions | Sessions lost on server restart; not multi-instance safe | Add Redis or connect-sqlite3 session store |
| Email via Gmail SMTP | 500 emails/day limit on standard Gmail | Switch to SendGrid/Resend API at volume |
| `unsafe-inline` in CSP | Vite injects inline scripts | Replace with nonce-based CSP at scale |
| No i18n | English-only UI | Add react-i18next for Yoruba, Hausa, Igbo, Arabic support |
| bcrypt async on main thread | Blocks event loop for ~100ms during login | Offload to worker thread at high traffic |
| No automated tests | Regressions caught manually | Add Vitest unit tests, Playwright E2E suite |

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

Always back up `cardcraft.db` before deploying:
```bash
cp cardcraft.db cardcraft.db.backup-$(date +%Y%m%d-%H%M)
```

---

## 9. Monitoring (Recommended)

- [ ] Set up **UptimeRobot** (free) to ping `https://your-domain.com/api/auth/me` every 5 minutes
- [ ] Configure Railway/Render to send email on deploy failure
- [ ] Watch Railway logs for repeated 401/403/429 spikes (indicates attack attempts)

---

*Last reviewed: April 9, 2026*
