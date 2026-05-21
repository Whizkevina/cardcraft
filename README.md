# CardCraft 🎨

**CardCraft** is a full-stack web application for designing, personalizing, and sharing beautiful greeting cards — birthday, graduation, church, corporate, and more. Users upload a photo, customize every element, and download a high-resolution card in seconds.

---

## ✨ Features

### Card Editor
- **20 professional templates** across 8 categories: Birthday, Celebrations, Graduation, Anniversary, Church, Corporate, Achievement, Eid
- **Fabric.js canvas editor** — drag, resize, rotate, and layer any element
- **Photo upload** with background removal and corner radius controls
- **Text controls** — font family, size, color, bold, italic, opacity, drop shadow
- **QR code layer** — generate a scannable QR from any URL and place it on the card
- **Undo / Redo** with full history stack (Ctrl+Z / Ctrl+Y)
- **Zoom & pan** via scroll wheel or pinch-to-zoom on mobile
- **12 background color presets** + custom color picker

### Export & Sharing
- **PNG and JPG export** at 4 size presets (Original, Square Social 1080×1080, Portrait Story 1080×1920, Portrait Flyer 1200×1500)
- **WhatsApp sharing** — Web Share API on mobile, download + WhatsApp Web on desktop
- **Copy image to clipboard** — paste directly into any chat
- **Send by email** — delivers the card as an embedded image to any email address
- **Watermark** on free user exports (removed for Pro accounts)

### Bulk Generation (Pro)
- Upload a **CSV file** with `name, greeting, date, subtitle` columns
- CardCraft auto-generates a personalized card for every row
- Download individually or all at once
- **Requires a Pro account**

### Accounts & Tiers
| Feature | Free | Pro |
|---|---|---|
| All free templates | ✅ | ✅ (+ Pro templates) |
| Downloads per day | 3 | Unlimited |
| Watermark on export | Yes | No |
| Save cards | Up to 5 | Unlimited |
| Bulk generator | — | ✅ |
| Email delivery | ✅ (sign in required) | ✅ |

**Pro is a one-time payment of ₦10,000 (lifetime access)** via Paystack. The pricing page auto-detects your region and shows an approximate local currency; checkout always charges NGN.

### Admin Panel
- View all registered users
- Toggle any user between **Free ↔ Pro** with one click
- Grant or revoke admin role
- Create, publish, and unpublish templates
- View payment and download stats

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Canvas Editor | Fabric.js 5 (CDN, loaded via `client/src/lib/loadFabric.ts`) |
| UI Components | Tailwind CSS v3 + shadcn/ui |
| Routing | Wouter (hash-based for iframe compatibility) |
| State & Data | TanStack Query v5 |
| Backend | Express.js (Node.js) |
| Database | PostgreSQL via Drizzle ORM |
| Authentication | express-session + connect-pg-simple + bcryptjs |
| Payment | Paystack (inline popup + webhook) |
| Email | Nodemailer + Gmail SMTP |
| QR Codes | qrcode (browser-side generation) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- PostgreSQL 14+ (local, Supabase, or Railway Postgres)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/cardcraft.git
cd cardcraft
npm install
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL at minimum
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### Production Build

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

---

## ⚙️ Environment Variables

Copy [`.env.example`](.env.example) to `.env.local` for local development. The server loads `.env.local` first, then `.env`.

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/cardcraft

# Required in production
SESSION_SECRET=change-this-to-a-secure-random-string
APP_URL=https://your-domain.com
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx

# Optional — Google Sign-In
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Optional — email (simulated without these)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

E2E tests use `.env.test` (see [`.env.test.example`](.env.test.example)).

> **Gmail App Password**: Go to [myaccount.google.com](https://myaccount.google.com) → Security → 2-Step Verification → App Passwords → Create one for "Mail".

---

## 🌍 Deployment Options

### Option 1 — Railway (Recommended ⭐)

Railway supports Node.js + PostgreSQL — add a Postgres plugin and set `DATABASE_URL`.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/new?referralCode=cardcraft)

**Step-by-step:**

