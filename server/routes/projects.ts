import type { Express } from "express";
import { storage } from "../storage";
import { FREE_PROJECT_LIMIT } from "@shared/schema";
import { requireStaffRole } from "../permissions";
import {
  requireAuth,
  safeId,
  sanitiseProjectBody,
  parseShareImage,
  getEffectiveUserId,
  blockIfImpersonating,
  logAudit,
} from "../routeContext";

export function registerProjectRoutes(app: Express) {
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
}
