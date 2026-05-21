import { sql, desc, gte, eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { AnalyticsSession, AnalyticsEvent } from "@shared/schema";
import { storage, db as dbProxy } from "./storage";
import { getServerErrors24h } from "./metrics";
import { extractReferrerSourceServer } from "./auditUtils";

const db = dbProxy as ReturnType<typeof import("drizzle-orm/postgres-js").drizzle>;

type Period = "7d" | "30d" | "90d";

function periodDays(period: Period): number {
  if (period === "30d") return 30;
  if (period === "90d") return 90;
  return 7;
}

function periodStart(period: Period): Date {
  return new Date(Date.now() - periodDays(period) * 24 * 60 * 60 * 1000);
}

export async function getAnalyticsDashboard(period: Period = "7d") {
  const start = periodStart(period);
  const today = new Date().toISOString().split("T")[0];
  const base = await storage.getAnalytics();
  const ops = await storage.getOpsStats();
  const activeSessions = await storage.getActiveSessions(5);

  const signupsTrend = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${schema.users.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.users)
    .where(gte(schema.users.createdAt, start))
    .groupBy(sql`date_trunc('day', ${schema.users.createdAt})`)
    .orderBy(sql`date_trunc('day', ${schema.users.createdAt})`);

  const cardsTrend = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${schema.projects.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.projects)
    .where(gte(schema.projects.createdAt, start))
    .groupBy(sql`date_trunc('day', ${schema.projects.createdAt})`)
    .orderBy(sql`date_trunc('day', ${schema.projects.createdAt})`);

  const revenueTrend = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${schema.payments.createdAt}), 'YYYY-MM-DD')`,
      amount: sql<number>`coalesce(sum(${schema.payments.amount}), 0)::int`,
    })
    .from(schema.payments)
    .where(and(gte(schema.payments.createdAt, start), eq(schema.payments.status, "success")))
    .groupBy(sql`date_trunc('day', ${schema.payments.createdAt})`)
    .orderBy(sql`date_trunc('day', ${schema.payments.createdAt})`);

  const topPages = await db
    .select({
      path: schema.analyticsEvents.pagePath,
      views: sql<number>`count(*)::int`,
    })
    .from(schema.analyticsEvents)
    .where(and(
      gte(schema.analyticsEvents.createdAt, start),
      eq(schema.analyticsEvents.eventType, "page_view"),
    ))
    .groupBy(schema.analyticsEvents.pagePath)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const topActions = await db
    .select({
      action: schema.analyticsEvents.action,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.analyticsEvents)
    .where(and(gte(schema.analyticsEvents.createdAt, start), sql`${schema.analyticsEvents.action} IS NOT NULL`))
    .groupBy(schema.analyticsEvents.action)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const devices = await db
    .select({
      device: schema.analyticsSessions.deviceType,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.analyticsSessions)
    .where(gte(schema.analyticsSessions.lastSeenAt, start))
    .groupBy(schema.analyticsSessions.deviceType)
    .orderBy(desc(sql`count(*)`));

  const browsers = await db
    .select({
      browser: schema.analyticsSessions.browser,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.analyticsSessions)
    .where(gte(schema.analyticsSessions.lastSeenAt, start))
    .groupBy(schema.analyticsSessions.browser)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const [pageViewsToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.analyticsEvents)
    .where(and(
      eq(schema.analyticsEvents.eventType, "page_view"),
      sql`DATE(${schema.analyticsEvents.createdAt}) = ${today}`,
    ));

  const [sessionsToday] = await db
    .select({ count: sql<number>`count(distinct ${schema.analyticsSessions.sessionKey})::int` })
    .from(schema.analyticsSessions)
    .where(sql`DATE(${schema.analyticsSessions.startedAt}) = ${today}`);

  const conversionEvents = await db
    .select({
      event: schema.analyticsEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.analyticsEvents)
    .where(and(
      gte(schema.analyticsEvents.createdAt, start),
      sql`${schema.analyticsEvents.eventType} IN ('conversion', 'share_view', 'download')`,
    ))
    .groupBy(schema.analyticsEvents.eventType);

  const referrersRaw = await db
    .select({ referrer: schema.analyticsSessions.referrer, count: sql<number>`count(*)::int` })
    .from(schema.analyticsSessions)
    .where(gte(schema.analyticsSessions.lastSeenAt, start))
    .groupBy(schema.analyticsSessions.referrer)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  const referrerMap = new Map<string, number>();
  for (const row of referrersRaw) {
    const source = extractReferrerSourceServer(row.referrer);
    referrerMap.set(source, (referrerMap.get(source) ?? 0) + row.count);
  }
  const referrers = Array.from(referrerMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const funnel = {
    signups: Number(base.totalUsers),
    firstCard: await countUsersWithProjects(),
    hitDownloadCap: ops.atDownloadCapToday,
    paid: Number(base.proUsers),
  };

  return {
    period,
    activeUsersNow: activeSessions.length,
    sessionsToday: sessionsToday?.count ?? 0,
    pageViewsToday: pageViewsToday?.count ?? 0,
    errors24h: getServerErrors24h(),
    ...base,
    ops,
    signupsTrend,
    cardsTrend,
    revenueTrend: revenueTrend.map(r => ({ date: r.date, amount: Math.round((r.amount ?? 0) / 100) })),
    topPages: topPages.filter(p => p.path).map(p => ({ path: p.path!, views: p.views })),
    topActions: topActions.filter(a => a.action).map(a => ({ action: a.action!, count: a.count })),
    devices: devices.map(d => ({ device: d.device || "unknown", count: d.count })),
    browsers: browsers.map(b => ({ browser: b.browser || "Unknown", count: b.count })),
    referrers,
    conversions: conversionEvents.map(c => ({ event: c.event, count: c.count })),
    funnel,
    retention: await storage.getAnalyticsRetentionSettings(),
  };
}

async function countUsersWithProjects(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${schema.projects.userId})::int` })
    .from(schema.projects);
  return row?.count ?? 0;
}

