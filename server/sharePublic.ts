import type { Request, Response } from "express";
import type { Project } from "@shared/schema";
import { storage } from "./storage";
import { extractClientIp, hashIp, parseUserAgent } from "./auditUtils";
import { isLikelyBot, resolveVisitorType } from "./botDetection";

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getAppBaseUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = req.get("host");
  const proto = req.protocol || "http";
  return host ? `${proto}://${host}` : "http://127.0.0.1:5000";
}

export function parseImageDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0) return null;
    const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
    return { mime, buffer };
  } catch {
    return null;
  }
}

function pickShareImageSource(project: Project): string | null {
  return project.shareImage || project.thumbnail || null;
}

export async function resolvePublicShare(token: string): Promise<Project | null> {
  if (!token || token.length < 16) return null;
  const project = await storage.getProjectByShareToken(token);
  if (!project || !project.shareEnabled) return null;
  return project;
}

export function registerSharePublicRoutes(app: import("express").Express) {
  app.get("/share/:token/image.png", async (req, res) => {
    const token = String(req.params.token || "").trim();
    const project = await resolvePublicShare(token);
    if (!project) return res.status(404).send("Not found");

    const source = pickShareImageSource(project);
    if (!source) return res.status(404).send("No preview image");

    const parsed = parseImageDataUrl(source);
    if (!parsed) return res.status(404).send("Invalid preview image");

    res.setHeader("Content-Type", parsed.mime);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(parsed.buffer);
  });

  app.get("/share/:token", async (req, res) => {
    const token = String(req.params.token || "").trim();
    const project = await resolvePublicShare(token);
    if (!project) {
      return res.status(404).send("Card not found");
    }

    const ip = extractClientIp(req);
    const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
    const visitorType = resolveVisitorType(ua, false);
    const parsedUa = parseUserAgent(ua);
    await storage.recordAnalyticsEvent({
      eventType: "page_view",
      pagePath: `/share/${token.slice(0, 8)}…`,
      resourceType: "project",
      resourceId: project.id,
      meta: { title: project.title, userId: project.userId, visitorType, source: "share_html" },
      ipHash: hashIp(ip),
      referrer: typeof req.headers.referer === "string" ? req.headers.referer : undefined,
      browser: parsedUa.browser,
      os: parsedUa.os,
      deviceType: parsedUa.deviceType,
    });
    if (!isLikelyBot(ua)) {
      await storage.recordAnalyticsEvent({
        eventType: "share_view",
        pagePath: `/share/${token.slice(0, 8)}…`,
        resourceType: "project",
        resourceId: project.id,
        meta: { title: project.title, userId: project.userId, visitorType: "guest" },
        ipHash: hashIp(ip),
        referrer: typeof req.headers.referer === "string" ? req.headers.referer : undefined,
      });
    }
    await storage.logAuditEvent({
      actorRole: "guest",
      action: "share.view",
      targetType: "project",
      targetId: project.id,
      meta: { title: project.title, shareToken: token.slice(0, 8) + "…" },
      ipAddress: ip,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      pagePath: `/share/${token.slice(0, 8)}…`,
      referrer: typeof req.headers.referer === "string" ? req.headers.referer : null,
    });

    const baseUrl = getAppBaseUrl(req);
    const pageUrl = `${baseUrl}/share/${token}`;
    const hasPreview = Boolean(pickShareImageSource(project));
    const imageUrl = hasPreview
      ? `${baseUrl}/share/${token}/image.png`
      : `${baseUrl}/og-image.png`;
    const title = escapeHtml(project.title || "CardCraft Card");
    const description = escapeHtml(`View ${project.title || "this card"} on CardCraft`);
    const hashUrl = `/#/share/${token}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — CardCraft</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CardCraft" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="1000" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="canonical" href="${pageUrl}" />
  <meta http-equiv="refresh" content="0;url=${hashUrl}" />
  <script>window.location.replace(${JSON.stringify(hashUrl)});</script>
  <style>
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1.5rem; }
    img { max-width: min(480px, 100%); height: auto; border-radius: 4px; box-shadow: 0 20px 50px rgba(0,0,0,.45); }
    a { color: #f0c040; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="${title}" />
  <p>Opening card… <a href="${hashUrl}">Click here</a> if you are not redirected.</p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(html);
  });
}
