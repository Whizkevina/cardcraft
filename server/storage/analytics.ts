import { eq, desc, gte, lte, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { AnalyticsSession, AnalyticsEvent } from "@shared/schema";
import { getDb } from "./db";
import { getSystemMeta } from "./systemMeta";

export async function upsertAnalyticsSession(data: {
  sessionKey: string;
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  userRole: string;
  userTier?: string | null;
  pagePath?: string;
  referrer?: string;
  utmSource?: string;
  utmCampaign?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  country?: string | null;
}) {
  const now = new Date();
  const [existing] = await getDb()
    .select({ id: schema.analyticsSessions.id, startedAt: schema.analyticsSessions.startedAt })
    .from(schema.analyticsSessions)
    .where(and(
      eq(schema.analyticsSessions.sessionKey, data.sessionKey),
      eq(schema.analyticsSessions.userId, data.userId),
    ))
    .limit(1);

  if (existing) {
    await getDb().update(schema.analyticsSessions).set({
      pagePath: data.pagePath ?? null,
      referrer: data.referrer ?? null,
      utmSource: data.utmSource ?? null,
      utmCampaign: data.utmCampaign ?? null,
      browser: data.browser ?? null,
      os: data.os ?? null,
      deviceType: data.deviceType ?? null,
      country: data.country ?? null,
      lastSeenAt: now,
    }).where(eq(schema.analyticsSessions.id, existing.id));
    return existing.id;
  }

  const [row] = await getDb().insert(schema.analyticsSessions).values({
    sessionKey: data.sessionKey,
    userId: data.userId,
    userName: data.userName,
    userEmail: data.userEmail,
    userRole: data.userRole,
    userTier: data.userTier,
    pagePath: data.pagePath ?? null,
    referrer: data.referrer ?? null,
    utmSource: data.utmSource ?? null,
    utmCampaign: data.utmCampaign ?? null,
    browser: data.browser ?? null,
    os: data.os ?? null,
    deviceType: data.deviceType ?? null,
    country: data.country ?? null,
    startedAt: now,
    lastSeenAt: now,
  }).returning({ id: schema.analyticsSessions.id });
  return row?.id;
}

export async function recordAnalyticsEvent(data: {
  sessionKey?: string;
  userId?: number | null;
  eventType: string;
  pagePath?: string;
  action?: string;
  resourceType?: string;
  resourceId?: number | null;
  meta?: Record<string, unknown>;
  browser?: string;
  os?: string;
  deviceType?: string;
  referrer?: string;
  ipHash?: string | null;
}) {
  await getDb().insert(schema.analyticsEvents).values({
    sessionKey: data.sessionKey ?? null,
    userId: data.userId ?? null,
    eventType: data.eventType,
    pagePath: data.pagePath?.slice(0, 256) ?? null,
    action: data.action?.slice(0, 128) ?? null,
    resourceType: data.resourceType ?? null,
    resourceId: data.resourceId ?? null,
    meta: data.meta ? JSON.stringify(data.meta) : null,
    browser: data.browser ?? null,
    os: data.os ?? null,
    deviceType: data.deviceType ?? null,
    referrer: data.referrer?.slice(0, 512) ?? null,
    ipHash: data.ipHash ?? null,
  });
}

export async function getActiveSessions(maxAgeMinutes = 5): Promise<AnalyticsSession[]> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return getDb()
    .select()
    .from(schema.analyticsSessions)
    .where(gte(schema.analyticsSessions.lastSeenAt, cutoff))
    .orderBy(desc(schema.analyticsSessions.lastSeenAt))
    .limit(50);
}

export async function getRecentAnalyticsEvents(limit = 30): Promise<AnalyticsEvent[]> {
  return getDb()
    .select()
    .from(schema.analyticsEvents)
    .orderBy(desc(schema.analyticsEvents.createdAt))
    .limit(limit);
}

export async function purgeOldAnalyticsEvents(retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await getDb().delete(schema.analyticsEvents).where(lte(schema.analyticsEvents.createdAt, cutoff));
  await getDb().delete(schema.analyticsSessions).where(lte(schema.analyticsSessions.lastSeenAt, cutoff));
}

export async function getAnalyticsRetentionSettings() {
  const events = await getSystemMeta("analytics_retention_days");
  const audit = await getSystemMeta("audit_retention_days");
  return {
    analyticsRetentionDays: events ? parseInt(events.value, 10) || 90 : 90,
    auditRetentionDays: audit ? parseInt(audit.value, 10) || 365 : 365,
  };
}
