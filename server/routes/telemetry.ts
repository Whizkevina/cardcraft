import type { Express } from "express";
import { storage } from "../storage";
import { telemetryLimiter } from "../rateLimiters";
import { resolveTelemetryActor } from "../telemetryContext";

export function registerTelemetryRoutes(app: Express) {
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
}
