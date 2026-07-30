import type { Express } from "express";
import { storage } from "../storage";
import { FREE_DOWNLOAD_LIMIT } from "@shared/schema";
import { buildPricingQuote } from "../pricing";
import { logAudit } from "../routeContext";

function trackGuestDownload(req: any) {
  const today = new Date().toISOString().split("T")[0];
  const lastDate = req.session.guestDownloadDate;
  const downloadsToday = lastDate === today ? (req.session.guestDownloadsToday || 0) + 1 : 1;
  const allowed = downloadsToday <= FREE_DOWNLOAD_LIMIT;
  if (allowed) {
    req.session.guestDownloadsToday = downloadsToday;
    req.session.guestDownloadDate = today;
  }
  return { allowed, downloadsToday };
}

export function registerDownloadRoutes(app: Express) {
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
}
