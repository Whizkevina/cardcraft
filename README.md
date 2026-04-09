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

### Bulk Generation
- Upload a **CSV file** with `name, greeting, date, subtitle` columns
- CardCraft auto-generates a personalized card for every row
- Download individually or all at once

### Accounts & Tiers
| Feature | Free | Pro |
|---|---|---|
| All templates | ✅ | ✅ |
| Downloads per day | 3 | Unlimited |
| Watermark on export | Yes | No |
| Save cards | ✅ | ✅ |
| Bulk generator | ✅ | ✅ |
| Email delivery | ✅ | ✅ |

**Pro is a one-time payment of ₦10,000 (lifetime access)** via Paystack.

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
| Canvas Editor | Fabric.js 5 |
| UI Components | Tailwind CSS v3 + shadcn/ui |
| Routing | Wouter (hash-based for iframe compatibility) |
| State & Data | TanStack Query v5 |
| Backend | Express.js (Node.js) |
| Database | SQLite via Drizzle ORM + better-sqlite3 |
| Authentication | express-session + bcryptjs |
| Payment | Paystack (inline popup + webhook) |
| Email | Nodemailer + Gmail SMTP |
| QR Codes | qrcode (browser-side generation) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/cardcraft.git
cd cardcraft
npm install
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

Create a `.env` file in the project root or set these on your hosting platform:

```env
# Paystack — get keys from https://dashboard.paystack.com/#/settings/developers
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx

# Gmail SMTP — use an App Password, not your Gmail password
# Enable at: Google Account → Security → 2-Step Verification → App Passwords
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# App URL — used for Paystack callback redirect
APP_URL=https://your-domain.com

# Session secret — change this to a random string in production
SESSION_SECRET=change-this-to-a-secure-random-string
```

> **Gmail App Password**: Go to [myaccount.google.com](https://myaccount.google.com) → Security → 2-Step Verification → App Passwords → Create one for "Mail".

---

## 🌍 Deployment Options

### Option 1 — Railway (Recommended ⭐)

Railway supports Node.js + SQLite with zero configuration — `railway.toml` is already included in this repo.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/new?referralCode=cardcraft)

**Step-by-step:**

1. Go to [railway.app](https://railway.app) and sign up / log in
2. Click **New Project → Deploy from GitHub repo**
3. Select **Whizkevina/cardcraft** (or your fork)
4. Railway reads `railway.toml` automatically — no manual config needed
5. Go to your service → **Variables** tab and add:

| Variable | Value |
|---|---|
| `PAYSTACK_SECRET_KEY` | `sk_live_xxxx` from Paystack dashboard |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_xxxx` from Paystack dashboard |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail App Password (16-char code) |
| `SESSION_SECRET` | Any long random string |
| `APP_URL` | Your Railway URL e.g. `https://cardcraft.railway.app` |

6. Click **Deploy** — Railway builds and starts the app in ~2 minutes
7. Your app is live at `https://cardcraft-production-xxxx.up.railway.app`

**Persistent storage note:** The SQLite database (`cardcraft.db`) is stored on the Railway volume. To add a persistent volume: service → **Add Volume** → mount path `/app` (or wherever your app runs).

> Free tier includes $5/month credit — enough for a low-traffic app.

---

### Option 2 — Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect repo
3. **Build command:** `npm install && npm run build`
4. **Start command:** `NODE_ENV=production node dist/index.cjs`
5. Set environment variables under Environment tab
6. Free tier available (spins down after inactivity)

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

GitHub Pages only hosts **static files** — it cannot run a Node.js/Express backend, SQLite database, or server-side APIs. CardCraft requires a server for:
- User authentication and sessions
- Saving/loading projects
- Paystack payment verification
- Email delivery via Gmail SMTP

**Use Railway, Render, or a VPS instead** — all support Node.js and are free or low-cost to start.

---

## 🔑 First-Time Setup (after deploy)

1. Open your deployed app
2. Go to `/admin` (or click Admin in nav)
3. Click **"Create Admin Account"** — this seeds `admin@cardcraft.com` / `admin123`
4. Sign in with those credentials
5. **Immediately change the password** (edit in DB or add a change-password endpoint)
6. From the Admin panel → Users tab, you can upgrade any user to Pro

---

## 📁 Project Structure

```
cardcraft/
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
├── cardcraft.db            # SQLite database (git-ignored)
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
| GET | `/api/projects` | List user's saved cards |
| POST | `/api/projects` | Save a card |
| POST | `/api/payments/initialize` | Start Paystack payment |
| POST | `/api/payments/confirm` | Verify payment after popup closes |
| POST | `/api/payments/webhook` | Paystack server-to-server webhook |
| POST | `/api/email/send-card` | Send card to email |
| GET | `/api/admin/users` | List all users (admin only) |
| PATCH | `/api/admin/users/:id/tier` | Toggle Free/Pro (admin only) |

---

## 📄 License

MIT — free to use, modify, and distribute.

---

## 🙏 Credits

Built with [Fabric.js](https://fabricjs.com), [React](https://react.dev), [shadcn/ui](https://ui.shadcn.com), [Drizzle ORM](https://orm.drizzle.team), and [Paystack](https://paystack.com).