1. Go to [railway.app](https://railway.app) and sign up / log in
2. Click **New Project → Deploy from GitHub repo**
3. Add a **PostgreSQL** database to the project
4. Select your CardCraft service repo
5. Go to your service → **Variables** tab and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | From Railway Postgres plugin (auto-linked) |
| `PAYSTACK_SECRET_KEY` | `sk_live_xxxx` from Paystack dashboard |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_xxxx` from Paystack dashboard |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail App Password (16-char code) |
| `SESSION_SECRET` | Any long random string |
| `APP_URL` | Your Railway URL e.g. `https://cardcraft.railway.app` |
| `NODE_ENV` | `production` |

6. Click **Deploy** — Railway builds and starts the app in ~2 minutes
7. Your app is live at `https://cardcraft-production-xxxx.up.railway.app`

**Database note:** Use Railway's **PostgreSQL** plugin and link `DATABASE_URL` to your service. Tables are created automatically on first startup.

> Free tier includes $5/month credit — enough for a low-traffic app.

---

### Option 2 — Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect repo
3. **Build command:** `npm install && npm run geoip:download && npm run build`
4. **Start command:** `NODE_ENV=production node dist/index.cjs`
5. Set environment variables under **Environment** (see GeoIP below)
6. Free tier available (spins down after inactivity)

**GeoIP on Render** (optional — country codes in admin analytics):

| Variable | Value | Notes |
|----------|--------|--------|
| `MAXMIND_LICENSE_KEY` | Your MaxMind license key | Mark as **Secret** |
| `GEOIP_DB_PATH` | `./GeoLite2-Country.mmdb` | Same path the build script writes |

The build step `npm run geoip:download` fetches GeoLite2-Country from MaxMind using your license key and saves it before `npm run build`. On startup, logs should show `[geoip] GeoLite2 Country database loaded`.

Locally, place `GeoLite2-Country.mmdb` in the project root (or set `GEOIP_DB_PATH`); the download script skips if the file already exists.

> **Node version:** The repo includes `.node-version` (Node 22 LTS). Render should pick this automatically — avoid Node 26, which breaks native dev tools used at build time.

---

### Option 3 — VPS / DigitalOcean / Hetzner

```bash
# On your server
git clone https://github.com/YOUR_USERNAME/cardcraft.git
cd cardcraft
npm install
npm run build

# Create .env with your keys
cp .env.example .env
nano .env

# Run with PM2 (keeps process alive)
npm install -g pm2
pm2 start dist/index.cjs --name cardcraft
pm2 save
pm2 startup
```

---

### ⚠️ Why not GitHub Pages?

GitHub Pages only hosts **static files** — it cannot run the Node.js/Express backend, PostgreSQL database, or server-side APIs. CardCraft requires a server for:
- User authentication and sessions
- Saving/loading projects
- Paystack payment verification
- Email delivery via Gmail SMTP

**Use Railway, Render, or a VPS instead** — all support Node.js and are free or low-cost to start.

---

## 🔑 First-Time Setup (after deploy)

**Production:** Run `npm run db:seed-admin -- --email you@example.com --password 'YourSecurePass1!'` (requires `DATABASE_URL` in env). The in-app seed button is disabled in production.

**Local development:**

1. Run the app with `npm run dev`
2. Restore templates if the gallery is empty: `npm run db:seed` (requires `cardcraft.db` in project root)
3. Add romance templates if missing: `npm run db:seed-love`
4. Generate gallery preview images: `npm run db:previews` (uses Playwright + Fabric; re-run with `--force` to regenerate)
5. Go to `/admin` and click **"Create Admin Account"** — creates or resets `admin@cardcraft.com` / `admin123` (or run `npm run db:seed-admin`)
6. Sign in and **immediately change the password** from Account Settings
7. From the Admin panel → Users tab, you can upgrade any user to Pro

---

## 📁 Project Structure

```
cardcraft/
├── docs/                   # Planning & reference docs
│   └── ADMIN_DASHBOARD_ROADMAP.md  # Admin panel build tracker (Tier 1–4)
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── SharePanel.tsx
│   │   │   ├── QRDialog.tsx
│   │   │   └── ThemeProvider.tsx
│   │   ├── pages/          # Route-level pages
│   │   │   ├── Landing.tsx
│   │   │   ├── Gallery.tsx
│   │   │   ├── Editor.tsx      # Main Fabric.js canvas editor
│   │   │   ├── Projects.tsx
│   │   │   ├── BulkGenerate.tsx
│   │   │   ├── PricingPage.tsx
│   │   │   ├── AdminPage.tsx
│   │   │   └── AuthPage.tsx
│   │   └── index.css
├── server/                 # Express backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # All API routes
│   ├── storage.ts          # Database layer + template seeding
│   └── vite.ts             # Vite dev middleware
├── shared/
│   └── schema.ts           # Drizzle ORM schema + shared types
├── dist/                   # Production build output (git-ignored)
└── package.json
```

---

## 📝 API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/templates` | List published templates |
| GET | `/api/templates/:id` | Get template (403 if Pro-only and user is free) |
| GET | `/api/projects` | List user's saved cards |
| POST | `/api/projects` | Save a card |
| POST | `/api/projects/:id/enable-share` | Enable public share link (auth required) |
| GET | `/api/share/:token` | Public shared card JSON (requires share enabled) |
| GET | `/share/:token` | Public HTML page with Open Graph tags (redirects to app viewer) |
| GET | `/share/:token/image.png` | Public PNG preview for social crawlers |
| GET | `/api/pricing/quote` | Localized Pro price display (auto-detect country; charge remains NGN) |
| POST | `/api/payments/initialize` | Start Paystack payment |
| POST | `/api/payments/confirm` | Verify payment after popup closes |
| POST | `/api/payments/webhook` | Paystack server-to-server webhook |
| POST | `/api/email/send-card` | Send card to email (auth required) |
| GET | `/api/admin/users` | List all users (admin only) |
| PATCH | `/api/admin/users/:id/tier` | Toggle Free/Pro (admin only) |

---

## 📄 License

MIT — free to use, modify, and distribute.

---

## 🙏 Credits

Built with [Fabric.js](https://fabricjs.com), [React](https://react.dev), [shadcn/ui](https://ui.shadcn.com), [Drizzle ORM](https://orm.drizzle.team), and [Paystack](https://paystack.com).
