import { eq, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { Template, InsertTemplate } from "@shared/schema";
import { getDb } from "./db";

export async function getAllTemplates(): Promise<Template[]> { return getDb().select().from(schema.templates).orderBy(desc(schema.templates.id)); }
export async function getTemplatesCount(): Promise<number> {
  const result = await getDb().select({ count: sql<number>`COUNT(*)` }).from(schema.templates);
  const count = result[0]?.count;
  return typeof count === 'string' ? parseInt(count, 10) : (count || 0) as number;
}
export async function getPublishedTemplates(): Promise<Template[]> { return getDb().select().from(schema.templates).where(eq(schema.templates.status, "published")).orderBy(desc(schema.templates.id)); }
export async function getTemplate(id: number): Promise<Template | undefined> { const [t] = await getDb().select().from(schema.templates).where(eq(schema.templates.id, id)).limit(1); return t; }
export async function createTemplate(data: InsertTemplate): Promise<Template> { const [t] = await getDb().insert(schema.templates).values(data).returning(); return t; }
export async function updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> { const [t] = await getDb().update(schema.templates).set(data).where(eq(schema.templates.id, id)).returning(); return t; }
export async function deleteTemplate(id: number): Promise<void> { await getDb().delete(schema.templates).where(eq(schema.templates.id, id)); }
export async function incrementTemplateUsage(id: number): Promise<void> { await getDb().update(schema.templates).set({ usageCount: sql`usage_count + 1` }).where(eq(schema.templates.id, id)); }
