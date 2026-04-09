import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import session from "express-session";
import nodemailer from "nodemailer";
import https from "https";
import { FREE_DOWNLOAD_LIMIT, PRO_PRICE_KOBO, PRO_PRICE_NGN } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
    userTier?: string;
  }
}

// ─── Paystack config (swap with real keys in production) ──────────────────────
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder_replace_with_real_key";
const PAYSTACK_PUBLIC = process.env.PAYSTACK_PUBLIC_KEY || "pk_test_placeholder_replace_with_real_key";

// ─── Nodemailer transporter (Gmail SMTP) ─────────────────────────────────────
const createTransporter = () => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "",
    pass: process.env.GMAIL_APP_PASSWORD || "",
  },
});

// ─── Paystack HTTP helpers ────────────────────────────────────────────────────
function paystackRequest(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options = {
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
    const req = https.request(options, res => {
      let raw = "";
      res.on("data", chunk => { raw += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error("Invalid Paystack response")); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const safeUser = (u: any) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  tier: u.tier || "free", downloadsToday: u.downloadsToday || 0,
  lastDownloadDate: u.lastDownloadDate,
});

function generateRef() {
  return `CC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(session({
    secret: process.env.SESSION_SECRET || "cardcraft-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));

  // ─── Auth ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: "All fields required" });
      if (storage.getUserByEmail(email)) return res.status(400).json({ error: "Email already registered" });
      const hashed = await bcrypt.hash(password, 10);
      const user = storage.createUser({ name, email, password: hashed, role: "user", tier: "free" });
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userTier = user.tier;
      res.json(safeUser(user));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const user = storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userTier = user.tier;
      res.json(safeUser(user));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = storage.getUser(req.session.userId);
    if (!user) return res.json({ user: null });
    req.session.userTier = user.tier;
    res.json({ user: safeUser(user) });
  });

  // ─── Download tracking ────────────────────────────────────────────────────
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

  // ─── Templates ────────────────────────────────────────────────────────────
  app.get("/api/templates", (req, res) => {
    const isAdmin = req.session.userRole === "admin";
    const templates = isAdmin ? storage.getAllTemplates() : storage.getPublishedTemplates();
    res.json(templates);
  });

  app.get("/api/templates/:id", (req, res) => {
    const t = storage.getTemplate(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  app.post("/api/templates", (req, res) => {
    if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    try { res.json(storage.createTemplate(req.body)); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/templates/:id", (req, res) => {
    if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    const t = storage.updateTemplate(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  app.delete("/api/templates/:id", (req, res) => {
    if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    storage.deleteTemplate(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── Projects ────────────────────────────────────────────────────────────
  app.get("/api/projects", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    res.json(storage.getProjectsByUser(req.session.userId));
  });

  app.get("/api/projects/:id", (req, res) => {
    const p = storage.getProject(Number(req.params.id));
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.session.userId && req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    res.json(p);
  });

  app.post("/api/projects", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    try { res.json(storage.createProject({ ...req.body, userId: req.session.userId })); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/projects/:id", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const existing = storage.getProject(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    res.json(storage.updateProject(Number(req.params.id), req.body));
  });

  app.delete("/api/projects/:id", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const existing = storage.getProject(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    storage.deleteProject(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── Paystack: Initialize payment ─────────────────────────────────────────
  app.post("/api/payments/initialize", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Sign in to upgrade" });
    const user = storage.getUser(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.tier === "pro") return res.status(400).json({ error: "Already on Pro plan" });

    try {
      const reference = generateRef();
      // Create pending payment record
      storage.createPayment({
        userId: user.id,
        reference,
        amount: PRO_PRICE_KOBO,
        status: "pending",
        plan: "pro_lifetime",
      });

      // Initialize with Paystack
      const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
        email: user.email,
        amount: PRO_PRICE_KOBO,
        reference,
        currency: "NGN",
        metadata: {
          userId: user.id,
          plan: "pro_lifetime",
          custom_fields: [
            { display_name: "Plan", variable_name: "plan", value: "CardCraft Pro — Lifetime" },
            { display_name: "User", variable_name: "user", value: user.name },
          ],
        },
        callback_url: `${process.env.APP_URL || "https://cardcraft.app"}/api/payments/callback`,
      });

      if (!paystackRes.status) {
        return res.status(500).json({ error: paystackRes.message || "Paystack initialization failed" });
      }

      res.json({
        reference,
        authorizationUrl: paystackRes.data.authorization_url,
        accessCode: paystackRes.data.access_code,
        publicKey: PAYSTACK_PUBLIC,
        amount: PRO_PRICE_NGN,
        email: user.email,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Paystack: Verify payment ─────────────────────────────────────────────
  app.get("/api/payments/verify/:reference", async (req, res) => {
    const { reference } = req.params;
    try {
      const paystackRes = await paystackRequest("GET", `/transaction/verify/${reference}`);
      const payment = storage.getPayment(reference);

      if (!payment) return res.status(404).json({ error: "Payment not found" });

      if (paystackRes.status && paystackRes.data.status === "success") {
        // Mark payment success
        storage.updatePaymentStatus(reference, "success", JSON.stringify(paystackRes.data));
        // Upgrade user to Pro
        storage.updateUserTier(payment.userId, "pro");
        // Update session if this is the paying user
        if (req.session.userId === payment.userId) req.session.userTier = "pro";

        return res.json({ success: true, message: "Payment verified. Your account has been upgraded to Pro!", tier: "pro" });
      } else {
        storage.updatePaymentStatus(reference, "failed", JSON.stringify(paystackRes.data));
        return res.json({ success: false, message: paystackRes.data?.gateway_response || "Payment was not successful" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Paystack: Webhook (server-to-server notification) ────────────────────
  app.post("/api/payments/webhook", (req, res) => {
    // In production: verify HMAC signature with PAYSTACK_SECRET
    const event = req.body;
    if (event.event === "charge.success") {
      const ref = event.data?.reference;
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

  // ─── Paystack: Inline popup (frontend calls this after popup closes) ───────
  app.post("/api/payments/confirm", async (req, res) => {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: "Reference required" });
    try {
      const paystackRes = await paystackRequest("GET", `/transaction/verify/${reference}`);
      const payment = storage.getPayment(reference);
      if (!payment) return res.status(404).json({ error: "Payment not found" });

      if (paystackRes.status && paystackRes.data.status === "success") {
        storage.updatePaymentStatus(reference, "success", JSON.stringify(paystackRes.data));
        storage.updateUserTier(payment.userId, "pro");
        if (req.session.userId === payment.userId) req.session.userTier = "pro";
        return res.json({ success: true, tier: "pro" });
      }
      res.json({ success: false, message: "Payment not complete yet" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Email: Send card ─────────────────────────────────────────────────────
  app.post("/api/email/send-card", async (req, res) => {
    const { to, subject, message, imageDataUrl, cardTitle } = req.body;
    if (!to || !imageDataUrl) return res.status(400).json({ error: "Recipient email and card image are required" });

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: "Invalid email address" });

    // Check if Gmail is configured
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
      return res.status(503).json({
        error: "Email not configured",
        hint: "Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables to enable email sending."
      });
    }

    try {
      // Convert base64 data URL to buffer
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      const isJpeg = imageDataUrl.startsWith("data:image/jpeg");
      const filename = `${(cardTitle || "card").replace(/\s+/g, "-")}.${isJpeg ? "jpg" : "png"}`;

      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"CardCraft" <${gmailUser}>`,
        to,
        subject: subject || `${cardTitle || "Your Card"} from CardCraft`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f7;padding:32px;border-radius:12px;">
            <h2 style="color:#1a1a1a;margin-bottom:8px;">You received a card!</h2>
            <p style="color:#666;margin-bottom:24px;">${message || "Someone designed this card for you using CardCraft."}</p>
            <img src="cid:cardimage" alt="${cardTitle || "Birthday Card"}" style="width:100%;max-width:500px;border-radius:12px;display:block;margin:0 auto 24px;" />
            <p style="color:#999;font-size:12px;text-align:center;">Created with <a href="https://cardcraft.app" style="color:#c9a84c;">CardCraft</a> — Design beautiful cards online</p>
          </div>
        `,
        attachments: [{
          filename,
          content: imageBuffer,
          cid: "cardimage",
        }],
      });

      res.json({ success: true, message: `Card sent to ${to}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Email config status ──────────────────────────────────────────────────
  app.get("/api/email/status", (req, res) => {
    res.json({
      configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      sender: process.env.GMAIL_USER || null,
    });
  });

  // ─── Admin: User Management ───────────────────────────────────────────────
  app.get("/api/admin/users", (req, res) => {
    if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    res.json(storage.getAllUsers().map(safeUser));
  });

  app.patch("/api/admin/users/:id/tier", (req, res) => {
    if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { tier } = req.body;
    if (!["free", "pro"].includes(tier)) return res.status(400).json({ error: "Invalid tier" });
    const user = storage.updateUserTier(Number(req.params.id), tier);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(safeUser(user));
  });

  app.patch("/api/admin/users/:id/role", (req, res) => {
    if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const user = storage.updateUserRole(Number(req.params.id), role);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(safeUser(user));
  });

  app.post("/api/admin/seed", async (req, res) => {
    try {
      const existing = storage.getUserByEmail("admin@cardcraft.com");
      if (existing) return res.json({ message: "Admin already exists", email: "admin@cardcraft.com" });
      const hashed = await bcrypt.hash("admin123", 10);
      storage.createUser({ name: "Admin", email: "admin@cardcraft.com", password: hashed, role: "admin", tier: "pro" });
      res.json({ message: "Admin created", email: "admin@cardcraft.com", password: "admin123" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
