import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import session from "express-session";
import nodemailer from "nodemailer";
import https from "https";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import validator from "validator";
import { FREE_DOWNLOAD_LIMIT, PRO_PRICE_KOBO, PRO_PRICE_NGN } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
    userTier?: string;
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Session — secure cookie in production
  app.use(
    session({
      secret: process.env.SESSION_SECRET || (isProd ? undefined as any : "dev-secret-change-in-prod"),
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

  // ─── Auth ───────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name?.trim() || !email || !password) return res.status(400).json({ error: "All fields required" });
      if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email address" });
      if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      if (typeof name !== "string" || name.trim().length > 100) return res.status(400).json({ error: "Name too long" });
      const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
      if (storage.getUserByEmail(normalEmail)) return res.status(400).json({ error: "Email already registered" });
      const hashed = await bcrypt.hash(password, 12); // bcrypt rounds increased to 12
      const user = storage.createUser({ name: name.trim(), email: normalEmail, password: hashed, role: "user", tier: "free" });
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userTier = user.tier;
      res.status(201).json(safeUser(user));
    } catch (e: any) { res.status(500).json({ error: "Registration failed" }); }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email" });
      const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
      const user = storage.getUserByEmail(normalEmail);
      // Constant-time comparison even on miss — prevents timing attacks
      const dummyHash = "$2a$12$invalidhashfortimingequalityXXXXXXXXXXXXXXXXXXXXXX";
      const valid = user ? await bcrypt.compare(password, user.password) : await bcrypt.compare(password, dummyHash);
      if (!user || !valid) return res.status(401).json({ error: "Invalid credentials" });
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userTier = user.tier;
      res.json(safeUser(user));
    } catch (e: any) { res.status(500).json({ error: "Login failed" }); }
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = storage.getUser(req.session.userId);
    if (!user) { req.session.destroy(() => {}); return res.json({ user: null }); }
    req.session.userTier = user.tier;
    res.json({ user: safeUser(user) });
  });

  // ─── Change password ────────────────────────────────────────────────────────
  app.post("/api/auth/change-password", requireAuth, authLimiter, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both fields required" });
    if (typeof newPassword !== "string" || newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const user = storage.getUser(req.session.userId!);
    if (!user || !await bcrypt.compare(currentPassword, user.password)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    storage.updateUserPassword(req.session.userId!, hashed);
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
    const found = storage.setResetToken(normalEmail, token, expiry);
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
    if (typeof newPassword !== "string" || newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const user = storage.getUserByResetToken(token);
    if (!user || !user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
      storage.clearResetToken(user?.id || 0);
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    storage.updateUserPassword(user.id, hashed);
    storage.clearResetToken(user.id);
    res.json({ ok: true, message: "Password updated. You can now sign in." });
  });

  // ─── Theme ──────────────────────────────────────────────────────────────────
  app.patch("/api/auth/theme", requireAuth, (req, res) => {
    const { theme } = req.body;
    if (!["dark", "light"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
    storage.updateUserTheme(req.session.userId!, theme);
    res.json({ theme });
  });

  // ─── Downloads ──────────────────────────────────────────────────────────────
  app.post("/api/downloads/track", (req, res) => {
    if (!req.session.userId) return res.json({ allowed: true, tier: "guest", downloadsToday: 0, limit: FREE_DOWNLOAD_LIMIT });
    const result = storage.trackDownload(req.session.userId);
    const user = storage.getUser(req.session.userId);
    res.json({ allowed: result.allowed, tier: user?.tier || "free", downloadsToday: result.downloadsToday, limit: FREE_DOWNLOAD_LIMIT });
  });

  app.get("/api/downloads/status", (req, res) => {
    if (!req.session.userId) return res.json({ tier: "guest", downloadsToday: 0, limit: FREE_DOWNLOAD_LIMIT, allowed: true });
    const user = storage.getUser(req.session.userId);
    if (!user) return res.json({ tier: "guest", downloadsToday: 0, limit: FREE_DOWNLOAD_LIMIT, allowed: true });
    const today = new Date().toISOString().split("T")[0];
    const downloadsToday = user.lastDownloadDate === today ? (user.downloadsToday || 0) : 0;
    res.json({ tier: user.tier, downloadsToday, limit: FREE_DOWNLOAD_LIMIT, allowed: user.tier === "pro" || downloadsToday < FREE_DOWNLOAD_LIMIT });
  });

  // ─── Templates ──────────────────────────────────────────────────────────────
  app.get("/api/templates", (req, res) => {
    const isAdmin = req.session.userRole === "admin";
    res.json(isAdmin ? storage.getAllTemplates() : storage.getPublishedTemplates());
  });

  app.get("/api/templates/:id", (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const t = storage.getTemplate(id);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (req.session.userId) storage.incrementTemplateUsage(id);
    res.json(t);
  });

  app.post("/api/templates", requireAuth, requireAdmin, (req, res) => {
    try {
      const clean = sanitiseTemplateBody(req.body);
      if (!clean.title?.trim() || !clean.canvasJson) return res.status(400).json({ error: "title and canvasJson required" });
      // Validate canvasJson is valid JSON
      try { JSON.parse(clean.canvasJson); } catch { return res.status(400).json({ error: "canvasJson must be valid JSON" }); }
      res.status(201).json(storage.createTemplate(clean));
    } catch (e: any) { res.status(400).json({ error: "Failed to create template" }); }
  });

  app.patch("/api/templates/:id", requireAuth, requireAdmin, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const clean = sanitiseTemplateBody(req.body);
    const t = storage.updateTemplate(id, clean);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  app.delete("/api/templates/:id", requireAuth, requireAdmin, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    storage.deleteTemplate(id);
    res.json({ ok: true });
  });

  // ─── Projects ───────────────────────────────────────────────────────────────
  app.get("/api/projects", requireAuth, (req, res) => {
    res.json(storage.getProjectsByUser(req.session.userId!));
  });

  app.get("/api/projects/:id", requireAuth, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const p = storage.getProject(id);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.session.userId && req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    res.json(p);
  });

  app.post("/api/projects", requireAuth, (req, res) => {
    try {
      const clean = sanitiseProjectBody(req.body);
      if (!clean.designJson) return res.status(400).json({ error: "designJson required" });
      try { JSON.parse(clean.designJson); } catch { return res.status(400).json({ error: "designJson must be valid JSON" }); }
      res.status(201).json(storage.createProject({ ...clean, userId: req.session.userId! }));
    } catch (e: any) { res.status(400).json({ error: "Failed to create project" }); }
  });

  app.patch("/api/projects/:id", requireAuth, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const existing = storage.getProject(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    const clean = sanitiseProjectBody(req.body);
    res.json(storage.updateProject(id, clean));
  });

  app.delete("/api/projects/:id", requireAuth, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const existing = storage.getProject(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    storage.deleteProject(id);
    res.json({ ok: true });
  });

  app.post("/api/projects/:id/duplicate", requireAuth, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const copy = storage.duplicateProject(id, req.session.userId!);
    if (!copy) return res.status(404).json({ error: "Not found or unauthorized" });
    res.status(201).json(copy);
  });

  app.patch("/api/projects/:id/rename", requireAuth, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const title = String(req.body.title || "").trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: "Title required" });
    const p = storage.renameProject(id, req.session.userId!, title);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });

  // ─── Paystack ────────────────────────────────────────────────────────────────
  app.post("/api/payments/initialize", requireAuth, async (req, res) => {
    const user = storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.tier === "pro") return res.status(400).json({ error: "Already on Pro plan" });
    try {
      const reference = generateRef();
      storage.createPayment({ userId: user.id, reference, amount: PRO_PRICE_KOBO, status: "pending", plan: "pro_lifetime" });
      const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
        email: user.email, amount: PRO_PRICE_KOBO, reference, currency: "NGN",
        metadata: { userId: user.id, plan: "pro_lifetime" },
        callback_url: `${process.env.APP_URL || "http://localhost:5000"}/#/pricing`,
      });
      if (!paystackRes.status) return res.status(500).json({ error: "Payment initialization failed" });
      res.json({ reference, authorizationUrl: paystackRes.data.authorization_url, accessCode: paystackRes.data.access_code, publicKey: PAYSTACK_PUBLIC, amount: PRO_PRICE_NGN, email: user.email });
    } catch (e: any) { res.status(500).json({ error: "Payment initialization failed" }); }
  });

  app.post("/api/payments/confirm", requireAuth, async (req, res) => {
    const reference = String(req.body.reference || "").trim();
    if (!reference) return res.status(400).json({ error: "Reference required" });
    // Reference format validation to prevent injection
    if (!/^CC-[\d]+-[A-Z0-9]+$/.test(reference)) return res.status(400).json({ error: "Invalid reference format" });
    try {
      const paystackRes = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
      const payment = storage.getPayment(reference);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      // Ownership check — can only confirm your own payment
      if (payment.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
      if (paystackRes.status && paystackRes.data.status === "success") {
        storage.updatePaymentStatus(reference, "success", JSON.stringify(paystackRes.data));
        storage.updateUserTier(payment.userId, "pro");
        req.session.userTier = "pro";
        return res.json({ success: true, tier: "pro" });
      }
      res.json({ success: false, message: "Payment not complete yet" });
    } catch (e: any) { res.status(500).json({ error: "Verification failed" }); }
  });

  // Raw body required for HMAC verification — must be registered BEFORE express.json parses it
  app.post("/api/payments/webhook", (req, res) => {
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
        const payment = storage.getPayment(ref);
        if (payment && payment.status !== "success") {
          storage.updatePaymentStatus(ref, "success", JSON.stringify(event.data));
          storage.updateUserTier(payment.userId, "pro");
        }
      }
    }
    res.sendStatus(200);
  });

  app.get("/api/payments/my", requireAuth, (req, res) => {
    res.json(storage.getPaymentsByUser(req.session.userId!));
  });

  // ─── Email ───────────────────────────────────────────────────────────────────
  app.post("/api/email/send-card", emailSendLimiter, async (req, res) => {
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
  app.get("/api/admin/analytics", requireAuth, requireAdmin, (req, res) => {
    res.json(storage.getAnalytics());
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
    res.json(storage.getAllUsers().map(safeUser));
  });

  app.patch("/api/admin/users/:id/tier", requireAuth, requireAdmin, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { tier } = req.body;
    if (!["free", "pro"].includes(tier)) return res.status(400).json({ error: "Invalid tier" });
    const user = storage.updateUserTier(id, tier);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(safeUser(user));
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    // Prevent self-demotion
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot change your own role" });
    const user = storage.updateUserRole(id, role);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(safeUser(user));
  });

  app.post("/api/admin/seed", async (req, res) => {
    // Only allow seeding if no admin exists yet
    const existingAdmin = storage.getUserByEmail("admin@cardcraft.com");
    if (existingAdmin) return res.json({ message: "Admin already exists", email: "admin@cardcraft.com" });
    try {
      const hashed = await bcrypt.hash("admin123", 12);
      storage.createUser({ name: "Admin", email: "admin@cardcraft.com", password: hashed, role: "admin", tier: "pro" });
      res.status(201).json({ message: "Admin created", email: "admin@cardcraft.com", password: "admin123" });
    } catch (e: any) { res.status(500).json({ error: "Seed failed" }); }
  });

  return httpServer;
}
