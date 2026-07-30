import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireStaff,
  requirePermission,
  safeId,
  sanitiseTemplateBody,
  logAdmin,
} from "../routeContext";

export function registerTemplateRoutes(app: Express) {
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
}
