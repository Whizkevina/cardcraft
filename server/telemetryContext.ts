import type { Request } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { extractClientIp, hashIp } from "./auditUtils";
import { lookupCountry } from "./geoip";
import { resolveVisitorType, type VisitorType } from "./botDetection";

const GUEST_USER_ID = 0;

export function getTelemetrySessionKey(req: Request): string {
  if (req.sessionID) {
    return crypto.createHash("sha256").update(req.sessionID).digest("hex").slice(0, 32);
  }
  const ip = extractClientIp(req);
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
  return crypto.createHash("sha256").update(`${ip}:${ua}`).digest("hex").slice(0, 32);
}

export interface TelemetryActor {
  sessionKey: string;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  userRole: string;
  userTier: string | null;
  visitorType: VisitorType;
  ipHash: string | null;
  country: string | null;
}

export async function resolveTelemetryActor(req: Request): Promise<TelemetryActor> {
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
  const sessionKey = getTelemetrySessionKey(req);
  const ip = extractClientIp(req);
  const country = lookupCountry(ip);

  if (req.session.userId) {
    const user = await storage.getUser(req.session.userId);
    if (user) {
      const visitorType = resolveVisitorType(ua, true);
      return {
        sessionKey,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        userTier: user.tier,
        visitorType,
        ipHash: hashIp(ip),
        country,
      };
    }
  }

  // Touch session so express-session persists an anonymous cookie for guests.
  req.session.analyticsGuest = true;

  const visitorType = resolveVisitorType(ua, false);
  return {
    sessionKey,
    userId: GUEST_USER_ID,
    userName: visitorType === "bot" ? "Bot" : "Guest",
    userEmail: null,
    userRole: visitorType,
    userTier: null,
    visitorType,
    ipHash: hashIp(ip),
    country,
  };
}
