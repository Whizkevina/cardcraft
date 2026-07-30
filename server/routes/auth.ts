import type { Express } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";
import { storage } from "../storage";
import { authLimiter, forgotPasswordLimiter } from "../rateLimiters";
import { sendWelcomeEmail, sendPasswordResetForEmail } from "../email";
import {
  requireAuth,
  safeUser,
  validateEmail,
  establishSession,
  logAudit,
} from "../routeContext";

export function registerAuthRoutes(app: Express) {
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
}
