import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import * as schema from "@shared/schema";
import { hashIp, maskIp, buildIntegrityHash, getAuditSeverity } from "../auditUtils";
import { getDb } from "./db";

export async function logAuditEvent(data: {
  actorId?: number | null;
  actorRole: string;
  actorEmail?: string | null;
  actorName?: string | null;
  action: string;
  targetType: string;
  targetId?: number | null;
  meta?: Record<string, unknown>;
  ipAddress?: string | null;
  sessionId?: string | null;
  userAgent?: string | null;
  severity?: string;
  pagePath?: string | null;
  referrer?: string | null;
  beforeValue?: string | null;
  afterValue?: string | null;
}): Promise<void> {
  const rawIp = data.ipAddress ?? null;
  const ipHash = hashIp(rawIp);
  const maskedIp = maskIp(rawIp);
  const severity = data.severity ?? getAuditSeverity(data.action);
  const integrityPayload = {
    action: data.action,
    actorId: data.actorId ?? null,
    targetType: data.targetType,
    targetId: data.targetId ?? null,
    severity,
    at: new Date().toISOString(),
  };
  await getDb().insert(schema.adminAuditLog).values({
    actorId: data.actorId ?? null,
    actorRole: data.actorRole,
    actorEmail: data.actorEmail ?? null,
    actorName: data.actorName ?? null,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId ?? null,
    meta: data.meta ? JSON.stringify(data.meta) : null,
    ipAddress: maskedIp,
    ipHash,
    sessionId: data.sessionId ?? null,
    userAgent: data.userAgent?.slice(0, 512) ?? null,
    severity,
    pagePath: data.pagePath?.slice(0, 256) ?? null,
    referrer: data.referrer?.slice(0, 512) ?? null,
    beforeValue: data.beforeValue ?? null,
    afterValue: data.afterValue ?? null,
    integrityHash: buildIntegrityHash(integrityPayload),
  });
}

export async function getAuditLogs(filters: {
  limit?: number;
  offset?: number;
  search?: string;
  action?: string;
  actorRole?: string;
  severity?: string;
  from?: string;
  to?: string;
  ipHash?: string;
} = {}) {
  const conditions = [];
  if (filters.action && filters.action !== "all") {
    conditions.push(eq(schema.adminAuditLog.action, filters.action));
  }
  if (filters.actorRole && filters.actorRole !== "all") {
    conditions.push(eq(schema.adminAuditLog.actorRole, filters.actorRole));
  }
  if (filters.severity && filters.severity !== "all") {
    conditions.push(eq(schema.adminAuditLog.severity, filters.severity));
  }
  if (filters.from) {
    conditions.push(gte(schema.adminAuditLog.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(schema.adminAuditLog.createdAt, new Date(filters.to)));
  }
  if (filters.ipHash?.trim()) {
    conditions.push(eq(schema.adminAuditLog.ipHash, filters.ipHash.trim()));
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      sql`(
        ${schema.adminAuditLog.action} ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name}, '') ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.actorEmail}, ${schema.users.email}, '') ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.meta}, '') ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.pagePath}, '') ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.sessionId}, '') ILIKE ${q}
      )`,
    );
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 100, 500);
  const offset = filters.offset ?? 0;

  return getDb()
    .select({
      id: schema.adminAuditLog.id,
      actorId: schema.adminAuditLog.actorId,
      actorRole: schema.adminAuditLog.actorRole,
      actorEmail: schema.adminAuditLog.actorEmail,
      actorName: sql<string | null>`coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name})`,
      action: schema.adminAuditLog.action,
      targetType: schema.adminAuditLog.targetType,
      targetId: schema.adminAuditLog.targetId,
      meta: schema.adminAuditLog.meta,
      ipAddress: schema.adminAuditLog.ipAddress,
      ipHash: schema.adminAuditLog.ipHash,
      sessionId: schema.adminAuditLog.sessionId,
      userAgent: schema.adminAuditLog.userAgent,
      severity: schema.adminAuditLog.severity,
      pagePath: schema.adminAuditLog.pagePath,
      referrer: schema.adminAuditLog.referrer,
      beforeValue: schema.adminAuditLog.beforeValue,
      afterValue: schema.adminAuditLog.afterValue,
      integrityHash: schema.adminAuditLog.integrityHash,
      createdAt: schema.adminAuditLog.createdAt,
    })
    .from(schema.adminAuditLog)
    .leftJoin(schema.users, eq(schema.adminAuditLog.actorId, schema.users.id))
    .where(whereClause)
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getAuditLogCount(filters: {
  search?: string;
  action?: string;
  actorRole?: string;
  severity?: string;
  from?: string;
  to?: string;
  ipHash?: string;
} = {}): Promise<number> {
  const conditions = [];
  if (filters.action && filters.action !== "all") conditions.push(eq(schema.adminAuditLog.action, filters.action));
  if (filters.actorRole && filters.actorRole !== "all") conditions.push(eq(schema.adminAuditLog.actorRole, filters.actorRole));
  if (filters.severity && filters.severity !== "all") conditions.push(eq(schema.adminAuditLog.severity, filters.severity));
  if (filters.from) conditions.push(gte(schema.adminAuditLog.createdAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(schema.adminAuditLog.createdAt, new Date(filters.to)));
  if (filters.ipHash?.trim()) conditions.push(eq(schema.adminAuditLog.ipHash, filters.ipHash.trim()));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(sql`(
      ${schema.adminAuditLog.action} ILIKE ${q}
      OR coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name}, '') ILIKE ${q}
      OR coalesce(${schema.adminAuditLog.actorEmail}, ${schema.users.email}, '') ILIKE ${q}
      OR coalesce(${schema.adminAuditLog.meta}, '') ILIKE ${q}
    )`);
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.adminAuditLog)
    .leftJoin(schema.users, eq(schema.adminAuditLog.actorId, schema.users.id))
    .where(whereClause);
  return row?.count ?? 0;
}

export async function getAuditLogById(id: number) {
  const [row] = await getDb()
    .select({
      id: schema.adminAuditLog.id,
      actorId: schema.adminAuditLog.actorId,
      actorRole: schema.adminAuditLog.actorRole,
      actorEmail: schema.adminAuditLog.actorEmail,
      actorName: sql<string | null>`coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name})`,
      action: schema.adminAuditLog.action,
      targetType: schema.adminAuditLog.targetType,
      targetId: schema.adminAuditLog.targetId,
      meta: schema.adminAuditLog.meta,
      ipAddress: schema.adminAuditLog.ipAddress,
      ipHash: schema.adminAuditLog.ipHash,
      sessionId: schema.adminAuditLog.sessionId,
      userAgent: schema.adminAuditLog.userAgent,
      severity: schema.adminAuditLog.severity,
      pagePath: schema.adminAuditLog.pagePath,
      referrer: schema.adminAuditLog.referrer,
      beforeValue: schema.adminAuditLog.beforeValue,
      afterValue: schema.adminAuditLog.afterValue,
      integrityHash: schema.adminAuditLog.integrityHash,
      createdAt: schema.adminAuditLog.createdAt,
    })
    .from(schema.adminAuditLog)
    .leftJoin(schema.users, eq(schema.adminAuditLog.actorId, schema.users.id))
    .where(eq(schema.adminAuditLog.id, id))
    .limit(1);
  return row;
}

export async function purgeOldAuditLogs(retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await getDb().delete(schema.adminAuditLog).where(lte(schema.adminAuditLog.createdAt, cutoff));
}
