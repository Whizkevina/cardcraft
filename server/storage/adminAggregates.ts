import { eq, desc, sql, and, gte } from "drizzle-orm";
import * as schema from "@shared/schema";
import { FREE_PROJECT_LIMIT } from "@shared/schema";
import { getDb } from "./db";
import { getUser } from "./users";
import { getProjectStatsByUser } from "./projects";
import { getPaymentsByUser } from "./payments";

export async function getAnalytics() {
  const totalUsers = await getDb().select({ count: sql`count(*)` }).from(schema.users);
  const proUsers = await getDb().select({ count: sql`count(*)` }).from(schema.users).where(eq(schema.users.tier, "pro"));
  const totalCards = await getDb().select({ count: sql`count(*)` }).from(schema.projects);
  const totalRevenue = await getDb().select({ sum: sql`coalesce(sum(amount), 0)` }).from(schema.payments).where(eq(schema.payments.status, "success"));
  const today = new Date().toISOString().split("T")[0];
  const cardsToday = await getDb().select({ count: sql`count(*)` }).from(schema.projects).where(sql`DATE(created_at) = ${today}`);
  const signupsToday = await getDb().select({ count: sql`count(*)` }).from(schema.users).where(sql`DATE(created_at) = ${today}`);
  const topTemplates = await getDb().select({ id: schema.templates.id, title: schema.templates.title, uses: schema.templates.usageCount, thumbnailColor: schema.templates.thumbnailColor }).from(schema.templates).orderBy(desc(schema.templates.usageCount)).limit(5);
  const recentSignups = await getDb().select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, createdAt: schema.users.createdAt, tier: schema.users.tier }).from(schema.users).orderBy(desc(schema.users.createdAt)).limit(10);
  return { totalUsers: (totalUsers[0]?.count as any) || 0, proUsers: (proUsers[0]?.count as any) || 0, totalCards: (totalCards[0]?.count as any) || 0, totalRevenue: (totalRevenue[0]?.sum as any) || 0, cardsToday: (cardsToday[0]?.count as any) || 0, signupsToday: (signupsToday[0]?.count as any) || 0, topTemplates, recentSignups };
}

export async function getAdminUserDetail(userId: number) {
  const user = await getUser(userId);
  if (!user) return undefined;
  const stats = (await getProjectStatsByUser())[userId] ?? { projectCount: 0, sharedCount: 0 };
  const payments = await getPaymentsByUser(userId);
  return { user, stats, payments };
}

export async function getOpsStats() {
  const today = new Date().toISOString().split("T")[0];
  const nearLimitThreshold = Math.max(1, FREE_PROJECT_LIMIT - 1);

  const [atCapRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users)
    .where(and(
      eq(schema.users.tier, "free"),
      gte(schema.users.downloadsToday, 3),
      sql`${schema.users.lastDownloadDate} >= ${today}`,
    ));

  const [sharedRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projects)
    .where(eq(schema.projects.shareEnabled, true));

  const nearLimitUsers = await getDb()
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      projectCount: sql<number>`count(${schema.projects.id})::int`,
    })
    .from(schema.users)
    .innerJoin(schema.projects, eq(schema.projects.userId, schema.users.id))
    .where(eq(schema.users.tier, "free"))
    .groupBy(schema.users.id, schema.users.name, schema.users.email)
    .having(sql`count(${schema.projects.id}) >= ${nearLimitThreshold}`)
    .orderBy(sql`count(${schema.projects.id}) DESC`)
    .limit(8);

  return {
    atDownloadCapToday: atCapRow?.count ?? 0,
    sharedLinksCount: sharedRow?.count ?? 0,
    freeProjectLimit: FREE_PROJECT_LIMIT,
    nearProjectLimitUsers: nearLimitUsers,
    exportFormatBreakdown: await getExportFormatBreakdown(),
    bulkGenerateSessions30d: await getBulkGenerateCount30d(),
  };
}

export async function getExportFormatBreakdown() {
  const rows = await getDb()
    .select({
      format: schema.analyticsEvents.action,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.analyticsEvents)
    .where(and(
      eq(schema.analyticsEvents.eventType, "download"),
      sql`${schema.analyticsEvents.action} IS NOT NULL`,
    ))
    .groupBy(schema.analyticsEvents.action)
    .orderBy(desc(sql`count(*)`));
  return rows.filter((r: { format: string | null; count: number }) => r.format).map((r: { format: string; count: number }) => ({ format: r.format, count: r.count }));
}

export async function getBulkGenerateCount30d() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.analyticsEvents)
    .where(and(
      eq(schema.analyticsEvents.eventType, "bulk_generate"),
      gte(schema.analyticsEvents.createdAt, cutoff),
    ));
  return row?.count ?? 0;
}