export async function getAnalyticsLiveFeed() {
  const activeSessions = await storage.getActiveSessions(5);
  const recentEvents = await storage.getRecentAnalyticsEvents(25);
  const recentAudit = await storage.getAuditLogs({ limit: 15, offset: 0 });

  return {
    activeSessions: activeSessions.map((s: AnalyticsSession) => ({
      id: s.id,
      userId: s.userId,
      userName: s.userName,
      userEmail: s.userEmail,
      userRole: s.userRole,
      userTier: s.userTier,
      pagePath: s.pagePath,
      referrer: s.referrer,
      browser: s.browser,
      os: s.os,
      deviceType: s.deviceType,
      startedAt: s.startedAt,
      lastSeenAt: s.lastSeenAt,
      durationSeconds: s.startedAt && s.lastSeenAt
        ? Math.max(0, Math.floor((new Date(s.lastSeenAt).getTime() - new Date(s.startedAt).getTime()) / 1000))
        : 0,
    })),
    recentEvents: recentEvents.map((e: AnalyticsEvent) => ({
      id: e.id,
      eventType: e.eventType,
      pagePath: e.pagePath,
      action: e.action,
      userId: e.userId,
      browser: e.browser,
      deviceType: e.deviceType,
      createdAt: e.createdAt,
      meta: e.meta ? (() => { try { return JSON.parse(e.meta); } catch { return null; } })() : null,
    })),
    recentAudit: recentAudit.map((a: Awaited<ReturnType<typeof storage.getAuditLogs>>[number]) => ({
      id: a.id,
      action: a.action,
      severity: a.severity,
      actorName: a.actorName,
      actorRole: a.actorRole,
      targetType: a.targetType,
      targetId: a.targetId,
      pagePath: a.pagePath,
      createdAt: a.createdAt,
    })),
  };
}

export async function runRetentionCleanup() {
  const settings = await storage.getAnalyticsRetentionSettings();
  await storage.purgeOldAnalyticsEvents(settings.analyticsRetentionDays);
  await storage.purgeOldAuditLogs(settings.auditRetentionDays);
}
