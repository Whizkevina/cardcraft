import type { Express } from "express";
import type { Server } from "http";
import { storage, initDb, queryClient, getPgPool } from "./storage";
import bcrypt from "bcryptjs";
import session from "express-session";
import PgSimpleStore from "connect-pg-simple";
// @ts-ignore - Missing types for connect-pg-simple
import nodemailer from "nodemailer";
import https from "https";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import validator from "validator";
import { FREE_DOWNLOAD_LIMIT, FREE_PROJECT_LIMIT, PRO_PRICE_KOBO, PRO_PRICE_NGN } from "@shared/schema";
import { getServerErrors24h } from "./metrics";
import { getPaystackPublic, getPaystackSecret, getSessionSecret } from "./env";
import { buildPricingQuote } from "./pricing";
import { registerSharePublicRoutes } from "./sharePublic";
import { registerSeoRoutes } from "./seoRoutes";
import { extractClientIp, hashIp, parseUserAgent } from "./auditUtils";
import { getAnalyticsDashboard, getAnalyticsLiveFeed, runRetentionCleanup } from "./analyticsService";
import { initGeoIp, lookupCountry } from "./geoip";
import { hasPermission, requireStaffRole, type Permission } from "./permissions";
import { resolveTelemetryActor } from "./telemetryContext";
import { isLikelyBot } from "./botDetection";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
    userTier?: string;
    mustChangePassword?: boolean;
    guestDownloadsToday?: number;
    guestDownloadDate?: string;
    impersonatingUserId?: number;
    impersonatingUserName?: string;
    analyticsGuest?: boolean;
  }
}

const isProd = process.env.NODE_ENV === "production";

const PAYSTACK_SECRET = getPaystackSecret();
const PAYSTACK_PUBLIC = getPaystackPublic();

// ─── Sanitise helpers ─────────────────────────────────────────────────────────
/** Strip all HTML tags — prevents XSS in email bodies */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Validate and normalise a safe integer from route params */
function safeId(param: string): number | null {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Strip fields that must never be set by clients */
function sanitiseTemplateBody(body: any) {
  const { title, category, status, canvasJson, thumbnailColor, isPro } = body;
  return { title, category, status, canvasJson, thumbnailColor, isPro };
}

function sanitiseProjectBody(body: any) {
  const { title, designJson, exportSettings, thumbnail, templateId } = body;
  return { title, designJson, exportSettings, thumbnail, templateId };
}

const SHARE_IMAGE_MAX_LENGTH = 2_800_000;

/** Accept PNG data URLs captured from the editor canvas at share time */
function parseShareImage(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const value = String(raw);
  if (!value.startsWith("data:image/png;base64,")) return null;
  if (value.length > SHARE_IMAGE_MAX_LENGTH) return null;
  return value;
}

/** Normalise an email address */
function validateEmail(email: string): boolean {
  return validator.isEmail(String(email).trim().toLowerCase());
}

// ─── Safe user serialiser ─────────────────────────────────────────────────────
const safeUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  tier: u.tier || "free",
  theme: u.theme || "dark",
  downloadsToday: u.downloadsToday || 0,
  lastDownloadDate: u.lastDownloadDate,
  createdAt: u.createdAt,
  status: u.status || "active",
  // NEVER include: password, resetToken, resetTokenExpiry
});

const safeAdminUser = (u: any, stats?: { projectCount: number; sharedCount: number }) => ({
  ...safeUser(u),
  authProvider: u.authProvider || "email",
  lastLoginAt: u.lastLoginAt,
  totalDownloads: u.totalDownloads ?? 0,
  proExpiresAt: u.proExpiresAt,
  adminNote: u.adminNote ?? null,
  projectCount: stats?.projectCount ?? 0,
  sharedCount: stats?.sharedCount ?? 0,
});

const safePayment = (p: any) => ({
  id: p.id,
  userId: p.userId,
  userName: p.userName,
  userEmail: p.userEmail,
  reference: p.reference,
  amount: p.amount,
  currency: p.currency,
  status: p.status,
  plan: p.plan,
  refundNote: p.refundNote,
  createdAt: p.createdAt,
});

