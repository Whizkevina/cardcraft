import crypto from "crypto";

const INTEGRITY_SECRET = process.env.AUDIT_INTEGRITY_SECRET || process.env.SESSION_SECRET || "dev-audit-integrity";

export type AuditSeverity = "info" | "warning" | "security" | "critical";

export function extractClientIp(req: { headers?: Record<string, unknown>; ip?: string }): string {
  const raw = String(req.headers?.["x-forwarded-for"] || req.ip || "").split(",")[0].trim().replace("::ffff:", "");
  return raw.slice(0, 64);
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHmac("sha256", INTEGRITY_SECRET).update(ip).digest("hex").slice(0, 32);
}

export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    parts[parts.length - 1] = "xxxx";
    return parts.join(":");
  }
  return ip.length > 4 ? `${ip.slice(0, 4)}…` : "xxx";
}

export function buildIntegrityHash(payload: Record<string, unknown>): string {
  const body = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHmac("sha256", INTEGRITY_SECRET).update(body).digest("hex");
}

export function getAuditSeverity(action: string): AuditSeverity {
  if (["user.login_failed", "user.force_logout", "user.status_change"].includes(action)) return "security";
  if (["project.admin_delete", "template.delete", "user.role_change"].includes(action)) return "critical";
  if (["payment.failed", "payment.pending"].includes(action)) return "warning";
  return "info";
}

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  const s = String(ua || "");
  if (!s) return { browser: "Unknown", os: "Unknown", deviceType: "unknown" };

  let browser = "Unknown";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = "Chrome";
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = "Safari";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Opera|OPR\//i.test(s)) browser = "Opera";

  let os = "Unknown";
  if (/Windows NT/i.test(s)) os = "Windows";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(s)) os = "iOS";
  else if (/Linux/i.test(s)) os = "Linux";

  let deviceType: ParsedUserAgent["deviceType"] = "desktop";
  if (/iPad|Tablet/i.test(s)) deviceType = "tablet";
  else if (/Mobile|Android|iPhone/i.test(s)) deviceType = "mobile";

  return { browser, os, deviceType };
}

export function extractReferrerSource(referrer: string | null | undefined): string {
  if (!referrer?.trim()) return "Direct";
  try {
    const url = new URL(referrer);
    if (typeof window !== "undefined" && url.hostname === window.location.hostname) return "Internal";
    if (url.hostname.includes("google")) return "Google";
    if (url.hostname.includes("facebook") || url.hostname.includes("instagram")) return "Social";
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Other";
  }
}

export function extractReferrerSourceServer(referrer: string | null | undefined, host?: string): string {
  if (!referrer?.trim()) return "Direct";
  try {
    const url = new URL(referrer);
    if (host && url.hostname === host.replace(/^https?:\/\//, "").split("/")[0]) return "Internal";
    if (url.hostname.includes("google")) return "Google";
    if (url.hostname.includes("facebook") || url.hostname.includes("instagram")) return "Social";
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Other";
  }
}
