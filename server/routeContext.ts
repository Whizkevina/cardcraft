import crypto from "crypto";
import validator from "validator";
import { storage } from "./storage";
import { extractClientIp } from "./auditUtils";
import { hasPermission, requireStaffRole, type Permission } from "./permissions";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
    userTier?: string;
    mustChangePassword?: boolean;
    guestDownloadsToday?: number;
    guestDownloadDate?: string;
    impersonatingUserId?: number;
    impersonatingUserName?: string;
    analyticsGuest?: boolean;
  }
}

export const isProd = process.env.NODE_ENV === "production";

// ─── Sanitise helpers ─────────────────────────────────────────────────────────
/** Strip all HTML tags — prevents XSS in email bodies */
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Validate and normalise a safe integer from route params */
export function safeId(param: string): number | null {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Strip fields that must never be set by clients */
export function sanitiseTemplateBody(body: any) {
  const { title, category, status, canvasJson, thumbnailColor, isPro } = body;
  return { title, category, status, canvasJson, thumbnailColor, isPro };
}

export function sanitiseProjectBody(body: any) {
  const { title, designJson, exportSettings, thumbnail, templateId } = body;
  return { title, designJson, exportSettings, thumbnail, templateId };
}

export const SHARE_IMAGE_MAX_LENGTH = 2_800_000;

/** Accept PNG data URLs captured from the editor canvas at share time */
export function parseShareImage(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const value = String(raw);
  if (!value.startsWith("data:image/png;base64,")) return null;
  if (value.length > SHARE_IMAGE_MAX_LENGTH) return null;
  return value;
}

/** Normalise an email address */
export function validateEmail(email: string): boolean {
  return validator.isEmail(String(email).trim().toLowerCase());
}

// ─── Safe serialisers ──────────────────────────────────────────────────────────
export const safeUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  tier: u.tier || "free",
  theme: u.theme || "dark",
  downloadsToday: u.downloadsToday || 0,
  lastDownloadDate: u.lastDownloadDate,
  createdAt: u.createdAt,
  status: u.status || "active",
  // NEVER include: password, resetToken, resetTokenExpiry
});

export const safeAdminUser = (u: any, stats?: { projectCount: number; sharedCount: number }) => ({
  ...safeUser(u),
  authProvider: u.authProvider || "email",
  lastLoginAt: u.lastLoginAt,
  totalDownloads: u.totalDownloads ?? 0,
  proExpiresAt: u.proExpiresAt,
  adminNote: u.adminNote ?? null,
  projectCount: stats?.projectCount ?? 0,
  sharedCount: stats?.sharedCount ?? 0,
});

export const safePayment = (p: any) => ({
  id: p.id,
  userId: p.userId,
  userName: p.userName,
  userEmail: p.userEmail,
  reference: p.reference,
  amount: p.amount,
  currency: p.currency,
  status: p.status,
  plan: p.plan,
  refundNote: p.refundNote,
  createdAt: p.createdAt,
});

export async function establishSession(req: any, user: any) {
  const active = await storage.enforceProExpiry(user);
  req.session.userId = active.id;
  req.session.userRole = active.role;
  req.session.userTier = active.tier;
  await storage.touchLastLogin(active.id);
  return active;
}

// ─── Audit logging ─────────────────────────────────────────────────────────────
export async function logAudit(
  req: any,
  action: string,
  targetType: string,
  targetId: number | null,
  meta?: Record<string, unknown>,
  actorOverride?: { id?: number | null; role?: string; email?: string | null; name?: string | null },
) {
  try {
    const actorId = actorOverride?.id !== undefined ? actorOverride.id : (req.session?.userId ?? null);
    let role = actorOverride?.role;
    let email = actorOverride?.email ?? null;
    let name = actorOverride?.name ?? null;
    if (!role && actorId) {
      const u = await storage.getUser(actorId);
      if (u) {
        role = u.role;
        email = email ?? u.email;
        name = name ?? u.name;
      }
    }
    const ip = extractClientIp(req);
    const userAgent = typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null;
    const pagePath = typeof meta?.pagePath === "string" ? meta.pagePath : (typeof req.headers?.["x-page-path"] === "string" ? req.headers["x-page-path"] : null);
    const referrer = typeof req.headers?.referer === "string" ? req.headers.referer : null;
    const beforeValue = meta?.from != null ? String(meta.from) : (meta?.before != null ? String(meta.before) : null);
    const afterValue = meta?.to != null ? String(meta.to) : (meta?.after != null ? String(meta.after) : null);
    await storage.logAuditEvent({
      actorId,
      actorRole: role ?? (actorId ? "user" : "guest"),
      actorEmail: email ?? (typeof meta?.email === "string" ? meta.email : null),
      actorName: name,
      action,
      targetType,
      targetId,
      meta,
      ipAddress: ip || null,
      sessionId: req.sessionID ?? null,
      userAgent,
      pagePath,
      referrer,
      beforeValue,
      afterValue,
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}

export async function logAdmin(req: any, action: string, targetType: string, targetId: number | null, meta?: Record<string, unknown>) {
  await logAudit(req, action, targetType, targetId, meta);
}

export function parseAuditRow(l: { meta: string | null; [key: string]: unknown }) {
  return {
    ...l,
    meta: l.meta ? (() => { try { return JSON.parse(l.meta as string); } catch { return l.meta; } })() : null,
  };
}

// ─── Token helpers ──────────────────────────────────────────────────────────────
export function generateRef() {
  return `CC-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}
export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Middleware ─────────────────────────────────────────────────────────────────
export const requireAuth = async (req: any, res: any, next: any) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
  const active = await storage.enforceProExpiry(user);
  if (active.tier !== user.tier) {
    req.session.userTier = active.tier;
  }
  req.currentUser = active;
  next();
};

export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.session.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

export const requireStaff = (req: any, res: any, next: any) => {
  if (!requireStaffRole(req.session.userRole ?? "")) return res.status(403).json({ error: "Forbidden" });
  next();
};

export const requirePermission = (permission: Permission) => (req: any, res: any, next: any) => {
  if (!hasPermission(req.session.userRole ?? "", permission)) return res.status(403).json({ error: "Forbidden" });
  next();
};

export function getEffectiveUserId(req: any): number {
  if (req.session.impersonatingUserId && hasPermission(req.session.userRole ?? "", "users:impersonate")) {
    return req.session.impersonatingUserId;
  }
  return req.session.userId!;
}

export function isImpersonating(req: any): boolean {
  return Boolean(req.session.impersonatingUserId && hasPermission(req.session.userRole ?? "", "users:impersonate"));
}

export function blockIfImpersonating(req: any, res: any): boolean {
  if (isImpersonating(req)) {
    res.status(403).json({ error: "Read-only view mode — exit support view to make changes" });
    return true;
  }
  return false;
}

export const isLocalRequest = (req: any) => {
  const ip = String(req.ip || "").replace("::ffff:", "");
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim().replace("::ffff:", "");
  return ip === "127.0.0.1" || ip === "::1" || forwarded === "127.0.0.1" || forwarded === "::1";
};
