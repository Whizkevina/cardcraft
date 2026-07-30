import crypto from "crypto";
import { eq, desc, sql, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { Project, InsertProject } from "@shared/schema";
import { getDb } from "./db";

export async function getProject(id: number): Promise<Project | undefined> { const [p] = await getDb().select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1); return p; }
export async function getProjectByShareToken(token: string): Promise<Project | undefined> {
  const [p] = await getDb().select().from(schema.projects).where(eq(schema.projects.shareToken, token)).limit(1);
  return p;
}
export async function getProjectsByUser(userId: number): Promise<Project[]> { return getDb().select().from(schema.projects).where(eq(schema.projects.userId, userId)).orderBy(desc(schema.projects.updatedAt)); }
export async function createProject(data: InsertProject): Promise<Project> {
  const shareToken = crypto.randomBytes(24).toString("hex");
  const [p] = await getDb().insert(schema.projects).values({ ...data, shareToken }).returning();
  return p;
}
export async function updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> { const [p] = await getDb().update(schema.projects).set(data).where(eq(schema.projects.id, id)).returning(); return p; }
export async function deleteProject(id: number): Promise<void> { await getDb().delete(schema.projects).where(eq(schema.projects.id, id)); }
export async function duplicateProject(id: number, userId: number): Promise<Project | undefined> {
  const existing = await getProject(id);
  if (!existing || existing.userId !== userId) return undefined;
  const shareToken = crypto.randomBytes(24).toString("hex");
  const [d] = await getDb().insert(schema.projects).values({
    userId,
    templateId: existing.templateId,
    title: `${existing.title} (Copy)`,
    designJson: existing.designJson,
    exportSettings: existing.exportSettings,
    thumbnail: existing.thumbnail,
    shareToken,
    shareEnabled: false,
  }).returning();
  return d;
}
export async function enableProjectShare(id: number, userId: number, shareImage?: string | null): Promise<Project | undefined> {
  const existing = await getProject(id);
  if (!existing || existing.userId !== userId) return undefined;
  const shareToken = existing.shareToken || crypto.randomBytes(24).toString("hex");
  const patch: { shareEnabled: boolean; shareToken: string; shareImage?: string } = {
    shareEnabled: true,
    shareToken,
  };
  if (shareImage) patch.shareImage = shareImage;
  const [p] = await getDb().update(schema.projects).set(patch).where(eq(schema.projects.id, id)).returning();
  return p;
}
export async function renameProject(id: number, userId: number, title: string): Promise<Project | undefined> { const existing = await getProject(id); if (!existing || existing.userId !== userId) return undefined; const [p] = await getDb().update(schema.projects).set({ title }).where(eq(schema.projects.id, id)).returning(); return p; }

export async function getProjectStatsByUser(): Promise<Record<number, { projectCount: number; sharedCount: number }>> {
  const rows = await getDb()
    .select({
      userId: schema.projects.userId,
      projectCount: sql<number>`count(*)::int`,
      sharedCount: sql<number>`coalesce(sum(case when share_enabled then 1 else 0 end), 0)::int`,
    })
    .from(schema.projects)
    .groupBy(schema.projects.userId);
  const map: Record<number, { projectCount: number; sharedCount: number }> = {};
  for (const row of rows) {
    map[row.userId] = { projectCount: row.projectCount, sharedCount: row.sharedCount };
  }
  return map;
}

export async function getAdminProjects(filters: { search?: string; sharedOnly?: boolean; limit?: number } = {}) {
  const conditions = [];
  if (filters.sharedOnly) conditions.push(eq(schema.projects.shareEnabled, true));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(sql`(
      ${schema.projects.title} ILIKE ${q}
      OR ${schema.users.name} ILIKE ${q}
      OR ${schema.users.email} ILIKE ${q}
    )`);
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  return getDb()
    .select({
      id: schema.projects.id,
      userId: schema.projects.userId,
      userName: schema.users.name,
      userEmail: schema.users.email,
      templateId: schema.projects.templateId,
      templateTitle: schema.templates.title,
      title: schema.projects.title,
      shareEnabled: schema.projects.shareEnabled,
      shareToken: schema.projects.shareToken,
      updatedAt: schema.projects.updatedAt,
      createdAt: schema.projects.createdAt,
    })
    .from(schema.projects)
    .innerJoin(schema.users, eq(schema.projects.userId, schema.users.id))
    .leftJoin(schema.templates, eq(schema.projects.templateId, schema.templates.id))
    .where(whereClause)
    .orderBy(desc(schema.projects.updatedAt))
    .limit(filters.limit ?? 200);
}

export async function getAdminUserProjects(userId: number) {
  return getDb()
    .select({
      id: schema.projects.id,
      title: schema.projects.title,
      templateTitle: schema.templates.title,
      shareEnabled: schema.projects.shareEnabled,
      shareToken: schema.projects.shareToken,
      updatedAt: schema.projects.updatedAt,
      createdAt: schema.projects.createdAt,
    })
    .from(schema.projects)
    .leftJoin(schema.templates, eq(schema.projects.templateId, schema.templates.id))
    .where(eq(schema.projects.userId, userId))
    .orderBy(desc(schema.projects.updatedAt));
}

export async function adminRevokeProjectShare(id: number): Promise<Project | undefined> {
  const [p] = await getDb().update(schema.projects).set({ shareEnabled: false }).where(eq(schema.projects.id, id)).returning();
  return p;
}