async function sendPasswordResetForEmail(email: string): Promise<boolean> {
  const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
  const token = generateToken();
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const found = await storage.setResetToken(normalEmail, token, expiry);
  if (!found || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return !!found;
  const appUrl = process.env.APP_URL || "http://localhost:5000";
  const resetUrl = `${appUrl}/#/reset-password?token=${token}`;
  try {
    await createTransporter().sendMail({
      from: `"CardCraft" <${process.env.GMAIL_USER}>`,
      to: normalEmail,
      subject: "Reset your CardCraft password",
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f9f9f7;padding:32px;border-radius:12px;"><h2 style="color:#1a1a1a">Reset your password</h2><p style="color:#555">Click below to set a new password. This link expires in 1 hour.</p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#c9a84c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset Password</a><p style="color:#999;font-size:12px;">If you didn't request this, you can safely ignore this email.</p></div>`,
    });
    return true;
  } catch {
    return false;
  }
}

async function establishSession(req: any, user: any) {
  const active = await storage.enforceProExpiry(user);
  req.session.userId = active.id;
  req.session.userRole = active.role;
  req.session.userTier = active.tier;
  await storage.touchLastLogin(active.id);
  return active;
}

async function logAudit(
  req: any,
  action: string,
  targetType: string,
  targetId: number | null,
  meta?: Record<string, unknown>,
  actorOverride?: { id?: number | null; role?: string; email?: string | null; name?: string | null },
) {
  try {
    const actorId = actorOverride?.id !== undefined ? actorOverride.id : (req.session?.userId ?? null);
    let role = actorOverride?.role;
    let email = actorOverride?.email ?? null;
    let name = actorOverride?.name ?? null;
    if (!role && actorId) {
      const u = await storage.getUser(actorId);
      if (u) {
        role = u.role;
        email = email ?? u.email;
        name = name ?? u.name;
      }
    }
    const ip = extractClientIp(req);
    const userAgent = typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null;
    const pagePath = typeof meta?.pagePath === "string" ? meta.pagePath : (typeof req.headers?.["x-page-path"] === "string" ? req.headers["x-page-path"] : null);
    const referrer = typeof req.headers?.referer === "string" ? req.headers.referer : null;
    const beforeValue = meta?.from != null ? String(meta.from) : (meta?.before != null ? String(meta.before) : null);
    const afterValue = meta?.to != null ? String(meta.to) : (meta?.after != null ? String(meta.after) : null);
    await storage.logAuditEvent({
      actorId,
      actorRole: role ?? (actorId ? "user" : "guest"),
      actorEmail: email ?? (typeof meta?.email === "string" ? meta.email : null),
      actorName: name,
      action,
      targetType,
      targetId,
      meta,
      ipAddress: ip || null,
      sessionId: req.sessionID ?? null,
      userAgent,
      pagePath,
      referrer,
      beforeValue,
      afterValue,
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}

async function logAdmin(req: any, action: string, targetType: string, targetId: number | null, meta?: Record<string, unknown>) {
  await logAudit(req, action, targetType, targetId, meta);
}

function parseAuditRow(l: { meta: string | null; [key: string]: unknown }) {
  return {
    ...l,
    meta: l.meta ? (() => { try { return JSON.parse(l.meta as string); } catch { return l.meta; } })() : null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateRef() {
  return `CC-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Email transporter ────────────────────────────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER || "", pass: process.env.GMAIL_APP_PASSWORD || "" },
  });

// ─── Welcome email ────────────────────────────────────────────────────────────
async function sendWelcomeEmail(name: string, email: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  const appUrl = process.env.APP_URL || "https://cardcraft-tdog.onrender.com";
  const safeName = escapeHtml(name);
  try {
    await createTransporter().sendMail({
      from: `"CardCraft" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Welcome to CardCraft! 🎨",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#16151a;padding:36px;border-radius:14px;color:#e8e0cc;">
          <div style="text-align:center;margin-bottom:24px;">
            <svg viewBox="0 0 32 32" fill="none" width="48" height="48" style="display:inline-block;">
              <rect width="32" height="32" rx="8" fill="hsl(43,96%,58%)"/>
              <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="#16151a" stroke-width="2"/>
              <path d="M6 14h20" stroke="#16151a" stroke-width="1.5"/>
              <circle cx="10" cy="20" r="1.5" fill="#16151a"/>
              <path d="M13 20h9" stroke="#16151a" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <h1 style="color:#f0c040;font-size:22px;margin:12px 0 4px;">Welcome to CardCraft!</h1>
          </div>
          <p style="color:#c8bfa8;font-size:15px;line-height:1.6;">Hi <strong style="color:#f0e0a0;">${safeName}</strong>,</p>
          <p style="color:#c8bfa8;font-size:15px;line-height:1.6;">
            Your account is ready. You can now create, save, and share stunning cards — business cards, invites, event flyers, and more.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${appUrl}/#/templates"
               style="display:inline-block;background:#c9a84c;color:#16151a;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;">
              Start Designing →
            </a>
          </div>
          <p style="color:#7a7060;font-size:12px;text-align:center;margin-top:24px;">
            You're on the <strong>Free plan</strong> — upgrade to Pro anytime for unlimited downloads.<br/>
            <a href="${appUrl}/#/pricing" style="color:#c9a84c;">View Pro plans</a>
          </p>
        </div>
      `,
    });
  } catch (e) {
    // Fail silently — welcome email is non-critical
    console.error("[welcome-email] Failed to send:", e);
  }
}

// ─── Paystack HTTP helper ─────────────────────────────────────────────────────
function paystackRequest(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: "api.paystack.co",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
        ...(data && { "Content-Length": Buffer.byteLength(data) }),
      },
    };
    const req = https.request(opts, res => {
      let raw = "";
      res.on("data", c => { raw += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid Paystack response")); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Rate limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 200,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 5,
  message: { error: "Too many password reset requests. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 20,
  message: { error: "Email send limit reached. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 120,                     // general API limit
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Middleware helpers ───────────────────────────────────────────────────────
const requireAuth = async (req: any, res: any, next: any) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
  const active = await storage.enforceProExpiry(user);
  if (active.tier !== user.tier) {
    req.session.userTier = active.tier;
  }
  req.currentUser = active;
  next();
};
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

const requireStaff = (req: any, res: any, next: any) => {
  if (!requireStaffRole(req.session.userRole ?? "")) return res.status(403).json({ error: "Forbidden" });
  next();
};

const requirePermission = (permission: Permission) => (req: any, res: any, next: any) => {
  if (!hasPermission(req.session.userRole ?? "", permission)) return res.status(403).json({ error: "Forbidden" });
  next();
};

function getEffectiveUserId(req: any): number {
  if (req.session.impersonatingUserId && hasPermission(req.session.userRole ?? "", "users:impersonate")) {
    return req.session.impersonatingUserId;
  }
  return req.session.userId!;
}

function isImpersonating(req: any): boolean {
  return Boolean(req.session.impersonatingUserId && hasPermission(req.session.userRole ?? "", "users:impersonate"));
}

function blockIfImpersonating(req: any, res: any): boolean {
  if (isImpersonating(req)) {
    res.status(403).json({ error: "Read-only view mode — exit support view to make changes" });
    return true;
  }
  return false;
}

const isLocalRequest = (req: any) => {
  const ip = String(req.ip || "").replace("::ffff:", "");
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim().replace("::ffff:", "");
  return ip === "127.0.0.1" || ip === "::1" || forwarded === "127.0.0.1" || forwarded === "::1";
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Initialize database
  await initDb();
  await initGeoIp();
  runRetentionCleanup().catch(e => console.error("[retention]", e));

  // Public share pages for crawlers (OG tags) — before SPA catch-all
  registerSeoRoutes(app);
  registerSharePublicRoutes(app);

  // Session — secure cookie in production
  // PostgreSQL-backed session store via Supabase (using pg Pool for compatibility)
  const PostgresStore = PgSimpleStore(session);
  app.use(
    session({
      store: new PostgresStore({
        pool: getPgPool(),
        tableName: "session",
      }),
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProd,           // HTTPS-only in production
        httpOnly: true,           // Not accessible from JS
        sameSite: "lax",          // CSRF mitigation
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // General API rate limit
  app.use("/api", apiLimiter);

  const passwordChangeAllowlist = new Set([
    "/api/auth/me",
    "/api/auth/logout",
    "/api/auth/change-password",
  ]);

  app.use((req, res, next) => {
    if (req.session?.mustChangePassword && req.path.startsWith("/api") && !passwordChangeAllowlist.has(req.path)) {
      return res.status(403).json({ error: "Password change required" });
    }
    next();
  });

  // ─── Auth ───────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name?.trim() || !email || !password) return res.status(400).json({ error: "All fields required" });
      if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email address" });
      if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      if (typeof name !== "string" || name.trim().length > 100) return res.status(400).json({ error: "Name too long" });
      const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
      const existingUser = await storage.getUserByEmail(normalEmail);
      if (existingUser) return res.status(400).json({ error: "Email already registered" });
      const hashed = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ name: name.trim(), email: normalEmail, password: hashed, role: "user", tier: "free", authProvider: "email" });
      await establishSession(req, user);
      req.session.mustChangePassword = false;
      // Send welcome email asynchronously — do NOT await so it never delays the response
      sendWelcomeEmail(user.name, user.email);
      await logAudit(req, "user.register", "user", user.id, { authProvider: "email" }, { id: user.id, role: user.role, email: user.email, name: user.name });
      res.status(201).json({ user: safeUser(user) });
    } catch (e: any) { res.status(500).json({ error: "Registration failed" }); }
  });

  // ─── Google OAuth ────────────────────────────────────────────────────────────
  app.post("/api/auth/google", authLimiter, async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ error: "Missing Google credential" });

      const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error("[Google OAuth] VITE_GOOGLE_CLIENT_ID is not configured in the environment.");
        return res.status(500).json({ error: "Google OAuth is not configured" });
      }

      // Import inside route so it's lazy-loaded
      const { OAuth2Client } = require("google-auth-library");
      const client = new OAuth2Client(clientId);

      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) return res.status(400).json({ error: "Invalid Google payload" });

      const normalEmail = validator.normalizeEmail(payload.email) || payload.email.toLowerCase().trim();
      let user = await storage.getUserByEmail(normalEmail);

      // Register new user seamlessly if they don't exist
      const isNewUser = !user;
      if (!user) {
        const name = payload.name || "Google User";
        // Create an uncrackable random placeholder password for OAuth users
        const dummyHash = await bcrypt.hash("OAUTH_PLACEHOLDER_" + crypto.randomBytes(32).toString("hex"), 12);
        user = await storage.createUser({
          name,
          email: normalEmail,
          password: dummyHash,
          role: "user",
          tier: "free",
          authProvider: "google",
        });
      } else if (user.authProvider !== "google") {
        await storage.updateUserAuthProvider(user.id, "google");
      }

      await establishSession(req, user);
      req.session.mustChangePassword = false;

      if (isNewUser) {
        await logAudit(req, "user.register", "user", user.id, { authProvider: "google" }, { id: user.id, role: user.role, email: user.email, name: user.name });
      }
      await logAudit(req, "user.login", "user", user.id, { method: "google" }, { id: user.id, role: user.role, email: user.email, name: user.name });

      res.status(200).json({ user: safeUser(user) });
    } catch (e: any) {
      console.error("[Google OAuth] Error verifying token:", e);
      res.status(401).json({ error: "Google authentication failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email" });
      const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalEmail);
      // Constant-time comparison even on miss — prevents timing attacks
      const dummyHash = "$2a$12$invalidhashfortimingequalityXXXXXXXXXXXXXXXXXXXXXX";
      const valid = user ? await bcrypt.compare(password, user.password) : await bcrypt.compare(password, dummyHash);
      if (!user || !valid) {
        await logAudit(req, "user.login_failed", "user", null, { email: normalEmail, reason: user ? "invalid_password" : "unknown_email" });
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
      await establishSession(req, user);
      req.session.mustChangePassword = false;
      // Flag admin logging in with default password so frontend can prompt change
      const isDefaultAdminPassword = user.role === "admin" && await bcrypt.compare("admin123", user.password);
      req.session.mustChangePassword = isDefaultAdminPassword;
      const userObj = safeUser(user) as any;
      if (isDefaultAdminPassword) userObj.needsPasswordChange = true;
      await logAudit(req, "user.login", "user", user.id, { method: "email" }, { id: user.id, role: user.role, email: user.email, name: user.name });
      res.json({ user: userObj });
    } catch (e: any) { res.status(500).json({ error: "Login failed" }); }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    await logAudit(req, "user.logout", "user", req.session.userId!);
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    let user = await storage.getUser(req.session.userId);
    if (!user) { req.session.destroy(() => {}); return res.json({ user: null }); }
    if (user.status === "suspended") return res.json({ user: null });
    user = await storage.enforceProExpiry(user);
    req.session.userTier = user.tier;
    const userObj = safeUser(user) as any;
    if (req.session.mustChangePassword) userObj.needsPasswordChange = true;
    const payload: Record<string, unknown> = { user: userObj };
    if (req.session.impersonatingUserId) {
      payload.impersonating = {
        userId: req.session.impersonatingUserId,
        userName: req.session.impersonatingUserName ?? null,
      };
    }
    res.json(payload);
  });

  // ─── Change password ────────────────────────────────────────────────────────
  app.post("/api/auth/change-password", requireAuth, authLimiter, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both fields required" });
    if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const user = await storage.getUser(req.session.userId!);
    if (!user || !await bcrypt.compare(currentPassword, user.password)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await storage.updateUserPassword(req.session.userId!, hashed);
    req.session.mustChangePassword = false;
    await logAudit(req, "user.password_change", "user", req.session.userId!);
    res.json({ ok: true });
  });

  // ─── Forgot password ────────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email || !validateEmail(email)) return res.json({ ok: true });
    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    await sendPasswordResetForEmail(normalEmail);
    await logAudit(req, "user.password_reset_request", "user", null, { email: normalEmail });
    res.json({ ok: true, message: "If that email is registered, you'll receive a reset link shortly." });
  });

  // ─── Reset password ─────────────────────────────────────────────────────────
  app.post("/api/auth/reset-password", forgotPasswordLimiter, async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });
    if (typeof token !== "string" || token.length !== 64) return res.status(400).json({ error: "Invalid token" });
    if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const user = await storage.getUserByResetToken(token);
    if (!user || !user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
      await storage.clearResetToken(user?.id || 0);
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await storage.updateUserPassword(user.id, hashed);
    await storage.clearResetToken(user.id);
    await logAudit(req, "user.password_reset", "user", user.id, { email: user.email }, { id: user.id, role: user.role, email: user.email, name: user.name });
    res.json({ ok: true, message: "Password updated. You can now sign in." });
  });

  // ─── Theme ──────────────────────────────────────────────────────────────────
  app.patch("/api/auth/theme", requireAuth, async (req, res) => {
    const { theme } = req.body;
    if (!["dark", "light"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
    await storage.updateUserTheme(req.session.userId!, theme);
    await logAudit(req, "user.theme_change", "user", req.session.userId!, { theme });
    res.json({ theme });
  });

  const telemetryLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

  app.post("/api/telemetry/heartbeat", telemetryLimiter, async (req, res) => {
    const actor = await resolveTelemetryActor(req);
    const { pagePath, referrer, utmSource, utmCampaign, browser, os, deviceType } = req.body ?? {};
    await storage.upsertAnalyticsSession({
      sessionKey: actor.sessionKey,
      userId: actor.userId,
      userName: actor.userName ?? "Guest",
      userEmail: actor.userEmail ?? undefined,
      userRole: actor.userRole,
      userTier: actor.userTier ?? undefined,
      pagePath: typeof pagePath === "string" ? pagePath.slice(0, 256) : undefined,
      referrer: typeof referrer === "string" ? referrer.slice(0, 512) : undefined,
      utmSource: typeof utmSource === "string" ? utmSource.slice(0, 128) : undefined,
      utmCampaign: typeof utmCampaign === "string" ? utmCampaign.slice(0, 128) : undefined,
      browser: typeof browser === "string" ? browser.slice(0, 64) : undefined,
      os: typeof os === "string" ? os.slice(0, 64) : undefined,
      deviceType: typeof deviceType === "string" ? deviceType.slice(0, 32) : undefined,
      country: actor.country,
    });
    res.json({ ok: true });
  });

  app.post("/api/telemetry/event", telemetryLimiter, async (req, res) => {
    const actor = await resolveTelemetryActor(req);
    const { eventType, pagePath, action, resourceType, resourceId, meta, browser, os, deviceType, referrer } = req.body ?? {};
    if (!eventType || typeof eventType !== "string") return res.status(400).json({ error: "eventType required" });
    const allowed = ["page_view", "feature_click", "conversion", "download", "share_create", "bulk_generate", "bulk_download", "cta_click"];
    if (!allowed.includes(eventType)) return res.status(400).json({ error: "Invalid eventType" });
    const mergedMeta = {
      ...(meta && typeof meta === "object" ? meta as Record<string, unknown> : {}),
      visitorType: actor.visitorType,
    };
    await storage.recordAnalyticsEvent({
      sessionKey: actor.sessionKey,
      userId: actor.userId > 0 ? actor.userId : null,
      eventType,
      pagePath: typeof pagePath === "string" ? pagePath : undefined,
      action: typeof action === "string" ? action : undefined,
      resourceType: typeof resourceType === "string" ? resourceType : undefined,
      resourceId: Number.isInteger(resourceId) ? resourceId : null,
      meta: mergedMeta,
      browser: typeof browser === "string" ? browser : undefined,
      os: typeof os === "string" ? os : undefined,
      deviceType: typeof deviceType === "string" ? deviceType : undefined,
      referrer: typeof referrer === "string" ? referrer : undefined,
      ipHash: actor.ipHash,
    });
    res.json({ ok: true });
  });

  // ─── Downloads ──────────────────────────────────────────────────────────────
  const trackGuestDownload = (req: any) => {
    const today = new Date().toISOString().split("T")[0];
    const lastDate = req.session.guestDownloadDate;
    const downloadsToday = lastDate === today ? (req.session.guestDownloadsToday || 0) + 1 : 1;
    const allowed = downloadsToday <= FREE_DOWNLOAD_LIMIT;
    if (allowed) {
      req.session.guestDownloadsToday = downloadsToday;
      req.session.guestDownloadDate = today;
    }
    return { allowed, downloadsToday };
  };

  app.post("/api/downloads/track", async (req, res) => {
    if (!req.session.userId) {
      const result = trackGuestDownload(req);
      if (result.allowed) {
        await logAudit(req, "user.download", "session", null, { downloadsToday: result.downloadsToday, tier: "guest" });
      }
      return res.json({ allowed: result.allowed, tier: "guest", downloadsToday: result.downloadsToday, limit: FREE_DOWNLOAD_LIMIT });
    }
    const result = await storage.trackDownload(req.session.userId);
    const user = await storage.getUser(req.session.userId);
    if (result.allowed) {
      await logAudit(req, "user.download", "user", req.session.userId, { downloadsToday: result.downloadsToday, tier: user?.tier ?? "free" });
    }
    res.json({ allowed: result.allowed, tier: user?.tier || "free", downloadsToday: result.downloadsToday, limit: FREE_DOWNLOAD_LIMIT });
  });

  app.get("/api/downloads/status", async (req, res) => {
    if (!req.session.userId) {
      const today = new Date().toISOString().split("T")[0];
      const downloadsToday = req.session.guestDownloadDate === today ? (req.session.guestDownloadsToday || 0) : 0;
      return res.json({
        tier: "guest",
        downloadsToday,
        limit: FREE_DOWNLOAD_LIMIT,
        allowed: downloadsToday < FREE_DOWNLOAD_LIMIT,
      });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.json({ tier: "guest", downloadsToday: 0, limit: FREE_DOWNLOAD_LIMIT, allowed: true });
    const today = new Date().toISOString().split("T")[0];
    const downloadsToday = user.lastDownloadDate === today ? (user.downloadsToday || 0) : 0;
    res.json({ tier: user.tier, downloadsToday, limit: FREE_DOWNLOAD_LIMIT, allowed: user.tier === "pro" || downloadsToday < FREE_DOWNLOAD_LIMIT });
  });

  app.get("/api/pricing/quote", async (req, res) => {
    try {
      const quote = await buildPricingQuote(req);
      res.json(quote);
    } catch (err) {
      console.error("[pricing] quote error:", err);
      res.status(500).json({ error: "Could not load pricing quote" });
    }
  });

  // ─── Templates ──────────────────────────────────────────────────────────────
  app.get("/api/templates", async (req, res) => {
    const isAdmin = req.session.userRole === "admin";
    console.log(`[API] GET /templates - isAdmin: ${isAdmin}, userId: ${req.session.userId || "guest"}`);
    const result = isAdmin ? await storage.getAllTemplates() : await storage.getPublishedTemplates();
    console.log(`[API] Returning ${result.length} templates`);
    res.json(result);
  });

  app.get("/api/templates/:id", async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const t = await storage.getTemplate(id);
    if (!t) return res.status(404).json({ error: "Not found" });
    const isProUser = req.session.userTier === "pro" || req.session.userRole === "admin";
    if (t.isPro && !isProUser) {
      return res.status(403).json({ error: "This template requires a Pro account.", code: "PRO_TEMPLATE" });
    }
    if (req.session.userId) await storage.incrementTemplateUsage(id);
    res.json(t);
  });

  app.post("/api/templates", requireAuth, requireStaff, requirePermission("templates:write"), async (req, res) => {
    try {
      const clean = sanitiseTemplateBody(req.body);
      if (!clean.title?.trim() || !clean.canvasJson) return res.status(400).json({ error: "title and canvasJson required" });
      // Validate canvasJson is valid JSON
      try { JSON.parse(clean.canvasJson); } catch { return res.status(400).json({ error: "canvasJson must be valid JSON" }); }
      const t = await storage.createTemplate(clean);
      await logAdmin(req, "template.create", "template", t.id, { title: t.title, category: t.category });
      res.status(201).json(t);
    } catch (e: any) { res.status(400).json({ error: "Failed to create template" }); }
  });

  app.patch("/api/templates/:id", requireAuth, requireStaff, requirePermission("templates:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const before = await storage.getTemplate(id);
    const clean = sanitiseTemplateBody(req.body);
    const t = await storage.updateTemplate(id, clean);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (clean.status && before && before.status !== clean.status) {
      await logAdmin(req, "template.status_change", "template", id, { from: before.status, to: clean.status, title: t.title });
    }
    res.json(t);
  });

  app.delete("/api/templates/:id", requireAuth, requireStaff, requirePermission("templates:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const before = await storage.getTemplate(id);
    await storage.deleteTemplate(id);
    if (before) await logAdmin(req, "template.delete", "template", id, { title: before.title });
    res.json({ ok: true });
  });

  // ─── Projects ───────────────────────────────────────────────────────────────
  app.get("/api/projects", requireAuth, async (req, res) => {
    const userId = getEffectiveUserId(req);
    res.json(await storage.getProjectsByUser(userId));
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const p = await storage.getProject(id);
    if (!p) return res.status(404).json({ error: "Not found" });
    const userId = getEffectiveUserId(req);
    const isStaff = requireStaffRole(req.session.userRole ?? "");
    if (p.userId !== userId && !isStaff) return res.status(403).json({ error: "Forbidden" });
    res.json(p);
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    if (blockIfImpersonating(req, res)) return;
    try {
      const clean = sanitiseProjectBody(req.body);
      if (!clean.designJson) return res.status(400).json({ error: "designJson required" });
      try { JSON.parse(clean.designJson); } catch { return res.status(400).json({ error: "designJson must be valid JSON" }); }

      const user = await storage.getUser(req.session.userId!);
      if (user?.tier !== "pro") {
        const existingProjects = await storage.getProjectsByUser(req.session.userId!);
        if (existingProjects.length >= FREE_PROJECT_LIMIT) {
          return res.status(403).json({
            error: `Free accounts can save up to ${FREE_PROJECT_LIMIT} cards. Upgrade to Pro for unlimited projects.`,
          });
        }
      }

      const project = await storage.createProject({ ...clean, userId: req.session.userId! });
      await logAudit(req, "project.create", "project", project.id, { title: project.title, templateId: project.templateId });
      res.status(201).json(project);
    } catch (e: any) { res.status(400).json({ error: "Failed to create project" }); }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    if (blockIfImpersonating(req, res)) return;
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const existing = await storage.getProject(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    const clean = sanitiseProjectBody(req.body);
    const updated = await storage.updateProject(id, clean);
    await logAudit(req, "project.update", "project", id, { title: updated?.title ?? existing.title });
    res.json(updated);
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    if (blockIfImpersonating(req, res)) return;
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const existing = await storage.getProject(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    await storage.deleteProject(id);
    await logAudit(req, "project.delete", "project", id, { title: existing.title });
    res.json({ ok: true });
  });

  app.post("/api/projects/:id/duplicate", requireAuth, async (req, res) => {
    if (blockIfImpersonating(req, res)) return;
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const copy = await storage.duplicateProject(id, req.session.userId!);
    if (!copy) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "project.duplicate", "project", copy.id, { sourceId: id, title: copy.title });
    res.status(201).json(copy);
  });

  app.post("/api/projects/:id/enable-share", requireAuth, async (req, res) => {
    if (blockIfImpersonating(req, res)) return;
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const shareImage = parseShareImage(req.body?.shareImage);
    if (req.body?.shareImage && !shareImage) {
      return res.status(400).json({ error: "shareImage must be a PNG data URL under 2MB" });
    }
    const project = await storage.enableProjectShare(id, req.session.userId!, shareImage);
    if (!project) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "project.share_enable", "project", id, { title: project.title, shareToken: project.shareToken });
    res.json({
      shareToken: project.shareToken,
      shareEnabled: project.shareEnabled,
      shareImageStored: Boolean(project.shareImage),
    });
  });

  app.patch("/api/projects/:id/rename", requireAuth, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const title = String(req.body.title || "").trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: "Title required" });
    const p = await storage.renameProject(id, req.session.userId!, title);
    if (!p) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "project.rename", "project", id, { title });
    res.json(p);
  });

  // ─── Public project share (token-based) ─────────────────────────────────────
  app.get("/api/share/:token", async (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token || token.length < 16) return res.status(400).json({ error: "Invalid share token" });
    const p = await storage.getProjectByShareToken(token);
    if (!p || !p.shareEnabled) return res.status(404).json({ error: "Not found" });
    res.json({
      id: p.id,
      title: p.title,
      designJson: p.designJson,
      thumbnail: p.thumbnail,
      shareImage: p.shareImage,
      updatedAt: p.updatedAt,
    });
  });

  // Legacy id-based share — disabled; use token URLs instead
  app.get("/api/projects/:id/share", async (req, res) => {
    return res.status(410).json({ error: "Share links now use secure tokens. Enable sharing from the editor." });
  });

  // ─── Paystack ────────────────────────────────────────────────────────────────
  app.post("/api/payments/initialize", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.tier === "pro") return res.status(400).json({ error: "Already on Pro plan" });
    try {
      const reference = generateRef();
      const payment = await storage.createPayment({ userId: user.id, reference, amount: PRO_PRICE_KOBO, status: "pending", plan: "pro_lifetime" });
      await logAudit(req, "payment.initialize", "payment", payment.id, { reference, amount: PRO_PRICE_KOBO });
      const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
        email: user.email, amount: PRO_PRICE_KOBO, reference, currency: "NGN",
        metadata: { userId: user.id, plan: "pro_lifetime" },
        callback_url: `${process.env.APP_URL || "http://localhost:5000"}/#/pricing`,
      });
      if (!paystackRes.status) {
        console.error("[Paystack] Initialization error payload:", paystackRes);
        return res.status(500).json({ error: "Payment initialization failed: " + (paystackRes.message || "Unknown error") });
      }
      res.json({ reference, authorizationUrl: paystackRes.data.authorization_url, accessCode: paystackRes.data.access_code, publicKey: PAYSTACK_PUBLIC, amount: PRO_PRICE_NGN, email: user.email });
    } catch (e: any) { 
      console.error("[Paystack] System error:", e);
      res.status(500).json({ error: "Payment initialization failed" }); 
    }
  });

  app.post("/api/payments/confirm", requireAuth, async (req, res) => {
    const reference = String(req.body.reference || "").trim();
    if (!reference) return res.status(400).json({ error: "Reference required" });
    // Reference format validation to prevent injection
    if (!/^CC-[\d]+-[A-Z0-9]+$/.test(reference)) return res.status(400).json({ error: "Invalid reference format" });
    try {
      const paystackRes = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
      const payment = await storage.getPayment(reference);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      // Ownership check — can only confirm your own payment
      if (payment.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
      if (paystackRes.status && paystackRes.data.status === "success") {
        await storage.updatePaymentStatus(reference, "success");
        await storage.updateUserTier(payment.userId, "pro");
        req.session.userTier = "pro";
        await logAudit(req, "payment.success", "payment", payment.id, { reference, amount: payment.amount });
        return res.json({ success: true, tier: "pro" });
      }
      await logAudit(req, "payment.pending", "payment", payment.id, { reference, status: paystackRes.data?.status });
      res.json({ success: false, message: "Payment not complete yet" });
    } catch (e: any) { res.status(500).json({ error: "Verification failed" }); }
  });

  // Raw body required for HMAC verification — must be registered BEFORE express.json parses it
  app.post("/api/payments/webhook", async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      if (isProd) return res.status(503).json({ error: "Webhook verification not configured" });
    } else {
      const rawBody = (req as any).rawBody;
      if (!rawBody) return res.status(400).send("No raw body");
      const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
      if (hash !== req.headers["x-paystack-signature"]) {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    }
    const event = req.body;
    if (event?.event === "charge.success") {
      const ref = String(event.data?.reference || "");
      if (ref) {
        const payment = await storage.getPayment(ref);
        if (payment && payment.status !== "success") {
          await storage.updatePaymentStatus(ref, "success");
          await storage.updateUserTier(payment.userId, "pro");
          await logAudit(req, "payment.success", "payment", payment.id, { reference: ref, source: "webhook" }, { id: null, role: "system", name: "Paystack Webhook" });
        }
      }
      await storage.setSystemMeta("paystack_webhook_last", JSON.stringify({ status: "success", event: event.event, at: new Date().toISOString() }));
    } else {
      await storage.setSystemMeta("paystack_webhook_last", JSON.stringify({ status: "received", event: event?.event ?? "unknown", at: new Date().toISOString() }));
    }
    res.sendStatus(200);
  });

  app.get("/api/payments/my", requireAuth, async (req, res) => {
    res.json(await storage.getPaymentsByUser(req.session.userId!));
  });

  // ─── Email ───────────────────────────────────────────────────────────────────
  app.post("/api/email/send-card", emailSendLimiter, requireAuth, async (req, res) => {
    const { to, subject, message, imageDataUrl, cardTitle } = req.body;

    // Validate recipient
    if (!to || !validateEmail(to)) return res.status(400).json({ error: "Valid recipient email required" });
    if (!imageDataUrl || typeof imageDataUrl !== "string") return res.status(400).json({ error: "Image data required" });

    // Validate image data URL format
    if (!imageDataUrl.match(/^data:image\/(jpeg|jpg|png);base64,/)) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    // Size limit — base64 of a 2× export ≈ 6-8 MB
    if (imageDataUrl.length > 12_000_000) return res.status(413).json({ error: "Image too large" });

    // Sanitise user-controlled fields before embedding in HTML
    const safeMessage = escapeHtml(String(message || "Someone designed this card for you using CardCraft.").slice(0, 500));
    const safeTitle = escapeHtml(String(cardTitle || "Your Card").slice(0, 200));
    const safeSubject = escapeHtml(String(subject || `${safeTitle} from CardCraft`).slice(0, 200));
    const safeTo = validator.normalizeEmail(to) || to.trim();

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log(`[SIMULATED EMAIL] To: ${safeTo}, Subject: ${safeSubject}, ImageBase64Length: ${imageDataUrl.length}`);
      await logAudit(req, "email.send_card", "project", null, { to: safeTo, cardTitle: safeTitle, simulated: true });
      return res.status(200).json({ 
        success: true, 
        message: `[Simulated] Sent to ${safeTo}. Add GMAIL_USER in .env to send real emails.` 
      });
    }

    try {
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      const isJpeg = imageDataUrl.startsWith("data:image/jpeg") || imageDataUrl.startsWith("data:image/jpg");
      const filename = `${safeTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 60)}.${isJpeg ? "jpg" : "png"}`;

      await createTransporter().sendMail({
        from: `"CardCraft" <${process.env.GMAIL_USER}>`,
        to: safeTo,
        subject: safeSubject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f7;padding:32px;border-radius:12px;"><h2 style="color:#1a1a1a;">You received a card!</h2><p style="color:#666;">${safeMessage}</p><img src="cid:cardimage" alt="${safeTitle}" style="width:100%;max-width:500px;border-radius:12px;display:block;margin:16px auto;" /><p style="color:#999;font-size:12px;text-align:center;">Created with <a href="https://cardcraft.app" style="color:#c9a84c;">CardCraft</a></p></div>`,
        attachments: [{ filename, content: imageBuffer, cid: "cardimage" }],
      });
      res.json({ success: true, message: `Card sent to ${safeTo}` });
      await logAudit(req, "email.send_card", "project", null, { to: safeTo, cardTitle: safeTitle });
    } catch (e: any) { res.status(500).json({ error: "Failed to send email" }); }
  });

  app.get("/api/email/status", (req, res) => {
    res.json({ configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) });
    // NOTE: never expose the actual email address — just configured: true/false
  });

  // ─── Admin ───────────────────────────────────────────────────────────────────
  app.get("/api/admin/analytics", requireAuth, requireStaff, requirePermission("analytics:read"), async (req, res) => {
    res.json(await storage.getAnalytics());
  });

  app.get("/api/admin/users", requireAuth, requireStaff, requirePermission("users:read"), async (req, res) => {
    const [users, statsMap] = await Promise.all([storage.getAllUsers(), storage.getProjectStatsByUser()]);
    res.json(users.map(u => safeAdminUser(u, statsMap[u.id])));
  });

  app.get("/api/admin/users/:id", requireAuth, requireStaff, requirePermission("users:read"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const detail = await storage.getAdminUserDetail(id);
    if (!detail) return res.status(404).json({ error: "Not found" });
    res.json({
      user: safeAdminUser(detail.user, detail.stats),
      payments: detail.payments.map(p => safePayment({ ...p, userName: detail.user.name, userEmail: detail.user.email })),
    });
  });

  app.patch("/api/admin/users/:id/tier", requireAuth, requireStaff, requirePermission("users:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { tier, reason, proExpiresAt } = req.body;
    if (!["free", "pro"].includes(tier)) return res.status(400).json({ error: "Invalid tier" });
    const before = await storage.getUser(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    let expiry: Date | null | undefined;
    if (tier === "pro" && proExpiresAt) {
      const parsed = new Date(proExpiresAt);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: "Invalid pro expiry date" });
      expiry = parsed;
    } else if (tier === "free") {
      expiry = null;
    }
    const user = await storage.updateUserTier(id, tier, expiry);
    if (!user) return res.status(404).json({ error: "Not found" });
    await logAdmin(req, "user.tier_change", "user", id, {
      from: before.tier,
      to: tier,
      email: before.email,
      reason: typeof reason === "string" ? reason.slice(0, 500) : undefined,
      proExpiresAt: user.proExpiresAt,
    });
    res.json(safeAdminUser(user, (await storage.getProjectStatsByUser())[id]));
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireStaff, requirePermission("users:role"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { role } = req.body;
    if (!["user", "admin", "support", "content"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot change your own role" });
    const before = await storage.getUser(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    const user = await storage.updateUserRole(id, role);
    if (!user) return res.status(404).json({ error: "Not found" });
    await logAdmin(req, "user.role_change", "user", id, { from: before.role, to: role, email: before.email });
    res.json(safeAdminUser(user, (await storage.getProjectStatsByUser())[id]));
  });

  app.post("/api/admin/impersonate/:id", requireAuth, requireStaff, requirePermission("users:impersonate"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.role === "admin") return res.status(403).json({ error: "Cannot view as another admin" });
    req.session.impersonatingUserId = target.id;
    req.session.impersonatingUserName = target.name;
    await logAdmin(req, "user.impersonate_start", "user", id, { email: target.email, readOnly: true });
    res.json({ userId: target.id, userName: target.name, userEmail: target.email });
  });

  app.delete("/api/admin/impersonate", requireAuth, requireStaff, requirePermission("users:impersonate"), async (req, res) => {
    const id = req.session.impersonatingUserId;
    if (id) await logAdmin(req, "user.impersonate_end", "user", id, {});
    req.session.impersonatingUserId = undefined;
    req.session.impersonatingUserName = undefined;
    res.json({ ok: true });
  });

  app.get("/api/admin/payments", requireAuth, requireStaff, requirePermission("payments:read"), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const email = typeof req.query.email === "string" ? req.query.email : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const [payments, revenueThisMonth] = await Promise.all([
      storage.getAdminPayments({ status, email, from, to }),
      storage.getPaymentsRevenueThisMonth(),
    ]);
    res.json({ payments: payments.map(safePayment), revenueThisMonth });
  });

  app.patch("/api/admin/payments/:id/refund-note", requireAuth, requireStaff, requirePermission("payments:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { refundNote } = req.body;
    const note = typeof refundNote === "string" ? refundNote.slice(0, 500) : null;
    const payment = await storage.updatePaymentRefundNote(id, note || null);
    if (!payment) return res.status(404).json({ error: "Not found" });
    await logAdmin(req, "payment.refund_note", "payment", id, { refundNote: note });
    res.json(safePayment(payment));
  });

  app.post("/api/admin/users/:id/send-password-reset", requireAuth, requireStaff, requirePermission("users:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ error: "Not found" });
    await sendPasswordResetForEmail(user.email);
    await logAdmin(req, "user.password_reset_sent", "user", id, { email: user.email });
    res.json({ ok: true, message: "Password reset email sent if SMTP is configured." });
  });

  app.post("/api/admin/users/:id/force-logout", requireAuth, requireStaff, requirePermission("users:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot force-logout yourself" });
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ error: "Not found" });
    const count = await storage.destroyUserSessions(id);
    await logAdmin(req, "user.force_logout", "user", id, { sessionsDestroyed: count, email: user.email });
    res.json({ ok: true, sessionsDestroyed: count });
  });

  app.patch("/api/admin/users/:id/status", requireAuth, requireStaff, requirePermission("users:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot suspend yourself" });
    const { status } = req.body;
    if (!["active", "suspended"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const before = await storage.getUser(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    const user = await storage.updateUserStatus(id, status);
    if (!user) return res.status(404).json({ error: "Not found" });
    if (status === "suspended") await storage.destroyUserSessions(id);
    await logAdmin(req, "user.status_change", "user", id, { from: before.status, to: status, email: before.email });
    res.json(safeAdminUser(user, (await storage.getProjectStatsByUser())[id]));
  });

  app.delete("/api/admin/users/:id", requireAuth, requireStaff, requirePermission("users:delete"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot delete yourself" });
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.role === "admin") return res.status(400).json({ error: "Cannot delete admin accounts" });
    await logAdmin(req, "user.delete", "user", id, { email: target.email, name: target.name });
    const deleted = await storage.deleteUser(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  app.post("/api/admin/users/bulk-delete", requireAuth, requireStaff, requirePermission("users:delete"), async (req, res) => {
    const raw = req.body?.ids;
    const ids = Array.isArray(raw)
      ? raw.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    if (ids.length === 0) return res.status(400).json({ error: "No valid user IDs" });

    const failed: { id: number; reason: string }[] = [];
    let deleted = 0;
    for (const id of ids) {
      if (id === req.session.userId) {
        failed.push({ id, reason: "self" });
        continue;
      }
      const target = await storage.getUser(id);
      if (!target) {
        failed.push({ id, reason: "not_found" });
        continue;
      }
      if (target.role === "admin") {
        failed.push({ id, reason: "admin" });
        continue;
      }
      await logAdmin(req, "user.delete", "user", id, { email: target.email, name: target.name, bulk: true });
      const ok = await storage.deleteUser(id);
      if (ok) deleted++;
      else failed.push({ id, reason: "not_found" });
    }
    res.json({ deleted, failed });
  });

  app.get("/api/admin/audit-log", requireAuth, requireStaff, requirePermission("audit:read"), async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const actorRole = typeof req.query.actorRole === "string" ? req.query.actorRole : undefined;
    const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const ipSearch = typeof req.query.ip === "string" ? req.query.ip : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
    const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;
    const ipHash = ipSearch ? hashIp(ipSearch) ?? undefined : undefined;
    const filters = { search, action, actorRole, severity, from, to, ipHash, limit: Number.isFinite(limit) ? limit : 100, offset: Number.isFinite(offset) ? offset : 0 };
    const [logs, total] = await Promise.all([
      storage.getAuditLogs(filters),
      storage.getAuditLogCount(filters),
    ]);
    res.json({ items: logs.map(parseAuditRow), total, limit: filters.limit, offset: filters.offset });
  });

  app.get("/api/admin/audit-log/export", requireAuth, requireStaff, requirePermission("audit:read"), async (req, res) => {
    const format = req.query.format === "json" ? "json" : "csv";
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const actorRole = typeof req.query.actorRole === "string" ? req.query.actorRole : undefined;
    const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const logs = await storage.getAuditLogs({ search, action, actorRole, severity, from, to, limit: 5000, offset: 0 });
    const rows = logs.map(parseAuditRow);
    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="audit-log-${Date.now()}.json"`);
      return res.json(rows);
    }
    const headers = ["id", "createdAt", "action", "severity", "actorName", "actorEmail", "actorRole", "targetType", "targetId", "pagePath", "ipAddress", "sessionId"];
    const csv = [headers.join(",")].concat(rows.map((r: Record<string, unknown>) => headers.map(h => {
      const val = (r as Record<string, unknown>)[h];
      const s = val == null ? "" : String(val).replace(/"/g, '""');
      return `"${s}"`;
    }).join(","))).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(csv);
  });

  app.get("/api/admin/audit-log/:id", requireAuth, requireStaff, requirePermission("audit:read"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const entry = await storage.getAuditLogById(id);
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(parseAuditRow(entry));
  });

  app.get("/api/admin/analytics/dashboard", requireAuth, requireStaff, requirePermission("analytics:read"), async (req, res) => {
    const period = req.query.period === "30d" || req.query.period === "90d" ? req.query.period : "7d";
    res.json(await getAnalyticsDashboard(period));
  });

  app.get("/api/admin/analytics/live", requireAuth, requireStaff, requirePermission("analytics:read"), async (_req, res) => {
    res.json(await getAnalyticsLiveFeed());
  });

  app.patch("/api/admin/analytics/settings", requireAuth, requireStaff, requirePermission("settings:write"), async (req, res) => {
    const { analyticsRetentionDays, auditRetentionDays } = req.body ?? {};
    if (analyticsRetentionDays != null) {
      await storage.setSystemMeta("analytics_retention_days", String(Math.max(7, Math.min(365, Number(analyticsRetentionDays) || 90))));
    }
    if (auditRetentionDays != null) {
      await storage.setSystemMeta("audit_retention_days", String(Math.max(30, Math.min(730, Number(auditRetentionDays) || 365))));
    }
    await logAdmin(req, "settings.retention_change", "settings", null, { analyticsRetentionDays, auditRetentionDays });
    res.json(await storage.getAnalyticsRetentionSettings());
  });

  app.get("/api/admin/health", requireAuth, requireStaff, requirePermission("analytics:read"), async (_req, res) => {
    const dbOk = await storage.pingDatabase();
    const webhookMeta = await storage.getSystemMeta("paystack_webhook_last");
    let webhook: { status: string; event?: string; at: string } | null = null;
    if (webhookMeta) {
      try { webhook = JSON.parse(webhookMeta.value); } catch { webhook = null; }
    }
    res.json({
      db: dbOk,
      emailConfigured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      paystackConfigured: !!process.env.PAYSTACK_SECRET_KEY,
      webhookLast: webhook,
      serverErrors24h: getServerErrors24h(),
    });
  });

  app.get("/api/admin/ops-stats", requireAuth, requireStaff, requirePermission("analytics:read"), async (_req, res) => {
    res.json(await storage.getOpsStats());
  });

  app.get("/api/admin/projects", requireAuth, requireStaff, requirePermission("projects:moderate"), async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const sharedOnly = req.query.sharedOnly === "true";
    const projects = await storage.getAdminProjects({ search, sharedOnly });
    res.json(projects);
  });

  app.patch("/api/admin/projects/:id/revoke-share", requireAuth, requireStaff, requirePermission("projects:moderate"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const before = await storage.getProject(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    const project = await storage.adminRevokeProjectShare(id);
    await logAdmin(req, "project.share_revoke", "project", id, { title: before.title, userId: before.userId });
    res.json(project);
  });

  app.delete("/api/admin/projects/:id", requireAuth, requireStaff, requirePermission("projects:moderate"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const before = await storage.getProject(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    await storage.deleteProject(id);
    await logAdmin(req, "project.admin_delete", "project", id, { title: before.title, userId: before.userId });
    res.json({ ok: true });
  });

  app.get("/api/admin/users/:id/projects", requireAuth, requireStaff, requirePermission("users:read"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(await storage.getAdminUserProjects(id));
  });

  app.patch("/api/admin/users/:id/note", requireAuth, requireStaff, requirePermission("users:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { adminNote } = req.body;
    const note = typeof adminNote === "string" ? adminNote.slice(0, 2000) : null;
    const user = await storage.updateUserAdminNote(id, note || null);
    if (!user) return res.status(404).json({ error: "Not found" });
    await logAdmin(req, "user.admin_note", "user", id, { email: user.email });
    res.json(safeAdminUser(user, (await storage.getProjectStatsByUser())[id]));
  });

  app.post("/api/admin/impersonate/:id", requireAuth, requireStaff, requirePermission("users:impersonate"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.role === "admin") return res.status(403).json({ error: "Cannot view as another admin" });
    req.session.impersonatingUserId = target.id;
    req.session.impersonatingUserName = target.name;
    await logAdmin(req, "user.impersonate_start", "user", id, { email: target.email, readOnly: true });
    res.json({ userId: target.id, userName: target.name, userEmail: target.email });
  });

  app.delete("/api/admin/impersonate", requireAuth, requireStaff, requirePermission("users:impersonate"), async (req, res) => {
    const id = req.session.impersonatingUserId;
    if (id) await logAdmin(req, "user.impersonate_end", "user", id, {});
    req.session.impersonatingUserId = undefined;
    req.session.impersonatingUserName = undefined;
    res.json({ ok: true });
  });

  app.post("/api/admin/seed", async (req, res) => {
    // Never allow public seeding in production.
    if (isProd) return res.status(404).json({ error: "Not found" });
    // In non-production, only allow local requests.
    if (!isLocalRequest(req)) return res.status(403).json({ error: "Forbidden" });

    const logs: string[] = [];
    try {
      const adminEmail = "admin@cardcraft.com";
      const adminPassword = "admin123";
      const hashed = await bcrypt.hash(adminPassword, 12);

      const existingAdmin = await storage.getUserByEmail(adminEmail);
      let adminStatus: "created" | "reset";
      if (!existingAdmin) {
        await storage.createUser({ name: "Admin", email: adminEmail, password: hashed, role: "admin", tier: "pro" });
        adminStatus = "created";
      } else {
        await storage.updateUserPassword(existingAdmin.id, hashed);
        if (existingAdmin.role !== "admin") await storage.updateUserRole(existingAdmin.id, "admin");
        if (existingAdmin.tier !== "pro") await storage.updateUserTier(existingAdmin.id, "pro");
        adminStatus = "reset";
      }

      // Migrate templates from SQLite to PostgreSQL
      const existingTemplates = await storage.getTemplatesCount();
      logs.push(`Template count in PG: ${existingTemplates} (type: ${typeof existingTemplates})`);
      let templates = 0;
      if (existingTemplates === 0) {
        try {
          logs.push("Starting SQLite import...");
          const { default: Database } = await import("better-sqlite3");
          const sqliteDb = new Database("./cardcraft.db");
          const sqliteTemplates = sqliteDb.prepare("SELECT * FROM templates").all() as any[];
          logs.push(`Found ${sqliteTemplates.length} in SQLite`);
          
          for (const t of sqliteTemplates) {
            try {
              const templateData = {
                title: t.title,
                category: t.category,
                status: t.status,
                previewImage: t.preview_image,
                canvasJson: t.canvas_json,
                thumbnailColor: t.thumbnail_color,
                isPro: Number(t.is_pro ? 1 : 0),
              } as any;
              await storage.createTemplate(templateData);
              templates++;
              logs.push(`✓ ${t.title}`);
            } catch (e: any) {
              logs.push(`✗ ${t.title}: ${e.message}`);
            }
          }
          sqliteDb.close();
          logs.push(`Imported: ${templates} templates`);
        } catch (e: any) {
          logs.push(`SQLite error: ${e.message}`);
        }
      } else {
        logs.push(`Skipped (${existingTemplates} already exist)`);
      }
      
      res.status(201).json({
        message: adminStatus === "created" ? "Admin account created" : "Admin account reset",
        admin: adminStatus,
        email: adminEmail,
        password: adminPassword,
        templates,
        logs,
      });
    } catch (e: any) {
      logs.push(`Fatal error: ${e.message}`);
      res.status(500).json({ error: "Seed failed", logs });
    }
  });

  return httpServer;
}
