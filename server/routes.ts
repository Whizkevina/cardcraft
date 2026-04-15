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
import Database from "better-sqlite3";
import rateLimit from "express-rate-limit";
import validator from "validator";
import { FREE_DOWNLOAD_LIMIT, PRO_PRICE_KOBO, PRO_PRICE_NGN } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
    userTier?: string;
    mustChangePassword?: boolean;
  }
}

const isProd = process.env.NODE_ENV === "production";

// ─── Environment ──────────────────────────────────────────────────────────────
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder";
const PAYSTACK_PUBLIC = process.env.PAYSTACK_PUBLIC_KEY || "pk_test_placeholder";

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
  // NEVER include: password, resetToken, resetTokenExpiry
});

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
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                      // max 10 attempts per IP per window
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

const FREE_PROJECT_LIMIT = 20;

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 120,                     // general API limit
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Middleware helpers ───────────────────────────────────────────────────────
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
};
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

const isLocalRequest = (req: any) => {
  const ip = String(req.ip || "").replace("::ffff:", "");
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim().replace("::ffff:", "");
  return ip === "127.0.0.1" || ip === "::1" || forwarded === "127.0.0.1" || forwarded === "::1";
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Initialize database
  await initDb();

  // Session — secure cookie in production
  // PostgreSQL-backed session store via Supabase (using pg Pool for compatibility)
  const PostgresStore = PgSimpleStore(session);
  app.use(
    session({
      store: new PostgresStore({
        pool: getPgPool(),
        tableName: "session",
      }),
      secret: process.env.SESSION_SECRET || "cardcraft-fallback-secret-change-in-prod",
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
      const user = await storage.createUser({ name: name.trim(), email: normalEmail, password: hashed, role: "user", tier: "free" });
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userTier = user.tier;
      req.session.mustChangePassword = false;
      // Send welcome email asynchronously — do NOT await so it never delays the response
      sendWelcomeEmail(user.name, user.email);
      res.status(201).json({ user: safeUser(user) });
    } catch (e: any) { res.status(500).json({ error: "Registration failed" }); }
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
      if (!user || !valid) return res.status(401).json({ error: "Invalid credentials" });
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userTier = user.tier;
      req.session.mustChangePassword = false;
      // Flag admin logging in with default password so frontend can prompt change
      const isDefaultAdminPassword = user.role === "admin" && await bcrypt.compare("admin123", user.password);
      req.session.mustChangePassword = isDefaultAdminPassword;
      const userObj = safeUser(user) as any;
      if (isDefaultAdminPassword) userObj.needsPasswordChange = true;
      res.json({ user: userObj });
    } catch (e: any) { res.status(500).json({ error: "Login failed" }); }
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = await storage.getUser(req.session.userId);
    if (!user) { req.session.destroy(() => {}); return res.json({ user: null }); }
    req.session.userTier = user.tier;
    const userObj = safeUser(user) as any;
    if (req.session.mustChangePassword) userObj.needsPasswordChange = true;
    res.json({ user: userObj });
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
    res.json({ ok: true });
  });

  // ─── Forgot password ────────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
    const { email } = req.body;
    // Always respond 200 to prevent user enumeration
    if (!email || !validateEmail(email)) return res.json({ ok: true });
    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    const token = generateToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const found = await storage.setResetToken(normalEmail, token, expiry);
    if (found && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const appUrl = process.env.APP_URL || "http://localhost:5000";
      const resetUrl = `${appUrl}/#/reset-password?token=${token}`;
      try {
        await createTransporter().sendMail({
          from: `"CardCraft" <${process.env.GMAIL_USER}>`,
          to: normalEmail,
          subject: "Reset your CardCraft password",
          html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f9f9f7;padding:32px;border-radius:12px;"><h2 style="color:#1a1a1a">Reset your password</h2><p style="color:#555">Click below to set a new password. This link expires in 1 hour.</p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#c9a84c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset Password</a><p style="color:#999;font-size:12px;">If you didn't request this, you can safely ignore this email.</p></div>`,
        });
      } catch (e) { /* fail silently — don't leak whether email exists */ }
    }
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
    res.json({ ok: true, message: "Password updated. You can now sign in." });
  });

  // ─── Theme ──────────────────────────────────────────────────────────────────
  app.patch("/api/auth/theme", requireAuth, async (req, res) => {
    const { theme } = req.body;
    if (!["dark", "light"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
    await storage.updateUserTheme(req.session.userId!, theme);
    res.json({ theme });
  });

  // ─── Downloads ──────────────────────────────────────────────────────────────
  app.post("/api/downloads/track", async (req, res) => {
    if (!req.session.userId) return res.json({ allowed: true, tier: "guest", downloadsToday: 0, limit: FREE_DOWNLOAD_LIMIT });
    const result = await storage.trackDownload(req.session.userId);
    const user = await storage.getUser(req.session.userId);
    res.json({ allowed: result.allowed, tier: user?.tier || "free", downloadsToday: result.downloadsToday, limit: FREE_DOWNLOAD_LIMIT });
  });

  app.get("/api/downloads/status", async (req, res) => {
    if (!req.session.userId) return res.json({ tier: "guest", downloadsToday: 0, limit: FREE_DOWNLOAD_LIMIT, allowed: true });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.json({ tier: "guest", downloadsToday: 0, limit: FREE_DOWNLOAD_LIMIT, allowed: true });
    const today = new Date().toISOString().split("T")[0];
    const downloadsToday = user.lastDownloadDate === today ? (user.downloadsToday || 0) : 0;
    res.json({ tier: user.tier, downloadsToday, limit: FREE_DOWNLOAD_LIMIT, allowed: user.tier === "pro" || downloadsToday < FREE_DOWNLOAD_LIMIT });
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
    if (req.session.userId) await storage.incrementTemplateUsage(id);
    res.json(t);
  });

  app.post("/api/templates", requireAuth, requireAdmin, async (req, res) => {
    try {
      const clean = sanitiseTemplateBody(req.body);
      if (!clean.title?.trim() || !clean.canvasJson) return res.status(400).json({ error: "title and canvasJson required" });
      // Validate canvasJson is valid JSON
      try { JSON.parse(clean.canvasJson); } catch { return res.status(400).json({ error: "canvasJson must be valid JSON" }); }
      res.status(201).json(await storage.createTemplate(clean));
    } catch (e: any) { res.status(400).json({ error: "Failed to create template" }); }
  });

  app.patch("/api/templates/:id", requireAuth, requireAdmin, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const clean = sanitiseTemplateBody(req.body);
    const t = await storage.updateTemplate(id, clean);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  app.delete("/api/templates/:id", requireAuth, requireAdmin, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    await storage.deleteTemplate(id);
    res.json({ ok: true });
  });

  // ─── Projects ───────────────────────────────────────────────────────────────
  app.get("/api/projects", requireAuth, async (req, res) => {
    res.json(await storage.getProjectsByUser(req.session.userId!));
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const p = await storage.getProject(id);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.session.userId && req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    res.json(p);
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
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

      res.status(201).json(await storage.createProject({ ...clean, userId: req.session.userId! }));
    } catch (e: any) { res.status(400).json({ error: "Failed to create project" }); }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const existing = await storage.getProject(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    const clean = sanitiseProjectBody(req.body);
    res.json(await storage.updateProject(id, clean));
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const existing = await storage.getProject(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    await storage.deleteProject(id);
    res.json({ ok: true });
  });

  app.post("/api/projects/:id/duplicate", requireAuth, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const copy = await storage.duplicateProject(id, req.session.userId!);
    if (!copy) return res.status(404).json({ error: "Not found or unauthorized" });
    res.status(201).json(copy);
  });

  app.patch("/api/projects/:id/rename", requireAuth, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const title = String(req.body.title || "").trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: "Title required" });
    const p = await storage.renameProject(id, req.session.userId!, title);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });

  // ─── Public project share (no auth required) ──────────────────────────────────
  app.get("/api/projects/:id/share", async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const p = await storage.getProject(id);
    if (!p) return res.status(404).json({ error: "Not found" });
    // Return only safe fields — no userId exposed
    res.json({
      id: p.id,
      title: p.title,
      designJson: p.designJson,
      thumbnail: p.thumbnail,
      updatedAt: p.updatedAt,
    });
  });

  // ─── Paystack ────────────────────────────────────────────────────────────────
  app.post("/api/payments/initialize", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.tier === "pro") return res.status(400).json({ error: "Already on Pro plan" });
    try {
      const reference = generateRef();
      await storage.createPayment({ userId: user.id, reference, amount: PRO_PRICE_KOBO, status: "pending", plan: "pro_lifetime" });
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
        return res.json({ success: true, tier: "pro" });
      }
      res.json({ success: false, message: "Payment not complete yet" });
    } catch (e: any) { res.status(500).json({ error: "Verification failed" }); }
  });

  // Raw body required for HMAC verification — must be registered BEFORE express.json parses it
  app.post("/api/payments/webhook", async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (secret) {
      // Use raw body buffer for HMAC (express.json has already parsed but rawBody was saved)
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
        }
      }
    }
    res.sendStatus(200);
  });

  app.get("/api/payments/my", requireAuth, async (req, res) => {
    res.json(await storage.getPaymentsByUser(req.session.userId!));
  });

  // ─── Email ───────────────────────────────────────────────────────────────────
  app.post("/api/email/send-card", requireAuth, emailSendLimiter, async (req, res) => {
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
      return res.status(503).json({ error: "Email not configured", hint: "Set GMAIL_USER and GMAIL_APP_PASSWORD." });
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
    } catch (e: any) { res.status(500).json({ error: "Failed to send email" }); }
  });

  app.get("/api/email/status", (req, res) => {
    res.json({ configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) });
    // NOTE: never expose the actual email address — just configured: true/false
  });

  // ─── Admin ───────────────────────────────────────────────────────────────────
  app.get("/api/admin/analytics", requireAuth, requireAdmin, async (req, res) => {
    res.json(await storage.getAnalytics());
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map(safeUser));
  });

  app.patch("/api/admin/users/:id/tier", requireAuth, requireAdmin, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { tier } = req.body;
    if (!["free", "pro"].includes(tier)) return res.status(400).json({ error: "Invalid tier" });
    const user = await storage.updateUserTier(id, tier);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(safeUser(user));
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    // Prevent self-demotion
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot change your own role" });
    const user = await storage.updateUserRole(id, role);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(safeUser(user));
  });

  app.post("/api/admin/seed", async (req, res) => {
    // Never allow public seeding in production.
    if (isProd) return res.status(404).json({ error: "Not found" });
    // In non-production, only allow local requests.
    if (!isLocalRequest(req)) return res.status(403).json({ error: "Forbidden" });

    const logs: string[] = [];
    try {
      // Create admin if doesn't exist
      const existingAdmin = await storage.getUserByEmail("admin@cardcraft.com");
      if (!existingAdmin) {
        const hashed = await bcrypt.hash("admin123", 12);
        await storage.createUser({ name: "Admin", email: "admin@cardcraft.com", password: hashed, role: "admin", tier: "pro" });
      }

      // Migrate templates from SQLite to PostgreSQL
      const existingTemplates = await storage.getTemplatesCount();
      logs.push(`Template count in PG: ${existingTemplates} (type: ${typeof existingTemplates})`);
      let templates = 0;
      if (existingTemplates === 0) {
        try {
          logs.push("Starting SQLite import...");
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
        message: "Seed complete", 
        admin: existingAdmin ? "exists" : "created", 
        templates,
        logs 
      });
    } catch (e: any) {
      logs.push(`Fatal error: ${e.message}`);
      res.status(500).json({ error: "Seed failed", logs });
    }
  });

  return httpServer;
}
