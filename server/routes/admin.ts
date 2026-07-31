import type { Express } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { hashIp } from "../auditUtils";
import { getAnalyticsDashboard, getAnalyticsLiveFeed } from "../analyticsService";
import { getServerErrors24h } from "../metrics";
import { sendPasswordResetForEmail } from "../email";
import { paystackRequest } from "../paystackClient";
import { toCsv, sendCsv } from "../csv";
import {
  requireAuth,
  requireStaff,
  requirePermission,
  safeId,
  safeAdminUser,
  safePayment,
  parseAuditRow,
  logAdmin,
  isProd,
  isLocalRequest,
} from "../routeContext";

export function registerAdminRoutes(app: Express) {
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

  // Manual re-verification against Paystack — covers a missed/failed webhook
  // delivery ("replay") without waiting for Paystack to retry it.
  app.post("/api/admin/payments/:id/verify", requireAuth, requireStaff, requirePermission("payments:write"), async (req, res) => {
    const id = safeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const payment = await storage.getPaymentById(id);
    if (!payment) return res.status(404).json({ error: "Not found" });

    let paystackRes: any;
    try {
      paystackRes = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(payment.reference)}`);
    } catch (e: any) {
      console.error("[Paystack] Manual verify error:", e);
      return res.status(502).json({ error: "Could not reach Paystack to verify this reference" });
    }

    if (!paystackRes?.status) {
      await logAdmin(req, "payment.manual_verify", "payment", id, {
        reference: payment.reference,
        outcome: "unverifiable",
        paystackMessage: paystackRes?.message ?? null,
      });
      return res.status(502).json({
        error: paystackRes?.message || "Paystack could not verify this reference",
        payment: safePayment(payment),
      });
    }

    const paystackStatus = paystackRes.data?.status;
    const before = payment.status;

    if (paystackStatus === "success" && before !== "success") {
      await storage.updatePaymentStatus(payment.reference, "success");
      await storage.updateUserTier(payment.userId, "pro");
      const updated = await storage.getPaymentById(id);
      await logAdmin(req, "payment.manual_verify", "payment", id, {
        reference: payment.reference,
        outcome: "reconciled",
        from: before,
        to: "success",
        paystackStatus,
      });
      return res.json({ reconciled: true, paystackStatus, payment: safePayment(updated!) });
    }

    if (paystackStatus && paystackStatus !== "success" && before === "pending") {
      await storage.updatePaymentStatus(payment.reference, "failed");
      const updated = await storage.getPaymentById(id);
      await logAdmin(req, "payment.manual_verify", "payment", id, {
        reference: payment.reference,
        outcome: "reconciled",
        from: before,
        to: "failed",
        paystackStatus,
      });
      return res.json({ reconciled: true, paystackStatus, payment: safePayment(updated!) });
    }

    await logAdmin(req, "payment.manual_verify", "payment", id, {
      reference: payment.reference,
      outcome: "no_change",
      currentStatus: before,
      paystackStatus,
    });
    res.json({ reconciled: false, paystackStatus, payment: safePayment(payment) });
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
    sendCsv(res, "audit-log", toCsv(headers, rows));
  });

  app.get("/api/admin/payments/export", requireAuth, requireStaff, requirePermission("payments:read"), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const email = typeof req.query.email === "string" ? req.query.email : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const payments = await storage.getAdminPayments({ status, email, from, to, limit: 5000 });
    const rows = payments.map(safePayment);
    const headers = ["id", "userName", "userEmail", "reference", "amount", "currency", "status", "plan", "refundNote", "createdAt"];
    sendCsv(res, "payments", toCsv(headers, rows));
  });

  app.get("/api/admin/projects/export", requireAuth, requireStaff, requirePermission("projects:moderate"), async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const sharedOnly = req.query.sharedOnly === "true";
    const projects = await storage.getAdminProjects({ search, sharedOnly, limit: 5000 });
    const headers = ["id", "userName", "userEmail", "title", "templateTitle", "shareEnabled", "shareToken", "updatedAt", "createdAt"];
    sendCsv(res, "projects", toCsv(headers, projects));
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
}
